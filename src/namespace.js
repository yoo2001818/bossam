import CodeGenerator from './util/codeGenerator';
import createStringEncoder, { createUTF16StringEncoder }
  from './util/stringEncoder';

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
  f32: {
    name: 'f32',
    size: () => 4,
    encodeImpl: (value, dataView) => dataView.setFloat32(value),
    decodeImpl: (dataView) => dataView.getFloat32(),
    sizeCode: 'size += 4;\n',
    encodeCode: 'dataView.setFloat32(#value#);\n',
    decodeCode: '#value# = dataView.getFloat32();\n',
  },
  f64: {
    name: 'f64',
    size: () => 8,
    encodeImpl: (value, dataView) => dataView.setFloat64(value),
    decodeImpl: (dataView) => dataView.getFloat64(),
    sizeCode: 'size += 8;\n',
    encodeCode: 'dataView.setFloat64(#value#);\n',
    decodeCode: '#value# = dataView.getFloat64();\n',
  },
  'Array<_>': (state, generics) => {
    let type = state.resolveType(generics[0]);
    let numType = state.resolveType({ name: 'u32' });
    let codeGen = new CodeGenerator(state);
    let u8, nullFieldName;
    let nullable = generics[0].nullable;
    if (nullable) {
      // If the type is nullable, we have to use separate nullable fields to
      // spare some bits
      u8 = state.resolveType({ name: 'u8' });
      nullFieldName = 'nullCheck' + (Math.random() * 100000 | 0);
      codeGen.push(`var ${nullFieldName} = 0;`);
    }
    // TODO Even if it's randomized, maybe it can cause a problem? Not sure yet.
    let varName = 'arraySize' + (Math.random() * 100000 | 0);
    codeGen.pushTypeDecode(varName, numType, true);
    codeGen.pushEncode(`var ${varName} = #value#.length;`);
    codeGen.pushTypeEncode(varName, numType);
    codeGen.pushDecode(`#value# = new Array(${varName});`);
    codeGen.push(`for (var i = 0; i < ${varName}; ++i) {`);
    if (nullable) {
      // To match with decoding order, encoder must look ahead of the array
      // and save flags beforehand.
      codeGen.push('if (i % 8 === 0) {');
      codeGen.pushEncode(`${nullFieldName} = 0;`);
      codeGen.pushEncode(`var maxIdx = Math.min(8, ${varName} - i);`);
      codeGen.pushEncode('for (var j = 0; j < maxIdx; ++j) {');
      // Check flag / insert flag.
      codeGen.pushEncode(
        `${nullFieldName} |= #value#[i + j] == null ? 0 : (1 << j);`);
      codeGen.pushEncode('}');
      codeGen.pushType(nullFieldName, u8);
      codeGen.push('}');
      codeGen.push(`if (${nullFieldName} & (1 << (i % 8)) !== 0) {`);
    }
    codeGen.pushType('#value#[i]', type);
    if (nullable) {
      codeGen.push('}');
    }
    codeGen.push('}');
    return codeGen.compile();
  },
  String: createStringEncoder('utf-8'),
  'String<utf-16>': createUTF16StringEncoder('String<utf-16>', false),
  'String<utf-16be>': createUTF16StringEncoder('String<utf-16be>', false),
  'String<utf-16le>': createUTF16StringEncoder('String<utf-16le>', true),
  'String<_>': (state, generics) => {
    return createStringEncoder(generics[0].name);
  },
};

// Creates namespace. So simple :P
export default function createNamespace() {
  return Object.assign({}, builtInNamespace);
}
