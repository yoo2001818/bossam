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
  return matched(state);
}

function main(state) {
  // Loop until we meet null. This looks awkward, but this'll do.
  while (match(state, {
    null: () => false,
  }) !== false);
}

export default function parse(tokenizer) {
  function next() {
    const { value, done } = tokenizer.next();
    if (done) return null;
    return value;
  }
  let state = { next };
  // Read each line and process. Since this uses JS's own stack, it'd be really
  // simple to describe the language.
  main(state);
  return state;
}
