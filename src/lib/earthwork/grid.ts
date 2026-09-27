// Volúmenes de corte y relleno por el método de malla (grid method): se cubre el límite del sitio
// con celdas cuadradas, cada celda se recorta con el polígono del límite (área exacta en los
// bordes), se muestrean ambas superficies en el centroide de la parte recortada y
// volumen = área × dz. Para superficies planas (o lineales por celda) el resultado es exacto
// mientras dz no cambie de signo dentro de una celda.
import type {
  EarthworkGrid,
  EarthworkGridOptions,
  EarthworkTotals,
  ElevationFeature,
  Point,
  Surface,
} from '../../types/earthwork';
import { buildSurface, type ElevationSurface } from './surface';

/** Máximo de celdas permitido (protege al navegador de una celda demasiado chica). */
export const MAX_GRID_CELLS = 2_000_000;

/** Área firmada (shoelace) de un polígono en sus unidades², positiva si es antihorario (y arriba). */
export function signedArea(pts: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Área y centroide de un polígono (maneja piezas degeneradas del recorte). */
export function areaCentroid(pts: readonly Point[]): { area: number; c: Point } {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const cruz = p.x * q.y - q.x * p.y;
    a2 += cruz;
    cx += (p.x + q.x) * cruz;
    cy += (p.y + q.y) * cruz;
  }
  if (Math.abs(a2) < 1e-15) {
    const n = pts.length || 1;
    return { area: 0, c: { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n } };
  }
  return { area: Math.abs(a2) / 2, c: { x: cx / (3 * a2), y: cy / (3 * a2) } };
}

/** Recorta un polígono con el semiplano eje ≥ v (dir = 1) o eje ≤ v (dir = −1). Sutherland–Hodgman. */
function recortar(pts: readonly Point[], eje: 'x' | 'y', v: number, dir: 1 | -1): Point[] {
  const salida: Point[] = [];
  const dentro = (p: Point) => dir * (p[eje] - v) >= 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ad = dentro(a);
    const bd = dentro(b);
    if (ad) salida.push(a);
    if (ad !== bd) {
      const t = (v - a[eje]) / (b[eje] - a[eje]);
      salida.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return salida;
}

/** Parte del polígono dentro del rectángulo [x0, x1] × [y0, y1]. */
export function clipToRect(pts: readonly Point[], x0: number, y0: number, x1: number, y1: number): Point[] {
  let r = recortar(pts, 'x', x0, 1);
  if (r.length) r = recortar(r, 'x', x1, -1);
  if (r.length) r = recortar(r, 'y', y0, 1);
  if (r.length) r = recortar(r, 'y', y1, -1);
  return r;
}

/** Tamaño de celda (m) sugerido para obtener ~`celdasObjetivo` celdas en un área dada (m²). */
export function suggestCellSizeM(areaM2: number, celdasObjetivo = 40_000): number {
  if (!(areaM2 > 0)) return 1;
  const lado = Math.sqrt(areaM2 / celdasObjetivo);
  // Redondeo a un valor "limpio": 0.25, 0.5, 1, 2, 5… m.
  const limpios = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
  return limpios.find((l) => l >= lado) ?? Math.ceil(lado);
}

type Entrada = Surface | readonly ElevationFeature[] | ElevationSurface;

const esSuperficieLista = (s: Entrada): s is ElevationSurface => typeof (s as ElevationSurface).sample === 'function';

/**
 * Calcula la malla de corte/relleno entre la superficie existente y la propuesta dentro del
 * límite. `existing` / `proposed` pueden ser una `Surface`, una lista de elementos (solo cuentan
 * los aceptados) o una superficie ya construida.
 */
export function computeEarthworkGrid(
  existing: Entrada,
  proposed: Entrada,
  boundary: readonly Point[],
  options: EarthworkGridOptions,
): EarthworkGrid {
  const { metersPerPdfUnit: mpu, cellSizeM } = options;
  if (!(mpu > 0)) throw new RangeError('metersPerPdfUnit must be > 0 (calibrate the scale first).');
  if (!(cellSizeM > 0)) throw new RangeError('cellSizeM must be > 0.');
  if (boundary.length < 3) throw new RangeError('The site boundary needs at least 3 points.');

  const maxSegPdf = (options.densifyM ?? cellSizeM) / mpu;
  const construir = (e: Entrada): ElevationSurface =>
    esSuperficieLista(e)
      ? e
      : buildSurface(Array.isArray(e) ? e : (e as Surface).features, { maxSegPdf, idwPower: options.idwPower });
  const sExist = construir(existing);
  const sProp = construir(proposed);

  const cellSizePdf = cellSizeM / mpu;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of boundary) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const cols = Math.max(1, Math.ceil((maxX - minX) / cellSizePdf - 1e-9));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cellSizePdf - 1e-9));
  if (cols * rows > MAX_GRID_CELLS) {
    throw new RangeError(`Grid too fine: ${cols * rows} cells (max ${MAX_GRID_CELLS}). Use a larger cell size.`);
  }

  const n = cols * rows;
  const areaM2 = new Float64Array(n);
  const existingM = new Float64Array(n).fill(NaN);
  const proposedM = new Float64Array(n).fill(NaN);
  const dzM = new Float64Array(n).fill(NaN);
  const totals: EarthworkTotals = { cutM3: 0, fillM3: 0, netM3: 0, areaM2: 0, cutAreaM2: 0, fillAreaM2: 0 };
  const m2PorPdf2 = mpu * mpu;

  for (let j = 0; j < rows; j++) {
    const y0 = minY + j * cellSizePdf;
    const y1 = y0 + cellSizePdf;
    // Franja horizontal del límite (se recorta una vez por fila y luego por columnas).
    let franja = recortar(boundary, 'y', y0, 1);
    if (franja.length) franja = recortar(franja, 'y', y1, -1);
    if (franja.length < 3) continue;
    for (let i = 0; i < cols; i++) {
      const x0 = minX + i * cellSizePdf;
      let pieza = recortar(franja, 'x', x0, 1);
      if (pieza.length) pieza = recortar(pieza, 'x', x0 + cellSizePdf, -1);
      if (pieza.length < 3) continue;
      const { area, c } = areaCentroid(pieza);
      if (area <= 0) continue;
      const k = j * cols + i;
      const a = area * m2PorPdf2;
      const ze = sExist.sample(c.x, c.y);
      const zp = sProp.sample(c.x, c.y);
      const dz = zp - ze;
      areaM2[k] = a;
      existingM[k] = ze;
      proposedM[k] = zp;
      dzM[k] = dz;
      totals.areaM2 += a;
      if (!Number.isFinite(dz)) continue;
      if (dz < 0) {
        totals.cutM3 += -dz * a;
        totals.cutAreaM2 += a;
      } else if (dz > 0) {
        totals.fillM3 += dz * a;
        totals.fillAreaM2 += a;
      }
    }
  }
  totals.netM3 = totals.cutM3 - totals.fillM3;
  return { origin: { x: minX, y: minY }, cols, rows, cellSizePdf, cellSizeM, areaM2, existingM, proposedM, dzM, totals };
}

/** dz (m) de la celda que contiene el punto (unidades PDF), o NaN fuera de la malla/límite. */
export function gridDzAt(grid: EarthworkGrid, p: Point): number {
  const i = Math.floor((p.x - grid.origin.x) / grid.cellSizePdf);
  const j = Math.floor((p.y - grid.origin.y) / grid.cellSizePdf);
  if (i < 0 || j < 0 || i >= grid.cols || j >= grid.rows) return NaN;
  return grid.dzM[j * grid.cols + i];
}
