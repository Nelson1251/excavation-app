// Demo (solo desarrollo): genera un PNG del mapa de calor de corte/relleno a partir de un sitio
// sintético — loma existente trazada con curvas de nivel cerradas y una plataforma propuesta
// inclinada definida con cotas — sin dependencias (codificador PNG mínimo con node:zlib).
// Uso: npm run earthwork-demo [-- salida.png]   (por defecto /workspace/heatmap-demo.png)
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { cargarEarthwork } from './test-earthwork.mjs';

const salida = process.argv[2] ?? '/workspace/heatmap-demo.png';
const { grid: G, heatmap: H, features: F, quantities: Q } = await cargarEarthwork();

// Escala 1 unidad PDF = 0.25 m. Sitio de 100 m × 70 m.
const mpu = 0.25;
const manual = F.makeProvenance('manual');
const limite = [{ x: 20, y: 20 }, { x: 420, y: 20 }, { x: 420, y: 300 }, { x: 250, y: 300 }, { x: 20, y: 220 }];

// Existente: pendiente suave hacia +x con una loma en (150, 120); curvas cerradas cada 0.5 m.
const existente = [];
for (let k = 0; k < 8; k++) {
  const r = 20 + k * 18;
  const pts = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * 2 * Math.PI;
    return { x: 150 + r * Math.cos(a) * 1.3, y: 120 + r * Math.sin(a) };
  });
  existente.push(F.makeContour(pts, 104 - k * 0.5, manual, true));
}
existente.push(F.makeSpot({ x: 150, y: 120 }, 104.6, manual, 'TOP'));
for (const [x, y, z] of [[0, 0, 100.5], [450, 0, 99], [450, 330, 98.5], [0, 330, 100]]) {
  existente.push(F.makeSpot({ x, y }, z, manual));
}
// Propuesto: plataforma inclinada 1 % hacia +x (drenaje), cota 101.8 en x = 0.
const propuesto = [[0, 0], [450, 0], [450, 330], [0, 330]].map(([x, y]) => F.makeSpot({ x, y }, 101.8 - 0.01 * x * mpu, manual));

const grid = G.computeEarthworkGrid(existente, propuesto, limite, { metersPerPdfUnit: mpu, cellSizeM: 0.5 });
const opciones = { toleranceM: 0.1, maxCutM: 2, maxFillM: 2, opacity: 0.85 };
const ppc = 4; // píxeles por celda
const hm = H.heatmapPixels(grid, opciones, ppc);

// Lienzo: fondo gris claro "de plano", mapa de calor, límite y curvas encima, leyenda abajo.
const margen = 20;
const altoLeyenda = 60;
const W = hm.width + 2 * margen;
const Hh = hm.height + 2 * margen + altoLeyenda;
const img = new Uint8Array(W * Hh * 4);
for (let i = 0; i < W * Hh; i++) img.set([245, 245, 240, 255], i * 4);
const mezclar = (x, y, [r, g, b, a]) => {
  if (x < 0 || y < 0 || x >= W || y >= Hh || a === 0) return;
  const o = (y * W + x) * 4;
  const t = a / 255;
  img[o] = Math.round(img[o] * (1 - t) + r * t);
  img[o + 1] = Math.round(img[o + 1] * (1 - t) + g * t);
  img[o + 2] = Math.round(img[o + 2] * (1 - t) + b * t);
};
for (let y = 0; y < hm.height; y++) {
  for (let x = 0; x < hm.width; x++) {
    const o = (y * hm.width + x) * 4;
    mezclar(x + margen, y + margen, [hm.data[o], hm.data[o + 1], hm.data[o + 2], hm.data[o + 3]]);
  }
}
// PDF → píxel.
const aPx = (p) => ({ x: margen + ((p.x - grid.origin.x) / grid.cellSizePdf) * ppc, y: margen + ((p.y - grid.origin.y) / grid.cellSizePdf) * ppc });
const linea = (a, b, color, grosor = 1, guion = 0) => {
  const [pa, pb] = [aPx(a), aPx(b)];
  const pasos = Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y));
  for (let s = 0; s <= pasos; s++) {
    if (guion && Math.floor(s / guion) % 2 === 1) continue;
    const x = pa.x + ((pb.x - pa.x) * s) / (pasos || 1);
    const y = pa.y + ((pb.y - pa.y) * s) / (pasos || 1);
    for (let dy = 0; dy < grosor; dy++) for (let dx = 0; dx < grosor; dx++) mezclar(Math.round(x) + dx, Math.round(y) + dy, color);
  }
};
for (const c of existente.filter((f) => f.kind === 'contour')) {
  c.points.forEach((p, i) => linea(p, c.points[(i + 1) % c.points.length], [90, 70, 50, 200], 1, 5));
}
limite.forEach((p, i) => linea(p, limite[(i + 1) % limite.length], [20, 20, 20, 255], 3));

// Leyenda: barra de −maxCut (rojo) a +maxFill (azul) pasando por verde.
const y0 = hm.height + 2 * margen + 10;
const ancho = W - 2 * margen;
for (let x = 0; x < ancho; x++) {
  const dz = -opciones.maxCutM + ((opciones.maxCutM + opciones.maxFillM) * x) / (ancho - 1);
  const [r, g, b] = H.heatColor(dz, { ...opciones, opacity: 1 });
  for (let y = 0; y < 24; y++) mezclar(margen + x, y0 + y, [r, g, b, 255]);
}
// Marcas: extremos, ±tolerancia y 0.
for (const dz of [-opciones.maxCutM, -opciones.toleranceM, 0, opciones.toleranceM, opciones.maxFillM]) {
  const x = Math.round(margen + ((dz + opciones.maxCutM) / (opciones.maxCutM + opciones.maxFillM)) * (ancho - 1));
  for (let y = 0; y < 34; y++) mezclar(x, y0 + y, [20, 20, 20, 255]);
}

// Codificador PNG mínimo (RGBA 8 bits, filtro 0).
const crcTabla = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const bloque = (tipo, datos) => {
  const b = Buffer.alloc(12 + datos.length);
  b.writeUInt32BE(datos.length, 0);
  b.write(tipo, 4, 'ascii');
  Buffer.from(datos).copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + datos.length)), 8 + datos.length);
  return b;
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(Hh, 4);
ihdr.set([8, 6, 0, 0, 0], 8);
const crudo = Buffer.alloc((W * 4 + 1) * Hh);
for (let y = 0; y < Hh; y++) Buffer.from(img.buffer, y * W * 4, W * 4).copy(crudo, y * (W * 4 + 1) + 1);
writeFileSync(
  salida,
  Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloque('IHDR', ihdr), bloque('IDAT', deflateSync(crudo)), bloque('IEND', Buffer.alloc(0))]),
);

const t = grid.totals;
const yd = Q.totalsInUnits(t, 'imperial');
console.log(`Heat map → ${salida} (${W}×${Hh} px, malla ${grid.cols}×${grid.rows} de ${grid.cellSizeM} m)`);
console.log(`  Area ${t.areaM2.toFixed(1)} m² · Cut ${t.cutM3.toFixed(1)} m³ (${yd.cut.toFixed(1)} yd³) · Fill ${t.fillM3.toFixed(1)} m³ (${yd.fill.toFixed(1)} yd³) · Net ${t.netM3.toFixed(1)} m³ (${yd.net.toFixed(1)} yd³)`);
console.log(`  Legend: red = cut up to ${opciones.maxCutM} m, green = ±${opciones.toleranceM} m, blue = fill up to ${opciones.maxFillM} m`);
