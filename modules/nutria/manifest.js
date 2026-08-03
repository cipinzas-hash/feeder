export default {
  id: "nutria",
  tabLabel: "Nutria",
  state: {
    nutria: { default: "makeDefaultNutria()" }, // ver nota
  },
};

// NOTA: el default real no es un literal — viene de makeDefaultNutria(),
// una función definida en el bloque compartido (línea ~158 del archivo
// original), no dentro de este módulo. Falta decidir dónde vive esa
// función cuando se arme /shared: probablemente junto a EF/AnalogClock/etc.
// Por ahora el default de arriba es un placeholder, no un valor real.
