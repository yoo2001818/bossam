import { getIntSize, getIntVar, setIntVar } from './ivar';
import DataBuffer from '../dataBuffer.node';
import byteArrayToHex, { byteArrayFromHex } from './byteArrayToHex';

function encode(value) {
  let buffer = new DataBuffer();
  buffer.newBuffer(getIntSize(value));
  setIntVar(value, buffer);
  return byteArrayToHex(buffer.getBuffer());
}

function decode(hex) {
  let buffer = new DataBuffer();
  buffer.setBuffer(byteArrayFromHex(hex));
  return getIntVar(buffer);
}

describe('uvar', () => {
  it('should process 7bit numbers', () => {
    expect(encode(63)).toBe('7e');
    expect(decode('7e')).toBe(63);
    expect(encode(-63)).toBe('7d');
    expect(decode('7d')).toBe(-63);
    expect(encode(-64)).toBe('7f');
    expect(decode('7f')).toBe(-64);
    expect(encode(53)).toBe('6a');
    expect(decode('6a')).toBe(53);
    // Is this really necessary?
    for (let i = -64; i <= 63; ++i) {
      expect(decode(encode(i))).toBe(i);
    }
  });
  it('should process 14bit numbers', () => {
    expect(encode(0x1fff)).toBe('bffe');
    expect(decode('bffe')).toBe(0x1fff);
    expect(encode(-0x1fff)).toBe('bffd');
    expect(decode('bffd')).toBe(-0x1fff);
    expect(encode(-0x2000)).toBe('bfff');
    expect(decode('bfff')).toBe(-0x2000);
    expect(decode(encode(5678))).toBe(5678);
  });
  it('should process 21bit numbers', () => {
    expect(encode(0xfffff)).toBe('dffffe');
    expect(decode('dffffe')).toBe(0xfffff);
    expect(encode(-0xfffff)).toBe('dffffd');
    expect(decode('dffffd')).toBe(-0xfffff);
    expect(decode(encode(80000))).toBe(80000);
  });
  it('should process 28bit numbers', () => {
    expect(encode(0x7ffffff)).toBe('effffffe');
    expect(decode('effffffe')).toBe(0x7ffffff);
    expect(encode(-0x7ffffff)).toBe('effffffd');
    expect(decode('effffffd')).toBe(-0x7ffffff);
    expect(decode(encode(102476891))).toBe(102476891);
  });
  it('should process 35bit numbers', () => {
    expect(encode(0x7fffffff)).toBe('f0fffffffe');
    expect(decode('f0fffffffe')).toBe(0x7fffffff);
    expect(encode(-0x7fffffff)).toBe('f0fffffffd');
    expect(decode('f0fffffffd')).toBe(-0x7fffffff);
    expect(decode(encode(102476891))).toBe(102476891);
  });
});
