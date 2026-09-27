// Estado global del proyecto con Zustand.
import { create } from 'zustand';
import { metersPerPdfUnitFromRatio } from '../lib/geometry';
import { SISTEMA_POR_DEFECTO } from '../lib/units';
import { IDIOMA_POR_DEFECTO, esIdioma } from '../i18n';
import { DENSIDAD_ASFALTO_POR_DEFECTO } from '../lib/asphalt';
import type {
  AsphaltElement,
  ConcreteElement,
  Factors,
  Herramienta,
  Idioma,
  Modulo,
  PdfSource,
  ProjectState,
  SistemaUnidades,
  Vista,
  Zone,
} from '../types';

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 20;

const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

interface ProjectActions {
  setPdfSource: (source: PdfSource) => void;
  setPageIndex: (index: number) => void;
  setNumPaginas: (n: number) => void;
  setScale: (metersPerPdfUnit: number | null) => void;
  /** Agrega una zona. Con `nombre: ''` se muestra un nombre por defecto en el idioma actual ("Zone n" / "Zona n"). */
  addZone: (zone: Omit<Zone, 'id'>) => void;
  /** Actualiza propiedades de una zona (p. ej. profundidad o soilType; soilType: undefined = sin especificar). */
  updateZone: (id: string, cambios: Partial<Omit<Zone, 'id'>>) => void;
  removeZone: (id: string) => void;
  setFactors: (factors: Partial<Factors>) => void;
  setHerramienta: (h: Herramienta) => void;
  setVista: (vista: Partial<Vista>) => void;
  /** Zoom relativo alrededor del centro del lienzo. */
  zoomPor: (factor: number) => void;
  setTamanoLienzo: (ancho: number, alto: number) => void;
  /** Cambia el sistema de unidades y lo guarda en localStorage. */
  setSistemaUnidades: (sistema: SistemaUnidades) => void;
  /** Cambia el idioma de la interfaz y lo guarda en localStorage. */
  setLanguage: (idioma: Idioma) => void;
  setModulo: (modulo: Modulo) => void;
  addConcreteElement: (elemento: Omit<ConcreteElement, 'id'>) => void;
  updateConcreteElement: (id: string, cambios: Partial<Omit<ConcreteElement, 'id'>>) => void;
  removeConcreteElement: (id: string) => void;
  addAsphaltElement: (elemento: Omit<AsphaltElement, 'id'>) => void;
  updateAsphaltElement: (id: string, cambios: Partial<Omit<AsphaltElement, 'id'>>) => void;
  removeAsphaltElement: (id: string) => void;
  /** Densidad compactada del asfalto en t/m³. */
  setDensidadAsfalto: (tM3: number) => void;
}

export type ProjectStore = ProjectState & ProjectActions;

// Zonas de ejemplo alineadas con el plano de prueba (public/sample-plan.pdf).
// TODO: eliminar cuando exista la herramienta de dibujo de polígonos.
const zonasEjemplo: Zone[] = [
  {
    id: 'z-ejemplo-1',
    nombre: '', // el nombre visible sale de nombreClave (traducido al mostrar)
    nombreClave: 'zone.sample.buildingPad',
    tipo: 'corte',
    puntos: [
      { x: 380, y: 300 },
      { x: 620, y: 300 },
      { x: 620, y: 460 },
      { x: 380, y: 460 },
    ],
    profundidad: 1.5,
  },
  {
    id: 'z-ejemplo-2',
    nombre: '',
    nombreClave: 'zone.sample.parking',
    tipo: 'relleno',
    puntos: [
      { x: 650, y: 480 },
      { x: 820, y: 480 },
      { x: 820, y: 630 },
      { x: 650, y: 630 },
    ],
    profundidad: 0.8,
  },
];

// El store no usa el middleware `persist`; solo el sistema de unidades y el idioma se guardan en localStorage.
const CLAVE_UNIDADES = 'excavation-app:sistemaUnidades';
// v2: se cambió la clave para que todos empiecen en inglés una vez (un valor 'es' antiguo ya no se lee).
const CLAVE_IDIOMA = 'excavation-app:language-v2';
const CLAVES_IDIOMA_ANTIGUAS = ['excavation-app:language'];

function leerGuardado(clave: string): string | null {
  try {
    return globalThis.localStorage?.getItem(clave) ?? null;
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string) {
  try {
    globalThis.localStorage?.setItem(clave, valor);
  } catch {
    // localStorage no disponible (modo privado, etc.): se usa solo en memoria.
  }
}

function leerSistemaGuardado(): SistemaUnidades {
  const v = leerGuardado(CLAVE_UNIDADES);
  return v === 'imperial' || v === 'metrico' ? v : SISTEMA_POR_DEFECTO;
}

function leerIdiomaGuardado(): Idioma {
  try {
    for (const clave of CLAVES_IDIOMA_ANTIGUAS) globalThis.localStorage?.removeItem(clave);
  } catch {
    // sin localStorage
  }
  const v = leerGuardado(CLAVE_IDIOMA);
  return esIdioma(v) ? v : IDIOMA_POR_DEFECTO;
}

const nuevoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `z-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useProjectStore = create<ProjectStore>()((set) => ({
  // --- Estado inicial ---
  pdfSource: { tipo: 'url', url: '/sample-plan.pdf', nombre: 'sample-plan.pdf' },
  pageIndex: 0,
  numPaginas: 0,
  // Escala por defecto 1:500 (la del plano de prueba). Se reemplazará con la calibración.
  metersPerPdfUnit: metersPerPdfUnitFromRatio(500),
  zones: zonasEjemplo,
  factors: { abundamiento: 0.25, contraccion: 0.1, capacidadCamion: 14 },
  herramienta: 'navegar',
  vista: { zoom: 1, x: 0, y: 0 },
  tamanoLienzo: { ancho: 0, alto: 0 },
  sistemaUnidades: leerSistemaGuardado(),
  language: leerIdiomaGuardado(),
  modulo: 'excavacion',
  concreteElements: [],
  asphaltElements: [],
  densidadAsfalto: DENSIDAD_ASFALTO_POR_DEFECTO,

  // --- Acciones ---
  setPdfSource: (source) =>
    set((s) => {
      // Liberar el object URL anterior si lo cargó el usuario.
      if (s.pdfSource?.tipo === 'archivo' && s.pdfSource.url !== source.url) {
        URL.revokeObjectURL(s.pdfSource.url);
      }
      return { pdfSource: source, pageIndex: 0, numPaginas: 0 };
    }),
  setPageIndex: (index) => set({ pageIndex: Math.max(0, index) }),
  setNumPaginas: (n) => set({ numPaginas: n }),
  setScale: (metersPerPdfUnit) => set({ metersPerPdfUnit }),
  addZone: (zone) => set((s) => ({ zones: [...s.zones, { ...zone, id: nuevoId() }] })),
  updateZone: (id, cambios) =>
    set((s) => ({ zones: s.zones.map((z) => (z.id === id ? { ...z, ...cambios } : z)) })),
  removeZone: (id) => set((s) => ({ zones: s.zones.filter((z) => z.id !== id) })),
  setFactors: (factors) => set((s) => ({ factors: { ...s.factors, ...factors } })),
  setHerramienta: (herramienta) => set({ herramienta }),
  setVista: (vista) =>
    set((s) => ({
      vista: { ...s.vista, ...vista, zoom: limitarZoom(vista.zoom ?? s.vista.zoom) },
    })),
  zoomPor: (factor) =>
    set((s) => {
      const { zoom, x, y } = s.vista;
      const nuevoZoom = limitarZoom(zoom * factor);
      // Mantener fijo el punto del plano que está en el centro del lienzo.
      const cx = s.tamanoLienzo.ancho / 2;
      const cy = s.tamanoLienzo.alto / 2;
      const px = (cx - x) / zoom;
      const py = (cy - y) / zoom;
      return { vista: { zoom: nuevoZoom, x: cx - px * nuevoZoom, y: cy - py * nuevoZoom } };
    }),
  setTamanoLienzo: (ancho, alto) => set({ tamanoLienzo: { ancho, alto } }),
  setSistemaUnidades: (sistemaUnidades) => {
    guardar(CLAVE_UNIDADES, sistemaUnidades);
    set({ sistemaUnidades });
  },
  setLanguage: (language) => {
    guardar(CLAVE_IDIOMA, language);
    set({ language });
  },
  setModulo: (modulo) => set({ modulo }),
  addConcreteElement: (e) => set((s) => ({ concreteElements: [...s.concreteElements, { ...e, id: nuevoId() }] })),
  updateConcreteElement: (id, cambios) =>
    set((s) => ({ concreteElements: s.concreteElements.map((e) => (e.id === id ? { ...e, ...cambios } : e)) })),
  removeConcreteElement: (id) => set((s) => ({ concreteElements: s.concreteElements.filter((e) => e.id !== id) })),
  addAsphaltElement: (e) => set((s) => ({ asphaltElements: [...s.asphaltElements, { ...e, id: nuevoId() }] })),
  updateAsphaltElement: (id, cambios) =>
    set((s) => ({ asphaltElements: s.asphaltElements.map((e) => (e.id === id ? { ...e, ...cambios } : e)) })),
  removeAsphaltElement: (id) => set((s) => ({ asphaltElements: s.asphaltElements.filter((e) => e.id !== id) })),
  setDensidadAsfalto: (densidadAsfalto) => set({ densidadAsfalto }),
}));
