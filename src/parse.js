function match(state, matches) {
  // Try to match the type
  let token = state.next();
  let type = token === null ? 'null' : token.type;
  let matched = matches[type];
  if (matched == null) {
    throw new Error('Token error; Expected ' +
      Object.keys(matches).join(',') + ', But received ' + type
    );
  }
  return matched(state, token);
}

function pull(state, type) {
  // Try to match the type
  let token = state.next();
  let tokenType = (token === null ? 'null' : token.type);
  if (tokenType !== type) {
    throw new Error('Token error; Expected ' +
      type + ', But received ' + tokenType
    );
  }
  return token;
}

function pullIf(state, type, then) {
  // Try to match the type
  let token = state.next();
  let tokenType = (token === null ? 'null' : token.type);
  if (tokenType !== type) {
    state.push(token);
    return false;
  }
  then(state, token);
  return token;
}

function main(state) {
  // Loop until we meet null. This looks awkward, but this'll do.
  while (match(state, {
    null: () => false,
    enum: defineEnum,
    struct: defineStruct,
  }) !== false);
}

function defineEnum(state) {
  let name = defineName(state);
  pull(state, 'curlyOpen');
  pull(state, 'curlyClose');
}

function defineStruct(state) {
  let name = defineName(state);
  pull(state, 'curlyOpen');
  pull(state, 'curlyClose');
}

function defineName(state) {
  let data = {};
  // Get keyword.
  data.name = pull(state, 'keyword');
  // Support generics - continue if we have generics.
  // We're suddenly using continuation-passing style. I'm not sure why.
  pullIf(state, 'angleOpen', (state, token) => {
    data.generics = [];
    function next() {
      // Receive a keyword...
      data.generics.push(pull(state, 'keyword'));
      // Continue to next if comma is provided
      pullIf(state, 'comma', next);
    }
    next();
    // Digest angleClose
    pull(state, 'angleClose');
  });
  console.log(data);
  return data;
}

export default function parse(tokenizer) {
  let state = { next, push, lookahead: [] };
  function next() {
    if (state.lookahead.length > 0) {
      return state.lookahead.shift();
    }
    const { value, done } = tokenizer.next();
    if (done) return null;
    return value;
  }
  // Lookahead support
  function push(token) {
    state.lookahead.push(token);
  }
  // Read each line and process. Since this uses JS's own stack, it'd be really
  // simple to describe the language.
  main(state);
  return state;
}
