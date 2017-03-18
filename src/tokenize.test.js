import fs from 'fs';
import tokenize from './tokenize';

describe('tokenize', () => {
  it('should support line comments', () => {
    expect([...tokenize(`
      // What do you expect?
      // Hello!
    `)]).toEqual([]);
  });
  it('should support block comments', () => {
    expect([...tokenize(`
      /* This is a block comment */
      /* This
         too!
      */
    `)]).toEqual([]);
  });
  it('should parse test code', () => {
    [...tokenize(fs.readFileSync('./test.jsbyte', 'utf-8'))];
  });
});
