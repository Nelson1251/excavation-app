// Estado global del proyecto con Zustand.
import { create } from 'zustand';
import { metersPerPdfUnitFromRatio } from '../lib/geometry';
import type { Factors, Herramienta, PdfSource, ProjectState, Vista, Zone } from '../types';

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 20;

const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

interface ProjectActions {
  setPdfSource: (source: PdfSource) => void;
  setPageIndex: (index: number) => void;
  setNumPaginas: (n: number) => void;
  setScale: (metersPerPdfUnit: number | null) => void;
  addZone: (zone: Omit<Zone, 'id'>) => void;
  updateZone: (id: string, cambios: Partial<Omit<Zone, 'id'>>) => void;
  removeZone: (id: string) => void;
  setFactors: (factors: Partial<Factors>) => void;
  setHerramienta: (h: Herramienta) => void;
  setVista: (vista: Partial<Vista>) => void;
  /** Zoom relativo alrededor del centro del lienzo. */
  zoomPor: (factor: number) => void;
  setTamanoLienzo: (ancho: number, alto: number) => void;
}

export type ProjectStore = ProjectState & ProjectActions;

// Zonas de ejemplo alineadas con el plano de prueba (public/sample-plan.pdf).
// TODO: eliminar cuando exista la herramienta de dibujo de polígonos.
const zonasEjemplo: Zone[] = [
  {
    id: 'z-ejemplo-1',
    nombre: 'Plataforma edificio',
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
    nombre: 'Estacionamiento',
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
}));
