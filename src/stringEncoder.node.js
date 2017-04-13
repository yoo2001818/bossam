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
    size: (value) => Buffer.byteLength(value, charset) + 4,
    encodeImpl: (value, dataView) => {
      let size = Buffer.byteLength(value, charset);
      dataView.setUint32(size);
      dataView.setString(size, value, charset);
    },
    decodeImpl: (dataView) => dataView.getString(dataView.getUint32(), charset),
    sizeCode: `size += Buffer.byteLength(#value#, "${charset}") + 4;\n`,
    encodeCode: `var size = Buffer.byteLength(#value#, "${charset}");\n` +
    `dataView.setUint32(size);\n` +
    `dataView.setString(size, #value#, "${charset}");\n`,
    decodeCode:
      `#value# = dataView.getString(dataView.getUint32(), "${charset}");\n`,
  };
}
