// Fábricas y utilidades puras para elementos de elevación (usadas por la futura UI de trazado,
// por la importación y por las sugerencias de IA).
import type {
  Breakline,
  ContourLine,
  ElevationFeature,
  FeatureSource,
  FeatureStatus,
  Point,
  Point3,
  Provenance,
  SpotElevation,
} from '../../types/earthwork';

let contador = 0;
/** Id único local (no criptográfico). */
export function newEarthworkId(prefijo = 'ew'): string {
  contador = (contador + 1) % 1e6;
  return `${prefijo}-${Date.now().toString(36)}-${contador.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Procedencia por defecto: lo manual e importado nace aceptado; lo sugerido por IA nace
 * pendiente de revisión.
 */
export function makeProvenance(source: FeatureSource = 'manual', extra: Partial<Provenance> = {}): Provenance {
  return {
    source,
    status: source === 'ai-suggested' ? 'pending' : 'accepted',
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

export function makeContour(points: Point[], elevationM: number, provenance: Provenance = makeProvenance(), closed = false): ContourLine {
  return { id: newEarthworkId('ct'), kind: 'contour', points, elevationM, closed, provenance };
}

export function makeSpot(point: Point, elevationM: number, provenance: Provenance = makeProvenance(), label?: string): SpotElevation {
  return { id: newEarthworkId('sp'), kind: 'spot', point, elevationM, label, provenance };
}

export function makeBreakline(points: Point3[], provenance: Provenance = makeProvenance()): Breakline {
  return { id: newEarthworkId('bl'), kind: 'breakline', points, provenance };
}

/** Cambia el estado de revisión (aceptar/rechazar una sugerencia) y anota la fecha. */
export function withStatus<T extends ElevationFeature>(f: T, status: FeatureStatus, ahora = new Date()): T {
  return { ...f, provenance: { ...f.provenance, status, reviewedAt: ahora.toISOString() } };
}

/**
 * Elevación sugerida para la siguiente curva al trazar curvas seguidas: la anterior ± el
 * intervalo (como "auto-step by contour interval" de Foreman). `direccion` = +1 sube, −1 baja.
 */
export function nextContourElevation(anteriorM: number, intervaloM: number, direccion: 1 | -1 = 1): number {
  // Redondeo a 1e-6 m para no acumular errores de coma flotante (0.1 + 0.2…).
  return Math.round((anteriorM + direccion * intervaloM) * 1e6) / 1e6;
}

/** Resumen para la lista de revisión: cuántos elementos hay por estado. */
export function countByStatus(features: readonly ElevationFeature[]): Record<FeatureStatus, number> {
  const r: Record<FeatureStatus, number> = { accepted: 0, pending: 0, rejected: 0 };
  for (const f of features) r[f.provenance.status]++;
  return r;
}
