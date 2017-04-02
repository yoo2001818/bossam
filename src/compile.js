import DataBuffer from './dataBuffer';
import createNamespace from './namespace';
import getIdentifier from './util/getIdentifier';
import CodeGenerator from './util/codeGenerator';

export default function compile(ast, namespace = createNamespace()) {
  console.log(JSON.stringify(ast, null, 2));
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
}

export function assert(expected, received) {
  if (expected !== received) {
    throw new Error(
      `Assertion error: Expected ${expected}, but got ${received}`);
  }
}

function resolveType(state, type, parentGenerics) {
  if (Array.isArray(type)) {
    // Namespaces are hard to handle. Nevertheless, we need to implement them
    // to implement enums.
    // If an array is provided, we need to resolve AST / namespace in order,
    // returning valid object with that name.
    // Thus, we need to refactor the old code to use returned object itself,
    // not the key.
    // Also, resolveBlock should be able to distinguish local scope and
    // global scope, allowing to use global namespace if local namespace
    // doesn't have the requested entry.
    throw new Error('Not implemented yet');
  }
  let resolvedType = type;
  if (type.generic === true) resolvedType = parentGenerics[type.name];
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
    let templateKey = resolveBlock(state,
      getIdentifier({ name }, generics.map(() => '_')));
    let template = namespace[templateKey];
    if (template == null) throw new Error(`${key} is not defined`);
    namespace[key] = template(genericsData, state);
    return key;
  } else if (astBlock == null && namespace[key] == null) {
    throw new Error(`${key} is not defined`);
  }
  // If the block is already compiled, skip it.
  if (namespace[key] != null) return key;
  // 'Lock' the output object to avoid stack overflow. Any other functions
  // meeting this 'false' will use proxy objects instead.
  namespace[key] = false;
  // If 'generics' is not defined and the block uses generics, return a
  // function that compiles the block using generics.
  if (generics == null && astBlock.generics != null) {
    namespace[key] = (generics) => {
      // Since the generics variable is already processed by parentGenerics,
      // we can just call compileBlock with correct generics. Done!
      return compileBlock(state, astBlock, generics);
    };
    return key;
  }
  // Otherwise, just compile it!
  namespace[key] = compileBlock(state, astBlock, genericsData);
  return key;
}

// Assume that everything is compiled at this moment.
function compileBlock(state, astBlock, generics) {
  if (astBlock.type === 'struct') {
    return compileStruct(state, astBlock, generics);
  }
  if (astBlock.type === 'enum') {
    // return compileEnum(state, astBlock, generics);
  }
  throw new Error('Unknown type ' + astBlock.type);
}

function compileStruct(state, ast, generics) {
  let codeGen = new CodeGenerator(state);
  // TODO We can directly reference functions; but since that's complicated,
  // just use indirect reference now
  function writeEntry(key, value) {
    if (value.const) {
      let typeName = resolveType(state, value.type, generics);
      let valueStr = JSON.stringify(value.value);
      codeGen.pushTypeEncode(valueStr, typeName);
      codeGen.pushTypeDecode('assertValue', typeName, true);
      // TODO Actually assert the value
      // decodeCode.push(`assert(${valueStr}, ${ref}.decode(dataView));`);
    } else {
      let typeName = resolveType(state, value, generics);
      codeGen.pushType(`#value#[${key}]`, typeName);
    }
  }
  switch (ast.subType) {
    case 'object': {
      codeGen.pushDecode('#value# = {};');
      ast.keys.forEach(key => {
        // If key is an object, process it separately since it is a const
        // value, not an actual value.
        if (typeof key === 'object' && key.const) {
          writeEntry(null, key);
        } else {
          writeEntry(`'${key}'`, ast.values[key]);
        }
      });
      break;
    }
    case 'array': {
      codeGen.pushDecode('#value# = [];');
      let pos = 0;
      ast.keys.forEach(key => {
        if (key.const) {
          writeEntry(null, key);
        } else {
          writeEntry(pos++, key);
        }
      });
      break;
    }
    case 'empty': {
      codeGen.pushDecode('#value# = {};');
      break;
    }
  }
  return codeGen.compile();
}
