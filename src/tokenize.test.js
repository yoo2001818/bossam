import tokenize from './tokenize';

describe('tokenize', () => {
  it('should support line comments', () => {
    expect(tokenize(`
      // What do you expect?
      // Hello!
    `)).toEqual([{ type: 'commentLine' }, { type: 'commentLine' }]);
  });
  it('should support block comments', () => {
    expect(tokenize(`
      /* This is a block comment */
      /* This
         too!
      */
    `)).toEqual([
      { type: 'commentBlock' },
      { type: 'commentBlockEnd' },
      { type: 'commentBlock' },
      { type: 'commentBlockEnd' },
    ]);
  });
});
