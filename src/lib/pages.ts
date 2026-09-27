// Utilidades de páginas (hojas) de un PDF de varias páginas. Índices basados en 0.
import type { EscalaPagina, Zone } from '../types';

/**
 * Limita un índice de página a [0, numPaginas − 1]. Mientras aún no se conoce el número de
 * páginas (numPaginas = 0) solo se impide que sea negativo.
 */
export function limitarPagina(indice: number, numPaginas: number): number {
  const i = Math.max(0, Math.floor(Number.isFinite(indice) ? indice : 0));
  return numPaginas > 0 ? Math.min(i, numPaginas - 1) : i;
}

/** Escala (metros por unidad PDF) de una página, o null si esa página no está calibrada. */
export function escalaDePagina(escalas: Record<number, EscalaPagina>, pagina: number): number | null {
  return escalas[pagina]?.metersPerPdfUnit ?? null;
}

/** Zonas de una página. */
export function zonasDePagina(zones: Zone[], pagina: number): Zone[] {
  return zones.filter((z) => (z.pageIndex ?? 0) === pagina);
}

/** Páginas que tienen zonas, en orden ascendente (para agrupar la lista por hoja). */
export function paginasConZonas(zones: Zone[]): number[] {
  return [...new Set(zones.map((z) => z.pageIndex ?? 0))].sort((a, b) => a - b);
}
