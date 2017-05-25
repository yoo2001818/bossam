export default function createMsgPackEncoder(msgpack) {
  return {
    name: 'MsgPack',
    // Deny inlining the code
    locked: true,
    maxSize: Infinity,
    size: function(namespace, value) {
      // MessagePack length + uvar.
      let length = msgpack.encode(value).length;
      return length + namespace.uvar.size(namespace, length);
    },
    encodeImpl: function(namespace, value, dataView) {
      let buffer = msgpack.encode(value);
      namespace.uvar.encodeImpl(namespace, buffer.length, dataView);
      dataView.setUint8Array(buffer);
    },
    decodeImpl: function(namespace, dataView) {
      let size = namespace.uvar.decodeImpl(namespace, dataView);
      return msgpack.decode(dataView.getUint8Array(size));
    },
  };
}
