export function getUintSize(value) {
  // If size is n, the total bit space is 7 * n space.
  // Don't support >32bit integers for now.
  if (value < 0) return 5;
  if (value < (1 << 7)) return 1;
  if (value < (1 << 14)) return 2;
  if (value < (1 << 21)) return 3;
  if (value < (1 << 28)) return 4;
  /* for (let i = 1; i <= 4; ++i) {
    if (value < (1 << (i * 7))) return i;
  } */
  // Actually, 5 bits mode completely drops first byte.
  return 5;
}

export function getUintVar(dataBuffer) {
  let firstByte = dataBuffer.getUint8BE();
  let sizeByte = firstByte;
  let size = 1;
  while (size <= 5) {
    if ((sizeByte & 0x80) === 0) break;
    sizeByte = sizeByte << 1;
    size++;
  }
  // Done! decode the bytes.
  let output = 0;
  let remainingSize = size - 1;
  firstByte = firstByte & (0xFF >> size);
  // Handle 32bit specially :/
  if (remainingSize < 4) {
    output = firstByte << (remainingSize << 3);
  }
  while (remainingSize >= 4) {
    remainingSize -= 4;
    output |= dataBuffer.getUint32BE() << (remainingSize << 3);
  }
  if (remainingSize >= 2) {
    remainingSize -= 2;
    output |= dataBuffer.getUint16BE() << (remainingSize << 3);
  }
  if (remainingSize >= 1) {
    remainingSize -= 1;
    output |= dataBuffer.getUint8BE() << (remainingSize << 3);
  }
  return output;
}

export function setUintVar(value, dataBuffer) {
  // Determine the size of value first.
  let size = getUintSize(value);
  // Write the first byte - Include the size information too.
  let sizeByte = (0xFE00 >> size) & 0xFF;
  let remainingSize = size - 1;
  // Handle 32bit specially :/
  if (remainingSize < 4) {
    dataBuffer.setUint8BE((value >>> (remainingSize << 3)) | sizeByte);
  } else {
    dataBuffer.setUint8BE(sizeByte);
  }
  while (remainingSize >= 4) {
    remainingSize -= 4;
    dataBuffer.setUint32BE(value >>> (remainingSize << 3));
  }
  if (remainingSize >= 2) {
    remainingSize -= 2;
    dataBuffer.setUint16BE((value >>> (remainingSize << 3)) & 0xFFFF);
  }
  if (remainingSize >= 1) {
    remainingSize -= 1;
    dataBuffer.setUint8BE((value >>> (remainingSize << 3)) & 0xFF);
  }
}
