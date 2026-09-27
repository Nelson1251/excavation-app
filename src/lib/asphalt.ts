// Cálculo de asfalto por elemento (funciones puras). Dimensiones en metros; volúmenes en m³;
// masa en toneladas métricas (la conversión a toneladas cortas de EE. UU. está en units.ts).

export type TipoAsfalto = 'calle' | 'estacionamiento' | 'banqueta' | 'acceso' | 'bacheo';

export const TIPOS_ASFALTO: readonly TipoAsfalto[] = ['calle', 'estacionamiento', 'banqueta', 'acceso', 'bacheo'];

/** Desperdicio predeterminado para asfalto (5 %). */
export const DESPERDICIO_ASFALTO_POR_DEFECTO = 0.05;

/**
 * Densidad compactada predeterminada de mezcla asfáltica en caliente (hot-mix): 2.35 t/m³
 * (≈ 146.7 lb/ft³; rango usual 2.2–2.45 t/m³ ≈ 137–153 lb/ft³ según agregado y compactación).
 * Editable en la interfaz; se usa para convertir el volumen a pedir en tonelaje.
 */
export const DENSIDAD_ASFALTO_POR_DEFECTO = 2.35;

export interface AsphaltElement {
  id: string;
  tipo: TipoAsfalto;
  nombre: string;
  /** Número de áreas iguales (entero ≥ 1). */
  cantidad: number;
  /** Dimensiones en metros. */
  largo: number;
  ancho: number;
  espesor: number;
  /** Desperdicio como fracción (0.05 = 5 %). */
  desperdicio: number;
  notas: string;
}

type Medidas = Pick<AsphaltElement, 'largo' | 'ancho' | 'espesor' | 'cantidad' | 'desperdicio'>;

/** Área total del elemento (m²) = largo × ancho × cantidad. */
export const areaAsfalto = (e: Pick<AsphaltElement, 'largo' | 'ancho' | 'cantidad'>): number =>
  Math.max(0, e.largo) * Math.max(0, e.ancho) * Math.max(0, e.cantidad);

/** Toneladas métricas = volumen (m³) × densidad (t/m³). */
export const toneladasAsfalto = (volumenM3: number, densidadTM3: number): number => volumenM3 * Math.max(0, densidadTM3);

/** Área, volumen neto, volumen a pedir (con desperdicio) y tonelaje del pedido. */
export function calculoAsfalto(
  e: Medidas,
  densidadTM3: number,
): { area: number; neto: number; pedido: number; toneladas: number } {
  const area = areaAsfalto(e);
  const neto = area * Math.max(0, e.espesor);
  const pedido = neto * (1 + Math.max(0, e.desperdicio));
  return { area, neto, pedido, toneladas: toneladasAsfalto(pedido, densidadTM3) };
}

/** Totales de una lista de elementos. */
export function totalesAsfalto(
  elementos: Medidas[],
  densidadTM3: number,
): { area: number; neto: number; pedido: number; toneladas: number } {
  return elementos.reduce(
    (acc, e) => {
      const c = calculoAsfalto(e, densidadTM3);
      return {
        area: acc.area + c.area,
        neto: acc.neto + c.neto,
        pedido: acc.pedido + c.pedido,
        toneladas: acc.toneladas + c.toneladas,
      };
    },
    { area: 0, neto: 0, pedido: 0, toneladas: 0 },
  );
}

/** Dimensiones iniciales razonables por tipo (m). */
export function dimensionesAsfaltoPorDefecto(tipo: TipoAsfalto): Pick<AsphaltElement, 'largo' | 'ancho' | 'espesor'> {
  switch (tipo) {
    case 'calle':
      return { largo: 100, ancho: 7, espesor: 0.05 };
    case 'estacionamiento':
      return { largo: 30, ancho: 20, espesor: 0.05 };
    case 'banqueta':
      return { largo: 20, ancho: 1.5, espesor: 0.03 };
    case 'acceso':
      return { largo: 10, ancho: 4, espesor: 0.05 };
    case 'bacheo':
      return { largo: 1, ancho: 1, espesor: 0.05 };
  }
}
