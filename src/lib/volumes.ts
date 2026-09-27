// Cálculo simple de volúmenes: área × profundidad promedio (método de prisma).
import type { TipoZona } from '../types';

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
