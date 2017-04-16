import compileFromCode from './index';
import byteArrayToHex from './util/byteArrayToHex';

describe('compileFromCode', () => {
  // Bunch of integration tests
  it('should encode simple object struct correctly', () => {
    let { Point } = compileFromCode('struct Point { x: ivar, y: ivar }');
    let buffer = Point.encode({ x: 3, y: 19 });
    expect(byteArrayToHex(buffer)).toBe('0626');
    expect(Point.decode(buffer)).toEqual({ x: 3, y: 19 });
  });
  it('should encode simple array struct correctly', () => {
    let { Point } = compileFromCode('struct Point(f32, f32)');
    let buffer = Point.encode([3.14, -5.28]);
    // Since I have no idea how IEEE 754 is laid out, so I just used
    // https://www.h-schmidt.net/FloatConverter/IEEE754.html to convert
    // the numbers into bytes
    expect(byteArrayToHex(buffer)).toBe('4048f5c3c0a8f5c3');
    expect(Point.decode(buffer)).toEqual(
      Array.prototype.slice.call(new Float32Array([3.14, -5.28])));
  });
  it('should encode utf-8 stream correctly', () => {
    let { Data } = compileFromCode('struct Data { str: String<"utf-8"> }');
    let buffer = Data.encode({ str: '밯망hee' });
    // UTF-16 stream: bc2f b9dd 0068 0065 0065
    // UTF-8 stream: ebb0af eba79d 68 65 65
    expect(byteArrayToHex(buffer)).toBe('09ebb0afeba79d686565');
    expect(Data.decode(buffer)).toEqual({ str: '밯망hee' });
  });
  it('should encode object struct with nullable correctly', () => {
    let { Data } = compileFromCode(`struct Data {
      a: ?u8,
      b: ?u8,
      c: u8,
      d: ?u8,
      e: ?u16,
      f: ?u8,
      g: ?u8,
      h: ?u8,
      i: ?u8,
      // Next byte from here
      j: ?u8,
    }`);
    let data = {
      a: 8,
      b: null,
      c: 15,
      d: 53,
      e: null,
      f: null,
      g: null,
      h: null,
      i: 5,
      j: 6,
    };
    let buffer = Data.encode(data);
    expect(byteArrayToHex(buffer)).toBe('8501080f350506');
    expect(Data.decode(buffer)).toEqual(data);
  });
  it('should encode inline array struct correctly', () => {
    let { Mat2x2 } = compileFromCode('struct Mat2x2((f32, f32), (ivar, ivar))');
    let buffer = Mat2x2.encode([[3.14, -5.28], [-9, 22]]);
    // Since I have no idea how IEEE 754 is laid out, so I just used
    // https://www.h-schmidt.net/FloatConverter/IEEE754.html to convert
    // the numbers into bytes
    expect(byteArrayToHex(buffer)).toBe('4048f5c3c0a8f5c3112c');
    expect(Mat2x2.decode(buffer)).toEqual([
      Array.prototype.slice.call(new Float32Array([3.14, -5.28])),
      [-9, 22],
    ]);
  });
  it('should encode inline object struct correctly', () => {
    let { Transaction } = compileFromCode(`
      struct Transaction {
        price: ivar,
        user: {
          id: u32,
          count: u8,
        },
      };
    `);
    let data = {
      price: 1500,
      user: {
        id: 19999,
        count: 13,
      },
    };
    let buffer = Transaction.encode(data);
    expect(byteArrayToHex(buffer)).toBe('8bb800004e1f0d');
    expect(Transaction.decode(buffer)).toEqual(data);
  });
  it('should encode empty object', () => {
    let { Data } = compileFromCode(`
      struct Data {}
    `);
    let buffer = Data.encode({});
    expect(byteArrayToHex(buffer)).toBe('');
    expect(Data.decode(buffer)).toEqual({});
  });
});
