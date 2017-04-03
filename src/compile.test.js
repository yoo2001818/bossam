import tokenize from './tokenize';
import parse from './parse';
import compile from './compile';

describe('compile', () => {
  it('should compile regular structs', () => {
    compile(parse(tokenize('struct Test { a: i32, b: u32 }')));
  });
  it('should compile tuple structs', () => {
    compile(parse(tokenize('struct Test(i32, i8, u32);')));
  });
  it('should compile structs with constant value', () => {
    compile(parse(tokenize(`
      struct Test {
        a: i32,
        0xABCDEF: u32,
        b: i32,
        "Hello!": String,
      }
    `)));
  });
  it('should compile structs with generics', () => {
    compile(parse(tokenize(`
      struct Message<PacketSize> {
        size: PacketSize,
        name: String,
      }
      struct Test {
        header: String,
        message: Message<i32>,
      }
    `)));
  });
  it('should compile double generics', () => {
    compile(parse(tokenize(`
      struct MessageData<T> {
        data: T,
      }
      struct Message<PacketSize> {
        size: MessageData<PacketSize>,
        name: String,
      }
      struct Test {
        header: Array<i32>,
        message: Message<MessageData<i32>>,
      }
    `)));
  });
  it('should compile empty enums', () => {
    compile(parse(tokenize(`
      enum Test {
        A, B, C,
      }
    `)));
  });
  it('should compile tuple enums', () => {
    compile(parse(tokenize(`
      enum Test {
        A(i32, u32, u8),
        B(String, i32),
        C(i32),
      }
    `)));
  });
  it('should compile struct enums', () => {
    compile(parse(tokenize(`
      enum Point {
        TwoDimension { x: i32, y: i32 },
        ThreeDimension { x: i32, y: i32, z: i32 },
        FourDimension { x: i32, y: i32, z: i32, w: i32 },
      }
    `)));
  });
});
