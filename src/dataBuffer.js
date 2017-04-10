// AS3 ByteArray style Buffer object. It shims the DataView object
// to make it more convinent to use - it automatically records position data.
// To avoid conflict with Node.js Buffer object, it is 'DataBuffer' instead of
// just 'Buffer'.
export default class DataBuffer {
  constructor(dataView) {
    this.dataView = dataView;
    this.position = 0;
  }
  setUint8Array(buffer) {
    const size = buffer.length;
    const output = new Uint8Array(this.dataView.buffer, this.position, size);
    this.position += size;
    output.set(buffer);
  }
  getUint8Array(size, buffer) {
    const output = new Uint8Array(this.dataView.buffer, this.position, size);
    this.position += size;
    if (buffer != null) {
      if (buffer.length > size) {
        throw new Error('Buffer size is smaller than required size');
      }
      buffer.set(output);
      return buffer;
    }
    return output;
  }
  setUint16Array(buffer) {
    const size = buffer.length;
    const output = new Uint16Array(this.dataView.buffer, this.position, size);
    this.position += size;
    output.set(buffer);
  }
  getUint16Array(size, buffer) {
    const output = new Uint16Array(this.dataView.buffer, this.position, size);
    this.position += size;
    if (buffer != null) {
      if (buffer.length > size) {
        throw new Error('Buffer size is smaller than required size');
      }
      buffer.set(output);
      return buffer;
    }
    return output;
  }
}

// Implement each accessor function. Since copy & paste is not preferred,
// I decided to alter prototypes to create functions dynamically.
[
  ['Float32', 4],
  ['Float64', 8],
  ['Int8', 1],
  ['Int16', 2],
  ['Int32', 4],
  ['Uint8', 1],
  ['Uint16', 2],
  ['Uint32', 4],
].forEach(([type, bytes]) => {
  const getterName = 'get' + type;
  const setterName = 'set' + type;
  const getter = new Function('littleEndian', `
    var result = this.dataView.${getterName}(this.position, littleEndian);
    this.position += ${bytes};
    return result;
  `);
  const setter = new Function('value', 'littleEndian', `
    this.dataView.${setterName}(value, this.position, littleEndian);
    this.position += ${bytes};
  `);
  DataBuffer.prototype[getterName] = getter;
  DataBuffer.prototype[setterName] = setter;
});
