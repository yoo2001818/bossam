import * as ivar from './util/ivar';
import * as uvar from './util/uvar';
import createArrayEncoder from './arrayEncoder';
import CodeGenerator from './codeGenerator';
let createStringEncoder;
if (typeof Buffer !== 'undefined') {
  createStringEncoder = require('./stringEncoder.node').default;
} else {
  createStringEncoder = require('./stringEncoder').default;
}

function createPrimitive(name, size, encode, decode, maxSize) {
  let codeGen = new CodeGenerator();
  codeGen.sizeCode.push(`size += ${size};`);
  codeGen.encodeCode.push(`${encode}`);
  codeGen.decodeCode.push(`${decode}`);
  let result = codeGen.compile(maxSize == null ? size : maxSize);
  result.name = name;
  return result;
}

const builtInNamespace = {
  i8: createPrimitive('i8', 1,
    'dataView.setInt8BE(#value#);',
    '#value# = dataView.getInt8BE();',
  ),
  u8: createPrimitive('u8', 1,
    'dataView.setUint8BE(#value#);',
    '#value# = dataView.getUint8BE();',
  ),
  i16: createPrimitive('i16', 2,
    'dataView.setInt16BE(#value#);',
    '#value# = dataView.getInt16BE();',
  ),
  u16: createPrimitive('u16', 2,
    'dataView.setUint16BE(#value#);',
    '#value# = dataView.getUint16BE();',
  ),
  i32: createPrimitive('i32', 4,
    'dataView.setInt32BE(#value#);',
    '#value# = dataView.getInt32BE();',
  ),
  u32: createPrimitive('u32', 4,
    'dataView.setUint32BE(#value#);',
    '#value# = dataView.getUint32BE();',
  ),
  i8le: createPrimitive('i8le', 1,
    'dataView.setInt8LE(#value#);',
    '#value# = dataView.getInt8LE();',
  ),
  u8le: createPrimitive('u8le', 1,
    'dataView.setUint8LE(#value#);',
    '#value# = dataView.getUint8LE();',
  ),
  i16le: createPrimitive('i16le', 2,
    'dataView.setInt16LE(#value#);',
    '#value# = dataView.getInt16LE();',
  ),
  u16le: createPrimitive('u16le', 2,
    'dataView.setUint16LE(#value#);',
    '#value# = dataView.getUint16LE();',
  ),
  i32le: createPrimitive('i32le', 4,
    'dataView.setInt32LE(#value#);',
    '#value# = dataView.getInt32LE();',
  ),
  u32le: createPrimitive('u32le', 4,
    'dataView.setUint32LE(#value#);',
    '#value# = dataView.getUint32LE();',
  ),
  u48: createPrimitive('u48', 6,
    'dataView.setUint16BE(Math.floor(#value# / Math.pow(2, 32)));\n' +
    'dataView.setUint32BE(#value# % Math.pow(2, 32));',
    '#value# = dataView.getUint16BE() * Math.pow(2, 32) + ' +
      'dataView.getUint32BE();',
  ),
  u48le: createPrimitive('u48le', 6,
    'dataView.setUint32LE(#value# % Math.pow(2, 32));\n' +
    'dataView.setUint16LE(Math.floor(#value# / Math.pow(2, 32)));',
    '#value# = dataView.getUint32LE() + ' +
    'dataView.getUint16LE() * Math.pow(2, 32);',
  ),
  u64: createPrimitive('u64', 8,
    'dataView.setUint32BE(Math.floor(#value# / Math.pow(2, 32)));\n' +
    'dataView.setUint32BE(#value# % Math.pow(2, 32));',
    '#value# = dataView.getUint32BE() * Math.pow(2, 32) + ' +
      'dataView.getUint32BE();',
  ),
  i64: createPrimitive('i64', 8,
    // If a positive number is provided, it can be encoded using u64 encode.
    // Negative number is more complicated - we have to calculate 2's
    // complement by hand.
    'if (#value# >= 0) {\n' +
    'dataView.setUint32BE((#value# / Math.pow(2, 32)) | 0);\n' +
    'dataView.setUint32BE(#value# % Math.pow(2, 32));\n' +
    '} else {\n' +
    // Since Javascript doesn't support carry result, we have to divide it into
    // 32bits / 31bits - and mux them in the right order. Ouch.
    'var high = (-#value# / Math.pow(2, 31)) | 0;\n' +
    'var low = -#value# % Math.pow(2, 31);\n' +
    'low = (low ^ 0x7fffffff) + 1;\n' +
    'var carry = (low & 0x80000000) !== 0;\n' +
    'high = (~high) + carry;\n' +
    // Finally, mux them...
    'dataView.setUint32BE(0x80000000 | (high >>> 1));\n' +
    'dataView.setUint32BE((low & 0x7fffffff) | ((high & 1) << 31));\n' +
    '}',
    // Decoding is also hard to implement.
    'var high = dataView.getUint32BE()\n' +
    'var low = dataView.getUint32BE()\n' +
    'if ((high & 0x80000000) !== 0) {\n' +
    // Use 2's complement in here too..
    'high = (high << 1) | (low >>> 31);\n' +
    'low = ((~low) & 0x7fffffff) + 1;\n' +
    'var carry = low >>> 31;\n' +
    'high = ((~high) >>> 0) + carry;\n' +
    '#value# = -(high * Math.pow(2, 31) + (low & 0x7fffffff));\n' +
    '} else {' +
    // Positive numbers are easy to implement.
    '#value# = high * Math.pow(2, 32) + low;\n' +
    '}'
  ),
  // TODO Remove duplicate code
  u64le: createPrimitive('u64le', 8,
    'dataView.setUint32LE(#value# % Math.pow(2, 32));\n' +
    'dataView.setUint32LE(Math.floor(#value# / Math.pow(2, 32)));',
    '#value# = dataView.getUint32LE() + ' +
    'dataView.getUint32LE() * Math.pow(2, 32);',
  ),
  i64le: createPrimitive('i64le', 8,
    // If a positive number is provided, it can be encoded using u64 encode.
    // Negative number is more complicated - we have to calculate 2's
    // complement by hand.
    'if (#value# >= 0) {\n' +
    'dataView.setUint32LE(#value# % Math.pow(2, 32));\n' +
    'dataView.setUint32LE((#value# / Math.pow(2, 32)) | 0);\n' +
    '} else {\n' +
    // Since Javascript doesn't support carry result, we have to divide it into
    // 32bits / 31bits - and mux them in the right order. Ouch.
    'var high = (-#value# / Math.pow(2, 31)) | 0;\n' +
    'var low = -#value# % Math.pow(2, 31);\n' +
    'low = (low ^ 0x7fffffff) + 1;\n' +
    'var carry = (low & 0x80000000) !== 0;\n' +
    'high = (~high) + carry;\n' +
    // Finally, mux them...
    'dataView.setUint32LE((low & 0x7fffffff) | ((high & 1) << 31));\n' +
    'dataView.setUint32LE(0x80000000 | (high >>> 1));\n' +
    '}',
    // Decoding is also hard to implement.
    'var low = dataView.getUint32LE()\n' +
    'var high = dataView.getUint32LE()\n' +
    'if ((high & 0x80000000) !== 0) {\n' +
    // Use 2's complement in here too..
    'high = (high << 1) | (low >>> 31);\n' +
    'low = ((~low) & 0x7fffffff) + 1;\n' +
    'var carry = low >>> 31;\n' +
    'high = ((~high) >>> 0) + carry;\n' +
    '#value# = -(high * Math.pow(2, 31) + (low & 0x7fffffff));\n' +
    '} else {' +
    // Positive numbers are easy to implement.
    '#value# = high * Math.pow(2, 32) + low;\n' +
    '}'
  ),
  // ivar and uvar needs ivar, uvar objects which aren't available on the
  // compiled scope
  ivar: {
    name: 'ivar',
    locked: true,
    maxSize: 5,
    size: (namespace, value) => ivar.getIntSize(value),
    encodeImpl: (namespace, value, dataView) => ivar.setIntVar(value, dataView),
    decodeImpl: (namespace, dataView) => ivar.getIntVar(dataView),
  },
  uvar: {
    name: 'uvar',
    locked: true,
    maxSize: 5,
    size: (namespace, value) => uvar.getUintSize(value),
    encodeImpl: (namespace, value, dataView) =>
      uvar.setUintVar(value, dataView),
    decodeImpl: (namespace, dataView) => uvar.getUintVar(dataView),
  },
  f32: createPrimitive('f32', 4,
    'dataView.setFloat32BE(#value#)',
    '#value# = dataView.getFloat32BE()',
  ),
  f64: createPrimitive('f64', 8,
    'dataView.setFloat64BE(#value#)',
    '#value# = dataView.getFloat64BE()',
  ),
  f32le: createPrimitive('f32le', 4,
    'dataView.setFloat32LE(#value#);',
    '#value# = dataView.getFloat32LE();',
  ),
  f64le: createPrimitive('f64le', 8,
    'dataView.setFloat64LE(#value#);',
    '#value# = dataView.getFloat64LE();',
  ),
  bool: createPrimitive('bool', 1,
    'dataView.setUint8BE(#value# ? 1 : 0)',
    '#value# = !!dataView.getUint8BE()',
  ),
  'Array<_>': createArrayEncoder,
  'Vec<_>': createArrayEncoder,
  'Array<_,_>': createArrayEncoder,
  'Vec<_,_>': createArrayEncoder,
  'String': createStringEncoder('utf-8'),
  'String<_>': (namespace, generics) => {
    return createStringEncoder(generics[0].name);
  },
  'Padded<_,_>': (namespace, generics) => {
    let type = namespace.resolveType(generics[0]);
    let size = generics[1].name;
    let codeGen = new CodeGenerator(namespace);
    let posVar = 'pos' + (namespace._refs++);
    if (generics[0].nullable) {
      // TODO Implement nullable, but maybe it'd be better to forward it?
      throw new Error('Nullable objects are unsupported by Padded<T,S> - ' +
        'Please move it outside of Padded<T,S>, so it would be ?Padded<T,S>, ' +
        'instead of Padded<?T,S>.');
    }
    // Record start position
    codeGen.pushEncodeOnly(`var ${posVar} = dataView.position;`);
    codeGen.pushDecode(`var ${posVar} = dataView.position;`);
    codeGen.pushSize(`size += ${size};`);
    // Decode / encode type normally
    codeGen.pushTypeEncode('#value#', type, true);
    codeGen.pushTypeDecode('#value#', type);
    // Check diff and fill it. If the diff is lower than 0, throw an error
    // since the request cannot be satisfied - overflow.
    let posVarSetCode = `
      ${posVar} = dataView.position - ${posVar};
      if (${posVar} > ${size}) {
        throw new Error('Encoded ${type.name} is larger than requested Padded' +
          ' size. Shouldn\\'t be larger than ${size} bytes but was ' +
          ${posVar} + ' bytes long');
      }
    `;
    codeGen.pushDecode(posVarSetCode);
    codeGen.pushEncodeOnly(posVarSetCode);
    // If being decoded, just fast-forward. But it should be zero-filled while
    // encoding - it's not safe (We're using unsafe methods in Node.js variant)
    codeGen.pushDecode(`dataView.position += ${size} - ${posVar};`);
    codeGen.pushEncodeOnly(`dataView.fill(0, ${size} - ${posVar});`);
    return codeGen.compile(size);
  },
  Date: createPrimitive('Date', 8,
    'namespace.u64.encodeImpl(namespace, #value#.getTime(), dataView)',
    '#value# = new Date(namespace.u64.decodeImpl(namespace, dataView))',
  ),
  JSON: createPrimitive('JSON',
    'namespace.String.size(namespace, JSON.stringify(#value#))',
    'namespace.String.encodeImpl(namespace, JSON.stringify(#value#), dataView)',
    '#value# = JSON.parse(namespace.String.decodeImpl(namespace, dataView))',
  ),
  _refs: 0,
};

// Creates namespace. So simple :P
export default function createNamespace() {
  let namespace = Object.create(builtInNamespace);
  // Create empty AST
  namespace.ast = {};
  return namespace;
}
