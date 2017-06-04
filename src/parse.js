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
  if (Array.isArray(type) ? !type.includes(tokenType) : tokenType !== type) {
    state.push(token);
    return false;
  }
  if (then != null) then(state, token);
  return token;
}

function peek(state) {
  let token = state.next();
  state.push(token);
  return token;
}

function peekIf(state, type, then) {
  // Try to match the type
  let token = peek(state);
  let tokenType = (token === null ? 'null' : token.type);
  if (Array.isArray(type) ? !type.includes(tokenType) : tokenType !== type) {
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
    if (value.subType !== 'empty' && value.type !== 'alias') {
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

function defineInlineStruct(state, data, allowEmpty = false, generics) {
  return match(state, {
    else: !allowEmpty ? null : (state, token) => {
      // Just push the token and return the data.
      state.push(token);
      data.subType = 'empty';
      data.keys = [];
      return data;
    },
    equal: () => {
      data.type = 'alias';
      data.key = getType(state, generics);
      pullIf(state, 'semicolon');
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
      let exited = false;
      function next() {
        // If parenClose is reached, escape!
        if (pullIf(state, 'parenClose')) {
          exited = true;
          return;
        }
        data.keys.push(getType(state, generics));
        return pullIf(state, 'comma', next);
      }
      next();
      // Close the paren...
      if (!exited) pull(state, 'parenClose');
      // And expect a semicolon
      pullIf(state, 'semicolon');
      return data;
    },
  });
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
  return defineInlineStruct(state, data, allowEmpty, generics);
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
      state.push(token);
      let topNode = getName(state, generics);
      return match(state, {
        else: (state, token) => {
          // Restore tokens, then just process as name. :P
          state.push(token);
          return topNode;
        },
        period: (state) => {
          let data = getName(state, generics);
          return [topNode, data];
        },
      });
    },
    question: (state) => {
      // Process a nullable type.
      let type = getType(state, generics);
      type.nullable = true;
      return type;
    },
    curlyOpen: (state, token) => {
      let data = { inline: true, type: 'struct' };
      state.push(token);
      return defineInlineStruct(state, data, false, generics);
    },
    parenOpen: (state, token) => {
      let data = { inline: true, type: 'struct' };
      state.push(token);
      return defineInlineStruct(state, data, false, generics);
    },
    squareOpen: (state) => {
      let data = { array: true };
      data.type = getType(state, generics);
      pull(state, 'semicolon');
      data.size = getExpression(state, generics);
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
      if (define) {
        data.generics.push(pull(state, 'keyword').name);
      } else {
        data.generics.push(getExpression(state, generics));
      }
      // Continue to next if comma is provided
      pullIf(state, 'comma', next);
    }
    next();
    // Digest angleClose
    pull(state, 'angleClose');
    if (!define && data.name === 'Option' && data.generics.length === 1) {
      data = data.generics[0];
      data.nullable = true;
      return data;
    }
  });
  return data;
}

function getExpression(state, generics) {
  // TODO Wouldn't it be better to move these into standalone functions?
  function addExpr() {
    let buffer = null;
    do {
      if (buffer != null) {
        let op = Object.assign({ op: true }, state.next());
        let right = mulExpr();
        buffer = [].concat(buffer, right, op);
      } else {
        buffer = mulExpr();
      }
    } while (peekIf(state, ['plus', 'minus']));
    return buffer;
  }
  function mulExpr() {
    let buffer = null;
    do {
      if (buffer != null) {
        let op = Object.assign({ op: true }, state.next());
        let right = funcExpr();
        buffer = [].concat(buffer, right, op);
      } else {
        buffer = funcExpr();
      }
    } while (peekIf(state, ['asterisk', 'slash', 'percent']));
    return buffer;
  }
  function funcExpr() {
    if (peekIf(state, 'keyword')) {
      let keyword = state.next();
      let paren = pullIf(state, 'parenOpen');
      if (paren === false) {
        // Put the value back to buffer; parse it as a value.
        state.push(keyword);
        return value();
      }
      let args = funcArgs();
      return args.concat(Object.assign({ op: true }, keyword));
    } else if (pullIf(state, 'parenOpen')) {
      let output = addExpr();
      pull(state, 'parenClose');
      return output;
    } else {
      return value();
    }
  }
  function funcArgs() {
    let buffer = null;
    do {
      if (buffer != null) {
        let right = addExpr();
        buffer = [].concat(buffer, right);
      } else {
        buffer = addExpr();
      }
    } while (pullIf(state, 'comma'));
    pull(state, 'parenClose');
    return buffer;
  }
  function value() {
    return [match(state, {
      else: (state, token) => {
        state.push(token);
        return getType(state, generics);
      },
      string: (state, token) => {
        return { jsConst: true, name: token.value };
      },
      number: (state, token) => {
        return { jsConst: true, name: token.value };
      },
    })];
  }
  let result = addExpr();
  return result;
}

function createParser(tokenizer) {
  let state = { next, push, unshift, lookahead: [], namespace: {} };
  function next() {
    if (state.lookahead.length > 0) {
      return state.lookahead.pop();
    }
    const { value, done } = tokenizer.next();
    if (done) return null;
    return value;
  }
  // Lookahead support
  function push(token) {
    state.lookahead.push(token);
  }
  function unshift(token) {
    state.lookahead.unshift(token);
  }
  return state;
}

export default function parse(tokenizer) {
  let state = createParser(tokenizer);
  // Read each line and process. Since this uses JS's own stack, it'd be really
  // simple to describe the language.
  main(state);
  return state.namespace;
}

export function parseKeyword(tokenizer) {
  let state = createParser(tokenizer);
  return getName(state);
}
