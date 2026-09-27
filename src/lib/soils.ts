// Catálogo de tipos de suelo (zonas de corte) y materiales de relleno (zonas de relleno),
// con su abundamiento / contracción típicos. Los nombres visibles NO están aquí: se traducen
// con las claves `soil.<id>` y `fill.<id>` de src/i18n (en.ts / es.ts).
import type { Clave, Traductor } from '../i18n';

// ---------------------------------------------------------------------------
// Tipos de suelo (zonas de corte) y su abundamiento (esponjamiento)
// ---------------------------------------------------------------------------
//
// El abundamiento de cada zona se usa para pasar el volumen en banco a volumen suelto
// (suelto = banco × (1 + abundamiento)). Prioridad: valor manual de la zona → valor
// representativo del tipo de suelo → abundamiento general del proyecto.
//
// Fuente de los rangos: valores aproximados de tablas generales de movimiento de tierras
// (p. ej. Caterpillar Performance Handbook, tabla de pesos y factores de abundamiento de
// materiales; Peurifoy, "Construction Planning, Equipment and Methods"). El valor
// representativo es el punto medio del rango típico. Varían con humedad, compacidad y
// método de excavación: verificar siempre con el estudio de mecánica de suelos.

export interface TipoSueloInfo {
  id: string;
  /** Rango típico de abundamiento en porcentaje. */
  abundamientoTipico: { min: number; max: number };
}

export const TIPOS_SUELO = [
  { id: 'arcilla', abundamientoTipico: { min: 30, max: 40 } },
  { id: 'arcilla-arenosa', abundamientoTipico: { min: 25, max: 35 } },
  { id: 'arena', abundamientoTipico: { min: 10, max: 15 } },
  { id: 'arena-arcillosa-limosa', abundamientoTipico: { min: 15, max: 25 } },
  { id: 'grava', abundamientoTipico: { min: 10, max: 15 } },
  { id: 'limo', abundamientoTipico: { min: 20, max: 30 } },
  { id: 'tierra-vegetal', abundamientoTipico: { min: 25, max: 45 } },
  { id: 'relleno', abundamientoTipico: { min: 15, max: 30 } },
  { id: 'tepetate-caliche', abundamientoTipico: { min: 30, max: 50 } },
  { id: 'roca-blanda', abundamientoTipico: { min: 30, max: 50 } },
  { id: 'roca-dura', abundamientoTipico: { min: 50, max: 80 } },
] as const satisfies readonly TipoSueloInfo[];

/** Identificador de tipo de suelo. */
export type SoilType = (typeof TIPOS_SUELO)[number]['id'];

export function infoSuelo(id: SoilType | undefined): TipoSueloInfo | undefined {
  return id ? TIPOS_SUELO.find((s) => s.id === id) : undefined;
}

/** Nombre traducido del suelo, o "Unspecified"/"Sin especificar" si no hay (listas y exportaciones). */
export function etiquetaSuelo(id: SoilType | undefined, t: Traductor): string {
  return id ? t(`soil.${id}`) : t('common.unspecified');
}

/**
 * Abundamiento representativo del suelo como fracción (punto medio del rango típico).
 * Ej.: arcilla 30–40 % → 0.35. undefined si no hay suelo.
 */
export function abundamientoSuelo(id: SoilType | undefined): number | undefined {
  const info = infoSuelo(id);
  if (!info) return undefined;
  const { min, max } = info.abundamientoTipico;
  return (min + max) / 2 / 100;
}

/**
 * De dónde sale el factor usado en una zona: 'manual' (capturado en la zona), 'suelo'
 * (tipo de suelo o material de relleno) o 'proyecto' (valor general por defecto).
 */
export type OrigenAbundamiento = 'manual' | 'suelo' | 'proyecto';

/**
 * Abundamiento (fracción) que se aplica a una zona:
 * valor manual de la zona → valor representativo del suelo → abundamiento del proyecto.
 */
export function abundamientoDeZona(
  zona: { soilType?: SoilType; abundamientoManual?: number },
  abundamientoProyecto: number,
): { valor: number; origen: OrigenAbundamiento } {
  if (zona.abundamientoManual !== undefined && Number.isFinite(zona.abundamientoManual)) {
    return { valor: zona.abundamientoManual, origen: 'manual' };
  }
  const deSuelo = abundamientoSuelo(zona.soilType);
  if (deSuelo !== undefined) return { valor: deSuelo, origen: 'suelo' };
  return { valor: abundamientoProyecto, origen: 'proyecto' };
}

/** Pista de abundamiento típico (traducida), p. ej. "Typical swell 30–40%". Vacía si no hay suelo. */
export function pistaAbundamiento(id: SoilType | undefined, t: Traductor): string {
  const info = infoSuelo(id);
  if (!info) return '';
  return t('hint.typicalSwell', info.abundamientoTipico);
}

/** true si el texto es un identificador de suelo válido. */
export function esSoilType(v: string): v is SoilType {
  return TIPOS_SUELO.some((s) => s.id === v);
}

// ---------------------------------------------------------------------------
// Materiales de relleno (zonas de relleno) y su contracción por compactación
// ---------------------------------------------------------------------------
//
// La contracción se usa con fillMaterialNeeded(): material necesario (en banco) =
// volumen compactado / (1 − contracción). Prioridad: valor manual de la zona → valor
// representativo del material → contracción general del proyecto.
//
// Fuente de los rangos: valores aproximados de tablas generales de movimiento de tierras
// (Caterpillar Performance Handbook; Peurifoy, "Construction Planning, Equipment and Methods")
// y práctica común en terracerías (bases y sub-bases según grado de compactación Proctor).
// El valor representativo es el punto medio del rango. Verificar con pruebas de laboratorio
// (peso volumétrico seco suelto vs. compactado) del banco de material real.

export interface MaterialRellenoInfo {
  id: string;
  /** Rango típico de contracción por compactación en porcentaje. */
  contraccionTipica: { min: number; max: number };
  /** Clave i18n de una descripción opcional (ayuda emergente). */
  descripcion?: Clave;
  /** Clave i18n de un aviso opcional junto a la contracción típica (p. ej. valor no verificado). */
  nota?: Clave;
}

export const MATERIALES_RELLENO = [
  { id: 'tepetate', contraccionTipica: { min: 10, max: 20 } },
  { id: 'arena', contraccionTipica: { min: 5, max: 15 } },
  { id: 'grava', contraccionTipica: { min: 5, max: 10 } },
  // Grava 1": grava que pasa malla de 1 pulgada (1" minus). Al incluir fracción fina además de la
  // grava, se reacomoda algo más que la grava limpia: contracción típica 6–12 % (rango de gravas y
  // gravas-arena en las tablas citadas). Se usa 9 %.
  { id: 'grava-1', contraccionTipica: { min: 6, max: 12 }, descripcion: 'fill.grava-1.desc' },
  { id: 'grava-arena', contraccionTipica: { min: 5, max: 15 } },
  { id: 'relleno-selecto', contraccionTipica: { min: 10, max: 20 } },
  { id: 'relleno-comun', contraccionTipica: { min: 15, max: 25 } },
  { id: 'base-hidraulica', contraccionTipica: { min: 10, max: 20 } },
  { id: 'sub-base', contraccionTipica: { min: 10, max: 20 } },
  { id: 'tierra-vegetal', contraccionTipica: { min: 15, max: 30 } },
  // Tierra (solo suelo) / "Soil only": terraplén de tierra común sin agregados. La contracción de
  // tierra común (common earth / loam) al compactarla se cita típicamente en 10–25 % según humedad
  // y energía de compactación (Caterpillar Performance Handbook; Peurifoy). Se usa 17.5 %.
  { id: 'solo-suelo', contraccionTipica: { min: 10, max: 25 } },
  { id: 'material-banco', contraccionTipica: { min: 10, max: 20 } },
  // Mezclas de roca / roca-suelo: casi no contraen. En pedraplenes de roca fragmentada el volumen
  // compactado puede incluso quedar algo MAYOR que el volumen en banco (contracción negativa);
  // en mezclas roca-suelo bien graduadas se reportan contracciones bajas, del orden de 0–10 %
  // (Caterpillar Performance Handbook; Peurifoy). Se usa 5 % (punto medio), del lado conservador:
  // sobrestima ligeramente el material necesario si la roca realmente se abunda.
  { id: 'rock-mix', contraccionTipica: { min: 0, max: 10 } },
  // Road mix / Tricorel: base de agregado triturado para caminos (road base), equivalente a base
  // hidráulica/granular. Contracción típica 10–20 % al compactar al 95–100 % Proctor desde el
  // banco/acopio (tablas de terracerías; Caterpillar Performance Handbook; Peurifoy). Se usa 15 %.
  // "Tricorel" es un nombre comercial/local que no pudimos verificar: el valor es estimado y se
  // marca con una nota ("estimated value, adjust") para que el usuario lo ajuste por zona.
  { id: 'road-mix-tricorel', contraccionTipica: { min: 10, max: 20 }, nota: 'fill.road-mix-tricorel.note' },
  // Road mix 2" minus: agregado triturado más grueso (pasa malla de 2 pulgadas), bien graduado.
  // Al tener partículas mayores y menos finos se reacomoda menos que una base fina: contracción
  // típica 8–14 % (rango bajo de bases/sub-bases granulares en las mismas tablas). Se usa 11 %.
  { id: 'road-mix-2-minus', contraccionTipica: { min: 8, max: 14 }, descripcion: 'fill.road-mix-2-minus.desc' },
] as const satisfies readonly MaterialRellenoInfo[];

/** Identificador de material de relleno. */
export type FillMaterial = (typeof MATERIALES_RELLENO)[number]['id'];

export function infoMaterialRelleno(id: FillMaterial | undefined): MaterialRellenoInfo | undefined {
  return id ? MATERIALES_RELLENO.find((m) => m.id === id) : undefined;
}

/** Nombre traducido del material, o "Unspecified"/"Sin especificar". */
export function etiquetaMaterialRelleno(id: FillMaterial | undefined, t: Traductor): string {
  return id ? t(`fill.${id}`) : t('common.unspecified');
}

/** Descripción traducida del material (si tiene), p. ej. "Passes 2-inch sieve". */
export function descripcionMaterialRelleno(id: FillMaterial | undefined, t: Traductor): string | undefined {
  const clave = infoMaterialRelleno(id)?.descripcion;
  return clave ? t(clave) : undefined;
}

/** Contracción representativa del material como fracción (punto medio del rango). */
export function contraccionMaterial(id: FillMaterial | undefined): number | undefined {
  const info = infoMaterialRelleno(id);
  if (!info) return undefined;
  const { min, max } = info.contraccionTipica;
  return (min + max) / 2 / 100;
}

/**
 * Contracción (fracción) que se aplica a una zona de relleno:
 * valor manual de la zona → valor representativo del material → contracción del proyecto.
 */
export function contraccionDeZona(
  zona: { fillMaterial?: FillMaterial; contraccionManual?: number },
  contraccionProyecto: number,
): { valor: number; origen: OrigenAbundamiento } {
  if (zona.contraccionManual !== undefined && Number.isFinite(zona.contraccionManual)) {
    return { valor: zona.contraccionManual, origen: 'manual' };
  }
  const deMaterial = contraccionMaterial(zona.fillMaterial);
  if (deMaterial !== undefined) return { valor: deMaterial, origen: 'suelo' };
  return { valor: contraccionProyecto, origen: 'proyecto' };
}

/** Pista de contracción típica (traducida), p. ej. "Typical shrink 10–20% (estimated value, adjust)". */
export function pistaContraccion(id: FillMaterial | undefined, t: Traductor): string {
  const info = infoMaterialRelleno(id);
  if (!info) return '';
  const pista = t('hint.typicalShrink', info.contraccionTipica);
  return info.nota ? `${pista} (${t(info.nota)})` : pista;
}

/** true si el texto es un identificador de material de relleno válido. */
export function esFillMaterial(v: string): v is FillMaterial {
  return MATERIALES_RELLENO.some((m) => m.id === v);
}
