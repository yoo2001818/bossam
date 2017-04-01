import CodeGenerator from './util/codeGenerator';

const builtInNamespace = {
  i8: {
    size: () => 1,
    encode: (value, dataView) => dataView.setInt8(value),
    decode: (dataView) => dataView.getInt8(),
    sizeCode: 'size += 1;\n',
    encodeCode: 'dataView.setInt8(#value#);\n',
    decodeCode: '#value# = dataView.getInt8();\n',
  },
  u8: {
    size: () => 1,
    encode: (value, dataView) => dataView.setUint8(value),
    decode: (dataView) => dataView.getUint8(),
    sizeCode: 'size += 1;\n',
    encodeCode: 'dataView.setUint8(#value#);\n',
    decodeCode: '#value# = dataView.getUint8();\n',
  },
  i16: {
    size: () => 2,
    encode: (value, dataView) => dataView.setInt16(value),
    decode: (dataView) => dataView.getInt16(),
    sizeCode: 'size += 2;\n',
    encodeCode: 'dataView.setInt16(#value#);\n',
    decodeCode: '#value# = dataView.getInt16();\n',
  },
  u16: {
    size: () => 2,
    encode: (value, dataView) => dataView.setUint16(value),
    decode: (dataView) => dataView.getUint16(),
    sizeCode: 'size += 2;\n',
    encodeCode: 'dataView.setUint16(#value#);\n',
    decodeCode: '#value# = dataView.getUint16();\n',
  },
  i32: {
    size: () => 4,
    encode: (value, dataView) => dataView.setInt32(value),
    decode: (dataView) => dataView.getInt32(),
    sizeCode: 'size += 4;\n',
    encodeCode: 'dataView.setInt32(#value#);\n',
    decodeCode: '#value# = dataView.getInt32();\n',
  },
  u32: {
    size: () => 4,
    encode: (value, dataView) => dataView.setUint32(value),
    decode: (dataView) => dataView.getUint32(),
    sizeCode: 'size += 4;\n',
    encodeCode: 'dataView.setUint32(#value#);\n',
    decodeCode: '#value# = dataView.getUint32();\n',
  },
  'Array<_>': (generics, state) => {
    let typeName = state.resolveType(generics[0]);
    let codeGen = new CodeGenerator(state);
    // TODO Even if it's randomized, maybe it can cause a problem? Not sure yet.
    let varName = 'arraySize' + (Math.random() * 100000 | 0);
    codeGen.pushTypeDecode(varName, 'u32', true);
    codeGen.pushEncode(`var ${varName} = #value#.length;`);
    codeGen.pushTypeEncode(varName, 'u32');
    codeGen.pushDecode(`#value# = new Array(${varName});`);
    codeGen.push(`for (var i = 0; i < ${varName}; ++i) {`);
    codeGen.pushType('#value#[i]', typeName);
    codeGen.push('}');
    return codeGen.compile();
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
