// Tipos compartidos de la aplicación de cubicación de excavación (corte y relleno).
import type { SistemaUnidades } from '../lib/units';
import type { FillMaterial, SoilType } from '../lib/soils';
import type { Clave, Idioma } from '../i18n';
import type { ConcreteElement } from '../lib/concrete';
import type { AsphaltElement } from '../lib/asphalt';

export type { AsphaltElement, ConcreteElement, FillMaterial, Idioma, SistemaUnidades, SoilType };

/** Módulo visible: movimiento de tierras sobre el plano, concreto o asfalto. */
export type Modulo = 'excavacion' | 'concreto' | 'asfalto';

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
  /** Nombre escrito por el usuario. Vacío = se muestra un nombre por defecto traducido ("Zone 3" / "Zona 3"). */
  nombre: string;
  /** Clave i18n del nombre (zonas de ejemplo); se traduce al mostrar y sigue el selector EN | ES. */
  nombreClave?: Clave;
  tipo: TipoZona;
  /** Vértices del polígono en unidades PDF. */
  puntos: Point[];
  /** Profundidad (corte) o espesor (relleno) promedio, en metros. */
  profundidad: number;
  /** Tipo de suelo (opcional; sin valor = "Sin especificar"). Ver src/lib/soils.ts. */
  soilType?: SoilType;
  /**
   * Abundamiento manual de la zona como fracción (0.25 = 25 %). Si no hay valor se usa el
   * representativo del tipo de suelo y, si tampoco hay suelo, el abundamiento del proyecto.
   */
  abundamientoManual?: number;
  /** Material de relleno (solo zonas de relleno; sin valor = "Sin especificar"). Ver src/lib/soils.ts. */
  fillMaterial?: FillMaterial;
  /**
   * Contracción manual de la zona como fracción (0.20 = 20 %). Si no hay valor se usa la
   * representativa del material de relleno y, si tampoco hay material, la del proyecto.
   */
  contraccionManual?: number;
}

/** Factores de conversión de volúmenes. */
export interface Factors {
  /** Abundamiento (esponjamiento) general como fracción: 0.25 = 25 %. Se usa en zonas sin tipo de suelo ni valor manual. */
  abundamiento: number;
  /** Contracción por compactación general como fracción: 0.10 = 10 %. Se usa en rellenos sin material ni valor manual. */
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
  /** Sistema de unidades para mostrar y capturar distancias. Internamente todo se guarda en metros. */
  sistemaUnidades: SistemaUnidades;
  /** Idioma de la interfaz ('en' por defecto). Se guarda en localStorage como el sistema de unidades. */
  language: Idioma;
  /** Módulo visible en la interfaz. */
  modulo: Modulo;
  /** Elementos del módulo de concreto (dimensiones en metros). */
  concreteElements: ConcreteElement[];
  /** Elementos del módulo de asfalto (dimensiones en metros). */
  asphaltElements: AsphaltElement[];
  /** Densidad compactada del asfalto en t/m³ (por defecto 2.35, mezcla en caliente). */
  densidadAsfalto: number;
}
