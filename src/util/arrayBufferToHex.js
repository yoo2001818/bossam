export default function arrayBufferToHex(buffer) {
  return Array.prototype.map.call(new Uint8Array(buffer),
    x => ('00' + x.toString(16)).slice(-2)).join('');
}
