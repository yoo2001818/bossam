import * as ivar from './util/ivar';
import * as uvar from './util/uvar';
let createStringEncoder;
if (typeof Buffer !== 'undefined') {
  createStringEncoder = require('./stringEncoder.node').default;
} else {
  createStringEncoder = require('./stringEncoder').default;
}
import createArrayEncoder from './arrayEncoder';

const builtInNamespace = {
  i8: {
    name: 'i8',
    maxSize: 1,
    size: () => 1,
    encodeImpl: (value, dataView) => dataView.setInt8(value),
    decodeImpl: (dataView) => dataView.getInt8(),
    sizeCode: 'size += 1;\n',
    encodeCode: 'dataView.setInt8(#value#);\n',
    decodeCode: '#value# = dataView.getInt8();\n',
  },
  u8: {
    name: 'u8',
    maxSize: 1,
    size: () => 1,
    encodeImpl: (value, dataView) => dataView.setUint8(value),
    decodeImpl: (dataView) => dataView.getUint8(),
    sizeCode: 'size += 1;\n',
    encodeCode: 'dataView.setUint8(#value#);\n',
    decodeCode: '#value# = dataView.getUint8();\n',
  },
  i16: {
    name: 'i16',
    maxSize: 2,
    size: () => 2,
    encodeImpl: (value, dataView) => dataView.setInt16(value),
    decodeImpl: (dataView) => dataView.getInt16(),
    sizeCode: 'size += 2;\n',
    encodeCode: 'dataView.setInt16(#value#);\n',
    decodeCode: '#value# = dataView.getInt16();\n',
  },
  u16: {
    name: 'u16',
    maxSize: 2,
    size: () => 2,
    encodeImpl: (value, dataView) => dataView.setUint16(value),
    decodeImpl: (dataView) => dataView.getUint16(),
    sizeCode: 'size += 2;\n',
    encodeCode: 'dataView.setUint16(#value#);\n',
    decodeCode: '#value# = dataView.getUint16();\n',
  },
  i32: {
    name: 'i32',
    maxSize: 4,
    size: () => 4,
    encodeImpl: (value, dataView) => dataView.setInt32(value),
    decodeImpl: (dataView) => dataView.getInt32(),
    sizeCode: 'size += 4;\n',
    encodeCode: 'dataView.setInt32(#value#);\n',
    decodeCode: '#value# = dataView.getInt32();\n',
  },
  u32: {
    name: 'u32',
    maxSize: 4,
    size: () => 4,
    encodeImpl: (value, dataView) => dataView.setUint32(value),
    decodeImpl: (dataView) => dataView.getUint32(),
    sizeCode: 'size += 4;\n',
    encodeCode: 'dataView.setUint32(#value#);\n',
    decodeCode: '#value# = dataView.getUint32();\n',
  },
  ivar: {
    name: 'ivar',
    locked: true,
    maxSize: 5,
    size: (value) => ivar.getIntSize(value),
    encodeImpl: (value, dataView) => ivar.setIntVar(value, dataView),
    decodeImpl: (dataView) => ivar.getIntVar(dataView),
  },
  uvar: {
    name: 'uvar',
    locked: true,
    maxSize: 5,
    size: (value) => uvar.getUintSize(value),
    encodeImpl: (value, dataView) => uvar.setUintVar(value, dataView),
    decodeImpl: (dataView) => uvar.getUintVar(dataView),
  },
  f32: {
    name: 'f32',
    maxSize: 4,
    size: () => 4,
    encodeImpl: (value, dataView) => dataView.setFloat32(value),
    decodeImpl: (dataView) => dataView.getFloat32(),
    sizeCode: 'size += 4;\n',
    encodeCode: 'dataView.setFloat32(#value#);\n',
    decodeCode: '#value# = dataView.getFloat32();\n',
  },
  f64: {
    name: 'f64',
    maxSize: 4,
    size: () => 8,
    encodeImpl: (value, dataView) => dataView.setFloat64(value),
    decodeImpl: (dataView) => dataView.getFloat64(),
    sizeCode: 'size += 8;\n',
    encodeCode: 'dataView.setFloat64(#value#);\n',
    decodeCode: '#value# = dataView.getFloat64();\n',
  },
  'bool': {
    name: 'bool',
    maxSize: 1,
    size: () => 1,
    encodeImpl: (value, dataView) => dataView.setUint8(value ? 1 : 0),
    decodeImpl: (dataView) => !!dataView.getUint8(),
    sizeCode: 'size += 1;\n',
    encodeCode: 'dataView.setUint8(#value# ? 1 : 0);\n',
    decodeCode: '#value# = !!dataView.getUint8();\n',
  },
  'Array<_>': createArrayEncoder,
  'Vec<_>': createArrayEncoder,
  'Array<_,_>': createArrayEncoder,
  'Vec<_,_>': createArrayEncoder,
  String: createStringEncoder('utf-8'),
  'String<_>': (state, generics) => {
    return createStringEncoder(generics[0].name);
  },
  _refs: 0,
};

// Creates namespace. So simple :P
export default function createNamespace() {
  return Object.assign({}, builtInNamespace);
}
