export default function byteArrayToHex(buffer) {
  return Array.prototype.map.call(buffer,
    x => ('00' + x.toString(16)).slice(-2)).join('');
}
