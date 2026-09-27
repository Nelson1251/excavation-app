// Cálculo de volúmenes de concreto por elemento (funciones puras). Todo en metros / m³.
// El concreto no tiene conversión banco/suelto: el volumen con desperdicio es la cantidad a pedir.

export type TipoConcreto = 'banqueta' | 'columna' | 'losa' | 'zapata' | 'viga' | 'muro';
export type FormaColumna = 'rectangular' | 'redonda';

export const TIPOS_CONCRETO: readonly TipoConcreto[] = ['banqueta', 'columna', 'losa', 'zapata', 'viga', 'muro'];

/** Desperdicio predeterminado para concreto (5 %). */
export const DESPERDICIO_CONCRETO_POR_DEFECTO = 0.05;

export interface ConcreteElement {
  id: string;
  tipo: TipoConcreto;
  nombre: string;
  /** Número de piezas iguales (entero ≥ 1). */
  cantidad: number;
  /** Solo columnas. */
  forma: FormaColumna;
  /** Dimensiones en metros. largo × ancho × alto (alto = espesor, peralte o altura según el tipo). */
  largo: number;
  ancho: number;
  alto: number;
  /** Diámetro (m), solo columnas redondas. */
  diametro: number;
  /** Desperdicio como fracción (0.05 = 5 %). */
  desperdicio: number;
  /** Notas libres: armado, f'c, especificaciones. */
  notas: string;
}

/** ¿El elemento es una columna redonda (usa diámetro + altura)? */
export const esRedonda = (e: Pick<ConcreteElement, 'tipo' | 'forma'>) => e.tipo === 'columna' && e.forma === 'redonda';

/** Volumen de un prisma rectangular (m³). */
export const volumenPrisma = (largo: number, ancho: number, alto: number): number =>
  Math.max(0, largo) * Math.max(0, ancho) * Math.max(0, alto);

/** Volumen de un cilindro a partir del diámetro y la altura (m³). */
export const volumenCilindro = (diametro: number, alto: number): number =>
  Math.PI * (Math.max(0, diametro) / 2) ** 2 * Math.max(0, alto);

/** Volumen con desperdicio: neto × (1 + desperdicio). */
export const conDesperdicio = (netoM3: number, desperdicio: number): number => netoM3 * (1 + Math.max(0, desperdicio));

/** Volumen de UNA pieza (m³). */
export function volumenUnitarioConcreto(
  e: Pick<ConcreteElement, 'tipo' | 'forma' | 'largo' | 'ancho' | 'alto' | 'diametro'>,
): number {
  return esRedonda(e) ? volumenCilindro(e.diametro, e.alto) : volumenPrisma(e.largo, e.ancho, e.alto);
}

/** Volúmenes del elemento: neto (todas las piezas) y a pedir (con desperdicio), en m³. */
export function volumenesConcreto(
  e: Pick<ConcreteElement, 'tipo' | 'forma' | 'largo' | 'ancho' | 'alto' | 'diametro' | 'cantidad' | 'desperdicio'>,
): { neto: number; pedido: number } {
  const neto = volumenUnitarioConcreto(e) * Math.max(0, e.cantidad);
  return { neto, pedido: conDesperdicio(neto, e.desperdicio) };
}

/** Totales de una lista de elementos (m³). */
export function totalesConcreto(elementos: Parameters<typeof volumenesConcreto>[0][]): { neto: number; pedido: number } {
  return elementos.reduce(
    (acc, e) => {
      const v = volumenesConcreto(e);
      return { neto: acc.neto + v.neto, pedido: acc.pedido + v.pedido };
    },
    { neto: 0, pedido: 0 },
  );
}

/** Dimensiones iniciales razonables por tipo (m) al agregar un elemento. */
export function dimensionesPorDefecto(
  tipo: TipoConcreto,
): Pick<ConcreteElement, 'largo' | 'ancho' | 'alto' | 'diametro' | 'forma'> {
  const base = { diametro: 0.3, forma: 'rectangular' as FormaColumna };
  switch (tipo) {
    case 'banqueta':
      return { ...base, largo: 10, ancho: 1.2, alto: 0.1 };
    case 'columna':
      return { ...base, largo: 0.3, ancho: 0.3, alto: 3 };
    case 'losa':
      return { ...base, largo: 5, ancho: 5, alto: 0.1 };
    case 'zapata':
      return { ...base, largo: 1, ancho: 1, alto: 0.3 };
    case 'viga':
      return { ...base, largo: 5, ancho: 0.25, alto: 0.4 };
    case 'muro':
      return { ...base, largo: 5, ancho: 0.15, alto: 2.4 };
  }
}
