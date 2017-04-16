import createNamespace from './namespace';
import getIdentifier from './util/getIdentifier';
import CodeGenerator from './codeGenerator';

export default function compile(ast, namespace = createNamespace()) {
  // Create compiler state.
  let state = { ast, namespace };
  state.resolveType = resolveType.bind(null, state);
  state.resolveBlock = resolveBlock.bind(null, state);
  // Resolve each block - all blocks will be compiled then.
  // However, if a circular reference occurs, a stack overflow will happen.
  // It can be resolved by sacrificing some functions to resolve other
  // datatypes using proxy objects instead of direct function references.
  // But such use case won't happen, so I'll do it someday later.
  // TODO Fix stack overflow.
  for (let key in ast) {
    resolveBlock(state, key);
  }
  return namespace;
}

export function assert(expected, received) {
  if (expected !== received) {
    throw new Error(
      `Assertion error: Expected ${expected}, but got ${received}`);
  }
}

function resolveType(state, type, parentGenerics) {
  let resolvedType = type;
  if (type.generic === true) resolvedType = parentGenerics[type.name];
  // If the type is a tuple, Compile it right away.
  if (resolvedType.inline === true) {
    return compileStruct(state, resolvedType, parentGenerics);
  }
  // Same for arrays.
  if (resolvedType.array === true) {
    return compileArray(state, resolvedType, parentGenerics);
  }
  if (Array.isArray(resolvedType)) {
    // Namespaces are hard to handle. Nevertheless, we need to implement them
    // to implement enums.
    // If an array is provided, we need to resolve AST / namespace in order,
    // returning valid object with that name.
    // resolveBlock should be able to distinguish local scope and
    // global scope, allowing to use global namespace if local namespace
    // doesn't have the requested entry.
    return resolvedType.reduce((prev, typeVal, i) => {
      // Start from root; narrow down to right entry. Repeat until the end.
      // parentGenerics should be same all the time.
      let resolvedTypeVal = typeVal;
      if (typeVal.generic === true) {
        resolvedTypeVal = parentGenerics[typeVal.name];
      }
      let astKey = getIdentifier({ name: resolvedTypeVal.name },
        resolvedTypeVal.generics && resolvedTypeVal.generics.map(() => '_'));
      let block = resolveBlock(prev, resolvedTypeVal.name,
        resolvedTypeVal.generics, parentGenerics);
      if (i === resolvedType.length - 1) {
        // Done! Directly return the block.
        return block;
      } else {
        // Descend...
        return {
          // Store 'root' object to use in compiling mode; compilers have to
          // refer root namespace directly.
          root: prev.root || prev,
          namespace: block.namespace,
          ast: prev.ast[astKey],
        };
      }
    }, state);
  }
  return resolveBlock(state, resolvedType.name,
    resolvedType.generics, parentGenerics);
}

function resolveBlock(state, name, generics, parentGenerics) {
  const { ast, namespace } = state;
  let genericsData = generics;
  if (generics != null && parentGenerics != null) {
    genericsData = generics.map(v => v.generic ? parentGenerics[v.name] : v);
  }
  let key = getIdentifier({ name }, genericsData);
  let astBlock = ast[key];
  // If 'generics' is provided and the astBlock is missing, compile against
  // the generics template.
  if (generics != null && astBlock == null) {
    let template = resolveBlock(state,
      getIdentifier({ name }, generics.map(() => '_')));
    if (template == null) throw new Error(`${key} is not defined`);
    // Swap the astBlock to the template and continue.
    astBlock = template;
  } else if (astBlock == null && namespace[key] == null) {
    throw new Error(`${key} is not defined`);
  }
  // If the block is already compiled, skip it.
  if (namespace[key] != null) return namespace[key];
  // 'Lock' the output object to avoid stack overflow. Any other functions
  // meeting this locked object will use proxy objects instead.
  namespace[key] = { name: key, locked: true, namespace: {} };
  // If 'generics' is not defined and the block uses generics, return a
  // function that compiles the block using generics.
  if (generics == null && astBlock.generics != null) {
    namespace[key] = (state, generics, namespace) => {
      // Since the generics variable is already processed by parentGenerics,
      // we can just call compileBlock with correct generics. Done!
      return compileBlock(state, astBlock, generics, namespace);
    };
    namespace[key].ast = astBlock;
    return namespace[key];
  }
  // Otherwise, just compile it!
  let result = compileBlock(state.root || state, astBlock, genericsData,
    namespace[key].namespace);
  result.name = key;
  result.ast = astBlock.ast || astBlock;
  // If the AST has namespace definition, move previous namespace definition
  // in locked object onto the result object.
  if (astBlock.namespace != null) result.namespace = namespace[key].namespace;
  namespace[key] = result;
  return result;
}

// Assume that everything is compiled at this moment.
function compileBlock(state, astBlock, generics, namespace) {
  if (typeof astBlock === 'function') {
    return astBlock(state, generics, namespace);
  }
  if (astBlock.type === 'struct') {
    return compileStruct(state, astBlock, generics);
  }
  if (astBlock.type === 'enum') {
    return compileEnum(state, astBlock, generics, namespace);
  }
  throw new Error('Unknown type ' + astBlock.type);
}

function compileArray(state, ast, generics) {
  // Just a downgraded version of Array<T>.
  let type = resolveType(state, ast.type, generics);
  let codeGen = new CodeGenerator(state);
  let u8, nullFieldName;
  let maxSize = 0;
  let nullable = ast.type.nullable;
  if (nullable) {
    // If the type is nullable, we have to use separate nullable fields to
    // spare some bits
    u8 = resolveType(state, { name: 'u8' });
    nullFieldName = 'nullCheck' + (state.namespace._refs++);
    codeGen.push(`var ${nullFieldName} = 0;`);
    maxSize += Math.ceil(ast.size / 8);
  }
  codeGen.pushDecode(`#value# = new Array(${ast.size});`);
  codeGen.push(`for (var i = 0; i < ${ast.size}; ++i) {`);
  if (nullable) {
    // To match with decoding order, encoder must look ahead of the array
    // and save flags beforehand.
    codeGen.push('if (i % 8 === 0) {');
    codeGen.pushEncode(`${nullFieldName} = 0;`);
    codeGen.pushEncode(`var maxIdx = Math.min(8, ${ast.size} - i);`);
    codeGen.pushEncode('for (var j = 0; j < maxIdx; ++j) {');
    // Check flag / insert flag.
    codeGen.pushEncode(
      `${nullFieldName} |= #value#[i + j] == null ? 0 : (1 << j);`);
    codeGen.pushEncode('}');
    codeGen.pushType(nullFieldName, u8);
    codeGen.push('}');
    codeGen.push(`if (${nullFieldName} & (1 << (i % 8)) !== 0) {`);
  }
  codeGen.pushType('#value#[i]', type);
  if (nullable) {
    codeGen.pushDecode('} else {');
    codeGen.pushDecode('#value#[i] = null;');
    codeGen.push('}');
  }
  codeGen.push('}');
  maxSize += type.maxSize * ast.size;
  return codeGen.compile(maxSize);
}

function compileStruct(state, ast, generics) {
  let codeGen = new CodeGenerator(state);
  let nullableCount = 0;
  let nullFieldName = 'nullCheck' + (state.namespace._refs++);
  let refFieldName = 'ref' + (state.namespace._refs++);
  let refId = 0;
  let refs = {};
  let maxSize = 0;
  function writeRefEncode(key) {
    let name = refFieldName + '_' + (refId++);
    refs[key] = name;
    codeGen.pushEncode(`var ${name} = #value#[${key}];`);
    codeGen.pushDecode(`var ${name};`);
  }
  function writeRefDecode(key) {
    let name = refs[key];
    codeGen.pushDecode(`#value#[${key}] = ${name};`);
  }
  function writeNullable(key, value) {
    if (value.nullable) {
      let bytePos = (nullableCount / 8) | 0;
      let fieldName = nullFieldName + '_' + bytePos;
      if (nullableCount % 8 === 0) {
        let u8 = resolveType(state, { name: 'u8' });
        codeGen.pushTypeDecode(fieldName, u8, true);
        if (bytePos > 0) {
          codeGen.pushTypeEncode(nullFieldName + '_' + (bytePos - 1), u8);
        }
        maxSize += 1;
        codeGen.pushEncode(`var ${fieldName} = 0;`);
      }
      let shiftPos = 1 << (nullableCount % 8);
      codeGen.pushEncode(
        `${fieldName} |= ${refs[key]} != null ? ${shiftPos} : 0;`);
      nullableCount++;
    }
  }
  function finalizeNullable() {
    if (nullableCount > 0 && (nullableCount % 8) > 0) {
      let bytePos = (nullableCount / 8) | 0;
      let u8 = resolveType(state, { name: 'u8' });
      codeGen.pushTypeEncode(nullFieldName + '_' + bytePos, u8);
      maxSize += 1;
    }
    nullableCount = 0;
  }
  function writeEntry(key, value) {
    if (value.jsConst) {
      codeGen.pushDecode(`${refs[key]} = ${JSON.stringify(value.value)};`);
    } else if (value.const) {
      let type = resolveType(state, value.type, generics);
      let valueStr = JSON.stringify(value.value);
      codeGen.pushTypeEncode(valueStr, type);
      codeGen.pushTypeDecode('assertValue', type, true);
      // TODO Actually assert the value
      // decodeCode.push(`assert(${valueStr}, ${ref}.decode(dataView));`);
    } else {
      let type = resolveType(state, value, generics);
      maxSize += type.maxSize;
      // If the type is nullable, read a byte to check if the data exists.
      if (value.nullable) {
        let bytePos = (nullableCount / 8) | 0;
        let flagName = nullFieldName + '_' + bytePos;
        let shiftPos = 1 << (nullableCount % 8);
        codeGen.push(`if ((${flagName} & ${shiftPos}) !== 0) {`);
        codeGen.pushType(`${refs[key]}`, type);
        codeGen.pushDecode('} else {');
        codeGen.pushDecode(`${refs[key]} = null;`);
        codeGen.push('}');
        nullableCount++;
      } else {
        codeGen.pushType(`${refs[key]}`, type);
      }
    }
  }
  switch (ast.subType) {
    case 'object': {
      codeGen.pushDecode('#value# = {};');
      ast.keys.forEach(key => {
        writeRefEncode(`"${key}"`);
      });
      ast.keys.forEach(key => {
        if (typeof key === 'string') {
          writeNullable(`"${key}"`, ast.values[key]);
        }
      });
      finalizeNullable();
      ast.keys.forEach(key => {
        // If key is an object, process it separately since it is a const
        // value, not an actual value.
        if (typeof key === 'object' && key.const) {
          writeEntry(null, key);
        } else {
          writeEntry(`"${key}"`, ast.values[key]);
        }
      });
      ast.keys.forEach(key => {
        writeRefDecode(`"${key}"`);
      });
      break;
    }
    case 'array': {
      codeGen.pushDecode('#value# = [];');
      let pos = 0;
      ast.keys.forEach(() => {
        writeRefEncode(pos++);
      });
      pos = 0;
      ast.keys.forEach(key => {
        writeNullable(pos++, key);
      });
      finalizeNullable();
      pos = 0;
      ast.keys.forEach(key => {
        if (key.const) {
          writeEntry(null, key);
        } else {
          writeEntry(pos++, key);
        }
      });
      pos = 0;
      ast.keys.forEach(() => {
        writeRefDecode(pos++);
      });
      break;
    }
    case 'empty': {
      codeGen.pushDecode('#value# = {};');
      break;
    }
  }
  return codeGen.compile(maxSize);
}

function compileEnum(state, ast, generics, namespace) {
  // Create a code generator, then loop for every entry in the entries list,
  // compile them into switch loop.
  let codeGen = new CodeGenerator(state);
  let typeRef = JSON.stringify(ast.typeTarget);
  let maxSize = 0;
  let typeMaxSize = 0;
  if (ast.subType === 'array') typeRef = '0';
  // We have to build encode / decode routine separately - they can't be shared.
  // TODO Support nulls? Although it's not necessary at all, but it'd be good
  // if we can support it.
  // Read the type object.
  let varName = 'enumType' + (state.namespace._refs++);
  let varOut = 'enumData' + (state.namespace._refs++);
  let typeType = resolveType(state, ast.typeType, generics);
  let localState = { root: state, namespace, ast: ast.namespace };
  codeGen.push(`var ${varOut};`);
  codeGen.pushEncode(`${varOut} = #value#;`);
  codeGen.pushTypeDecode(varName, typeType, true);
  maxSize += typeType.maxSize;
  codeGen.pushEncode(`switch (#value#[${typeRef}]) {`);
  codeGen.pushDecode(`switch (${varName}) {`);
  // Now, insert case clauses using for loop.
  ast.entries.forEach(([key, valueName]) => {
    let keyStr = JSON.stringify(key);
    let valueNameStr = JSON.stringify(valueName);
    let type = resolveType(localState, { name: valueName }, generics);
    if (ast.subType === 'array' && type.ast.keys[0].jsConst) {
      valueNameStr = JSON.stringify(type.ast.keys[0].value);
    } else if (type.ast.values != null &&
      type.ast.values[ast.typeTarget] != null
    ) {
      valueNameStr = JSON.stringify(type.ast.values[ast.typeTarget].value);
    }
    codeGen.pushEncode(`case ${valueNameStr}:`);
    codeGen.pushDecode(`case ${keyStr}:`);
    // Slice header if const is not specified at front.
    if (ast.subType === 'array' && !type.ast.keys[0].jsConst) {
      codeGen.pushEncode(`${varOut} = #value#.slice(0);`);
    }
    // Encode the type; this is already done in decoder.
    codeGen.pushTypeEncode(keyStr, typeType);
    // Now, encode / decode the value.
    // If the value is array, we have to increment each key. This is
    // not possible yet, so we'll just use temporary variable to store the
    // result, then concat with the old array.
    codeGen.pushType(varOut, type);
    if (typeMaxSize < type.maxSize) {
      typeMaxSize = type.maxSize;
    }
    if (ast.subType === 'array') {
      if (!type.ast.keys[0].jsConst) {
        codeGen.pushDecode(`${varOut}.unshift(${valueNameStr});`);
      }
    } else if (type.ast.values == null ||
      type.ast.values[ast.typeTarget] == null
    ) {
      codeGen.pushDecode(`${varOut}[${typeRef}] = ${valueNameStr};`);
    }
    codeGen.push('break;');
  });
  codeGen.push('}');
  codeGen.pushDecode(`#value# = ${varOut};`);
  maxSize += typeMaxSize;
  return codeGen.compile(maxSize);
}
