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
    maxSize: Infinity,
    size: function(namespace, value) {
      // Int8Array + uvar.
      let length = encoder.encode(value).length;
      return length + namespace.uvar.size(namespace, length);
    },
    encodeImpl: function(namespace, value, dataView) {
      let buffer = encoder.encode(value);
      namespace.uvar.encodeImpl(namespace, buffer.length, dataView);
      dataView.setUint8ArrayBE(buffer);
    },
    decodeImpl: function(namespace, dataView) {
      let size = namespace.uvar.decodeImpl(namespace, dataView);
      return decoder.decode(dataView.getUint8ArrayBE(size));
    },
  };
}

export function createUTF16StringEncoder(littleEndian) {
  return {
    name: 'String',
    locked: true,
    maxSize: Infinity,
    // So deterministic
    size: function(namespace, value) {
      let length = value.length * 2;
      return length + namespace.uvar.size(namespace, length);
    },
    encodeImpl: function(namespace, value, dataView) {
      namespace.uvar.encodeImpl(namespace, value.length * 2, dataView);
      for (let i = 0; i < value.length; ++i) {
        dataView.setUint16BE(value.charCodeAt(i), littleEndian);
      }
    },
    decodeImpl: function(namespace, dataView) {
      let size = namespace.uvar.decodeImpl(namespace, dataView) / 2;
      // If little endian is provided, we have to convert it word by word.
      if (littleEndian) {
        let data = new Uint16Array(size);
        for (let i = 0; i < size; ++i) {
          data.push(dataView.getUint16BE(littleEndian));
        }
        return String.fromCharCode.apply(null, data);
      } else {
        return String.fromCharCode.apply(null,
          dataView.getUint16ArrayBE(size * 2));
      }
    },
  };
}
