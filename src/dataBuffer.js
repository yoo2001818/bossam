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
  fill(value, bytes) {
    this.buffer.fill(value, this.position, this.position + bytes);
    this.position += bytes;
  }
}

// Creates array encoder following system's native endian.
function createArrayNativeEncoder(type, bytes) {
  const getter = new Function('size', 'buffer', `
    var output;
    if (this.position % ${bytes} === 0) {
      output = new ${type}Array(this.dataView.buffer, this.position,
        size / ${bytes});
    } else {
      output = new ${type}Array(this.dataView.buffer.slice(this.position,
        this.position + size), 0);
    }
    this.position += size;
    if (buffer != null) {
      if (buffer.length > size / ${bytes}) {
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
  const setter = new Function('buffer', 'size', `
    var bufferSize = ${bytes} * buffer.length;
    var maxSize = size == null ? bufferSize : size;
    if (this.position % ${bytes} === 0) {
      var output = new ${type}Array(this.dataView.buffer, this.position,
        maxSize);
      output.set(buffer);
      output.fill(0, buffer.length);
    } else {
      var src;
      if (buffer instanceof ${type}Array) {
        src = new Uint8Array(buffer.buffer, buffer.byteOffset,
          buffer.byteLength);
      } else {
        src = new Uint8Array(new ${type}Array(buffer).buffer, 0);
      }
      var output = new Uint8Array(this.dataView.buffer, this.position, maxSize);
      output.set(src);
      output.fill(0, bufferSize);
    }
    this.position += maxSize;
  `);
  return { getter, setter };
}

// Creates unoptimized array encoder with custom endian.
// endian: true if little endian, following DataView spec.
function createArrayEndianEncoder(type, bytes, endian) {
  const getter = new Function('size', 'buffer', `
    var sizeCount = size / ${bytes};
    var output;
    if (buffer != null) {
      output = buffer;
      if (buffer.length > sizeCount) {
        throw new Error('Buffer size is smaller than requested size');
      }
    } else {
      output = new ${type}Array(sizeCount);
    }
    for (var i = 0; i < sizeCount; ++i) {
      output[i] = this.dataView.get${type}(this.position +
        i * ${bytes}, ${endian});
    }
    this.position += size;
    return output;
  `);
  // It may look weird because the arguments order is different from getter,
  // but it's alright because 'size' is optional in setter, and 'buffer' is
  // optional in getter.
  const setter = new Function('buffer', 'size', `
    var maxSize = size == null ? buffer.length : size / ${bytes};
    var minSize = Math.min(maxSize, buffer.length);
    for (var i = 0; i < minSize; ++i) {
      this.dataView.set${type}(this.position + i * ${bytes},
        buffer[i], ${endian});
    }
    if (maxSize !== minSize) {
      this.buffer.fill(0, this.position + minSize * ${bytes},
        this.position + maxSize * ${bytes});
    }
    this.position += maxSize * ${bytes};
  `);
  return { getter, setter };
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
  const getterBEName = 'get' + type + 'BE';
  const setterBEName = 'set' + type + 'BE';
  const getterBE = new Function(`
    var result = this.dataView.${getterName}(this.position);
    this.position += ${bytes};
    return result;
  `);
  const setterBE = new Function('value', `
    this.dataView.${setterName}(this.position, value);
    this.position += ${bytes};
  `);
  DataBuffer.prototype[getterBEName] = getterBE;
  DataBuffer.prototype[setterBEName] = setterBE;
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
  const getterLEArrayName = 'get' + type + 'ArrayLE';
  const setterLEArrayName = 'set' + type + 'ArrayLE';
  const getterBEArrayName = 'get' + type + 'ArrayBE';
  const setterBEArrayName = 'set' + type + 'ArrayBE';
  if (bytes !== 1) {
    // Check endianness of the computer: The typed array view types operate
    // with the endianness of the host computer. :(
    // Modern computers doesn't use middle endian at all - it can be simply
    // ignored.
    let a = new Uint16Array([0x1234]);
    let b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    let isBigEndian = b[0] === 0x12;
    if (isBigEndian) {
      // Most systems don't use big endian, however we have to make sure that
      // all systems are compatiable
      let nativeEncoder = createArrayNativeEncoder(type, bytes);
      DataBuffer.prototype[getterBEArrayName] = nativeEncoder.getter;
      DataBuffer.prototype[setterBEArrayName] = nativeEncoder.setter;
      // And hand-crafted little endian encoder.
      let endianEncoder = createArrayEndianEncoder(type, bytes, true);
      DataBuffer.prototype[getterLEArrayName] = endianEncoder.getter;
      DataBuffer.prototype[setterLEArrayName] = endianEncoder.setter;
    } else {
      // Little endian.
      let nativeEncoder = createArrayNativeEncoder(type, bytes);
      DataBuffer.prototype[getterLEArrayName] = nativeEncoder.getter;
      DataBuffer.prototype[setterLEArrayName] = nativeEncoder.setter;
      // And hand-crafted big endian encoder.
      let endianEncoder = createArrayEndianEncoder(type, bytes, false);
      DataBuffer.prototype[getterBEArrayName] = endianEncoder.getter;
      DataBuffer.prototype[setterBEArrayName] = endianEncoder.setter;
    }
  } else {
    let nativeEncoder = createArrayNativeEncoder(type, bytes);
    DataBuffer.prototype[getterBEArrayName] = nativeEncoder.getter;
    DataBuffer.prototype[setterBEArrayName] = nativeEncoder.setter;
    DataBuffer.prototype[getterLEArrayName] = nativeEncoder.getter;
    DataBuffer.prototype[setterLEArrayName] = nativeEncoder.setter;
  }
});
