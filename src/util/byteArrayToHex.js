export default function byteArrayToHex(buffer) {
  return Array.prototype.map.call(buffer,
    x => ('00' + x.toString(16)).slice(-2)).join('');
}

export function byteArrayFromHex(str) {
  let buf = new Uint8Array(str.length / 2);
  for (let i = 0; i < buf.length; ++i) {
    buf[i] = parseInt(str.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}
