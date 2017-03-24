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
    enum: (state) => {
      let data = defineEnum(state);
      state.namespace[getIdentifier(data)] = data;
    },
    struct: (state) => {
      let data = defineStruct(state);
      state.namespace[getIdentifier(data)] = data;
    },
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
  function next() {
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
        pull(state, 'arrow');
      },
      string: (state, token) => {
        strategy = 'object';
        key = token.value;
        pull(state, 'arrow');
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
    value.enumKey = key;
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
  if (data.type == null) data.type = 'enumEmpty';
  if (!exited) pull(state, 'curlyClose');
  return data;
}

function defineStruct(state, allowEmpty = false) {
  let data = getName(state);
  return match(state, {
    else: allowEmpty && ((state, token) => {
      // Just push the token and return the data.
      state.push(token);
      data.type = 'structEmpty';
      data.keys = [];
      return data;
    }),
    curlyOpen: () => {
      data.type = 'structObject';
      data.values = {};
      data.keys = [];
      let exited = false;
      function processKeyword(state, token) {
        state.push(token);
        let name = getVariable(state);
        pull(state, 'colon');
        let type = getType(state);
        data.keys.push(name);
        data.values[name] = type;
        return pullIf(state, 'comma', next);
      }
      function processValue(state, token) {
        let value = token.value;
        pull(state, 'colon');
        let type = getType(state);
        // Don't put it in values.
        data.keys.push({ const: true, type, value });
        return pullIf(state, 'comma', next);
      }
      function next() {
        // If curlyClose is reached, escape!
        if (pullIf(state, 'curlyClose')) {
          exited = true;
          return;
        }
        return match(state, {
          keyword: processKeyword,
          string: processValue,
          number: processValue,
        });
      }
      next();
      if (!exited) pull(state, 'curlyClose');
      return data;
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
      pullIf(state, 'semicolon');
      return data;
    },
  });
}

function getType(state) {
  // Read keyword or paren. If paren is specified, that means a tuple is
  // specified.
  return match(state, {
    keyword: (state, token) => {
      // If the next token is period, that means a namespace is specified,
      // so resolve it. However, since only 1 level is supported for now,
      // we can just check single level.
      return match(state, {
        else: (state, tokenNext) => {
          // Restore tokens, then just process as name. :P
          state.push(token);
          state.push(tokenNext);
          return getName(state);
        },
        period: (state) => {
          let data = getName(state);
          data.name = [token.name, data.name];
          return data;
        },
      });
    },
    parenOpen: (state) => {
      // Process tuple.
      let result = [];
      function next() {
        // Receive a keyword...
        result.push(getType(state));
        // Continue to next if comma is provided
        pullIf(state, 'comma', next);
      }
      next();
      pull(state, 'parenClose');
      return result;
    },
    squareOpen: (state) => {
      let data = { array: true };
      data.type = getType(state);
      pull(state, 'semicolon');
      match(state, {
        number: (state, token) => data.size = token.value,
        keyword: (state, token) => data.size = token.name,
      });
      pull(state, 'squareClose');
      return data;
    },
  });
}

function getVariable(state) {
  return pull(state, 'keyword').name;
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
      match(state, {
        keyword: (state, token) => {
          state.push(token);
          // Receive a keyword...
          data.generics.push(getType(state));
        },
        // These two are absurd, however, it is required to specify string's
        // encoding and size.
        string: (state, token) => {
          data.generics.push({ const: true, value: token.value });
        },
        number: (state, token) => {
          data.generics.push({ const: true, value: token.value });
        },
      });
      // Continue to next if comma is provided
      pullIf(state, 'comma', next);
    }
    next();
    // Digest angleClose
    pull(state, 'angleClose');
  });
  return data;
}

export default function parse(tokenizer) {
  let state = { next, push, lookahead: [], namespace: {} };
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
  console.log(state.namespace);
  return state;
}
