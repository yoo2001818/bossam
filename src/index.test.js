import compileFromCode from './index';
import byteArrayToHex from './util/byteArrayToHex';

describe('compileFromCode', () => {
  // Bunch of integration tests
  it('should encode simple object struct correctly', () => {
    let { Point } = compileFromCode('struct Point { x: i32, y: i32 }');
    let buffer = Point.encode({ x: 3, y: 19 });
    expect(byteArrayToHex(buffer)).toBe('0000000300000013');
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
    expect(byteArrayToHex(buffer)).toBe('00000009ebb0afeba79d686565');
    expect(Data.decode(buffer)).toEqual({ str: '밯망hee' });
  });
  it('should encode object struct with nullable correctly', () => {
    let { Data } = compileFromCode(`struct Data {
      a: ?u8,
      b: ?u8,
      c: u8,
      d: ?u8,
      e: ?u16,
    }`);
    let buffer = Data.encode({ a: 8, b: null, c: 15, d: 53, e: null });
    expect(byteArrayToHex(buffer)).toBe('05080f35');
    expect(Data.decode(buffer)).toEqual(
      { a: 8, b: null, c: 15, d: 53, e: null });
  });
});
