// Sistema de unidades: conversión y formato de longitudes, áreas y volúmenes.
// Los valores internos SIEMPRE se guardan en metros (m, m², m³); estas funciones
// puras solo convierten para mostrar o para leer lo que escribe el usuario.

/** 'metrico' = metros (m, m², m³); 'imperial' = pies y pulgadas (ft-in, ft², yd³). */
export type SistemaUnidades = 'metrico' | 'imperial';

export const SISTEMA_POR_DEFECTO: SistemaUnidades = 'metrico';

/** 1 pie = 0.3048 m (exacto, definición internacional). */
export const METROS_POR_PIE = 0.3048;
/** 1 pulgada = 0.0254 m (exacto). */
export const METROS_POR_PULGADA = 0.0254;
export const PULGADAS_POR_PIE = 12;
/** 1 ft² = 0.09290304 m². */
export const M2_POR_PIE2 = METROS_POR_PIE * METROS_POR_PIE;
/** 1 yd³ = 0.9144³ m³ = 0.764554857984 m³ (yarda cúbica, estándar de excavación en EE. UU.). */
export const M3_POR_YARDA3 = 0.9144 * 0.9144 * 0.9144;

/** 1 tonelada corta (EE. UU., 2000 lb) = 0.90718474 t métricas (exacto). */
export const T_POR_TONELADA_CORTA = 0.90718474;
/** 1 t/m³ = 62.42796 lb/ft³. */
export const LB_FT3_POR_T_M3 = 62.42796;

/** Paso de redondeo al MOSTRAR pulgadas: 1/8 de pulgada (fracción reducida: 7 3/8", 6 1/2"). */
export const PASO_PULGADAS = 1 / 8;
/** Denominador al CARGAR un valor guardado en el campo de pulgadas: 1/16 ("7 3/8", "11 15/16"). */
export const DENOMINADOR_CAMPO = 16;
/** Denominadores aceptados al capturar fracciones de pulgada. */
export const DENOMINADORES_VALIDOS: readonly number[] = [2, 4, 8, 16];

// ---------------------------------------------------------------------------
// Conversiones básicas
// ---------------------------------------------------------------------------

export const metrosAPies = (m: number): number => m / METROS_POR_PIE;
export const piesAMetros = (ft: number): number => ft * METROS_POR_PIE;
export const pulgadasAMetros = (inch: number): number => inch * METROS_POR_PULGADA;

/** Pies + pulgadas → metros. Ej.: 3 ft 6 in = 1.0668 m. */
export function piesPulgadasAMetros(pies: number, pulgadas: number): number {
  return pies * METROS_POR_PIE + pulgadas * METROS_POR_PULGADA;
}

export const toneladasACortas = (t: number): number => t / T_POR_TONELADA_CORTA;
export const tM3ALbFt3 = (d: number): number => d * LB_FT3_POR_T_M3;
export const lbFt3ATM3 = (d: number): number => d / LB_FT3_POR_T_M3;

export const m2APies2 = (m2: number): number => m2 / M2_POR_PIE2;
export const m3AYardas3 = (m3: number): number => m3 / M3_POR_YARDA3;
export const yardas3AM3 = (yd3: number): number => yd3 * M3_POR_YARDA3;

/**
 * Normaliza pies + pulgadas pasando cada 12 pulgadas a pies.
 * Ej.: 3 ft 18 in → 4 ft 6 in. Conserva la parte decimal de las pulgadas.
 * Pensado para valores no negativos (entradas de distancia).
 */
export function normalizarPiesPulgadas(pies: number, pulgadas: number): { pies: number; pulgadas: number } {
  const totalPulgadas = pies * PULGADAS_POR_PIE + pulgadas;
  const signo = totalPulgadas < 0 ? -1 : 1;
  const abs = Math.abs(totalPulgadas);
  let p = Math.floor(abs / PULGADAS_POR_PIE);
  // Redondear a centésimas de pulgada para evitar residuos de coma flotante (p. ej. 5.999999).
  let pulg = Math.round((abs - p * PULGADAS_POR_PIE) * 100) / 100;
  if (pulg >= PULGADAS_POR_PIE) {
    p += 1;
    pulg -= PULGADAS_POR_PIE;
  }
  return { pies: signo * p, pulgadas: signo * pulg };
}

/**
 * Metros → pies y pulgadas (magnitud), con las pulgadas redondeadas al múltiplo de `paso` más cercano
 * y el acarreo a pies cuando el redondeo llega a 12".
 */
export function metrosAPiesPulgadas(
  m: number,
  paso = PASO_PULGADAS,
): { negativo: boolean; pies: number; pulgadas: number } {
  const totalPulgadas = Math.abs(m) / METROS_POR_PULGADA;
  // Redondeo previo a 1e-9 para que 42.0000000001 no se convierta en 42.25 por error numérico.
  const redondeadas = Math.round(Math.round(totalPulgadas * 1e9) / 1e9 / paso) * paso;
  const pies = Math.floor(redondeadas / PULGADAS_POR_PIE);
  const pulgadas = redondeadas - pies * PULGADAS_POR_PIE;
  return { negativo: m < 0 && redondeadas > 0, pies, pulgadas };
}

// ---------------------------------------------------------------------------
// Formato para mostrar
// ---------------------------------------------------------------------------

const mcd = (a: number, b: number): number => (b === 0 ? a : mcd(b, a % b));

/**
 * Pulgadas (≥ 0) como texto con fracción reducida al denominador dado:
 * 7.375 → "7 3/8", 0.5 → "1/2" (o "0 1/2" con `ceroEntero`), 7 → "7", 0 → "0".
 * Redondea al 1/denominador más cercano (puede dar "12" si se redondea hacia arriba).
 */
export function pulgadasATextoFraccion(pulgadas: number, denominador = DENOMINADOR_CAMPO, ceroEntero = false): string {
  const unidades = Math.round(Math.round(Math.abs(pulgadas) * denominador * 1e6) / 1e6);
  const enteras = Math.floor(unidades / denominador);
  const resto = unidades - enteras * denominador;
  if (resto === 0) return `${enteras}`;
  const d = mcd(resto, denominador);
  const fraccion = `${resto / d}/${denominador / d}`;
  return enteras === 0 && !ceroEntero ? fraccion : `${enteras} ${fraccion}`;
}

/**
 * Formato pies-pulgadas redondeado a 1/8" con fracción reducida:
 * 3' 6", 3' 6 1/2", 65' 7 3/8", 0' 8", 0' 0 3/8", -0' 8".
 */
export function formatearPiesPulgadas(m: number): string {
  if (!Number.isFinite(m)) return '—';
  const { negativo, pies, pulgadas } = metrosAPiesPulgadas(m);
  return `${negativo ? '-' : ''}${pies}' ${pulgadasATextoFraccion(pulgadas, 1 / PASO_PULGADAS, true)}"`;
}

/**
 * Valores iniciales de los campos "ft" e "in" para un valor guardado en metros: pies enteros y
 * pulgadas como fracción reducida a 1/16 (nunca un decimal largo). 20 m → { pies: '65', pulgadas: '7 3/8' }.
 */
export function metrosACamposPiesPulgadas(m: number): { pies: string; pulgadas: string } {
  const unidades = Math.round(Math.round((Math.abs(m) / METROS_POR_PULGADA) * DENOMINADOR_CAMPO * 1e6) / 1e6);
  const porPie = PULGADAS_POR_PIE * DENOMINADOR_CAMPO;
  const pies = Math.floor(unidades / porPie);
  return { pies: String(pies), pulgadas: pulgadasATextoFraccion((unidades - pies * porPie) / DENOMINADOR_CAMPO) };
}

/**
 * Texto para el campo de pulgadas tras normalizar: fracción si el valor es exacto en 1/16;
 * si no, decimal con hasta 2 cifras (para no alterar lo que escribió el usuario).
 */
export function textoCampoPulgadas(pulgadas: number): string {
  const unidades = pulgadas * DENOMINADOR_CAMPO;
  return Math.abs(unidades - Math.round(unidades)) < 1e-9
    ? pulgadasATextoFraccion(pulgadas)
    : String(Math.round(pulgadas * 100) / 100);
}

/** Claves i18n de error al leer pulgadas con fracción. */
export type ErrorPulgadas = 'distance.err.inchesInvalid' | 'distance.err.denominator' | 'distance.err.mixedFraction';

/**
 * Lee pulgadas escritas como en obra: "7", "1/2", "3/4", "5/8", "1/16", "7 1/2", "7-1/2",
 * "11 15/16" y, por tolerancia, decimales "7.5" / "7,5". Denominadores válidos: 2, 4, 8, 16.
 * Una fracción sola impropia ("5/4" = 1.25) es válida; en un número mixto la fracción debe ser < 1.
 * No valida el rango (< 12): lo que pase de 12 se pasa a pies al normalizar.
 */
export function leerPulgadasFraccion(texto: string): { valor: number } | { error: ErrorPulgadas } {
  const t = texto.trim().replace(/\s+/g, ' ').replace(',', '.');
  let m: RegExpMatchArray | null;
  if (/^\d+$/.test(t)) return { valor: Number(t) };
  if (/^(\d+\.\d*|\.\d+)$/.test(t)) return { valor: Number(t) };
  const denominadorOk = (d: number) => DENOMINADORES_VALIDOS.includes(d);
  if ((m = t.match(/^(\d+) ?\/ ?(\d+)$/))) {
    const [num, den] = [Number(m[1]), Number(m[2])];
    if (!denominadorOk(den)) return { error: 'distance.err.denominator' };
    return { valor: num / den };
  }
  if ((m = t.match(/^(\d+)(?: | ?- ?)(\d+) ?\/ ?(\d+)$/))) {
    const [ent, num, den] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!denominadorOk(den)) return { error: 'distance.err.denominator' };
    if (num >= den) return { error: 'distance.err.mixedFraction' };
    return { valor: ent + num / den };
  }
  return { error: 'distance.err.inchesInvalid' };
}

/** Número con separadores en inglés (en-US) y decimales fijos. */
export function formatearNumero(n: number, decimales = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** Longitud (guardada en m) formateada según el sistema: "1.07 m" o "3' 6"". */
export function formatearLongitud(m: number, sistema: SistemaUnidades, decimales = 2): string {
  return sistema === 'imperial' ? formatearPiesPulgadas(m) : `${formatearNumero(m, decimales)} m`;
}

/** Área (guardada en m²) formateada: "12.50 m²" o "134.55 ft²". */
export function formatearArea(m2: number, sistema: SistemaUnidades, decimales = 2): string {
  return sistema === 'imperial'
    ? `${formatearNumero(m2APies2(m2), decimales)} ft²`
    : `${formatearNumero(m2, decimales)} m²`;
}

/** Volumen (guardado en m³) formateado: "10.00 m³" o "13.08 yd³". */
export function formatearVolumen(m3: number, sistema: SistemaUnidades, decimales = 2): string {
  return sistema === 'imperial'
    ? `${formatearNumero(m3AYardas3(m3), decimales)} yd³`
    : `${formatearNumero(m3, decimales)} m³`;
}

// ---------------------------------------------------------------------------
// Lectura de campos numéricos
// ---------------------------------------------------------------------------

/**
 * Convierte el texto de un campo numérico a número. Acepta coma o punto decimal.
 * Devuelve null si está vacío o no es un número válido.
 */
export function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Validación de distancias capturadas (usada por DistanceInput)
// ---------------------------------------------------------------------------

/** Claves i18n de error de captura de distancia (subconjunto de las claves de src/i18n). */
export type ErrorDistancia =
  | ErrorPulgadas
  | 'distance.err.negative'
  | 'distance.err.zero'
  | 'distance.err.empty'
  | 'distance.err.feetInteger';

/** Validación común del valor ya convertido a metros. */
export function validarDistanciaMetros(m: number, permitirCero: boolean): ErrorDistancia | null {
  if (m < 0) return 'distance.err.negative';
  if (m === 0 && !permitirCero) return 'distance.err.zero';
  return null;
}

/** Lee el campo de pies: entero ≥ 0 (vacío = 0). */
export function leerPiesEnteros(texto: string): { valor: number } | { error: 'distance.err.feetInteger' } {
  const t = texto.trim();
  if (t === '') return { valor: 0 };
  return /^\d+$/.test(t) ? { valor: Number(t) } : { error: 'distance.err.feetInteger' };
}

/**
 * Evalúa los textos de los campos "ft" (entero) e "in" (fracción) y devuelve los metros
 * (usa SIEMPRE pies y pulgadas) o la clave del error. Campo vacío = 0; ambos vacíos es error.
 * Ej.: ('65', '7 3/8') → 19.99901 m; ('3', '6') → 1.0668 m; ('', '42') → 1.0668 m.
 */
export function evaluarPiesPulgadas(
  textoPies: string,
  textoPulgadas: string,
  permitirCero = true,
): { metros: number; pies: number; pulgadas: number } | { error: ErrorDistancia } {
  if (textoPies.trim() === '' && textoPulgadas.trim() === '') return { error: 'distance.err.empty' };
  const p = leerPiesEnteros(textoPies);
  if ('error' in p) return p;
  const i = textoPulgadas.trim() === '' ? { valor: 0 } : leerPulgadasFraccion(textoPulgadas);
  if ('error' in i) return i;
  const metros = piesPulgadasAMetros(p.valor, i.valor);
  const err = validarDistanciaMetros(metros, permitirCero);
  return err ? { error: err } : { metros, pies: p.valor, pulgadas: i.valor };
}
