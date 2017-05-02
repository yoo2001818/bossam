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
      a: Option<u8>,
      b: ?u8,
      c: u8,
      d: ?u8,
      e: Option<u16>,
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
          enabled: bool,
          count: u8,
        },
      };
    `);
    let data = {
      price: 1500,
      user: {
        id: 19999,
        enabled: true,
        count: 13,
      },
    };
    let buffer = Transaction.encode(data);
    expect(byteArrayToHex(buffer)).toBe('8bb800004e1f010d');
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
  it('should encode alias structs', () => {
    let { Data } = compileFromCode('struct Data = u8;');
    let buffer = Data.encode(3);
    expect(byteArrayToHex(buffer)).toBe('03');
    expect(Data.decode(buffer)).toEqual(3);
  });
  it('should encode Array', () => {
    let { Data } = compileFromCode(`
      struct Data {
        data: Array<u8, 8>,
      }
    `);
    let data = { data: [1, 2, 3, 4, 5] };
    let buffer = Data.encode(data);
    expect(byteArrayToHex(buffer)).toBe('050102030405');
    expect(Data.decode(buffer)).toEqual(data);
  });
  it('should correctly encode u64', () => {
    // Check 64, 63, 33, 32, 31th position especially. However, since
    // Javascript double supports up to 53-bit integer precision, it's
    // meaningless to check 64, 63th position.
    let { Data } = compileFromCode('struct Data(u64);');
    let buffer = Data.encode([0xffffffff]);
    expect(byteArrayToHex(buffer)).toBe('00000000ffffffff');
    expect(Data.decode(buffer)).toEqual([0xffffffff]);
    buffer = Data.encode([0xf9f9ffffffff]);
    expect(byteArrayToHex(buffer)).toBe('0000f9f9ffffffff');
    expect(Data.decode(buffer)).toEqual([0xf9f9ffffffff]);
  });
  it('should correctly encode i64', () => {
    let { Data } = compileFromCode('struct Data(i64);');
    let buffer = Data.encode([0xffffffff]);
    expect(byteArrayToHex(buffer)).toBe('00000000ffffffff');
    expect(Data.decode(buffer)).toEqual([0xffffffff]);
    buffer = Data.encode([0xf9f9ffffffff]);
    expect(byteArrayToHex(buffer)).toBe('0000f9f9ffffffff');
    expect(Data.decode(buffer)).toEqual([0xf9f9ffffffff]);
    buffer = Data.encode([-0xf9f9ffffffff]);
    expect(byteArrayToHex(buffer)).toBe('ffff060600000001');
    expect(Data.decode(buffer)).toEqual([-0xf9f9ffffffff]);
    buffer = Data.encode([-0x01010101010101]);
    expect(byteArrayToHex(buffer)).toBe('fffefefefefefeff');
    expect(Data.decode(buffer)).toEqual([-0x01010101010101]);
  });
  it('should encode Date', () => {
    let { Data } = compileFromCode('struct Data(Date);');
    let buffer = Data.encode([new Date('1970-01-01T00:01Z')]);
    expect(byteArrayToHex(buffer)).toBe('000000000000ea60');
    expect(Data.decode(buffer)).toEqual([new Date('1970-01-01T00:01Z')]);
  });
  it('should encode empty enums', () => {
    let { Data } = compileFromCode('enum Data { a, b, c, d }');
    let buffer = Data.encode({ type: 'c' });
    expect(byteArrayToHex(buffer)).toBe('02');
    expect(Data.decode(buffer)).toEqual({ type: 'c' });
  });
  it('should throw error if enum type is not found', () => {
    let { Data } = compileFromCode('enum Data { a, b, c, d }');
    expect(() => Data.encode({ type: 'haha' })).toThrow();
    expect(() => Data.decode(new Uint8Array([53]))).toThrow();
  });
  it('should encode tuple enums', () => {
    let { Data } = compileFromCode('enum Data { a(i8), b(i8, i8), c, d }');
    let buffer = Data.encode(['a', 15]);
    expect(byteArrayToHex(buffer)).toBe('000f');
    expect(Data.decode(buffer)).toEqual(['a', 15]);
    buffer = Data.encode(['b', 0x23, 0x32]);
    expect(byteArrayToHex(buffer)).toBe('012332');
    expect(Data.decode(buffer)).toEqual(['b', 0x23, 0x32]);
    buffer = Data.encode(['c']);
    expect(byteArrayToHex(buffer)).toBe('02');
    expect(Data.decode(buffer)).toEqual(['c']);
  });
  it('should encode object enums', () => {
    let { Data } = compileFromCode(
      'enum Data { a { a: u8 }, b { a: u8, b: u8 }, c, d }');
    let buffer = Data.encode({ type: 'a', a: 0x32 });
    expect(byteArrayToHex(buffer)).toBe('0032');
    expect(Data.decode(buffer)).toEqual({ type: 'a', a: 0x32 });
    buffer = Data.encode({ type: 'b', a: 0x32, b: 0x55 });
    expect(byteArrayToHex(buffer)).toBe('013255');
    expect(Data.decode(buffer)).toEqual({ type: 'b', a: 0x32, b: 0x55 });
    buffer = Data.encode({ type: 'c' });
    expect(byteArrayToHex(buffer)).toBe('02');
    expect(Data.decode(buffer)).toEqual({ type: 'c' });
  });
  it('should use specified type in enums', () => {
    let { Data } = compileFromCode('enum Data(u32) { a, b, c, d }');
    let buffer = Data.encode({ type: 'c' });
    expect(byteArrayToHex(buffer)).toBe('00000002');
    expect(Data.decode(buffer)).toEqual({ type: 'c' });
  });
  it('should use specified type name in object enums', () => {
    let { Data } = compileFromCode(
      'enum Data(u8, tt) { a { a: u8 }, b { a: u8, b: u8 }, c, d }');
    let buffer = Data.encode({ tt: 'a', a: 0x32 });
    expect(byteArrayToHex(buffer)).toBe('0032');
    expect(Data.decode(buffer)).toEqual({ tt: 'a', a: 0x32 });
  });
  it('should use specified type encoded value in enums', () => {
    let { Data } = compileFromCode(`
      enum Data(String) {
        "haha" => a { a: u8 },
        "meh" => b { a: u8, b: u8 },
        "why" => c,
        "goof" => d,
      }
    `);
    let buffer = Data.encode({ type: 'a', a: 0x32 });
    expect(byteArrayToHex(buffer)).toBe('046861686132');
    expect(Data.decode(buffer)).toEqual({ type: 'a', a: 0x32 });
  });
  it('should use specified type value in enums', () => {
    let { Data } = compileFromCode(`
      enum Data {
        a { type: "Hello there", a: u8 },
        b { a: u8, b: u8 },
        c,
        d,
      }
    `);
    let buffer = Data.encode({ type: 'Hello there', a: 0x32 });
    expect(byteArrayToHex(buffer)).toBe('0032');
    expect(Data.decode(buffer)).toEqual({ type: 'Hello there', a: 0x32 });
  });
  it('should use TypedArray for primitive types', () => {
    let { Data } = compileFromCode(`
      struct Data {
        u8: [u8; 10],
        u16: [u16; 8],
        f32: [f32; 4],
      }
    `);
    let data = {
      u8: [1, 2, 3, 4, 5, 6, 7, 7, 9, 15],
      u16: new Uint8Array([6, 5, 4, 3, 9, 5, 2, 1]),
      f32: new Float32Array([0.5, 0.9, 1.54, 9.88]),
    };
    let buffer = Data.encode(data);
    expect(Data.decode(buffer)).toEqual({
      u8: Buffer.from(data.u8),
      u16: new Uint16Array(data.u16),
      f32: new Float32Array(data.f32),
    });
  });
});
