// Cálculo simple de volúmenes: área × profundidad promedio (método de prisma).
import type { TipoZona } from '../types';
import { fillMaterialNeeded, looseVolume } from './factors';

/** Volumen de una zona en m³ (en banco para corte, compactado para relleno). */
export function zoneVolume(areaM2: number, depthM: number): number {
  return Math.max(0, areaM2) * Math.max(0, depthM);
}

export interface VolumenZona {
  tipo: TipoZona;
  volumen: number;
}

export interface Totales {
  corte: number;
  relleno: number;
  /** corte − relleno. Positivo = sobra material; negativo = falta material. */
  neto: number;
}

/** Totales de corte, relleno y balance neto. */
export function totals(zonas: VolumenZona[]): Totales {
  let corte = 0;
  let relleno = 0;
  for (const z of zonas) {
    if (z.tipo === 'corte') corte += z.volumen;
    else relleno += z.volumen;
  }
  return { corte, relleno, neto: corte - relleno };
}

/** Volúmenes de una zona (m³). */
export interface VolumenesZona {
  /** Volumen geométrico área × profundidad (en banco para corte; compactado para relleno). */
  geometrico: number;
  /** Volumen en banco (in situ): corte = geométrico; relleno = material necesario = compactado / (1 − contracción). */
  banco: number;
  /** Volumen suelto (abundado) = banco × (1 + abundamiento). Es el que se acarrea. */
  suelto: number;
}

/**
 * Volúmenes en banco y suelto de una zona.
 * - Corte: banco = volumen geométrico.
 * - Relleno: el geométrico es volumen compactado; banco = compactado / (1 − contracción).
 * En ambos casos suelto = looseVolume(banco, abundamiento).
 */
export function zoneVolumes(tipo: TipoZona, geometricoM3: number, abundamiento: number, contraccion: number): VolumenesZona {
  const banco = tipo === 'corte' ? geometricoM3 : fillMaterialNeeded(geometricoM3, contraccion);
  return { geometrico: geometricoM3, banco, suelto: looseVolume(banco, abundamiento) };
}
