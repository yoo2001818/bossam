export default function getIdentifier(data, generics) {
  if (generics != null) {
    return data.name + '<' + generics.map(v => v.name || '_').join(',') + '>';
  } else {
    if (data.generics == null) return data.name;
    return data.name + '<' + data.generics.map(() => '_').join(',') + '>';
  }
}
