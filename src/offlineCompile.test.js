import offlineCompile from './offlineCompile';
import compileFromCode from './index';
import byteArrayToHex from './util/byteArrayToHex';

describe('offlineCompile', () => {
  it('should compile existing namespace to code', () => {
    let namespace = compileFromCode('struct Point { x: ivar, y: ivar };');
    // This is so horrible.
    let code = offlineCompile(namespace, './');
    let compiled = (function() {
      let module = {};
      eval(code); // eslint-disable-line
      return module.exports;
    })();
    let Point = compiled.Point;
    let buffer = Point.encode({ x: 3, y: 19 });
    expect(byteArrayToHex(buffer)).toBe('0626');
    expect(Point.decode(buffer)).toEqual({ x: 3, y: 19 });
  });
});
