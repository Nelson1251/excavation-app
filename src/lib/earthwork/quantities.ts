// Del resultado geométrico de la malla (corte en banco, relleno compactado) a cantidades de obra:
// abundamiento/contracción con el mismo catálogo de suelos y materiales que las zonas
// (src/lib/soils.ts), viajes de camión y conversión a las unidades de pantalla (m³ | yd³).
import type { EarthworkMaterial, EarthworkTotals } from '../../types/earthwork';
import type { Factors } from '../../types';
import { fillMaterialNeeded, looseVolume, truckTrips } from '../factors';
import { abundamientoDeZona, contraccionDeZona, type OrigenAbundamiento } from '../soils';
import { formatearLongitud, formatearNumero, formatearVolumen, m3AYardas3, metrosAPies, type SistemaUnidades } from '../units';

export interface EarthworkQuantities {
  /** Abundamiento aplicado (fracción) y de dónde sale. */
  swell: { valor: number; origen: OrigenAbundamiento };
  /** Contracción aplicada (fracción) y de dónde sale. */
  shrink: { valor: number; origen: OrigenAbundamiento };
  /** Corte en banco (m³). */
  cutBankM3: number;
  /** Corte suelto = banco × (1 + abundamiento) (m³). */
  cutLooseM3: number;
  /** Relleno compactado (m³). */
  fillCompactedM3: number;
  /** Material en banco necesario para el relleno = compactado / (1 − contracción) (m³). */
  fillBankNeededM3: number;
  /** Balance en banco = corte − material necesario. > 0 = sobra (exportar); < 0 = falta (importar). */
  netBankM3: number;
  /** Volumen suelto a exportar (m³, 0 si hay que importar). */
  exportLooseM3: number;
  /** Material en banco a importar (m³, 0 si sobra). */
  importBankM3: number;
  /** Viajes de camión para exportar el sobrante (suelto / capacidad). */
  exportTrips: number;
}

/**
 * Aplica abundamiento y contracción al resultado de la malla. Prioridad (igual que las zonas):
 * valor manual → valor representativo del suelo/material → factor general del proyecto.
 */
export function earthworkQuantities(
  totals: Pick<EarthworkTotals, 'cutM3' | 'fillM3'>,
  material: EarthworkMaterial,
  proyecto: Factors,
): EarthworkQuantities {
  const swell = abundamientoDeZona(material, proyecto.abundamiento);
  const shrink = contraccionDeZona(material, proyecto.contraccion);
  const cutBankM3 = totals.cutM3;
  const cutLooseM3 = looseVolume(cutBankM3, swell.valor);
  const fillCompactedM3 = totals.fillM3;
  const fillBankNeededM3 = fillMaterialNeeded(fillCompactedM3, shrink.valor);
  const netBankM3 = cutBankM3 - fillBankNeededM3;
  const exportLooseM3 = netBankM3 > 0 ? looseVolume(netBankM3, swell.valor) : 0;
  return {
    swell,
    shrink,
    cutBankM3,
    cutLooseM3,
    fillCompactedM3,
    fillBankNeededM3,
    netBankM3,
    exportLooseM3,
    importBankM3: netBankM3 < 0 ? -netBankM3 : 0,
    exportTrips: truckTrips(exportLooseM3, proyecto.capacidadCamion),
  };
}

/** Totales en las unidades de pantalla: m³ (Meters) o yd³ (Feet). */
export function totalsInUnits(
  totals: Pick<EarthworkTotals, 'cutM3' | 'fillM3' | 'netM3'>,
  sistema: SistemaUnidades,
): { cut: number; fill: number; net: number; unit: 'm³' | 'yd³' } {
  const f = sistema === 'imperial' ? m3AYardas3 : (v: number) => v;
  return { cut: f(totals.cutM3), fill: f(totals.fillM3), net: f(totals.netM3), unit: sistema === 'imperial' ? 'yd³' : 'm³' };
}

/** Volumen de corte/relleno formateado ("261.59 yd³" / "200.00 m³"). */
export const formatEarthworkVolume = (m3: number, sistema: SistemaUnidades): string => formatearVolumen(m3, sistema);

/**
 * Elevación formateada. En Feet se usan pies decimales, como en los planos de nivelación de EE. UU.
 * ("1,234.50 ft", sin metros); en Meters "376.28 m".
 */
export function formatElevation(m: number, sistema: SistemaUnidades, decimales = 2): string {
  if (!Number.isFinite(m)) return '—';
  return sistema === 'imperial' ? `${formatearNumero(metrosAPies(m), decimales)} ft` : `${formatearNumero(m, decimales)} m`;
}

/**
 * Profundidad de corte/relleno (dz) formateada con signo: Feet = pies-pulgadas con fracción
 * (`+1' 6 1/2"`), Meters = "+0.47 m".
 */
export function formatCutFillDepth(dzM: number, sistema: SistemaUnidades): string {
  if (!Number.isFinite(dzM)) return '—';
  const texto = formatearLongitud(Math.abs(dzM), sistema);
  return dzM > 0 ? `+${texto}` : dzM < 0 ? `-${texto}` : texto;
}
