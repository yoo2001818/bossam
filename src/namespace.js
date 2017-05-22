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
    'dataView.setInt8(#value#);',
    '#value# = dataView.getInt8();',
  ),
  u8: createPrimitive('u8', 1,
    'dataView.setUint8(#value#);',
    '#value# = dataView.getUint8();',
  ),
  i16: createPrimitive('i16', 2,
    'dataView.setInt16(#value#);',
    '#value# = dataView.getInt16();',
  ),
  u16: createPrimitive('u16', 2,
    'dataView.setUint16(#value#);',
    '#value# = dataView.getUint16();',
  ),
  i32: createPrimitive('i32', 4,
    'dataView.setInt32(#value#);',
    '#value# = dataView.getInt32();',
  ),
  u32: createPrimitive('u32', 4,
    'dataView.setUint32(#value#);',
    '#value# = dataView.getUint32();',
  ),
  u64: createPrimitive('u64', 8,
    'dataView.setUint32(Math.floor(#value# / Math.pow(2, 32)));\n' +
    'dataView.setUint32(#value# % Math.pow(2, 32));',
    '#value# = dataView.getUint32() * Math.pow(2, 32) + dataView.getUint32();',
  ),
  i64: createPrimitive('i64', 8,
    // If a positive number is provided, it can be encoded using u64 encode.
    // Negative number is more complicated - we have to calculate 2's
    // complement by hand.
    'if (#value# >= 0) {\n' +
    'dataView.setUint32((#value# / Math.pow(2, 32)) | 0);\n' +
    'dataView.setUint32(#value# % Math.pow(2, 32));\n' +
    '} else {\n' +
    // Since Javascript doesn't support carry result, we have to divide it into
    // 32bits / 31bits - and mux them in the right order. Ouch.
    'var high = (-#value# / Math.pow(2, 31)) | 0;\n' +
    'var low = -#value# % Math.pow(2, 31);\n' +
    'low = (low ^ 0x7fffffff) + 1;\n' +
    'var carry = (low & 0x80000000) !== 0;\n' +
    'high = (~high) + carry;\n' +
    // Finally, mux them...
    'dataView.setUint32(0x80000000 | (high >>> 1));\n' +
    'dataView.setUint32((low & 0x7fffffff) | ((high & 1) << 31));\n' +
    '}',
    // Decoding is also hard to implement.
    'var high = dataView.getUint32()\n' +
    'var low = dataView.getUint32()\n' +
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
    'dataView.setFloat32(#value#)',
    '#value# = dataView.getFloat32()',
  ),
  f64: createPrimitive('f64', 8,
    'dataView.setFloat64(#value#)',
    '#value# = dataView.getFloat64()',
  ),
  bool: createPrimitive('bool', 1,
    'dataView.setUint8(#value# ? 1 : 0)',
    '#value# = !!dataView.getUint8()',
  ),
  'Array<_>': createArrayEncoder,
  'Vec<_>': createArrayEncoder,
  'Array<_,#>': createArrayEncoder,
  'Vec<_,#>': createArrayEncoder,
  'String': createStringEncoder('utf-8'),
  'String<#>': (namespace, generics) => {
    return createStringEncoder(generics[0].name);
  },
  'Padded<_,#>': (namespace, generics) => {
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
  'Date': createPrimitive('Date', 8,
    'namespace.u64.encodeImpl(namespace, #value#.getTime(), dataView)',
    '#value# = new Date(namespace.u64.decodeImpl(namespace, dataView))',
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
