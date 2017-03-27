export default function getIdentifier(data, generics) {
  if (data.generics == null) return data.name;
  if (generics != null) {
    return data.name + '<' + generics.map(v => v.name || '_').join(',') + '>';
  } else {
    return data.name + '<' + data.generics.map(() => '_').join(',') + '>';
  }
}
