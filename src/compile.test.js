import tokenize from './tokenize';
import parse from './parse';
import compile from './compile';

describe('compile', () => {
  it('should compile regular structs', () => {
    compile(parse(tokenize('struct Test { a: i32, b: u32 }')));
  });
});
