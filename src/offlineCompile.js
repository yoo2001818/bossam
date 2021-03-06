// Compiles the namespace to use without embeding the entire compiler stack
// on the program.
export default function offlineCompile(namespace,
  requireScope = 'bossam/lib/',
) {
  let output = [];
  // Unfortunately, primitive types must be included by calling
  // createNamespace() on the compiled code. Thus, CommonJS environment is
  // necessary to use this.
  // TODO Support custom primitive types.
  output.push(
    `var createNamespace = require('${requireScope}namespace.js').default;`);
  // Import DataBuffer too.
  output.push(`
    // Change to node.js variant if Buffer exists
    var DataBuffer;
    if (typeof Buffer !== 'undefined') {
      DataBuffer = require('${requireScope}dataBuffer.node').default;
    } else {
      DataBuffer = require('${requireScope}dataBuffer').default;
    }`.replace(/^ +/gm, ''));
  output.push('var namespace = createNamespace();');
  output.push('var dataBuffer = new DataBuffer();');
  // Define user-generated data types.
  for (let key in namespace) {
    let type = namespace[key];
    if (type.locked || type.encodeCode == null) continue;
    if (!namespace.hasOwnProperty(key)) continue;
    let keyEncoded = JSON.stringify(key);
    output.push(`namespace[${keyEncoded}] = {`);
    // Since sizeCode / encodeCode / decodeCode is not available, we need to
    // put this to avoid inline compliation, if any.
    output.push('locked: true,');
    // Add code
    output.push('size: function(namespace, value) {');
    output.push('var size = 0;');
    output.push(type.sizeCode.replace(/#value#/g, 'value'));
    output.push('return size;');
    output.push('},');
    output.push('encodeImpl: function(namespace, value, dataView) {');
    output.push(type.encodeCode.replace(/#value#/g, 'value'));
    output.push('},');
    output.push('decodeImpl: function(namespace, dataView) {');
    output.push('var value;');
    output.push(type.decodeCode.replace(/#value#/g, 'value'));
    output.push('return value;');
    output.push('},');
    // Then add user-facing functions.
    output.push('encode: function(value) {');
    output.push(`var entry = namespace[${keyEncoded}];`);
    output.push('dataBuffer.newBuffer(entry.size(namespace, value));');
    output.push('entry.encodeImpl(namespace, value, dataBuffer);');
    output.push('return dataBuffer.getBuffer();');
    output.push('},');
    output.push('decode: function(buffer) {');
    output.push(`var entry = namespace[${keyEncoded}];`);
    output.push('dataBuffer.setBuffer(buffer);');
    output.push('return entry.decodeImpl(namespace, dataBuffer);');
    output.push('}');
    output.push('};');
  }
  output.push('module.exports = namespace;');
  return output.join('\n');
}
