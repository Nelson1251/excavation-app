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
