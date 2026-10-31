/**
 * Layout dinámico de nodos del tablero arcade.
 * Devuelve posiciones {left, top} en % para `count` nodos,
 * con presets optimizados para los tamaños de nivel típicos
 * (1-5 preguntas, 8 de nivel medio, 15 y 20 del boss).
 */
export function getDynamicLayout(count = 1) {
  if (count === 1) {
    return [{ left: "50.0%", top: "45.0%" }];
  }
  if (count === 2) {
    return [
      { left: "35.0%", top: "45.0%" },
      { left: "65.0%", top: "45.0%" },
    ];
  }
  if (count === 3) {
    return [
      { left: "26.0%", top: "48.0%" },
      { left: "50.0%", top: "35.0%" },
      { left: "74.0%", top: "48.0%" },
    ];
  }
  if (count === 4) {
    return [
      { left: "30.0%", top: "32.0%" },
      { left: "70.0%", top: "32.0%" },
      { left: "30.0%", top: "62.0%" },
      { left: "70.0%", top: "62.0%" },
    ];
  }
  if (count === 5) {
    const layouts = [
      [
        { left: "20.0%", top: "50.0%" },
        { left: "36.0%", top: "24.0%" },
        { left: "50.0%", top: "64.0%" },
        { left: "66.0%", top: "24.0%" },
        { left: "81.0%", top: "50.0%" },
      ],
      [
        { left: "50.0%", top: "44.0%" },
        { left: "50.0%", top: "20.0%" },
        { left: "23.0%", top: "44.0%" },
        { left: "77.0%", top: "44.0%" },
        { left: "50.0%", top: "68.0%" },
      ],
    ];
    return layouts[Math.floor(Math.random() * layouts.length)];
  }
  if (count === 8) {
    return [
      { left: "20.0%", top: "30.0%" },
      { left: "40.0%", top: "24.0%" },
      { left: "60.0%", top: "24.0%" },
      { left: "80.0%", top: "30.0%" },
      { left: "22.0%", top: "64.0%" },
      { left: "42.0%", top: "68.0%" },
      { left: "62.0%", top: "68.0%" },
      { left: "82.0%", top: "64.0%" },
    ];
  }
  if (count === 15) {
    // 3 filas ordenadas de 5 nodos para máxima claridad visual
    const positions = [];
    const cols = [18, 34, 50, 66, 82];
    const rows = [24, 48, 72];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        positions.push({
          left: `${cols[c]}%`,
          top: `${rows[r]}%`,
        });
      }
    }
    return positions;
  }
  if (count === 20) {
    // 4 filas de 5 nodos
    const positions = [];
    const cols = [18, 34, 50, 66, 82];
    const rows = [20, 38, 56, 74];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        positions.push({
          left: `${cols[c]}%`,
          top: `${rows[r]}%`,
        });
      }
    }
    return positions;
  }

  // Algoritmo adaptativo universal
  const colsCount = Math.ceil(Math.sqrt(count * 1.6));
  const rowsCount = Math.ceil(count / colsCount);
  const positions = [];
  const minX = 18,
    maxX = 82;
  const minY = 20,
    maxY = 74;
  const stepX = colsCount > 1 ? (maxX - minX) / (colsCount - 1) : 0;
  const stepY = rowsCount > 1 ? (maxY - minY) / (rowsCount - 1) : 0;

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / colsCount);
    const c = i % colsCount;
    const x = minX + c * stepX;
    const y = minY + r * stepY;
    positions.push({
      left: `${x.toFixed(1)}%`,
      top: `${y.toFixed(1)}%`,
    });
  }
  return positions;
}
