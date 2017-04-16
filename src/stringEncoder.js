import { TextEncoder, TextDecoder } from 'text-encoding';

export default function createStringEncoder(charset = 'utf-8') {
  if (charset === 'utf-16') return createUTF16StringEncoder();
  if (charset === 'utf-16be') return createUTF16StringEncoder();
  if (charset === 'utf-16le') return createUTF16StringEncoder(true);
  // TODO Because TextEncoder doesn't provide a method to retrieve the size of
  // the string, we should cache the results.
  let encoder = new TextEncoder(charset);
  let decoder = new TextDecoder(charset);
  return {
    name: 'String',
    // Deny inlining the code
    locked: true,
    size: function(value) {
      // Int8Array + uvar.
      let length = encoder.encode(value).length;
      return length + this.uvar.size(length);
    },
    encodeImpl: function(value, dataView) {
      let buffer = encoder.encode(value);
      this.uvar.encodeImpl(buffer.length, dataView);
      dataView.setUint8Array(buffer);
    },
    decodeImpl: function(dataView) {
      let size = this.uvar.decodeImpl(dataView);
      return decoder.decode(dataView.getUint8Array(size));
    },
  };
}

export function createUTF16StringEncoder(littleEndian) {
  return {
    name: 'String',
    locked: true,
    // So deterministic
    size: function(value) {
      let length = value.length * 2;
      return length + this.uvar.size(length);
    },
    encodeImpl: function(value, dataView) {
      this.uvar.encodeImpl(value.length * 2, dataView);
      for (let i = 0; i < value.length; ++i) {
        dataView.setUint16(value.charCodeAt(i), littleEndian);
      }
    },
    decodeImpl: function(dataView) {
      let size = this.uvar.decodeImpl(dataView) / 2;
      // If little endian is provided, we have to convert it word by word.
      if (littleEndian) {
        let data = new Uint16Array(size);
        for (let i = 0; i < size; ++i) {
          data.push(dataView.getUint16(littleEndian));
        }
        return String.fromCharCode.apply(null, data);
      } else {
        return String.fromCharCode.apply(null,
          dataView.getUint16Array(size * 2));
      }
    },
  };
}
