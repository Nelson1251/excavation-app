// Utilidades geométricas. Las coordenadas de entrada están en unidades PDF;
// se convierten a metros con la escala calibrada (metros por unidad PDF).
import { kinks, polygon } from '@turf/turf';
import type { Point } from '../types';

/** Unidades PDF por pulgada (1 pt = 1/72 in). */
export const PDF_UNITS_PER_INCH = 72;

/**
 * Área de un polígono con la fórmula del cordón de zapato (shoelace).
 * Devuelve el área en unidades PDF² (siempre positiva, sin importar el sentido de giro).
 */
export function shoelaceArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let suma = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    suma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(suma) / 2;
}

/** Convierte una longitud en unidades PDF a metros reales. */
export function pdfUnitsToMeters(value: number, metersPerPdfUnit: number): number {
  return value * metersPerPdfUnit;
}

/** Convierte un área en unidades PDF² a m² (la escala se aplica al cuadrado). */
export function pdfAreaToSquareMeters(areaPdf: number, metersPerPdfUnit: number): number {
  return areaPdf * metersPerPdfUnit * metersPerPdfUnit;
}

/** Área real de un polígono en m². */
export function polygonAreaM2(points: Point[], metersPerPdfUnit: number): number {
  return pdfAreaToSquareMeters(shoelaceArea(points), metersPerPdfUnit);
}

/** Distancia entre dos puntos en unidades PDF (útil para la calibración). */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Escala (metros por unidad PDF) a partir de una escala de plano 1:N,
 * suponiendo que el PDF se imprimió a tamaño real.
 * Ej.: 1:500 → 500 × 0.0254 / 72 ≈ 0.1764 m por unidad PDF.
 */
export function metersPerPdfUnitFromRatio(denominador: number): number {
  return (denominador * 0.0254) / PDF_UNITS_PER_INCH;
}

/** Escala a partir de una línea de referencia: distancia real (m) / distancia medida (unidades PDF). */
export function metersPerPdfUnitFromReference(a: Point, b: Point, distanciaRealM: number): number | null {
  const d = distance(a, b);
  return d > 0 ? distanciaRealM / d : null;
}

/** true si el polígono no se auto-intersecta (validación con Turf). */
export function isSimplePolygon(points: Point[]): boolean {
  if (points.length < 3) return false;
  const anillo = points.map((p) => [p.x, p.y]);
  anillo.push([points[0].x, points[0].y]);
  return kinks(polygon([anillo])).features.length === 0;
}

// ---------------------------------------------------------------------------
// Dibujo en el lienzo
// ---------------------------------------------------------------------------

/** Movimiento mínimo del puntero (px de pantalla) para que un clic se considere arrastre. */
export const DRAG_THRESHOLD_PX = 5;
/** Radio (px de pantalla) alrededor del primer vértice que cierra el polígono al hacer clic. */
export const CLOSE_RADIUS_PX = 10;

/** true si el puntero se movió más de `umbralPx` entre `a` y `b` (coordenadas de pantalla). */
export function isDrag(a: Point, b: Point, umbralPx = DRAG_THRESHOLD_PX): boolean {
  return distance(a, b) > umbralPx;
}

/**
 * Rectángulo (4 vértices, empezando por la esquina superior izquierda y en sentido horario en
 * pantalla) a partir de las esquinas opuestas de un arrastre, en cualquier dirección.
 */
export function rectFromDrag(a: Point, b: Point): Point[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/** Convierte un punto del plano (unidades PDF) a píxeles de pantalla con la vista (zoom y desplazamiento). */
export function planToScreen(p: Point, vista: { zoom: number; x: number; y: number }): Point {
  return { x: p.x * vista.zoom + vista.x, y: p.y * vista.zoom + vista.y };
}

/** Convierte un punto de pantalla (px relativos al lienzo) a unidades PDF (inverso de planToScreen). */
export function screenToPlan(p: Point, vista: { zoom: number; x: number; y: number }): Point {
  return { x: (p.x - vista.x) / vista.zoom, y: (p.y - vista.y) / vista.zoom };
}

/**
 * Centroide del área de un polígono (para colocar la etiqueta). Si el área es nula
 * (polígono degenerado) devuelve el promedio de los vértices.
 */
export function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-9) {
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}
