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
    size: function(value) {
      let length = Buffer.byteLength(value, charset);
      return length + this.uvar.size(length);
    },
    encodeImpl: function(value, dataView) {
      let size = Buffer.byteLength(value, charset);
      this.uvar.encodeImpl(size, dataView);
      dataView.setString(size, value, charset);
    },
    decodeImpl: function(dataView) {
      return dataView.getString(this.uvar.decodeImpl(dataView), charset);
    },
    sizeCode: `var length = Buffer.byteLength(#value#, "${charset}");\n` +
      'size += length + this.uvar.size(length);',
    encodeCode: `var size = Buffer.byteLength(#value#, "${charset}");\n` +
    `this.uvar.encodeImpl(size, dataView);\n` +
    `dataView.setString(size, #value#, "${charset}");\n`,
    decodeCode:
      `#value# = dataView.getString(this.uvar.decodeImpl(dataView), ` +
      `"${charset}");\n`,
  };
}
