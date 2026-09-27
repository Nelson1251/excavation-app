// Cálculo simple de volúmenes: área × profundidad promedio (método de prisma).
// Cada zona puede tener a la vez una profundidad de corte y una de relleno; ambas partes se
// calculan por separado y se suman por separado en los totales.
import { fillMaterialNeeded, looseVolume } from './factors';

/** Volumen área × profundidad en m³ (valores negativos se tratan como 0). */
export function zoneVolume(areaM2: number, depthM: number): number {
  return Math.max(0, areaM2) * Math.max(0, depthM);
}

/** Factores (fracciones) que se aplican a una zona. */
export interface FactoresZona {
  /** Abundamiento del corte (suelo): suelto = banco × (1 + abundamiento). */
  abundamientoCorte: number;
  /** Abundamiento para acarrear el material de relleno: suelto = necesario × (1 + abundamiento). */
  abundamientoRelleno: number;
  /** Contracción por compactación del relleno: necesario = compactado / (1 − contracción). */
  contraccion: number;
}

/** Volúmenes (m³) de corte y de relleno de UNA zona. */
export interface VolumenesZona {
  /** Corte en banco (in situ) = área × cutDepth. */
  corteBanco: number;
  /** Corte suelto = corteBanco × (1 + abundamiento del corte). Es el que se acarrea. */
  corteSuelto: number;
  /** Relleno compactado = área × fillDepth. */
  rellenoCompactado: number;
  /** Material necesario (en banco) = compactado / (1 − contracción). */
  rellenoNecesario: number;
  /** Relleno suelto = necesario × (1 + abundamiento del relleno). Es el que se acarrea. */
  rellenoSuelto: number;
  /** Neto con signo = corteBanco − rellenoCompactado (corte +, relleno −). */
  neto: number;
}

/**
 * Volúmenes de corte y de relleno de una zona con dos profundidades.
 * Corte: banco = área × cutDepth; suelto = looseVolume(banco, abundamientoCorte).
 * Relleno: compactado = área × fillDepth; necesario = fillMaterialNeeded(compactado, contraccion);
 * suelto = looseVolume(necesario, abundamientoRelleno).
 */
export function zoneVolumes(areaM2: number, cutDepthM: number, fillDepthM: number, f: FactoresZona): VolumenesZona {
  const corteBanco = zoneVolume(areaM2, cutDepthM);
  const rellenoCompactado = zoneVolume(areaM2, fillDepthM);
  const rellenoNecesario = rellenoCompactado > 0 ? fillMaterialNeeded(rellenoCompactado, f.contraccion) : 0;
  return {
    corteBanco,
    corteSuelto: corteBanco > 0 ? looseVolume(corteBanco, f.abundamientoCorte) : 0,
    rellenoCompactado,
    rellenoNecesario,
    rellenoSuelto: rellenoNecesario > 0 ? looseVolume(rellenoNecesario, f.abundamientoRelleno) : 0,
    neto: corteBanco - rellenoCompactado,
  };
}

/** Totales del proyecto: corte y relleno sumados por separado sobre todas las zonas (todas las hojas). */
export type Totales = VolumenesZona;

/** Suma por separado las partes de corte y de relleno de todas las zonas. */
export function totals(zonas: VolumenesZona[]): Totales {
  const t: Totales = { corteBanco: 0, corteSuelto: 0, rellenoCompactado: 0, rellenoNecesario: 0, rellenoSuelto: 0, neto: 0 };
  for (const z of zonas) {
    t.corteBanco += z.corteBanco;
    t.corteSuelto += z.corteSuelto;
    t.rellenoCompactado += z.rellenoCompactado;
    t.rellenoNecesario += z.rellenoNecesario;
    t.rellenoSuelto += z.rellenoSuelto;
  }
  t.neto = t.corteBanco - t.rellenoCompactado;
  return t;
}
