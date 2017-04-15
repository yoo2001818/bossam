import { getUintSize, getUintVar, setUintVar } from './uvar';
import DataBuffer from '../dataBuffer.node';
import byteArrayToHex, { byteArrayFromHex } from './byteArrayToHex';

function encode(value) {
  let buffer = new DataBuffer();
  buffer.newBuffer(getUintSize(value));
  setUintVar(value, buffer);
  return byteArrayToHex(buffer.getBuffer());
}

function decode(hex) {
  let buffer = new DataBuffer();
  buffer.setBuffer(byteArrayFromHex(hex));
  return getUintVar(buffer);
}

describe('uvar', () => {
  it('should process 6bit numbers', () => {
    expect(encode(127)).toBe('7f');
    expect(decode('7f')).toBe(127);
    expect(encode(53)).toBe('35');
    expect(decode('35')).toBe(53);
    // Is this really necessary?
    for (let i = 0; i <= 127; ++i) {
      expect(decode(encode(i))).toBe(i);
    }
  });
  it('should process 14bit numbers', () => {
    expect(encode(0x3fff)).toBe('bfff');
    expect(decode('bfff')).toBe(0x3fff);
    expect(encode(5678)).toBe('962e');
    expect(decode('962e')).toBe(5678);
  });
  it('should process 21bit numbers', () => {
    expect(encode(0x1fffff)).toBe('dfffff');
    expect(decode('dfffff')).toBe(0x1fffff);
    expect(decode(encode(80000))).toBe(80000);
  });
  it('should process 28bit numbers', () => {
    expect(encode(0xfffffff)).toBe('efffffff');
    expect(decode('efffffff')).toBe(0xfffffff);
    expect(decode(encode(102476891))).toBe(102476891);
  });
  it('should process 35bit numbers', () => {
    expect(encode(0x7fffffff)).toBe('f07fffffff');
    expect(decode('f07fffffff')).toBe(0x7fffffff);
    expect(encode(0xffffffff)).toBe('f0ffffffff');
    expect(decode('f0ffffffff')).toBe(-1);
    expect(decode(encode(102476891))).toBe(102476891);
  });
});
