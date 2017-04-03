import getIdentifier from './util/getIdentifier';
import findNumberType from './util/findNumberType';

function match(state, matches) {
  // Try to match the type
  let token = state.next();
  let type = token === null ? 'null' : token.type;
  let matched = matches[type];
  if (matched == null) {
    if (matches.else != null) return matches.else(state, token);
    throw new Error('Token error; Expected ' +
      Object.keys(matches).join(', ') + ', But received ' + type
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
    // Do nothing if semicolon is provided
    semicolon: () => {},
  }) !== false);
}

function defineEnum(state) {
  let data = getName(state, null, true);
  let exited = false;
  let index = 0;
  // Pull enum target for structs
  data.typeTarget = 'type';
  if (pullIf(state, 'parenOpen')) {
    data.typeType = getType(state, data.generics);
    if (pullIf(state, 'comma')) {
      data.typeTarget = getVariable(state);
    }
    pull(state, 'parenClose');
  }
  data.type = 'enum';
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
    let value = defineStruct(state, true, data.generics);
    // Enforce the type mode.
    if (value.subType !== 'empty') {
      if (data.subType != null && data.subType !== value.subType) {
        throw new Error('Enum data type can\'t be mixed');
      }
      data.subType = value.subType;
    }
    if (data.strategy == null) {
      data.strategy = strategy;
      data.entries = [];
      /*
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
      */
    } else if (data.strategy !== strategy) {
      throw new Error('Enum indexing type can\'t be mixed');
    }
    let valueName = getIdentifier(value);
    data.namespace[valueName] = value;
    value.enumKey = key;
    // Don't use strategy - it's useless since the code compiles into
    // switch clauses.
    /*
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
    */
    data.entries.push([key, valueName]);
    pullIf(state, 'comma', next);
  }
  next();
  if (data.subType === 'array') delete data.typeTarget;
  // Choose right type if not provided
  if (data.typeType == null) {
    switch (data.strategy) {
      case 'match': {
        // Get largest value; then get the type.
        let value = data.entries.reduce((prev, [key]) =>
          key > prev ? key : prev, -Infinity);
        data.typeType = { name: findNumberType(value) };
        break;
      }
      case 'object': {
        data.typeType = { name: 'String' };
        break;
      }
      case 'array': {
        data.typeType = { name: findNumberType(data.entries.length) };
      }
    }
  }
  if (data.subType == null) data.subType = 'empty';
  if (!exited) pull(state, 'curlyClose');
  return data;
}

function defineStruct(state, allowEmpty = false, parentGenerics) {
  let data, generics;
  if (parentGenerics != null) {
    data = getName(state, parentGenerics, true);
    generics = parentGenerics;
  } else {
    data = getName(state, null, true);
    generics = data.generics;
  }
  data.type = 'struct';
  return match(state, {
    else: !allowEmpty ? null : (state, token) => {
      // Just push the token and return the data.
      state.push(token);
      data.subType = 'empty';
      data.keys = [];
      return data;
    },
    curlyOpen: () => {
      data.subType = 'object';
      data.values = {};
      data.keys = [];
      let exited = false;
      function processKeyword(state, token) {
        state.push(token);
        let name = getVariable(state);
        pull(state, 'colon');
        let type = getType(state, generics);
        data.keys.push(name);
        data.values[name] = type;
        return pullIf(state, 'comma', next);
      }
      function processValue(state, token) {
        let value = token.value;
        pull(state, 'colon');
        let type = getType(state, generics);
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
      data.subType = 'array';
      // Quite simple, since we just need to accept keywords again and again.
      data.keys = [];
      function next() {
        data.keys.push(getType(state, generics));
        return pullIf(state, 'comma', next);
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

function getType(state, generics) {
  // Read keyword or paren. If paren is specified, that means a tuple is
  // specified.
  // String or number indicates a constant value on JS side.
  return match(state, {
    string: (_, token) => ({ jsConst: true, value: token.value }),
    number: (_, token) => ({ jsConst: true, value: token.value }),
    keyword: (state, token) => {
      // If the next token is period, that means a namespace is specified,
      // so resolve it. However, since only 1 level is supported for now,
      // we can just check single level.
      return match(state, {
        else: (state, tokenNext) => {
          // Restore tokens, then just process as name. :P
          state.push(token);
          state.push(tokenNext);
          return getName(state, generics);
        },
        period: (state) => {
          let data = getName(state, generics);
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
        result.push(getType(state, generics));
        // Continue to next if comma is provided
        pullIf(state, 'comma', next);
      }
      next();
      pull(state, 'parenClose');
      return result;
    },
    squareOpen: (state) => {
      let data = { array: true };
      data.type = getType(state, generics);
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

function getName(state, generics, define) {
  let data = {};
  // Get keyword.
  data.name = pull(state, 'keyword').name;
  if (generics != null && !define) {
    let genericIndex = generics.indexOf(data.name);
    if (genericIndex !== -1) {
      data.generic = true;
      data.name = genericIndex;
    }
  }
  // Support generics - continue if we have generics.
  // We're suddenly using continuation-passing style. I'm not sure why.
  pullIf(state, 'angleOpen', (state) => {
    data.generics = [];
    function next() {
      match(state, {
        keyword: (state, token) => {
          if (define) {
            // If in define mode, use a single keyword.
            data.generics.push(token.name);
          } else {
            state.push(token);
            data.generics.push(getType(state, generics));
          }
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
  return state.namespace;
}
