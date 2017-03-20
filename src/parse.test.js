import fs from 'fs';
import tokenize from './tokenize';
import parse from './parse';

describe('parse', () => {
  it('should parse tuple structs', () => {
    parse(tokenize('struct Test(i32, u32, u32);'));
    parse(tokenize('struct Test(i32);'));
  });
  it('should parse structs', () => {
    parse(tokenize('struct Test { a: i32, b: u32, c: Test<u32> }'));
    parse(tokenize('struct Test { a: i32, }'));
    parse(tokenize('struct Test {}'));
  });
  it('should parse generics', () => {
    parse(tokenize('struct Test<A, B, C> {}'));
    parse(tokenize('struct Test<A> {}'));
    expect(() => parse(tokenize('struct Test<A,> {}'))).toThrow();
  });
  it('should parse test code', () => {
    parse(tokenize(fs.readFileSync('./test.jsbyte', 'utf-8')));
  });
});
