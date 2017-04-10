import { TextEncoder, TextDecoder } from 'text-encoding';

export default function createStringEncoder(charset = 'utf-8') {
  // TODO Because TextEncoder doesn't provide a method to retrieve the size of
  // the string, we should cache the results.
  let encoder = new TextEncoder(charset);
  let decoder = new TextDecoder(charset);
  return {
    name: 'String',
    // Deny inlining the code
    locked: true,
    size: (value) => {
      // Int8Array + u32.
      return encoder.encode(value).length + 4;
    },
    encodeImpl: (value, dataView) => {
      let buffer = decoder.encode(value);
      dataView.setUint32(buffer.length);
      dataView.setUint8Array(buffer);
    },
    decodeImpl: (dataView) => {
      let size = dataView.getUint32();
      return decoder.decode(dataView.getUint8Array(size));
    },
  };
}

export function createUTF16StringEncoder(name, littleEndian) {
  return {
    name,
    locked: true,
    // So deterministic
    size: (value) => value.length * 2 + 4,
    encodeImpl: (value, dataView) => {
      dataView.setUint32(value.length);
      for (let i = 0; i < value.length; ++i) {
        dataView.setUint16(value.charCodeAt(i), littleEndian);
      }
    },
    decodeImpl: (dataView) => {
      let size = dataView.getUint32();
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
