export default function findNumberType(num) {
  if (num < 256) return 'u8';
  if (num < 65536) return 'u16';
  // wut
  if (num < 4294967296) return 'u32';
  return 'u64';
}
