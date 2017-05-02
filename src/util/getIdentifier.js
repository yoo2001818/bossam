export default function getIdentifier(data, generics) {
  if (generics != null) {
    return data.name + '<' + generics.map(v =>
      v.name != null ? getIdentifier(v, v.generics) : (
        v.const ? '#' : '_')).join(',') + '>';
  } else {
    if (data.generics == null) return data.name;
    return data.name + '<' + data.generics.map(() => '_').join(',') + '>';
  }
}

export function getGenericIdentifier(data, generics) {
  if (generics == null) return data.name;
  return data.name + '<' + generics.map(v => v.const ? '#' : '_').join(',') +
    '>';
}
