const builtInNamespace = {
  i8: {
    size: () => 1,
    encode: (value, dataView) => dataView.setInt8(value),
    decode: (dataView) => dataView.getInt8(),
  },
  u8: {
    size: () => 1,
    encode: (value, dataView) => dataView.setUint8(value),
    decode: (dataView) => dataView.getUint8(),
  },
  i16: {
    size: () => 2,
    encode: (value, dataView) => dataView.setInt16(value),
    decode: (dataView) => dataView.getInt16(),
  },
  u16: {
    size: () => 2,
    encode: (value, dataView) => dataView.setUint16(value),
    decode: (dataView) => dataView.getUint16(),
  },
  i32: {
    size: () => 4,
    encode: (value, dataView) => dataView.setInt32(value),
    decode: (dataView) => dataView.getInt32(),
  },
  u32: {
    size: () => 4,
    encode: (value, dataView) => dataView.setUint32(value),
    decode: (dataView) => dataView.getUint32(),
  },
};

// Creates namespace. So simple :P
export default function createNamespace() {
  return Object.assign({}, builtInNamespace);
}
