// Tipos compartidos de la aplicación de cubicación de excavación (corte y relleno).

/** Punto en coordenadas del plano, expresado en unidades PDF (1 unidad = 1/72 pulgada en papel). */
export interface Point {
  x: number;
  y: number;
}

/** Tipo de movimiento de tierra de una zona. */
export type TipoZona = 'corte' | 'relleno';

/** Zona (polígono) dibujada sobre el plano. */
export interface Zone {
  id: string;
  nombre: string;
  tipo: TipoZona;
  /** Vértices del polígono en unidades PDF. */
  puntos: Point[];
  /** Profundidad (corte) o espesor (relleno) promedio, en metros. */
  profundidad: number;
}

/** Factores de conversión de volúmenes. */
export interface Factors {
  /** Abundamiento (esponjamiento) como fracción: 0.25 = 25 %. */
  abundamiento: number;
  /** Contracción por compactación como fracción: 0.10 = 10 %. */
  contraccion: number;
  /** Capacidad del camión en m³ sueltos. */
  capacidadCamion: number;
}

/** Origen del PDF mostrado en el lienzo. */
export interface PdfSource {
  /** 'url' = archivo servido (p. ej. /sample-plan.pdf); 'archivo' = cargado por el usuario (object URL). */
  tipo: 'url' | 'archivo';
  url: string;
  nombre: string;
}

/** Herramienta activa en el lienzo. */
export type Herramienta = 'navegar' | 'calibrar' | 'dibujar';

/** Estado de la vista del lienzo (zoom y desplazamiento). */
export interface Vista {
  zoom: number;
  x: number;
  y: number;
}

/** Estado de datos del proyecto (sin acciones). */
export interface ProjectState {
  pdfSource: PdfSource | null;
  /** Índice de página basado en 0. */
  pageIndex: number;
  numPaginas: number;
  /** Metros reales por unidad PDF. null = escala sin calibrar. */
  metersPerPdfUnit: number | null;
  zones: Zone[];
  factors: Factors;
  herramienta: Herramienta;
  vista: Vista;
  /** Tamaño en píxeles del contenedor del lienzo (lo actualiza Canvas). */
  tamanoLienzo: { ancho: number; alto: number };
}
