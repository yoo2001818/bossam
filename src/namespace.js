import CodeGenerator from './util/codeGenerator';

const builtInNamespace = {
  i8: {
    name: 'i8',
    size: () => 1,
    encodeImpl: (value, dataView) => dataView.setInt8(value),
    decodeImpl: (dataView) => dataView.getInt8(),
    sizeCode: 'size += 1;\n',
    encodeCode: 'dataView.setInt8(#value#);\n',
    decodeCode: '#value# = dataView.getInt8();\n',
  },
  u8: {
    name: 'u8',
    size: () => 1,
    encodeImpl: (value, dataView) => dataView.setUint8(value),
    decodeImpl: (dataView) => dataView.getUint8(),
    sizeCode: 'size += 1;\n',
    encodeCode: 'dataView.setUint8(#value#);\n',
    decodeCode: '#value# = dataView.getUint8();\n',
  },
  i16: {
    name: 'i16',
    size: () => 2,
    encodeImpl: (value, dataView) => dataView.setInt16(value),
    decodeImpl: (dataView) => dataView.getInt16(),
    sizeCode: 'size += 2;\n',
    encodeCode: 'dataView.setInt16(#value#);\n',
    decodeCode: '#value# = dataView.getInt16();\n',
  },
  u16: {
    name: 'u16',
    size: () => 2,
    encodeImpl: (value, dataView) => dataView.setUint16(value),
    decodeImpl: (dataView) => dataView.getUint16(),
    sizeCode: 'size += 2;\n',
    encodeCode: 'dataView.setUint16(#value#);\n',
    decodeCode: '#value# = dataView.getUint16();\n',
  },
  i32: {
    name: 'i32',
    size: () => 4,
    encodeImpl: (value, dataView) => dataView.setInt32(value),
    decodeImpl: (dataView) => dataView.getInt32(),
    sizeCode: 'size += 4;\n',
    encodeCode: 'dataView.setInt32(#value#);\n',
    decodeCode: '#value# = dataView.getInt32();\n',
  },
  u32: {
    name: 'u32',
    size: () => 4,
    encodeImpl: (value, dataView) => dataView.setUint32(value),
    decodeImpl: (dataView) => dataView.getUint32(),
    sizeCode: 'size += 4;\n',
    encodeCode: 'dataView.setUint32(#value#);\n',
    decodeCode: '#value# = dataView.getUint32();\n',
  },
  'Array<_>': (state, generics) => {
    let type = state.resolveType(generics[0]);
    let numType = state.resolveType({ name: 'u32' });
    let codeGen = new CodeGenerator(state);
    // TODO Even if it's randomized, maybe it can cause a problem? Not sure yet.
    let varName = 'arraySize' + (Math.random() * 100000 | 0);
    codeGen.pushTypeDecode(varName, numType, true);
    codeGen.pushEncode(`var ${varName} = #value#.length;`);
    codeGen.pushTypeEncode(varName, numType);
    codeGen.pushDecode(`#value# = new Array(${varName});`);
    codeGen.push(`for (var i = 0; i < ${varName}; ++i) {`);
    codeGen.pushType('#value#[i]', type);
    codeGen.push('}');
    return codeGen.compile();
  },
  String: {
    name: 'String',
    locked: true,
  },
};

// Creates namespace. So simple :P
export default function createNamespace() {
  return Object.assign({}, builtInNamespace);
}
