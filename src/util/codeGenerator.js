// Generates the code using inline
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
      let ref = `namespace['${type.name}']`;
      this.sizeCode.push(`size += ${ref}.size(${keyword});`);
      this.encodeCode.push(`${ref}.encode(${keyword}, dataView);`);
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
      let ref = `namespace['${type.name}']`;
      this.decodeCode.push(`${keyword} = ${ref}.decode(dataView);`);
    } else {
      // Or include the code into the output code. :)
      this.decodeCode.push(type.decodeCode.replace(/#value#/g, keyword)
        .slice(0, -1));
    }
  }
  compile() {
    const namespace = this.namespace; // eslint-disable-line
    let output = {
      sizeCode: this.sizeCode.join('\n') + '\n',
      encodeCode: this.encodeCode.join('\n') + '\n',
      decodeCode: this.decodeCode.join('\n') + '\n',
    };
    // Simply swap #value# with value and we're good to go.
    output.size = new Function('value',
      'var size = 0;\n' +
      output.sizeCode.replace(/#value#/g, 'value') +
      'return size;\n');
    output.encode = new Function('value', 'dataView',
      output.encodeCode.replace(/#value#/g, 'value'));
    // Decode code should define output target, so define them like this.
    output.decode = new Function('value', 'dataView',
      'var value;\n' +
      output.decodeCode.replace(/#value#/g, 'value') +
      'return value;\n');
    console.log(output.sizeCode);
    console.log(output.encodeCode);
    console.log(output.decodeCode);
    return output;
  }
}
