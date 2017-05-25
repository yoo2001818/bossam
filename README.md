# bossam
Bossam is an object serialization library, with Rust-like domain-specific
language.

## Installation

Install bossam from NPM registry by running `npm install bossam`.

## Usage
Bossam itself is a compiler that compiles bossam code into Javascript code.
You can embed the compiler into your project, or compile the code using offline
compiler.

### Using bossam by embeding

```js
import bossam from 'bossam';

const namespace = bossam(`
  struct Point {
    x: f32,
    y: f32,
  }
`);

namespace.Point.encode({x: 3, y: 3}); // Returns Uint8Array or Buffer (Node.js)
console.log(namespace.Point.decode(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])));

// Expanding existing namespace is possible by using:
bossam(`
  struct Data(i32, i32);
  struct DataT<T>(T, T);
`, namespace);
// Create generics with the resolve function
const DataT = namespace.resolve('DataT<i8>');
console.log(DataT.encode([3, 3]));
```

**NOTE: If you're not using Babel, you can import it using**
`var bossam = require('bossam').default;`

### Using bossam by compiling

```js
import compile from 'bossam/lib/offlineCompile';

console.log(compile(`
  struct Point {
    x: f32,
    y: f32,
  }
`)); // JavaScript code.
```

Compiled code requires CommonJS environment to be present - it uses `require`
and `module.exports`.

## Bossam language
Bossam uses Rust-like domain specific language for structing the data.

```rust
/*
  Block comments are supported too.
*/
// Tuple structs
struct Point(f64, f64, f64);
// Object structs
struct Entity {
  type: u32,
  position: Point,
  // Nullable types can be specified by prepending ?
  health: ?u8,
}
// Object enums. Resulting objects receive 'type' value by default, which is
// one of "Join" or "Kill" in this case.
enum Packet {
  Join { entity: Entity },
  Kill { entity: ?Entity, reason: String },
}

// A slightly complex example to showcase the features of bossam language.
struct User {
  createdAt: Date,
  favoritesCount: u32,
  following: ?bool,
  id: u64,
  name: String,
  description: ?String,
  // Fixed width arrays.
  position: [f64; 3],
  // Dynamic width arrays. Bossam supports template strings too.
  email: Array<String>,
  // Inline tuples.
  acl: (bool, bool, bool),
  // Inline objects.
  inventory: {
    gold: uvar,
    items: Array<Item>,
  },
  // This may look weird, but Javascript-side default value can be specified
  // using this - unit: "User", unitId: 3 will be set by default.
  // Only strings and numbers are supported.
  unit: "User",
  unitId: 3,
}

// Type name and encoded type can be specified.
// In this case, enum itself will be encoded using u8, and Item's type will be
// specified using type.
enum Item(u8, type) {
  // Type value can be overriden like this.
  Iron { type: "iron" },
  Pickaxe { strength: u8 },
  Axe { rarity: Rarity<u8> },
  // You can use aliases in the enum.
  BizCard = User,
  // You can also point to other types in enums like this.
  Shovel = Item.Axe,
}

// Tuple enums are supported too. 0th position of array will be the type and
// it can't be changed.
// Encoded type can be String too, and encode type specifier can be overriden.
// Templates are supported too.
enum Rarity<T>(String) {
  // It'll be encoded as "c" in binary
  "c" => Common(T),
  "r" => Rare(T),
  "e" => Epic(T),
  "l" => Legendary(T),
}

// Aliases are also possible.
struct Hello = Rarity<i32>;
struct There = Item.Axe;

```

### Primitive types
All types use big endian unless specified.

- u8 - 8bit unsigned integer.
- i8 - 8bit signed integer.
- u16 - 16bit unsigned integer.
- i16 - 16bit signed integer.
- u32 - 32bit unsigned integer.
- i32 - 32bit signed integer.
- u64 - 64bit unsigned integer. Since Javascript doesn't support 64bit
  integers, Bossam forcefully converts them to double. This means that numbers
  are usable up to 53 bits.
- i64 - 64bit signed integer. Same constraint for u64 affects this too.
- ivar - varying signed integer. Description is in the below.
- uvar - varying unsigned integer. Description is in the below.
- f32 - 32bit IEEE 754 floating number.
- f64 - 64bit IEEE 754 floating number.
- bool - Equivalent to u8, automatically converts from / to Boolean.
- Array&lt;T&gt; - dynamic array of type T.
- Vec&lt;T&gt; - Equivalent to Array&lt;T&gt;.
- String - UTF-8 encoded string.
- String&lt;T&gt; - String with encoding T. T should be one of:
  "utf-8", "utf-16", "utf-16le", "utf-16be". Other encodings are not supported
  because TextEncoder spec doesn't allow it.
- Date - Equivalent to u64, but automatically converts from / to Date.
- JSON - Equivalent to UTF-8 encoded string, but automatically converts from /
  to JSON. **This stores JSON as a string!**
- Padded&lt;T, S&gt; - Type T padded to size S. If the type is larger than the
  provided size, it'll throw an error.

## Resulting byte sizes
Bossam encodes the data without any metadata or specifier. If you specify 4
u16s, then it'll be encoded to 8 bytes.

However, arrays, strings, nullable types, varying integers have dynamic byte
sizes.

### Varying integers
Varying unsigned integers are encoded like utf-8 - the first byte decides the
size of varying unsigned integer.

- If the byte starts with 0 - it means the size is 1.
- If the byte starts with 10 - it means the size is 2.
- If the byte starts with 110 - it means the size is 3.
- ...

Remaining bits of first byte is used to encode numbers.

Since Javascript supports up to 32bit integers, varying integers are limited to
32 bits.

- 7 bits encodes to 1 byte.
- 14 bits encodes to 2 bytes.
- 21 bits encodes to 3 bytes.
- 28 bits encodes to 4 bytes.
- 32 bits encodes to 5 bytes.

Varying signed integers encodes the MSB (sign) value at the LSB, then encodes
it as varying unsigned integers.

### Nullable types
Each nullable type takes 1/8 bytes - 8 nullable types are bundled to make the
size smaller.

First nullable type uses the lowest bit, so the order is quite weird.

```
Order         01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16
Bit position   0  1  2  3  4  5  6  7  0  1  2  3  4  5  6  7
Byte position  0  0  0  0  0  0  0  0  1  1  1  1  1  1  1  1
```

Object structs and tuples put the nullable data in the front, however, arrays
and tuples put the nullable data 'on-demand', which means that a byte appears
every 8 types.

### Strings and arrays
Strings and arrays encode the size info using uvar. 

## Adapters
Bossam includes 'adapter' code to use certain serialization format libraries
with Bossam. By default, they're not included in the default namespace -
you have to include them manually.

### MessagePack

```js
import compileFromCode, { createNamespace } from 'bossam';
import createMsgPackEncoder from 'bossam/lib/adapter/msgpack';
import msgpack from 'msgpack-lite';

const namespace = createNamespace();
namespace.MsgPack = createMsgPackEncoder(msgpack);
compileFromCode('struct Test = MsgPack', namespace);
```
