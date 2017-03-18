const Token = (type) => () => ({ type });
const SwitchToken = (type, mode) => (match, state) => {
  state.mode = mode;
  return { type };
};
const NoOp = () => undefined;

const SYNTAX_TABLE = {
  main: [
    [/\/\/.*$/gm, Token('commentLine')],
    [/\/\*/g, SwitchToken('commentBlock', 'commentBlock')],
    [/\s+/g, NoOp],
  ],
  commentBlock: [
    [/\*\//g, SwitchToken('commentBlockEnd', 'main')],
    [/([^*]+|.)/g, NoOp],
  ],
};

export default function tokenize(code) {
  let output = [];
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
      if (result !== undefined) {
        output.push(result);
        index = results[i][0][0].length + index;
        next = true;
        break;
      }
    }
    if (!next) {
      index = results[results.length - 1][0][0].length + index;
    }
  }
  return output;
}
