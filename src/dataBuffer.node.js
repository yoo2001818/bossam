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
  setUint8ArrayBE(array) {
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
  getUint8ArrayBE(size, buffer) {
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
  setUint8ArrayLE(array) {
    return this.setUint8ArrayBE(array);
  }
  getUint8ArrayLE(size, buffer) {
    return this.getUint8ArrayBE(size, buffer);
  }
  fill(value, bytes) {
    this.buffer.fill(value, this.position, this.position + bytes);
    this.position += bytes;
  }
}

// Creates array encoder following system's native endian.
function createArrayNativeEncoder(type, bytes) {
  const getter = new Function('size', 'buffer', `
    var pos = this.position + this.buffer.byteOffset;
    var output;
    if (pos % ${bytes} === 0) {
      output = new ${type}Array(this.buffer.buffer, pos,
      size / ${bytes});
    } else {
      output = new ${type}Array(this.buffer.buffer.slice(
        pos, pos + size), 0);
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
    var pos = this.position + this.buffer.byteOffset;
    var bufferSize = ${bytes} * buffer.length;
    var maxSize = size == null ? bufferSize : size;
    if (this.position % ${bytes} === 0) {
      var output = new ${type}Array(this.buffer.buffer, pos, maxSize);
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
      var output = new Uint8Array(this.buffer.buffer, pos, maxSize);
      output.set(src);
      output.fill(0, bufferSize);
    }
    this.position += maxSize;
  `);
  return { getter, setter };
}

// Creates unoptimized array encoder with custom endian.
// endian: true if little endian, following DataView spec.
function createArrayEndianEncoder(type, bytes, name, endian) {
  let endianStr = '';
  if (bytes !== 1) {
    endianStr = endian ? 'LE' : 'BE';
  }
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
      output[i] = this.buffer.read${name}${endianStr}(this.position +
        i * ${bytes}, true);
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
      this.buffer.write${name}${endianStr}(buffer[i], this.position +
        i * ${bytes}, true);
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
  const getterLEArrayName = 'get' + type + 'ArrayLE';
  const setterLEArrayName = 'set' + type + 'ArrayLE';
  const getterBEArrayName = 'get' + type + 'ArrayBE';
  const setterBEArrayName = 'set' + type + 'ArrayBE';
  if (DataBuffer.prototype[getterLEArrayName] == null) {
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
      let nativeEncoder = createArrayNativeEncoder(type, bytes, name);
      DataBuffer.prototype[getterBEArrayName] = nativeEncoder.getter;
      DataBuffer.prototype[setterBEArrayName] = nativeEncoder.setter;
      // And hand-crafted little endian encoder.
      let endianEncoder = createArrayEndianEncoder(type, bytes, name, true);
      DataBuffer.prototype[getterLEArrayName] = endianEncoder.getter;
      DataBuffer.prototype[setterLEArrayName] = endianEncoder.setter;
    } else {
      // Little endian.
      let nativeEncoder = createArrayNativeEncoder(type, bytes, name);
      DataBuffer.prototype[getterLEArrayName] = nativeEncoder.getter;
      DataBuffer.prototype[setterLEArrayName] = nativeEncoder.setter;
      // And hand-crafted big endian encoder.
      let endianEncoder = createArrayEndianEncoder(type, bytes, name, false);
      DataBuffer.prototype[getterBEArrayName] = endianEncoder.getter;
      DataBuffer.prototype[setterBEArrayName] = endianEncoder.setter;
    }
  }
});
