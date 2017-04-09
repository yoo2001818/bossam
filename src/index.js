import tokenize from './tokenize';
import parse from './parse';
import compile from './compile';

export default function compileFromCode(code, namespace) {
  return compile(parse(tokenize(code)), namespace);
}
