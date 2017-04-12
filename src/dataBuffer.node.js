// A Node.js variant for DataBuffer, because ArrayBuffer is quite slow
// in Node.js.
export default class DataBuffer {
  constructor(arg) {
    if (typeof arg === 'number') {
      this.buffer = Buffer.allocUnsafe(arg);
    } else {
      this.buffer = Buffer.from(arg);
    }
    this.position = 0;
  }
  getBuffer() {
    return this.buffer;
  }
  setUint8Array(array) {
    const source = Buffer.from(array);
    const size = source.length;
    source.copy(this.buffer, this.position);
    this.position += size;
  }
  getUint8Array(size, buffer) {
    const output = this.buffer.slice(this.position, this.position + size);
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
    const output = new Uint16Array(this.buffer.buffer,
      this.position + this.buffer.byteOffset, size);
    this.position += size;
    output.set(buffer);
  }
  getUint16Array(size, buffer) {
    const output = new Uint16Array(this.buffer.buffer,
      this.position + this.buffer.byteOffset, size);
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
  ['Float32', 4, 'Float'],
  ['Float64', 8, 'Double'],
  ['Int8', 1],
  ['Int16', 2],
  ['Int32', 4],
  ['Uint8', 1, 'UInt8'],
  ['Uint16', 2, 'UInt16'],
  ['Uint32', 4, 'UInt32'],
].forEach(([type, bytes, nodeType]) => {
  const getterName = 'get' + type;
  const setterName = 'set' + type;
  const name = nodeType || type;
  const be = bytes === 1 ? '' : 'BE';
  const le = bytes === 1 ? '' : 'LE';
  const getter = new Function(`
    var result = this.buffer.read${name}${be}(this.position);
    this.position += ${bytes};
    return result;
  `);
  const setter = new Function('value', `
    this.buffer.write${name}${be}(value, this.position);
    this.position += ${bytes};
  `);
  DataBuffer.prototype[getterName] = getter;
  DataBuffer.prototype[setterName] = setter;
  const getterLEName = 'get' + type + 'LE';
  const setterLEName = 'set' + type + 'LE';
  const getterLE = new Function(`
    var result = this.buffer.read${name}${le}(this.position);
    this.position += ${bytes};
    return result;
  `);
  const setterLE = new Function('value', `
    this.buffer.write${name}${le}(value, this.position);
    this.position += ${bytes};
  `);
  DataBuffer.prototype[getterLEName] = getterLE;
  DataBuffer.prototype[setterLEName] = setterLE;
});
