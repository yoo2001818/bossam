import DataBuffer from './dataBuffer';
import createNamespace from './namespace';
import getIdentifier from './util/getIdentifier';

export default function compile(ast, namespace = createNamespace()) {
  // Create compiler state.
  let state = { ast, namespace };
  // Resolve each block - all blocks will be compiled then.
  // However, if a circular reference occurs, a stack overflow will happen.
  // It can be resolved by sacrificing some functions to resolve other
  // datatypes using proxy objects instead of direct function references.
  // But such use case won't happen, so I'll do it someday later.
  // TODO Fix stack overflow.
  for (let key in ast) {
    resolveBlock(state, key);
  }
  console.log(namespace);
}

function resolveBlock(state, name, generics) {
  const { ast, namespace } = state;
  let key = getIdentifier({ name }, generics);
  let astBlock = ast[key];
  // If 'generics' is provided and the astBlock is missing, compile against
  // the generics template.
  if (generics != null && astBlock == null) {
    let template = resolveBlock(state,
      getIdentifier({ name }, generics.map(() => '_')));
    if (template == null) throw new Error(`${key} is not defined`);
    return template(generics);
  }
  // If the block is already compiled, skip it.
  if (namespace[key] != null) return namespace[key];
  // 'Lock' the output object to avoid stack overflow. Any other functions
  // meeting this 'false' will use proxy objects instead.
  namespace[key] = false;
  // If 'generics' is not defined and the block uses generics, return a
  // function that compiles the block using generics.
  if (generics == null && astBlock.generics != null) {
    namespace[key] = resolveBlock.bind(null, state, astBlock.name);
    return namespace[key];
  }
  // Otherwise, just compile it!
}

function compileStruct(state, ast, generics) {

}
