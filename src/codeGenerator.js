// Change to node.js variant if Buffer exists
let DataBuffer;
if (typeof Buffer !== 'undefined') {
  DataBuffer = require('./dataBuffer.node').default;
} else {
  DataBuffer = require('./dataBuffer').default;
}

// Generates the code using new Function()
export default class CodeGenerator {
  constructor(state) {
    this.namespace = state.namespace;
    this.sizeCode = [];
    this.decodeCode = [];
    this.encodeCode = [];
  }
  push(code) {
    // Assume that all codes are same.
    this.sizeCode.push(code);
    this.decodeCode.push(code);
    this.encodeCode.push(code);
  }
  pushEncode(code) {
    // Encode / size has same code.
    this.sizeCode.push(code);
    this.encodeCode.push(code);
  }
  pushDecode(code) {
    this.decodeCode.push(code);
  }
  pushType(keyword, type, doVar) {
    this.pushTypeEncode(keyword, type);
    this.pushTypeDecode(keyword, type, doVar);
  }
  pushTypeEncode(keyword, type) {
    // Pull the value from the namespace.
    if (type == null || type.locked) {
      // Namespace value is false; since the function is not available yet,
      // (This means there is a circular reference) just call the method
      // directly.
      let ref = `this['${type.name}']`;
      this.sizeCode.push(`size += ${ref}.size(${keyword});`);
      this.encodeCode.push(`${ref}.encodeImpl(${keyword}, dataView);`);
    } else {
      // Or include the code into the output code. :)
      this.sizeCode.push(type.sizeCode.replace(/#value#/g, keyword)
        .slice(0, -1));
      this.encodeCode.push(type.encodeCode.replace(/#value#/g, keyword)
        .slice(0, -1));
    }
  }
  pushTypeDecode(keyword, type, doVar) {
    // Pull the value from the namespace.
    if (doVar) this.decodeCode.push(`var ${keyword};`);
    if (type == null || type.locked) {
      // Namespace value is false; since the function is not available yet,
      // (This means there is a circular reference) just call the method
      // directly.
      let ref = `this['${type.name}']`;
      this.decodeCode.push(`${keyword} = ${ref}.decodeImpl(dataView);`);
    } else {
      // Or include the code into the output code. :)
      this.decodeCode.push(type.decodeCode.replace(/#value#/g, keyword)
        .slice(0, -1));
    }
  }
  compile() {
    const namespace = this.namespace;
    let output = {
      sizeCode: this.sizeCode.join('\n') + '\n',
      encodeCode: this.encodeCode.join('\n') + '\n',
      decodeCode: this.decodeCode.join('\n') + '\n',
    };
    // Simply swap #value# with value and we're good to go.
    output.size = new Function('value',
      'var size = 0;\n' +
      output.sizeCode.replace(/#value#/g, 'value') +
      'return size;\n').bind(namespace);
    output.encodeImpl = new Function('value', 'dataView',
      output.encodeCode.replace(/#value#/g, 'value')).bind(namespace);
    // Decode code should define output target, so define them like this.
    output.decodeImpl = new Function('dataView',
      'var value;\n' +
      output.decodeCode.replace(/#value#/g, 'value') +
      'return value;\n').bind(namespace);
    const dataBuffer = new DataBuffer();
    output.encode = (value) => {
      // Calculate size and create ArrayBuffer, then we're good
      dataBuffer.newBuffer(output.size(value));
      output.encodeImpl(value, dataBuffer);
      return dataBuffer.getBuffer();
    };
    output.decode = (buffer) => {
      dataBuffer.setBuffer(buffer);
      return output.decodeImpl(dataBuffer);
    };
    return output;
  }
}
