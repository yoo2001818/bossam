import tokenize from './tokenize';
import parse, { parseKeyword } from './parse';
import compile, { resolveType } from './compile';
import createNamespace from './namespace';

export default function compileFromCode(code, namespace = createNamespace()) {
  // Add resolveType / resolve into the namespace if they don't exist.
  if (namespace.resolveType == null) {
    namespace.resolveType = resolveType.bind(null, namespace);
  }
  if (namespace.resolve == null) {
    namespace.resolve = (typeName) => {
      let keyword = parseKeyword(tokenize(typeName));
      return namespace.resolveType(keyword);
    };
  }
  return compile(parse(tokenize(code)), namespace);
}

export { createNamespace };
