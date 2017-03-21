function match(state, matches) {
  // Try to match the type
  let token = state.next();
  let type = token === null ? 'null' : token.type;
  let matched = matches[type];
  if (matched == null) {
    if (matches.else != null) return matches.else(state, token);
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
  let data = getName(state);
  let exited = false;
  let index = 0;
  // Pull enum target for structs
  if (pullIf(state, 'parenOpen')) {
    data.typeTarget = getVariable(state);
    if (pullIf(state, 'comma')) {
      data.typeType = getType(state);
    }
    pull(state, 'parenClose');
  }
  data.namespace = {};
  pull(state, 'curlyOpen');
  // Now, pull each character.
  function next(state) {
    // If curlyClose is reached, escape!
    if (pullIf(state, 'curlyClose')) {
      exited = true;
      return;
    }
    let key, strategy;
    // We have to choose strategy.
    match(state, {
      number: (state, token) => {
        strategy = 'match';
        key = token.value;
      },
      string: (state, token) => {
        strategy = 'object';
        key = token.value;
      },
      keyword: (state, token) => {
        // Just continue
        strategy = 'array';
        key = index++;
        state.push(token);
      },
    });
    // Now, pull the struct.
    let value = defineStruct(state, true);
    // Enforce the type mode.
    let dataType = null;
    switch (value.type) {
      case 'structObject':
        dataType = 'enumObject';
        break;
      case 'structArray':
        dataType = 'enumArray';
        break;
    }
    if (data.type != null && dataType != null && data.type !== dataType) {
      throw new Error('Enum data type can\'t be mixed');
    }
    data.type = dataType;
    if (data.strategy == null) {
      data.strategy = strategy;
      // Set up indexes
      switch (strategy) {
        case 'match':
          data.entries = [];
          break;
        case 'object':
          data.entries = {};
          break;
        case 'array':
          data.entries = [];
          break;
      }
    } else if (data.strategy !== strategy) {
      throw new Error('Enum indexing type can\'t be mixed');
    }
    data.namespace[getIdentifier(value)] = value;
    switch (strategy) {
      case 'match':
        data.entries.push([key, value]);
        break;
      case 'object':
        data.entries[key] = value;
        break;
      case 'array':
        data.entries.push(value);
        break;
    }
    pullIf(state, 'comma', next);
  }
  next();
  if (!exited) pull(state, 'curlyClose');
}

function defineStruct(state, allowEmpty = false) {
  let data = getName(state);
  match(state, {
    else: allowEmpty && ((state, token) => {
      // Just push the token and return the data.
      state.push(token);
      data.type = 'structEmpty';
      data.keys = [];
    }),
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
        let name = getVariable(state);
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
  return data;
}

function getType(state) {
  return getName(state);
}

function getVariable(state) {
  return getName(state);
}

function getIdentifier(data) {
  if (data.generics == null) return data.name;
  return data.name + '<' + data.generics.map(() => '_').join(',') + '>';
}

function getName(state) {
  let data = {};
  // Get keyword.
  data.name = pull(state, 'keyword').name;
  // Support generics - continue if we have generics.
  // We're suddenly using continuation-passing style. I'm not sure why.
  pullIf(state, 'angleOpen', (state) => {
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
