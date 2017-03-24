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
  it('should parse enums', () => {
    parse(tokenize('enum Test { Hello, World, This, }'));
    parse(tokenize('enum Test(i32) { Hello, World, This, }'));
    parse(tokenize('enum Test(i32) { 0 => Hello, 1 => World, 32 => This }'));
    parse(tokenize(`
      enum Test {
        Hello(i32, u32, u32),
        Gaa,
        Goo(str),
      }
    `));
    parse(tokenize(`
      enum Test(str) {
        "baa" => Hello,
        "boo" => World,
        "abc" => This,
      }
    `));
    parse(tokenize(`
      enum Pos(type) {
        TwoDimension {
          x: i32,
          y: i32,
        },
        ThreeDimension {
          x: i32,
          y: i32,
          z: i32,
        },
      }
    `));
  });
  it('should parse generics', () => {
    parse(tokenize('struct Test<A, B, C> {}'));
    parse(tokenize('struct Test<A> {}'));
    expect(() => parse(tokenize('struct Test<A,> {}'))).toThrow();
    parse(tokenize('enum Test<A, B, C> {A, B, C,}'));
  });
  it('should parse test code', () => {
    parse(tokenize(fs.readFileSync('./test.bsm', 'utf-8')));
  });
});
