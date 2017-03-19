import fs from 'fs';
import tokenize from './tokenize';
import parse from './parse';

describe('parse', () => {
  it('should parse generics', () => {
    parse(tokenize('struct Test<A, B, C> {}'));
    parse(tokenize('struct Test<A> {}'));
    expect(() => parse(tokenize('struct Test<A,> {}'))).toThrow();
  });
  it('should parse test code', () => {
    parse(tokenize(fs.readFileSync('./test.jsbyte', 'utf-8')));
  });
});
