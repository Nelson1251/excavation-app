// Mapa de calor de corte/relleno: color por dz (propuesto − existente) y búfer de píxeles RGBA
// (una celda de la malla = un bloque de píxeles) listo para dibujarse como Konva.Image.
// Rojo = corte, azul = relleno, verde = a rasante (|dz| ≤ tolerancia).
import type { EarthworkGrid, HeatmapOptions } from '../../types/earthwork';

export type RGBA = [number, number, number, number];
type RGB = [number, number, number];

/** Paleta (Tailwind red/blue/green) — también la usará la leyenda. */
export const HEATMAP_COLORS = {
  grade: [34, 197, 94] as RGB, // green-500
  cutLight: [252, 165, 165] as RGB, // red-300
  cutDark: [185, 28, 28] as RGB, // red-700
  fillLight: [147, 197, 253] as RGB, // blue-300
  fillDark: [29, 78, 216] as RGB, // blue-700
} as const;

/** Valores por defecto: ±5 cm (~2") a rasante, rojo/azul máximos a 2 m, 55 % de opacidad. */
export const HEATMAP_DEFAULTS: HeatmapOptions = { toleranceM: 0.05, maxCutM: 2, maxFillM: 2, opacity: 0.55 };

const mezclar = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Clasificación de un dz. */
export function cutFillClass(dzM: number, toleranceM: number): 'cut' | 'fill' | 'grade' | 'none' {
  if (!Number.isFinite(dzM)) return 'none';
  if (Math.abs(dzM) <= toleranceM) return 'grade';
  return dzM < 0 ? 'cut' : 'fill';
}

/**
 * dz (m) → color RGBA 0–255. |dz| ≤ tolerancia → verde; corte: rojo claro → rojo intenso al
 * llegar a `maxCutM`; relleno: azul claro → azul intenso en `maxFillM`. NaN → transparente.
 */
export function heatColor(dzM: number, opts: HeatmapOptions = HEATMAP_DEFAULTS): RGBA {
  const clase = cutFillClass(dzM, opts.toleranceM);
  if (clase === 'none') return [0, 0, 0, 0];
  const alfa = Math.round(Math.min(1, Math.max(0, opts.opacity)) * 255);
  if (clase === 'grade') return [...HEATMAP_COLORS.grade, alfa];
  const max = clase === 'cut' ? opts.maxCutM : opts.maxFillM;
  const rango = max - opts.toleranceM;
  const t = rango > 0 ? Math.min(1, Math.max(0, (Math.abs(dzM) - opts.toleranceM) / rango)) : 1;
  const rgb =
    clase === 'cut'
      ? mezclar(HEATMAP_COLORS.cutLight, HEATMAP_COLORS.cutDark, t)
      : mezclar(HEATMAP_COLORS.fillLight, HEATMAP_COLORS.fillDark, t);
  return [...rgb, alfa];
}

/** Paradas de la leyenda (de corte máximo a relleno máximo), con dz en metros. */
export function heatmapLegend(opts: HeatmapOptions = HEATMAP_DEFAULTS): { dzM: number; color: RGBA; kind: 'cut' | 'fill' | 'grade' }[] {
  const tolFuera = opts.toleranceM + 1e-9;
  return [
    { dzM: -opts.maxCutM, color: heatColor(-opts.maxCutM, opts), kind: 'cut' },
    { dzM: -tolFuera, color: heatColor(-tolFuera, opts), kind: 'cut' },
    { dzM: 0, color: heatColor(0, opts), kind: 'grade' },
    { dzM: tolFuera, color: heatColor(tolFuera, opts), kind: 'fill' },
    { dzM: opts.maxFillM, color: heatColor(opts.maxFillM, opts), kind: 'fill' },
  ];
}

/** Búfer de píxeles del mapa de calor y su posición sobre el plano (unidades PDF). */
export interface HeatmapPixels {
  width: number;
  height: number;
  /** RGBA fila por fila; la fila 0 corresponde a la y mínima del plano (arriba en el lienzo). */
  data: Uint8ClampedArray;
  /** Rectángulo que ocupa la imagen en el plano, en unidades PDF (para Konva.Image x/y/width/height). */
  x: number;
  y: number;
  widthPdf: number;
  heightPdf: number;
}

/**
 * Pinta la malla: cada celda con área > 0 dentro del límite se rellena con `heatColor(dz)`;
 * el resto queda transparente. `pixelsPerCell` agranda cada celda (útil para exportar PNG).
 * Dibujar con imageSmoothingEnabled = false y recortar con el polígono del límite (clipFunc).
 */
export function heatmapPixels(grid: EarthworkGrid, opts: HeatmapOptions = HEATMAP_DEFAULTS, pixelsPerCell = 1): HeatmapPixels {
  const ppc = Math.max(1, Math.floor(pixelsPerCell));
  const width = grid.cols * ppc;
  const height = grid.rows * ppc;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      const k = j * grid.cols + i;
      if (!(grid.areaM2[k] > 0)) continue;
      const [r, g, b, a] = heatColor(grid.dzM[k], opts);
      if (a === 0) continue;
      for (let py = j * ppc; py < (j + 1) * ppc; py++) {
        let o = (py * width + i * ppc) * 4;
        for (let px = 0; px < ppc; px++, o += 4) {
          data[o] = r;
          data[o + 1] = g;
          data[o + 2] = b;
          data[o + 3] = a;
        }
      }
    }
  }
  return {
    width,
    height,
    data,
    x: grid.origin.x,
    y: grid.origin.y,
    widthPdf: grid.cols * grid.cellSizePdf,
    heightPdf: grid.rows * grid.cellSizePdf,
  };
}

/**
 * Convierte el búfer en un canvas HTML listo para `<Image image={canvas} />` de react-konva.
 * Solo en el navegador (devuelve null si no hay DOM).
 */
export function heatmapToCanvas(px: HeatmapPixels): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || typeof ImageData === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = px.width;
  canvas.height = px.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(px.data), px.width, px.height), 0, 0);
  return canvas;
}
