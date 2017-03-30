import getIdentifier from './util/getIdentifier';

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
  'Array<_>': (generics, state) => {
    const { namespace } = state;
    // Built-in template function is really weird to implement.
    let key = getIdentifier({ name: 'Array' }, generics);
    if (namespace[key] != null) return namespace[key];
    const keyword = generics[0];
    let name = keyword.generic ? generics[keyword.name].name : keyword.name;
    let typeGenerics = keyword.generics && keyword.generics.map(
      v => v.generic ? generics[v.name] : v);
    state.resolveBlock(name, typeGenerics);
    // When we use direct reference, this will be changed to use output of
    // resolveBlock function.
    let typeName = getIdentifier({ name }, typeGenerics);
    return namespace[key] = {
      size: (value) => {
        let size = 0;
        size += 4;
        for (let i = 0; i < value.length; ++i) {
          size += namespace[typeName].size(value[i]);
        }
        return size;
      },
      encode: (value, dataView) => {
        dataView.setInt32(value.length);
        for (let i = 0; i < value.length; ++i) {
          namespace[typeName].encode(value[i], dataView);
        }
      },
      decode: (value, dataView) => {
        let size = dataView.getInt32(value.length);
        let output = new Array(size);
        for (let i = 0; i < size; ++i) {
          output[size] = namespace[typeName].decode(dataView);
        }
      },
    };
  },
  String: {
    size: (value) => 0,
    encode: (value, dataView) => {
      // TODO
    },
    decode: (value, dataView) => {
      // TODO
    },
  },
};

// Creates namespace. So simple :P
export default function createNamespace() {
  return Object.assign({}, builtInNamespace);
}
