// AS3 ByteArray style Buffer object. It shims the DataView object
// to make it more convinent to use - it automatically records position data.
// To avoid conflict with Node.js Buffer object, it is 'DataBuffer' instead of
// just 'Buffer'.
export default class DataBuffer {
  newBuffer(size) {
    this.buffer = new Uint8Array(size);
    // Create DataView from Uint8Array
    this.dataView = new DataView(this.buffer.buffer);
    this.position = 0;
  }
  setBuffer(buffer) {
    this.buffer = buffer;
    // Create DataView from Uint8Array
    this.dataView = new DataView(this.buffer.buffer,
      this.buffer.byteOffset, this.buffer.byteLength);
    this.position = 0;
  }
  getBufferSliced() {
    return this.buffer.subarray(0, this.position);
  }
  getBuffer() {
    return this.buffer;
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
  const getter = new Function(`
    var result = this.dataView.${getterName}(this.position);
    this.position += ${bytes};
    return result;
  `);
  const setter = new Function('value', `
    this.dataView.${setterName}(this.position, value);
    this.position += ${bytes};
  `);
  DataBuffer.prototype[getterName] = getter;
  DataBuffer.prototype[setterName] = setter;
  const getterLEName = 'get' + type + 'LE';
  const setterLEName = 'set' + type + 'LE';
  const getterLE = new Function(`
    var result = this.dataView.${getterName}(this.position, true);
    this.position += ${bytes};
    return result;
  `);
  const setterLE = new Function('value', `
    this.dataView.${setterName}(this.position, value, true);
    this.position += ${bytes};
  `);
  DataBuffer.prototype[getterLEName] = getterLE;
  DataBuffer.prototype[setterLEName] = setterLE;

  // Create array accessors
  const getterArrayName = 'get' + type + 'Array';
  const setterArrayName = 'set' + type + 'Array';
  const getterArray = new Function('size', 'buffer', `
    var output = new ${type}Array(this.dataView.buffer, this.position, size);
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
    var output = new ${type}Array(this.dataView.buffer, this.position,
      maxSize);
    output.set(buffer);
    output.fill(0, buffer.length);
    this.position += maxSize;
  `);
  DataBuffer.prototype[getterArrayName] = getterArray;
  DataBuffer.prototype[setterArrayName] = setterArray;
});
