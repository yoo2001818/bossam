import createStringEncoder from './stringEncoder';

export default function chooseStringEncoder(charset = 'utf-8') {
  // Handle some cases like utf-16 with Node.js native encoding
  switch (charset) {
    case 'utf-8':
      return createNodeStringEncoder('utf8');
    case 'utf-16le':
      return createNodeStringEncoder('utf16le');
    default:
      return createStringEncoder(charset);
  }
}

export function createNodeStringEncoder(charset) {
  return {
    name: 'String',
    maxSize: Infinity,
    locked: true,
    size: function(namespace, value) {
      let length = Buffer.byteLength(value, charset);
      return length + namespace.uvar.size(namespace, length);
    },
    encodeImpl: function(namespace, value, dataView) {
      let size = Buffer.byteLength(value, charset);
      namespace.uvar.encodeImpl(namespace, size, dataView);
      dataView.setString(size, value, charset);
    },
    decodeImpl: function(namespace, dataView) {
      return dataView.getString(namespace.uvar.decodeImpl(
        namespace, dataView), charset);
    },
    sizeCode: `var length = Buffer.byteLength(#value#, "${charset}");\n` +
      'size += length + namespace.uvar.size(namespace, length);',
    encodeCode: `var size = Buffer.byteLength(#value#, "${charset}");\n` +
    `namespace.uvar.encodeImpl(namespace, size, dataView);\n` +
    `dataView.setString(size, #value#, "${charset}");\n`,
    decodeCode:
      `#value# = dataView.getString(namespace.uvar.decodeImpl(` +
      `namespace, dataView), "${charset}");\n`,
  };
}
