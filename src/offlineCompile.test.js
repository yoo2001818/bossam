import offlineCompile from './offlineCompile';
import compileFromCode from './index';

describe('offlineCompile', () => {
  it('should compile existing namespace to code', () => {
    let namespace = compileFromCode('struct Data { a: String };');
    console.log(offlineCompile(namespace));
  });
});
