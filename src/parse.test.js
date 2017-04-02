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
    expect(() => parse(tokenize('enum Test {A(i32), B {a: i32}}'))).toThrow();
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
      enum Pos(i8, type) {
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
  it('should parse fixed values', () => {
    parse(tokenize(`
      struct Test {
        "Hello": str<"utf-8">,
        abcd: str,
        0x123: i32,
        efgh: str,
        5353: i16,
        ijkl: str,
      }
    `));
  });
  it('should parse generics', () => {
    parse(tokenize('struct Test<A, B, C> {}'));
    parse(tokenize('struct Test<A> {}'));
    expect(() => parse(tokenize('struct Test<A,> {}'))).toThrow();
  });
  it('should parse generics in enums correctly', () => {
    let namespace = {
      A: {
        name: 'A',
        type: 'struct',
        subType: 'array',
        keys: [{
          name: 0,
          generic: true,
        }],
        enumKey: 0,
      },
      B: {
        name: 'B',
        type: 'struct',
        subType: 'array',
        keys: [{
          name: 1,
          generic: true,
        }],
        enumKey: 1,
      },
      C: {
        name: 'C',
        type: 'struct',
        subType: 'array',
        keys: [{
          name: 2,
          generic: true,
        }],
        enumKey: 2,
      },
    };
    expect(parse(tokenize(`
      enum Test<A, B, C> {
        A(A),
        B(B),
        C(C),
      }
    `))).toEqual({
      'Test<_,_,_>': {
        name: 'Test',
        generics: ['A', 'B', 'C'],
        type: 'enum',
        subType: 'array',
        strategy: 'array',
        typeType: { name: 'u8' },
        namespace,
        entries: [
          [0, 'A'],
          [1, 'B'],
          [2, 'C'],
        ],
      },
    });
  });
  it('should parse test code', () => {
    parse(tokenize(fs.readFileSync('./test.bsm', 'utf-8')));
  });
});
