import tokenize from './tokenize';
import parse from './parse';
import compile from './compile';

describe('compile', () => {
  it('should compile regular structs', () => {
    compile(parse(tokenize('struct Test { a: i32, b: u32 }')));
  });
  it('should compile structs with constant value', () => {
    compile(parse(tokenize(`
      struct Test {
        a: i32,
        0xABCDEF: u32,
        b: i32,
        "Hello!": String,
      }
    `)));
  });
});
