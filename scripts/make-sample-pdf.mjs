// Genera public/sample-plan.pdf: un plano de sitio sencillo a escala 1:500 para pruebas.
// Uso: npm run sample-pdf   (o: node scripts/make-sample-pdf.mjs)
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, LineCapStyle } from 'pdf-lib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const salida = resolve(__dirname, '../public/sample-plan.pdf');

// A3 horizontal en unidades PDF (1 u = 1/72 in).
const W = 1190.55;
const H = 841.89;
// Escala 1:500 → metros reales por unidad PDF.
const M_POR_U = (500 * 0.0254) / 72; // ≈ 0.17639 m
const uDesdeM = (m) => m / M_POR_U; // 20 m ≈ 113.39 u

const negro = rgb(0, 0, 0);
const gris = rgb(0.45, 0.45, 0.45);
const cafe = rgb(0.55, 0.35, 0.15);
const azul = rgb(0.1, 0.3, 0.7);

const doc = await PDFDocument.create();
doc.setTitle('Plano de prueba - Escala 1:500');
doc.setAuthor('excavation-app');
doc.setSubject('Plano de sitio de ejemplo para cubicación de corte y relleno');
doc.setProducer('pdf-lib');
doc.setCreator('scripts/make-sample-pdf.mjs');
// Fechas fijas para que el archivo generado sea reproducible.
const fecha = new Date('2026-01-01T00:00:00Z');
doc.setCreationDate(fecha);
doc.setModificationDate(fecha);

const page = doc.addPage([W, H]);
const helv = await doc.embedFont(StandardFonts.Helvetica);
const helvB = await doc.embedFont(StandardFonts.HelveticaBold);

// Utilidades con origen arriba-izquierda (como en el lienzo), pdf-lib usa abajo-izquierda.
const rect = (x, y, w, h, opts = {}) =>
  page.drawRectangle({ x, y: H - y - h, width: w, height: h, borderColor: negro, borderWidth: 1, ...opts });
const texto = (str, x, y, size = 9, font = helv, color = negro, extra = {}) =>
  page.drawText(str, { x, y: H - y, size, font, color, ...extra });
const ruta = (d, opts = {}) =>
  page.drawSvgPath(d, { x: 0, y: H, borderColor: negro, borderWidth: 1, ...opts });
const polilinea = (pts, cerrar = false) =>
  'M ' + pts.map(([x, y]) => `${x} ${y}`).join(' L ') + (cerrar ? ' Z' : '');

// --- Marco ---
rect(20, 20, W - 40, H - 40, { borderWidth: 2 });
rect(30, 30, W - 60, H - 60, { borderWidth: 0.75 });

// --- Título ---
texto('Plano de prueba - Escala 1:500', 50, 62, 20, helvB);
texto('Levantamiento topográfico y proyecto de terracerías (ejemplo)', 50, 80, 10, helv, gris);

// --- Curvas de nivel (cada 1 m, maestras cada 5 m) ---
const curvas = [
  { cota: 98, y: 170 },
  { cota: 99, y: 255 },
  { cota: 100, y: 340 },
  { cota: 101, y: 425 },
  { cota: 102, y: 510 },
  { cota: 103, y: 595 },
  { cota: 104, y: 680 },
];
for (const { cota, y } of curvas) {
  const maestra = cota % 5 === 0;
  const d = `M 60 ${y} C 280 ${y - 70}, 520 ${y + 90}, 760 ${y - 10} S 1000 ${y - 60}, 1130 ${y - 20}`;
  ruta(d, { borderColor: cafe, borderWidth: maestra ? 1.4 : 0.6, borderOpacity: 0.85 });
  // Etiqueta de cota cerca del inicio de la curva, con fondo blanco.
  const etiqueta = `${cota.toFixed(2)}`;
  const size = maestra ? 9 : 7.5;
  const ancho = (maestra ? helvB : helv).widthOfTextAtSize(etiqueta, size);
  rect(66, y - 12, ancho + 6, size + 3, { color: rgb(1, 1, 1), borderWidth: 0 });
  texto(etiqueta, 69, y - 3, size, maestra ? helvB : helv, cafe);
}

// --- Lindero del predio (línea de trazo y punto) ---
const lindero = [
  [120, 120],
  [820, 105],
  [905, 420],
  [860, 700],
  [140, 715],
  [100, 400],
];
ruta(polilinea(lindero, true), { borderWidth: 1.6, borderDashArray: [14, 4, 2, 4] });
texto('LINDERO', 460, 100, 8, helvB);

// --- Camino de acceso (dos polilíneas paralelas) ---
ruta(polilinea([[100, 555], [380, 530], [650, 548], [905, 540]]), { borderWidth: 1 });
ruta(polilinea([[100, 585], [380, 560], [650, 578], [905, 570]]), { borderWidth: 1 });
texto('CAMINO DE ACCESO', 180, 563, 7.5, helv, gris);

// --- Edificio proyectado (zona de corte) ---
rect(380, 300, 240, 160, { borderWidth: 1.8, color: rgb(0.95, 0.85, 0.85) });
texto('EDIFICIO PROYECTADO', 435, 375, 10, helvB);
texto('NPT 101.50', 468, 390, 9, helv);
texto(`${(240 * M_POR_U).toFixed(2)} x ${(160 * M_POR_U).toFixed(2)} m`, 455, 404, 8, helv, gris);

// --- Estacionamiento (zona de relleno) ---
rect(650, 480, 170, 150, { borderWidth: 1.4, color: rgb(0.85, 0.9, 0.97), borderColor: azul });
texto('ESTACIONAMIENTO', 685, 548, 8.5, helvB, azul);
texto('NPT 102.30 (relleno)', 682, 562, 7.5, helv, azul);

// --- Cotas puntuales ---
const puntos = [
  [200, 220, '98.65'],
  [560, 250, '99.40'],
  [300, 470, '101.10'],
  [760, 380, '100.85'],
  [520, 650, '103.20'],
];
for (const [x, y, c] of puntos) {
  ruta(`M ${x - 4} ${y} L ${x + 4} ${y} M ${x} ${y - 4} L ${x} ${y + 4}`, { borderWidth: 0.8 });
  texto(c, x + 6, y - 2, 7, helv);
}

// --- Norte ---
const nx = W - 110;
const ny = 110;
ruta(`M ${nx} ${ny - 35} L ${nx + 12} ${ny + 10} L ${nx} ${ny} L ${nx - 12} ${ny + 10} Z`, {
  color: negro,
  borderWidth: 1,
});
texto('N', nx - 5, ny - 42, 14, helvB);

// --- Barra de escala gráfica de 20 m (4 tramos de 5 m) ---
const bx = 60;
const by = H - 100;
const tramo = uDesdeM(5);
for (let i = 0; i < 4; i++) {
  rect(bx + i * tramo, by, tramo, 8, { color: i % 2 === 0 ? negro : rgb(1, 1, 1), borderWidth: 0.8 });
  texto(String(i * 5), bx + i * tramo - (i === 0 ? 2 : 4), by + 20, 8);
}
texto('20 m', bx + 4 * tramo - 6, by + 20, 8, helvB);
texto('ESCALA GRÁFICA 1:500', bx, by - 8, 8, helvB);
page.drawLine({
  start: { x: bx, y: H - by + 6 },
  end: { x: bx, y: H - by - 14 },
  thickness: 0.5,
  color: negro,
  lineCap: LineCapStyle.Butt,
});

// --- Cuadro de datos (esquina inferior derecha) ---
const cx = W - 340;
const cy = H - 140;
rect(cx, cy, 310, 110, { borderWidth: 1.2 });
page.drawLine({ start: { x: cx, y: H - cy - 30 }, end: { x: cx + 310, y: H - cy - 30 }, thickness: 0.8 });
texto('Plano de prueba - Escala 1:500', cx + 10, cy + 20, 12, helvB);
texto('Proyecto: Movimiento de tierras (ejemplo)', cx + 10, cy + 48, 9);
texto('Unidades: metros · Cotas en m s.n.m.', cx + 10, cy + 63, 9);
texto('Equidistancia de curvas: 1.00 m', cx + 10, cy + 78, 9);
texto('Formato A3 · Hoja 1 de 1', cx + 10, cy + 93, 9, helv, gris);

const bytes = await doc.save({ useObjectStreams: false });
mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, bytes);
console.log(`PDF generado: ${salida} (${bytes.length} bytes)`);
