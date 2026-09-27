// Genera un PDF de prueba de 3 hojas con escalas distintas (1:500, 1:200 y 1:1000), cada una con
// una barra de escala gráfica y un rectángulo de medidas conocidas. Sirve para probar la
// navegación de páginas y la escala por hoja.
// Uso: node scripts/make-multipage-pdf.mjs [salida.pdf]   (por defecto: sample-multipage.pdf)
import { writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const salida = process.argv[2] ?? 'sample-multipage.pdf';
const mPorU = (n) => (n * 0.0254) / 72; // metros por unidad PDF a escala 1:n
// Coordenadas de la barra y del rectángulo en unidades PDF con origen ARRIBA a la izquierda
// (como en la app); pdf-lib usa origen abajo, se convierte con H − y.
export const HOJAS = [
  { tamano: [1190.55, 841.89], escala: 500, barraM: 20, rect: { x: 300, y: 250, w: 200, h: 100 } },
  { tamano: [612, 792], escala: 200, barraM: 10, rect: { x: 150, y: 200, w: 300, h: 200 } },
  { tamano: [1224, 792], escala: 1000, barraM: 50, rect: { x: 500, y: 300, w: 150, h: 100 } },
];

const doc = await PDFDocument.create();
const fuente = await doc.embedFont(StandardFonts.HelveticaBold);
HOJAS.forEach((h, i) => {
  const [W, H] = h.tamano;
  const p = doc.addPage([W, H]);
  const texto = (t, x, y, size = 12) => p.drawText(t, { x, y: H - y, size, font: fuente, color: rgb(0, 0, 0) });
  p.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  texto(`SHEET ${i + 1} OF ${HOJAS.length} - SCALE 1:${h.escala}`, 50, 60, 22);
  const { x, y, w, h: alto } = h.rect;
  p.drawRectangle({ x, y: H - y - alto, width: w, height: alto, borderColor: rgb(0.7, 0, 0), borderWidth: 1.5, color: rgb(1, 0.9, 0.9) });
  const m = mPorU(h.escala);
  texto(`${(w * m).toFixed(2)} m x ${(alto * m).toFixed(2)} m`, x + 5, y + alto / 2, 10);
  // Barra de escala: empieza en x = 60, y (centro) = H − 96.
  const largo = h.barraM / m;
  p.drawRectangle({ x: 60, y: 92, width: largo, height: 8, color: rgb(0, 0, 0) });
  texto(`0`, 58, H - 110, 8);
  texto(`${h.barraM} m`, 60 + largo - 10, H - 110, 8);
  texto(`GRAPHIC SCALE 1:${h.escala}`, 60, H - 70, 8);
});
writeFileSync(salida, await doc.save());
console.log(`PDF de ${HOJAS.length} hojas guardado en ${salida}`);
