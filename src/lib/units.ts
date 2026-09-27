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

/** Paso de redondeo al mostrar pulgadas: 1/4 de pulgada. */
export const PASO_PULGADAS = 0.25;

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

const FRACCIONES: Record<number, string> = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4' };

/**
 * Formato pies-pulgadas redondeado a 1/4": 3' 6", 3' 6 1/4", 0' 8", -0' 8", 12' 0".
 */
export function formatearPiesPulgadas(m: number): string {
  if (!Number.isFinite(m)) return '—';
  const { negativo, pies, pulgadas } = metrosAPiesPulgadas(m);
  const enteras = Math.floor(pulgadas);
  const fraccion = FRACCIONES[pulgadas - enteras];
  const textoPulgadas = fraccion ? `${enteras} ${fraccion}` : `${enteras}`;
  return `${negativo ? '-' : ''}${pies}' ${textoPulgadas}"`;
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
