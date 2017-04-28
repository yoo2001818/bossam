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
        A("a", i32, u32, u8),
        B(String, i32),
        C(i32),
      }
    `)));
  });
  it('should compile struct enums', () => {
    compile(parse(tokenize(`
      enum Point {
        TwoDimension { type: "2d", x: i32, y: i32 },
        ThreeDimension { x: i32, y: i32, z: i32 },
        FourDimension { x: i32, y: i32, z: i32, w: i32 },
      }
    `)));
  });
  it('should compile enums with integer matches', () => {
    compile(parse(tokenize(`
      enum Point {
        0xDEADCAFE => TwoDimension { x: i32, y: i32 },
        0xCAFEDEAD => ThreeDimension { x: i32, y: i32, z: i32 },
        0xCAFEBABE => FourDimension { x: i32, y: i32, z: i32, w: i32 },
      }
    `)));
  });
  it('should compile enums with string matches', () => {
    compile(parse(tokenize(`
      enum Point {
        "2d" => TwoDimension { x: i32, y: i32 },
        "3d" => ThreeDimension { x: i32, y: i32, z: i32 },
        "4d" => FourDimension { x: i32, y: i32, z: i32, w: i32 },
      }
    `)));
  });
  it('should compile structs referencing enum structs', () => {
    compile(parse(tokenize(`
      enum Point {
        TwoDimension { x: i32, y: i32 },
        ThreeDimension { x: i32, y: i32, z: i32 },
        FourDimension { x: i32, y: i32, z: i32, w: i32 },
      }
      struct Test {
        pos: Point.TwoDimension,
      }
    `)));
  });
  it('should compile nullable types', () => {
    compile(parse(tokenize(`
      struct Pos {
        x: ?i32,
        y: ?i16,
        name: ?String,
      }
      struct Test {
        pos: Pos,
        pos2: ?Pos,
      }
    `)));
    compile(parse(tokenize(`
      struct Pos(?i32, ?i16, ?String);
      struct Test(Pos, ?Pos);
    `)));
  });
  it('should compile inline tuples', () => {
    compile(parse(tokenize(`
      struct Test {
        aa: String<"utf-8">,
        abc: (i32, u32, String),
        def: (Array<?i32>, u32),
      }
    `)));
  });
  it('should compile inline structs', () => {
    compile(parse(tokenize(`
      struct Test {
        abc: {x: i32, y: i32},
      }
    `)));
  });
  it('should compile arrays', () => {
    compile(parse(tokenize(`
      struct Test {
        abc: [i32; 6],
        def: [?i32; 6],
      }
    `)));
  });
  it('should compile aliases', () => {
    compile(parse(tokenize(`
      struct Test = f32;
    `)));
  });
});
