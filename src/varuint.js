export function getSize(value) {
  if (value < (1 << 7)) return 1;
  if (value < (1 << 14)) return 2;
  if (value < (1 << 21)) return 3;
  if (value < (1 << 28)) return 4;
  return 5;
}

export function write() {
  
}
