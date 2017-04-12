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
    size: (value) => Buffer.from(value, charset).length,
    encodeImpl: (value, dataView) => {
      let strData = Buffer.from(value, charset);
      dataView.setUint32(strData.length);
      dataView.setUint8Array(strData);
    },
    decodeImpl: (dataView) => dataView.getString(dataView.getUint32(), charset),
    sizeCode: `size += Buffer.from(#value#, ${charset}).length;\n`,
    encodeCode: `var strData = Buffer.from(#value#, ${charset});\n` +
    `dataView.setUint32(strData.length);\n` +
    `dataView.setUint8Array(strData);\n`,
    decodeCode:
      `#value# = dataView.getString(dataView.getUint32(), ${charset});\n`,
  };
}
