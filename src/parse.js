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
  if (then != null) then(state, token);
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
  let name = getName(state);
  pull(state, 'curlyOpen');
  pull(state, 'curlyClose');
}

function defineStruct(state) {
  let data = getName(state);
  match(state, {
    curlyOpen: () => {
      data.type = 'structObject';
      data.values = {};
      data.keys = [];
      let exited = false;
      function next() {
        // If curlyClose is reached, escape!
        if (pullIf(state, 'curlyClose')) {
          exited = true;
          return;
        }
        let name = pull(state, 'keyword').name;
        pull(state, 'colon');
        let type = getType(state);
        data.keys.push(name);
        data.values[name] = type;
        pullIf(state, 'comma', next);
      }
      next();
      console.log(data);
      if (!exited) pull(state, 'curlyClose');
    },
    parenOpen: () => {
      data.type = 'structArray';
      // Quite simple, since we just need to accept keywords again and again.
      data.keys = [];
      function next() {
        data.keys.push(getType(state));
        pullIf(state, 'comma', next);
      }
      next();
      // Close the paren...
      pull(state, 'parenClose');
      // And expect a semicolon
      pull(state, 'semicolon');
      console.log(data);
    },
  });
}

function getType(state) {
  return getName(state);
}

function getName(state) {
  let data = {};
  // Get keyword.
  data.name = pull(state, 'keyword').name;
  // Support generics - continue if we have generics.
  // We're suddenly using continuation-passing style. I'm not sure why.
  pullIf(state, 'angleOpen', (state, token) => {
    data.generics = [];
    function next() {
      // Receive a keyword...
      data.generics.push(pull(state, 'keyword').name);
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
