import CodeGenerator from './codeGenerator';

const TYPED_ARRAY_MAP = {
  u8: 'Uint8ArrayBE',
  i8: 'Int8ArrayBE',
  u16: 'Uint16ArrayBE',
  i16: 'Int16ArrayBE',
  u32: 'Uint32ArrayBE',
  i32: 'Int32ArrayBE',
  f32: 'Float32ArrayBE',
  f64: 'Float64ArrayBE',
  u8le: 'Uint8ArrayLE',
  i8le: 'Int8ArrayLE',
  u16le: 'Uint16ArrayLE',
  i16le: 'Int16ArrayLE',
  u32le: 'Uint32ArrayLE',
  i32le: 'Int32ArrayLE',
  f32le: 'Float32ArrayLE',
  f64le: 'Float64ArrayLE',
};

export function generateArrayEncoderCode(namespace, codeGen, type, nullable, size) {
  let u8, nullFieldName;
  // If the value can be processed using TypedArray, handle it using it.
  if (!nullable && TYPED_ARRAY_MAP[type.name] != null) {
    let arrayName = TYPED_ARRAY_MAP[type.name];
    // Simply call getTypedArray function and that's good enough.
    // However, modification of the typed array should be avoided, but it's
    // unnecessary to copy the array to avoid modifying original array.
    codeGen.pushDecode(
      `#value# = dataView.get${arrayName}(${size} * ${type.maxSize});`);
    // Encoding can be done by simply calling setTypedArray, too.
    // But if the size of the array is different, we must zero-fill the
    // remaining space to avoid corruption.
    codeGen.pushEncodeOnly(
      `dataView.set${arrayName}(#value#, ${size} * ${type.maxSize});`);
    codeGen.pushSize(`size += ${size} * ${type.maxSize};`);
    return;
  }
  if (nullable) {
    // If the type is nullable, we have to use separate nullable fields to
    // spare some bits
    u8 = namespace.resolveType({ name: 'u8' });
    nullFieldName = 'nullCheck' + (namespace._refs++);
    codeGen.push(`var ${nullFieldName} = 0;`);
  }
  codeGen.pushDecode(`#value# = new Array(${size});`);
  codeGen.push(`for (var i = 0; i < ${size}; ++i) {`);
  if (nullable) {
    // To match with decoding order, encoder must look ahead of the array
    // and save flags beforehand.
    codeGen.push('if (i % 8 === 0) {');
    codeGen.pushEncode(`${nullFieldName} = 0;`);
    codeGen.pushEncode(`var maxIdx = Math.min(8, ${size} - i);`);
    codeGen.pushEncode('for (var j = 0; j < maxIdx; ++j) {');
    // Check flag / insert flag.
    codeGen.pushEncode(
      `${nullFieldName} |= #value#[i + j] == null ? 0 : (1 << j);`);
    codeGen.pushEncode('}');
    codeGen.pushType(nullFieldName, u8);
    codeGen.push('}');
    codeGen.push(`if (${nullFieldName} & (1 << (i % 8)) !== 0) {`);
  }
  codeGen.pushType('#value#[i]', type);
  if (nullable) {
    codeGen.pushDecode('} else {');
    codeGen.pushDecode('#value#[i] = null;');
    codeGen.push('}');
  }
  codeGen.push('}');
}

export default function createArrayEncoder(namespace, generics) {
  let type = namespace.resolveType(generics[0]);
  let maxLength = Infinity;
  if (generics[1] != null && generics[1].const) {
    maxLength = generics[1].name;
  }
  let numType = namespace.resolveType({ name: 'uvar' });
  let codeGen = new CodeGenerator(namespace);
  let nullable = generics[0].nullable;
  let varName = 'arraySize' + (namespace._refs++);
  codeGen.pushTypeDecode(varName, numType, true);
  codeGen.pushEncode(`var ${varName} = #value#.length;`);
  codeGen.pushTypeEncode(varName, numType);
  generateArrayEncoderCode(namespace, codeGen, type, nullable, varName);
  // Calculate max size if max length constraint is provided
  let maxSize = Infinity;
  if (maxLength !== Infinity) {
    maxSize = numType.size(maxLength);
    maxSize += maxLength * type.maxSize;
    if (nullable) {
      maxSize += Math.ceil(maxLength / 8);
    }
  }
  return codeGen.compile(maxSize);
}
