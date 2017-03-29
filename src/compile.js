import DataBuffer from './dataBuffer';
import createNamespace from './namespace';
import getIdentifier from './util/getIdentifier';

export default function compile(ast, namespace = createNamespace()) {
  // Create compiler state.
  let state = { ast, namespace };
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

function resolveBlock(state, name, generics, astFallback) {
  const { ast, namespace } = state;
  let key = getIdentifier({ name }, generics);
  let astBlock = ast[key] || astFallback;
  // If 'generics' is provided and the astBlock is missing, compile against
  // the generics template.
  if (generics != null && astBlock == null) {
    let template = resolveBlock(state,
      getIdentifier({ name }, generics.map(() => '_')));
    if (template == null) throw new Error(`${key} is not defined`);
    return template(generics, namespace);
  } else if (astBlock == null && namespace[key] == null) {
    throw new Error(`${key} is not defined`);
  }
  // If the block is already compiled, skip it.
  if (namespace[key] != null) return namespace[key];
  // 'Lock' the output object to avoid stack overflow. Any other functions
  // meeting this 'false' will use proxy objects instead.
  namespace[key] = false;
  // If 'generics' is not defined and the block uses generics, return a
  // function that compiles the block using generics.
  if (generics == null && astBlock.generics != null) {
    namespace[key] = (generics) => resolveBlock(state, astBlock.name,
      generics, astBlock);
    return namespace[key];
  }
  // Otherwise, just compile it!
  if (astBlock.type === 'struct') {
    namespace[key] = compileStruct(state, astBlock, generics);
  }
}

function compileStruct(state, ast, generics) {
  let sizeCode = ['var size = 0;'];
  let encodeCode = [];
  let decodeCode = [];
  // TODO We can directly reference functions; but since that's complicated,
  // just use indirect reference now
  function writeEntry(key, value) {
    if (value.const) {
      let type = value.type;
      let name = type.generic ? generics[type.name] : type.name;
      let typeName = getIdentifier({ name }, type.generics);
      let ref = `namespace['${typeName}']`;
      // Stringify the value using JSON encoder.
      let valueStr = JSON.stringify(value.value);
      sizeCode.push(`size += ${ref}.size(${valueStr});`);
      encodeCode.push(`${ref}.encode(${valueStr}, dataView);`);
      decodeCode.push(`assert(${valueStr}, ${ref}.decode(dataView));`);
    } else {
      let name = value.generic ? generics[value.name].name : value.name;
      resolveBlock(state, name, value.generics);
      // When we use direct reference, this will be changed to use output of
      // resolveBlock function.
      let typeName = getIdentifier({ name }, value.generics);
      let ref = `namespace['${typeName}']`;
      sizeCode.push(`size += ${ref}.size(value[${key}]);`);
      encodeCode.push(`${ref}.encode(value[${key}], dataView);`);
      decodeCode.push(`value[${key}] = ${ref}.decode(dataView);`);
    }
  }
  switch (ast.subType) {
    case 'object': {
      decodeCode.push('var output = {};');
      ast.keys.forEach(key => {
        // If key is an object, process it separately since it is a const
        // value, not an actual value.
        if (typeof key === 'object' && key.const) {
          writeEntry(null, key);
        } else {
          writeEntry(`'${key}'`, ast.values[key]);
        }
      });
      sizeCode.push('return size;');
      decodeCode.push('return output;');
      break;
    }
    case 'array': {
      decodeCode.push('var output = [];');
      let pos = 0;
      ast.keys.forEach(key => {
        if (key.const) {
          writeEntry(null, key);
        } else {
          writeEntry(pos++, key);
        }
      });
      sizeCode.push('return size;');
      decodeCode.push('return output;');
      break;
    }
    case 'empty': {
      sizeCode.push('return 0;');
      decodeCode.push('return {};');
      break;
    }
  }
  // This is used by compiled function; disable eslint for this line
  const namespace = state.namespace; // eslint-disable-line
  console.log(sizeCode.join('\n'));
  console.log(encodeCode.join('\n'));
  console.log(decodeCode.join('\n'));
  let output = {};
  output.size = new Function('value', sizeCode.join('\n'));
  output.encode = new Function('value', 'dataView', encodeCode.join('\n'));
  output.decode = new Function('dataView', decodeCode.join('\n'));
  return output;
}
