import { getUintSize, getUintVar, setUintVar } from './uvar';

export function getIntSize(value) {
  // Bring MSB to lowest position
  return getUintSize((value << 1) ^ (value >> 31));
}

export function getIntVar(dataBuffer) {
  let value = getUintVar(dataBuffer);
  // Raise the value - LSB to MSB
  return (value >>> 1) ^ ((value & 1) ? ~0 : 0);
}

export function setIntVar(value, dataBuffer) {
  return setUintVar((value << 1) ^ (value >> 31), dataBuffer);
}
