// TODO Load TextEncoder / TextDecoder polyfill
export default function createStringEncoder() {
  // TODO Because TextEncoder doesn't provide a method to retrieve the size of
  // the string, we should cache the results.
  let encoder = new TextEncoder('utf-8');
  let decoder = new TextDecoder('utf-8');
  return {
    name: 'String',
    // Deny JIT
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
