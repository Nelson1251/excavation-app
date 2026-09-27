// Modelo de datos de movimiento de tierras por superficies (corte/relleno entre terreno
// existente y rasante proyectada) y del mapa de calor. Pensado desde el inicio para que una IA
// pueda proponer elementos (curvas de nivel, cotas) que el usuario acepta o rechaza.
//
// Convenciones:
// - Coordenadas en unidades PDF de la página (igual que `Point` en src/types/index.ts).
// - Elevaciones y longitudes SIEMPRE en metros internamente; se muestran según Meters | Feet.
// - dz = propuesto − existente: dz > 0 = relleno (fill), dz < 0 = corte (cut).
import type { Point } from './index';
import type { FillMaterial, SoilType } from '../lib/soils';

export type { Point };

/** Qué superficie describe: terreno natural existente o rasante proyectada (diseño). */
export type SurfaceKind = 'existing' | 'proposed';

/** Origen de un elemento: dibujado a mano, sugerido por IA o importado (CSV, LandXML…). */
export type FeatureSource = 'manual' | 'ai-suggested' | 'imported';

/** Estado de revisión. SOLO los elementos 'accepted' entran en los cálculos. */
export type FeatureStatus = 'accepted' | 'pending' | 'rejected';

/** Trazabilidad de cada elemento (quién lo creó, con qué confianza y si fue revisado). */
export interface Provenance {
  source: FeatureSource;
  /** Confianza 0–1 (sugerencias de IA). */
  confidence?: number;
  status: FeatureStatus;
  /** Fecha ISO 8601 de creación. */
  createdAt: string;
  /** Fecha ISO 8601 de la última revisión (aceptar/rechazar). */
  reviewedAt?: string;
  /** Texto de apoyo de la IA, p. ej. la etiqueta leída del plano ("EL 1234.5"). */
  note?: string;
}

interface FeatureBase {
  id: string;
  provenance: Provenance;
}

/** Curva de nivel: polilínea de elevación constante. */
export interface ContourLine extends FeatureBase {
  kind: 'contour';
  /** Vértices en unidades PDF (al menos 2). */
  points: Point[];
  /** Elevación de la curva en metros. */
  elevationM: number;
  /** true si la curva es cerrada (el último vértice se une con el primero). */
  closed?: boolean;
}

/** Cota o punto de elevación (esquina de plataforma, nivel de piso terminado, etc.). */
export interface SpotElevation extends FeatureBase {
  kind: 'spot';
  point: Point;
  /** Elevación en metros. */
  elevationM: number;
  /** Etiqueta opcional ("FF", "TW", "BW", "PAD"). */
  label?: string;
}

/** Vértice 3D de una línea de quiebre. */
export interface Point3 extends Point {
  /** Elevación en metros. */
  elevationM: number;
}

/**
 * Línea de quiebre (bordillo, pie/corona de talud, muro): polilínea con elevación por vértice.
 * En la fase 1 sus vértices (densificados) se usan como puntos de la TIN; no se fuerzan como
 * aristas (TIN restringida = mejora posterior).
 */
export interface Breakline extends FeatureBase {
  kind: 'breakline';
  points: Point3[];
}

export type ElevationFeature = ContourLine | SpotElevation | Breakline;

/** Superficie (existente o propuesta) de una página del PDF. */
export interface Surface {
  id: string;
  kind: SurfaceKind;
  /** Página del PDF (base 0) en la que se trazaron los elementos. */
  pageIndex: number;
  features: ElevationFeature[];
}

/** Límite del sitio: polígono (unidades PDF) dentro del cual se calculan los volúmenes. */
export interface SiteBoundary {
  id: string;
  pageIndex: number;
  /** Vértices del polígono simple, en unidades PDF (al menos 3). */
  points: Point[];
  provenance: Provenance;
}

/** Opciones del cálculo de volúmenes por malla (grid method). */
export interface EarthworkGridOptions {
  /** Metros reales por unidad PDF (escala calibrada del plano). */
  metersPerPdfUnit: number;
  /** Lado de la celda en metros (p. ej. 1 m ≈ 3 ft). */
  cellSizeM: number;
  /**
   * Distancia máxima (m) entre vértices al densificar curvas y líneas de quiebre antes de
   * triangular. Por defecto = cellSizeM.
   */
  densifyM?: number;
  /** Potencia del IDW usado fuera de la TIN o con menos de 3 puntos (por defecto 2). */
  idwPower?: number;
}

/** Totales de la malla, en m³ / m². */
export interface EarthworkTotals {
  /** Corte en banco (existente por encima del propuesto), m³. */
  cutM3: number;
  /** Relleno compactado (existente por debajo del propuesto), m³. */
  fillM3: number;
  /** Neto = corte − relleno (misma convención que src/lib/volumes.ts). > 0 = sobra (export). */
  netM3: number;
  /** Área dentro del límite, m². */
  areaM2: number;
  cutAreaM2: number;
  fillAreaM2: number;
}

/**
 * Resultado de la malla. Las celdas se guardan fila por fila (fila 0 = y mínima del plano);
 * índice = fila × cols + columna. Celdas fuera del límite: area = 0 y valores NaN.
 */
export interface EarthworkGrid {
  /** Esquina (x mínima, y mínima) de la malla, en unidades PDF. */
  origin: Point;
  cols: number;
  rows: number;
  /** Lado de la celda en unidades PDF. */
  cellSizePdf: number;
  /** Lado de la celda en metros. */
  cellSizeM: number;
  /** Área de cada celda recortada por el límite, m². */
  areaM2: Float64Array;
  /** Elevación existente muestreada (m) en el centroide de la parte de celda dentro del límite. */
  existingM: Float64Array;
  /** Elevación propuesta muestreada (m). */
  proposedM: Float64Array;
  /** dz = propuesto − existente (m). */
  dzM: Float64Array;
  totals: EarthworkTotals;
}

/** Datos de material para abundamiento/contracción (reutiliza src/lib/soils.ts). */
export interface EarthworkMaterial {
  /** Suelo del corte (abundamiento representativo del catálogo). */
  soilType?: SoilType;
  /** Abundamiento manual (fracción) — tiene prioridad sobre el suelo. */
  abundamientoManual?: number;
  /** Material del relleno (contracción representativa del catálogo). */
  fillMaterial?: FillMaterial;
  /** Contracción manual (fracción) — tiene prioridad sobre el material. */
  contraccionManual?: number;
}

/** Opciones del mapa de calor. Todos los rangos en metros de dz. */
export interface HeatmapOptions {
  /** |dz| ≤ tolerancia → verde ("a rasante"). */
  toleranceM: number;
  /** dz de corte (valor positivo) con el que se alcanza el rojo más intenso. */
  maxCutM: number;
  /** dz de relleno con el que se alcanza el azul más intenso. */
  maxFillM: number;
  /** Opacidad 0–1 del mapa. */
  opacity: number;
}

/** Ajustes de la herramienta de superficies (lo que guardará la UI). */
export interface EarthworkSettings {
  cellSizeM: number;
  /** Intervalo entre curvas (m) para auto-incrementar la elevación al trazar curvas seguidas. */
  contourIntervalM: number;
  heatmap: HeatmapOptions;
  /** Mostrar el mapa de calor sobre el plano. */
  showHeatmap: boolean;
  material: EarthworkMaterial;
  /** Descapote (espesor de tierra vegetal a retirar, m). Reservado: aún no se usa en el cálculo. */
  topsoilStripM?: number;
}
