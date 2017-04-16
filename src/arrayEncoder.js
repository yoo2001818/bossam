import CodeGenerator from './codeGenerator';

export default function createArrayEncoder(state, generics) {
  let type = state.resolveType(generics[0]);
  let numType = state.resolveType({ name: 'uvar' });
  let codeGen = new CodeGenerator(state);
  let u8, nullFieldName;
  let nullable = generics[0].nullable;
  if (nullable) {
    // If the type is nullable, we have to use separate nullable fields to
    // spare some bits
    u8 = state.resolveType({ name: 'u8' });
    nullFieldName = 'nullCheck' + (state.namespace._refs++);
    codeGen.push(`var ${nullFieldName} = 0;`);
  }
  let varName = 'arraySize' + (state.namespace._refs++);
  codeGen.pushTypeDecode(varName, numType, true);
  codeGen.pushEncode(`var ${varName} = #value#.length;`);
  codeGen.pushTypeEncode(varName, numType);
  codeGen.pushDecode(`#value# = new Array(${varName});`);
  codeGen.push(`for (var i = 0; i < ${varName}; ++i) {`);
  if (nullable) {
    // To match with decoding order, encoder must look ahead of the array
    // and save flags beforehand.
    codeGen.push('if (i % 8 === 0) {');
    codeGen.pushEncode(`${nullFieldName} = 0;`);
    codeGen.pushEncode(`var maxIdx = Math.min(8, ${varName} - i);`);
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
  return codeGen.compile(Infinity);
}
