const Token = (type) => () => ({ type });
const NameToken = (type) => (match) => ({ type, name: match[1] });
const SwitchNoOp = (mode) => (match, state) => {
  state.mode = mode;
  return undefined;
};
const NoOp = () => undefined;

const SYNTAX_TABLE = {
  main: [
    [/\/\/.*$/gm, NoOp],
    [/\/\*/g, SwitchNoOp('commentBlock')],
    [/enum(?![a-zA-Z_$0-9])/g, Token('enum')],
    [/struct(?![a-zA-Z_$0-9])/g, Token('struct')],
    [/([a-zA-Z_$][a-zA-Z0-9_$]*)/g, NameToken('keyword')],
    // Only numbers are supported. Expressions like 10e3 is not supported, yet.
    [/[-+]?0x[0-9a-fA-F]+/g,
      (match) => ({ type: 'number', value: parseInt(match[0]) })],
    [/[-+]?(\d+)(\.\d+)?/g,
      (match) => ({ type: 'number', value: parseFloat(match[0]) })],
    [/"((?:[^"\\]|\n|\\\\|\\")+)"/g,
      (match) => ({ type: 'string', value: match[1].replace(/\\"/g, '"') })],
    [/=>/g, Token('arrow')],
    [/=/g, Token('equal')],
    [/\(/g, Token('parenOpen')],
    [/\)/g, Token('parenClose')],
    [/\{/g, Token('curlyOpen')],
    [/\}/g, Token('curlyClose')],
    [/</g, Token('angleOpen')],
    [/>/g, Token('angleClose')],
    [/\[/g, Token('squareOpen')],
    [/\]/g, Token('squareClose')],
    [/,/g, Token('comma')],
    [/\./g, Token('period')],
    [/:/g, Token('colon')],
    [/;/g, Token('semicolon')],
    [/\?/g, Token('question')],
    [/\s+/g, NoOp],
  ],
  commentBlock: [
    [/\*\//g, SwitchNoOp('main')],
    [/([^*]+|.)/g, NoOp],
  ],
};

export default function * tokenize(code) {
  let state = { mode: 'main' };
  let index = 0;
  while (index < code.length) {
    let syntaxes = SYNTAX_TABLE[state.mode];
    let results = [];
    for (let i = 0; i < syntaxes.length; ++i) {
      let syntax = syntaxes[i];
      let pattern = syntax[0];
      pattern.lastIndex = index;
      let result = pattern.exec(code);
      if (!result || result.index !== index) continue;
      let callback = syntax[1];
      results.push([result, callback]);
    }
    // results.sort((a, b) => a[0].length - b[0].length);
    if (results.length === 0) {
      let sliced = code.slice(index);
      let pos = sliced.search(/\s/);
      if (pos === -1) pos = sliced.length;
      let error = new Error('Unknown token ' +
        sliced.slice(0, pos));
      throw error;
    }
    let next = false;
    for (let i = 0; i < results.length; ++i) {
      let result = results[i][1](results[i][0], state);
      if (result !== undefined) yield result;
      index = results[i][0][0].length + index;
      next = true;
      break;
    }
    if (!next) {
      index = results[results.length - 1][0][0].length + index;
    }
  }
}
