import fs from 'fs';
import tokenize from './tokenize';
import parse from './parse';

describe('parse', () => {
  it('should parse test code', () => {
    parse(tokenize(fs.readFileSync('./test.jsbyte', 'utf-8')));
  });
});
