// A Node.js variant for DataBuffer, because ArrayBuffer is quite slow
// in Node.js.
export default class DataBuffer {
  newBuffer(size) {
    this.buffer = Buffer.allocUnsafe(size);
    this.position = 0;
  }
  setBuffer(buffer) {
    if (Buffer.isBuffer(buffer)) {
      this.buffer = buffer;
    } else {
      this.buffer = Buffer.from(buffer.buffer,
        buffer.byteOffset, buffer.length);
    }
    this.position = 0;
  }
  getBufferSliced() {
    return this.buffer.slice(0, this.position);
  }
  getBuffer() {
    return this.buffer;
  }
  setString(size, value, charset) {
    this.buffer.write(value, this.position, this.position + size, charset);
    this.position += size;
  }
  getString(size, charset) {
    const output = this.buffer.toString(charset,
      this.position, this.position + size);
    this.position += size;
    return output;
  }
  setUint8Array(array) {
    let source;
    if (array instanceof Buffer) {
      source = array;
    } else {
      source = Buffer.from(array);
    }
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
    var result = this.buffer.read${name}${be}(this.position, true);
    this.position += ${bytes};
    return result;
  `);
  const setter = new Function('value', `
    this.buffer.write${name}${be}(value, this.position, true);
    this.position += ${bytes};
  `);
  DataBuffer.prototype[getterName] = getter;
  DataBuffer.prototype[setterName] = setter;
  const getterLEName = 'get' + type + 'LE';
  const setterLEName = 'set' + type + 'LE';
  const getterLE = new Function(`
    var result = this.buffer.read${name}${le}(this.position, true);
    this.position += ${bytes};
    return result;
  `);
  const setterLE = new Function('value', `
    this.buffer.write${name}${le}(value, this.position, true);
    this.position += ${bytes};
  `);
  DataBuffer.prototype[getterLEName] = getterLE;
  DataBuffer.prototype[setterLEName] = setterLE;

  // Create array accessors
  const getterArrayName = 'get' + type + 'Array';
  const setterArrayName = 'set' + type + 'Array';
  if (DataBuffer.prototype[getterArrayName] != null) {
    const getterArray = new Function('size', 'buffer', `
      var output = new ${type}Array(this.buffer.buffer,
        this.position + this.buffer.byteOffset, size);
      this.position += size;
      if (buffer != null) {
        if (buffer.length > size) {
          throw new Error('Buffer size is smaller than requested size');
        }
        buffer.set(output);
        return buffer;
      }
      return output;
    `);
    // It may look weird because the arguments order is different from getter,
    // but it's alright because 'size' is optional in setter, and 'buffer' is
    // optional in getter.

    // Because buffer can be a regular array, or typed array of other type,
    // byteLength should be avoided - instead, TypedArray.BYTES_PER_ELEMENT
    // should be used.
    // If the buffer array size exceeds provided size, it should throw an error.
    const setterArray = new Function('buffer', 'size', `
      var bufferSize = ${type}Array.BYTES_PER_ELEMENT * buffer.length;
      var maxSize = size == null ? bufferSize : size;
      var output = new ${type}Array(this.buffer.buffer,
        this.position + this.buffer.byteOffset, maxSize);
      output.set(buffer);
      output.fill(0, buffer.length);
      this.position += maxSize;
    `);
    DataBuffer.prototype[getterArrayName] = getterArray;
    DataBuffer.prototype[setterArrayName] = setterArray;
  }
});
