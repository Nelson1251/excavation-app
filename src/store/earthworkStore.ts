// Estado de movimiento de tierras por superficies (curvas, cotas, límite, ajustes del mapa de
// calor). Store de Zustand INDEPENDIENTE de projectStore para poder conectarlo al lienzo más
// adelante sin tocar el estado existente. La escala (metersPerPdfUnit), la página y el sistema
// de unidades se leen de projectStore al calcular (ver `computeFor`).
import { create } from 'zustand';
import type {
  EarthworkGrid,
  EarthworkSettings,
  ElevationFeature,
  FeatureStatus,
  Point,
  SiteBoundary,
  Surface,
  SurfaceKind,
} from '../types/earthwork';
import { computeEarthworkGrid } from '../lib/earthwork/grid';
import { HEATMAP_DEFAULTS } from '../lib/earthwork/heatmap';
import { makeProvenance, newEarthworkId, withStatus } from '../lib/earthwork/features';

export const EARTHWORK_DEFAULTS: EarthworkSettings = {
  cellSizeM: 1,
  contourIntervalM: 0.5,
  heatmap: HEATMAP_DEFAULTS,
  showHeatmap: true,
  material: {},
};

/** Herramienta de trazado de superficies activa (se sumará a `Herramienta` al conectar el lienzo). */
export type EarthworkTool = 'none' | 'boundary' | 'contour' | 'spot' | 'breakline';

interface EarthworkState {
  surfaces: Surface[];
  boundaries: SiteBoundary[];
  settings: EarthworkSettings;
  /** Superficie en la que se traza ahora. */
  activeKind: SurfaceKind;
  tool: EarthworkTool;
  /** Último resultado calculado (se invalida al cambiar datos). */
  grid: EarthworkGrid | null;
  error: string | null;
}

interface EarthworkActions {
  setTool: (tool: EarthworkTool) => void;
  setActiveKind: (kind: SurfaceKind) => void;
  /** Agrega un elemento a la superficie (kind, página); crea la superficie si no existe. */
  addFeature: (kind: SurfaceKind, pageIndex: number, feature: ElevationFeature) => void;
  updateFeature: (id: string, cambios: Partial<ElevationFeature>) => void;
  setFeatureStatus: (id: string, status: FeatureStatus) => void;
  removeFeature: (id: string) => void;
  /** Reemplaza el límite del sitio de la página. */
  setBoundary: (pageIndex: number, points: Point[]) => void;
  clearBoundary: (pageIndex: number) => void;
  setSettings: (cambios: Partial<EarthworkSettings>) => void;
  /** Calcula la malla de la página con la escala dada; guarda el resultado o el error. */
  computeFor: (pageIndex: number, metersPerPdfUnit: number | null) => EarthworkGrid | null;
  reset: () => void;
}

const inicial = (): EarthworkState => ({
  surfaces: [],
  boundaries: [],
  settings: EARTHWORK_DEFAULTS,
  activeKind: 'existing',
  tool: 'none',
  grid: null,
  error: null,
});

const mapearElementos = (surfaces: Surface[], id: string, f: (e: ElevationFeature) => ElevationFeature | null): Surface[] =>
  surfaces.map((s) =>
    s.features.some((e) => e.id === id)
      ? { ...s, features: s.features.flatMap((e) => (e.id === id ? (f(e) ?? []) : [e])) }
      : s,
  );

export const useEarthworkStore = create<EarthworkState & EarthworkActions>()((set, get) => ({
  ...inicial(),
  setTool: (tool) => set({ tool }),
  setActiveKind: (activeKind) => set({ activeKind }),
  addFeature: (kind, pageIndex, feature) =>
    set((st) => {
      const existe = st.surfaces.some((s) => s.kind === kind && s.pageIndex === pageIndex);
      const surfaces = existe
        ? st.surfaces.map((s) => (s.kind === kind && s.pageIndex === pageIndex ? { ...s, features: [...s.features, feature] } : s))
        : [...st.surfaces, { id: newEarthworkId('sf'), kind, pageIndex, features: [feature] }];
      return { surfaces, grid: null };
    }),
  updateFeature: (id, cambios) =>
    set((st) => ({ surfaces: mapearElementos(st.surfaces, id, (e) => ({ ...e, ...cambios }) as ElevationFeature), grid: null })),
  setFeatureStatus: (id, status) =>
    set((st) => ({ surfaces: mapearElementos(st.surfaces, id, (e) => withStatus(e, status)), grid: null })),
  removeFeature: (id) => set((st) => ({ surfaces: mapearElementos(st.surfaces, id, () => null), grid: null })),
  setBoundary: (pageIndex, points) =>
    set((st) => ({
      boundaries: [
        ...st.boundaries.filter((b) => b.pageIndex !== pageIndex),
        { id: newEarthworkId('bd'), pageIndex, points, provenance: makeProvenance() },
      ],
      grid: null,
    })),
  clearBoundary: (pageIndex) => set((st) => ({ boundaries: st.boundaries.filter((b) => b.pageIndex !== pageIndex), grid: null })),
  setSettings: (cambios) => set((st) => ({ settings: { ...st.settings, ...cambios }, grid: null })),
  computeFor: (pageIndex, metersPerPdfUnit) => {
    const { surfaces, boundaries, settings } = get();
    const buscar = (kind: SurfaceKind) => surfaces.find((s) => s.kind === kind && s.pageIndex === pageIndex);
    const existing = buscar('existing');
    const proposed = buscar('proposed');
    const boundary = boundaries.find((b) => b.pageIndex === pageIndex);
    // Códigos de error estables: la UI los traduce con claves i18n `earthwork.err.<código>`.
    const error = !metersPerPdfUnit
      ? 'noScale'
      : !boundary
        ? 'noBoundary'
        : !existing?.features.some((f) => f.provenance.status === 'accepted')
          ? 'noExisting'
          : !proposed?.features.some((f) => f.provenance.status === 'accepted')
            ? 'noProposed'
            : null;
    if (error || !existing || !proposed || !boundary || !metersPerPdfUnit) {
      set({ grid: null, error });
      return null;
    }
    try {
      const grid = computeEarthworkGrid(existing, proposed, boundary.points, { metersPerPdfUnit, cellSizeM: settings.cellSizeM });
      set({ grid, error: null });
      return grid;
    } catch {
      set({ grid: null, error: 'tooManyCells' });
      return null;
    }
  },
  reset: () => set(inicial()),
}));
