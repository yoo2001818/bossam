import fs from 'fs';
import tokenize from './tokenize';

describe('tokenize', () => {
  it('should support line comments', () => {
    expect(Array.from(tokenize(`
      // What do you expect?
      // Hello!
    `))).toEqual([]);
  });
  it('should support block comments', () => {
    expect(Array.from(tokenize(`
      /* This is a block comment */
      /* This
         too!
      */
    `))).toEqual([]);
  });
  it('should support numbers', () => {
    expect(Array.from(tokenize('5353'))).toEqual([{
      type: 'number', value: 5353,
    }]);
    expect(Array.from(tokenize('0xdeadcafe'))).toEqual([{
      type: 'number', value: 0xdeadcafe,
    }]);
  });
  it('should support strings', () => {
    expect(Array.from(tokenize('"This says \\"Hello\\" to you"'))).toEqual([{
      type: 'string', value: 'This says "Hello" to you',
    }]);
  });
  it('should parse test code', () => {
    Array.from(tokenize(fs.readFileSync('./test.bsm', 'utf-8')));
  });
});
