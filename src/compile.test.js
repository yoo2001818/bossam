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
        header: String,
        message: Message<MessageData<i32>>,
      }
    `)));
  });
});
