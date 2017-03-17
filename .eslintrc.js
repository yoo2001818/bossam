module.exports = {
  parser: 'babel-eslint',
  extends: [
    'semistandard',
    'standard-jsx',
    'plugin:flowtype/recommended',
  ],
  plugins: [
    'flowtype',
  ],
  rules: {
    'no-multiple-empty-lines': [1, { max: 2 }],
    'no-trailing-spaces': [2],
    'no-return-assign': [0],
    'comma-dangle': [2, "always-multiline"],
    'space-before-function-paren': [2, "never"],
  },
  env: {
    browser: true,
    node: true,
    jest: true,
  },
};
