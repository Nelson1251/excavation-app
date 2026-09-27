// Utilidades de zonas compartidas por la lista, el lienzo y el store: nombre visible, migración
// del modelo antiguo (tipo + profundidad) al nuevo (cutDepth + fillDepth) y factores por zona.
import type { Traductor } from '../i18n';
import type { Factors, Zone } from '../types';
import { abundamientoDeZona, contraccionDeZona, type OrigenAbundamiento } from './soils';
import type { FactoresZona } from './volumes';

/** Nombre visible de una zona: clave i18n (ejemplos) → nombre del usuario → "Zone n"/"Zona n" traducido. */
export const nombreZona = (z: Zone, indice: number, t: Traductor) =>
  z.nombreClave ? t(z.nombreClave) : z.nombre.trim() || t('zone.defaultName', { n: indice + 1 });

/**
 * Zona guardada con el modelo antiguo (hasta v0.4.0): una sola `profundidad` y un `tipo`
 * ('corte' | 'relleno'). También acepta zonas ya migradas o sin `pageIndex` (antes de multipágina).
 */
export type ZonaEntrada = Omit<Zone, 'id' | 'cutDepth' | 'fillDepth' | 'pageIndex'> & {
  id?: string;
  cutDepth?: number;
  fillDepth?: number;
  pageIndex?: number;
  /** Modelo antiguo. */
  tipo?: 'corte' | 'relleno';
  /** Modelo antiguo: profundidad (corte) o espesor (relleno) en metros. */
  profundidad?: number;
};

/** Zona en el modelo actual (el id puede faltar si todavía no se agregó al store). */
export type ZonaMigrada = Omit<Zone, 'id'> & { id?: string };

/** Magnitud ≥ 0 finita (el relleno se guarda como magnitud aunque el usuario piense en él como negativo). */
const magnitud = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.abs(v) : 0);
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Convierte una zona al modelo actual sin perder datos:
 * - Zona antigua de corte con profundidad d → cutDepth = d, fillDepth = 0.
 * - Zona antigua de relleno con espesor d → cutDepth = 0, fillDepth = d; su abundamiento manual
 *   (que era el del acarreo del material) pasa a `abundamientoRellenoManual`.
 * - Zona ya migrada: se conservan cutDepth/fillDepth (normalizados a magnitudes ≥ 0).
 * - Sin `pageIndex` → hoja 1 (índice 0).
 * Los campos antiguos `tipo` y `profundidad` se eliminan; el resto se conserva tal cual.
 */
export function migrarZona(z: Zone): Zone;
export function migrarZona(z: ZonaEntrada): ZonaMigrada;
export function migrarZona(z: ZonaEntrada): ZonaMigrada {
  const { tipo, profundidad, ...resto } = z;
  const pageIndex = esNumero(resto.pageIndex) && resto.pageIndex >= 0 ? Math.floor(resto.pageIndex) : 0;
  if (esNumero(resto.cutDepth) || esNumero(resto.fillDepth)) {
    return { ...resto, pageIndex, cutDepth: magnitud(resto.cutDepth), fillDepth: magnitud(resto.fillDepth) };
  }
  const d = magnitud(profundidad);
  if (tipo === 'relleno') {
    const { abundamientoManual, ...sinAbund } = resto;
    return {
      ...sinAbund,
      ...(abundamientoManual !== undefined && sinAbund.abundamientoRellenoManual === undefined
        ? { abundamientoRellenoManual: abundamientoManual }
        : {}),
      pageIndex,
      cutDepth: 0,
      fillDepth: d,
    };
  }
  // 'corte' o sin tipo (el tipo por defecto siempre fue corte).
  return { ...resto, pageIndex, cutDepth: d, fillDepth: 0 };
}

/** Qué movimiento tiene una zona según sus dos profundidades. */
export type MovimientoZona = 'corte' | 'relleno' | 'mixta' | 'ninguno';

export function movimientoZona(z: Pick<Zone, 'cutDepth' | 'fillDepth'>): MovimientoZona {
  const c = z.cutDepth > 0;
  const f = z.fillDepth > 0;
  return c && f ? 'mixta' : c ? 'corte' : f ? 'relleno' : 'ninguno';
}

type Factor = { valor: number; origen: OrigenAbundamiento };

/** Factores usados en una zona (y los valores por defecto sin el valor manual, para prellenar campos). */
export interface FactoresUsados {
  abundCorte: Factor;
  abundCortePorDefecto: Factor;
  abundRelleno: Factor;
  abundRellenoPorDefecto: Factor;
  contr: Factor;
  contrPorDefecto: Factor;
  /** Fracciones listas para zoneVolumes(). */
  paraVolumen: FactoresZona;
}

/**
 * Factores de una zona:
 * - Abundamiento del corte: manual → tipo de suelo → proyecto.
 * - Contracción del relleno: manual → material de relleno → proyecto.
 * - Abundamiento del material de relleno (acarreo): manual → proyecto (el suelo del corte no aplica).
 */
export function factoresDeZona(z: Zone, factors: Factors): FactoresUsados {
  const abundCorte = abundamientoDeZona({ soilType: z.soilType, abundamientoManual: z.abundamientoManual }, factors.abundamiento);
  const abundCortePorDefecto = abundamientoDeZona({ soilType: z.soilType }, factors.abundamiento);
  const abundRelleno = abundamientoDeZona({ abundamientoManual: z.abundamientoRellenoManual }, factors.abundamiento);
  const abundRellenoPorDefecto = abundamientoDeZona({}, factors.abundamiento);
  const contr = contraccionDeZona(z, factors.contraccion);
  const contrPorDefecto = contraccionDeZona({ fillMaterial: z.fillMaterial }, factors.contraccion);
  return {
    abundCorte,
    abundCortePorDefecto,
    abundRelleno,
    abundRellenoPorDefecto,
    contr,
    contrPorDefecto,
    paraVolumen: { abundamientoCorte: abundCorte.valor, abundamientoRelleno: abundRelleno.valor, contraccion: contr.valor },
  };
}
