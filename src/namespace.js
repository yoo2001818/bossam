import * as ivar from './util/ivar';
import * as uvar from './util/uvar';
let createStringEncoder;
if (typeof Buffer !== 'undefined') {
  createStringEncoder = require('./stringEncoder.node').default;
} else {
  createStringEncoder = require('./stringEncoder').default;
}
import createArrayEncoder from './arrayEncoder';
import CodeGenerator from './codeGenerator';

function createPrimitive(name, size, encode, decode, maxSize) {
  let codeGen = new CodeGenerator();
  codeGen.sizeCode.push(`size += ${size};`);
  codeGen.encodeCode.push(encode);
  codeGen.decodeCode.push(`#value# = ${decode}`);
  let result = codeGen.compile(maxSize == null ? size : maxSize);
  result.name = name;
  return result;
}

const builtInNamespace = {
  i8: createPrimitive('i8', 1,
    'dataView.setInt8(#value#)',
    'dataView.getInt8()',
  ),
  u8: createPrimitive('u8', 1,
    'dataView.setUint8(#value#)',
    'dataView.getUint8()',
  ),
  i16: createPrimitive('i16', 2,
    'dataView.setInt16(#value#)',
    'dataView.getInt16()',
  ),
  u16: createPrimitive('u16', 2,
    'dataView.setUint16(#value#)',
    'dataView.getUint16()',
  ),
  i32: createPrimitive('i32', 4,
    'dataView.setInt32(#value#)',
    'dataView.getInt32()',
  ),
  u32: createPrimitive('u32', 4,
    'dataView.setUint32(#value#)',
    'dataView.getUint32()',
  ),
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
  f32: createPrimitive('f32', 4,
    'dataView.setFloat32(#value#)',
    'dataView.getFloat32()',
  ),
  f64: createPrimitive('f64', 8,
    'dataView.setFloat64(#value#)',
    'dataView.getFloat64()',
  ),
  bool: createPrimitive('bool', 1,
    'dataView.setUint8(#value# ? 1 : 0)',
    '!!dataView.getUint8()',
  ),
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
