// Construcción de una superficie de elevaciones a partir de curvas de nivel, cotas y líneas de
// quiebre: TIN (Delaunay) con interpolación lineal dentro de cada triángulo e IDW (inverso de la
// distancia) como respaldo fuera de la TIN o cuando hay menos de 3 puntos no colineales.
// Coordenadas en unidades PDF, elevaciones en metros.
import type { ElevationFeature, Point, Surface } from '../../types/earthwork';
import { delaunay } from './delaunay';

/** Vértice de la superficie (x, y en unidades PDF; z en metros). */
export interface SurfacePoint {
  x: number;
  y: number;
  z: number;
}

/** true si el elemento cuenta para los cálculos (solo los aceptados). */
export const isAccepted = (f: ElevationFeature): boolean => f.provenance.status === 'accepted';

/** Elementos aceptados de una superficie. */
export function acceptedFeatures(surface: Pick<Surface, 'features'>): ElevationFeature[] {
  return surface.features.filter(isAccepted);
}

/** Inserta vértices intermedios para que ningún tramo mida más de `maxSeg` (unidades PDF). */
function densificar<T extends Point>(pts: readonly T[], cerrado: boolean, maxSeg: number, emit: (x: number, y: number, t: number, a: T, b: T) => void) {
  const tramos = cerrado ? pts.length : pts.length - 1;
  if (pts.length === 1) emit(pts[0].x, pts[0].y, 0, pts[0], pts[0]);
  for (let i = 0; i < tramos; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const largo = Math.hypot(b.x - a.x, b.y - a.y);
    const pasos = maxSeg > 0 && Number.isFinite(maxSeg) ? Math.max(1, Math.ceil(largo / maxSeg)) : 1;
    for (let k = 0; k < pasos; k++) {
      const t = k / pasos;
      emit(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, t, a, b);
    }
  }
  if (!cerrado && pts.length > 1) {
    const u = pts[pts.length - 1];
    emit(u.x, u.y, 1, u, u);
  }
}

/**
 * Vértices 3D de los elementos ACEPTADOS (los 'pending' y 'rejected' se ignoran).
 * Curvas y líneas de quiebre se densifican a tramos ≤ `maxSegPdf`.
 */
export function featurePoints(features: readonly ElevationFeature[], maxSegPdf = Infinity): SurfacePoint[] {
  const salida: SurfacePoint[] = [];
  for (const f of features) {
    if (!isAccepted(f)) continue;
    if (f.kind === 'spot') {
      if (Number.isFinite(f.elevationM)) salida.push({ x: f.point.x, y: f.point.y, z: f.elevationM });
    } else if (f.kind === 'contour') {
      if (!Number.isFinite(f.elevationM) || f.points.length === 0) continue;
      densificar(f.points, !!f.closed && f.points.length > 2, maxSegPdf, (x, y) => salida.push({ x, y, z: f.elevationM }));
    } else {
      densificar(f.points, false, maxSegPdf, (x, y, t, a, b) =>
        salida.push({ x, y, z: a.elevationM + (b.elevationM - a.elevationM) * t }),
      );
    }
  }
  return salida;
}

/** Une puntos repetidos (misma posición dentro de `eps`) promediando su elevación. */
export function dedupePoints(pts: readonly SurfacePoint[], eps = 1e-6): SurfacePoint[] {
  const mapa = new Map<string, { x: number; y: number; z: number; n: number }>();
  for (const p of pts) {
    const clave = `${Math.round(p.x / eps)},${Math.round(p.y / eps)}`;
    const e = mapa.get(clave);
    if (e) {
      e.z += p.z;
      e.n++;
    } else mapa.set(clave, { x: p.x, y: p.y, z: p.z, n: 1 });
  }
  return [...mapa.values()].map((e) => ({ x: e.x, y: e.y, z: e.z / e.n }));
}

/** Superficie consultable: elevación (m) en cualquier punto del plano. */
export interface ElevationSurface {
  points: SurfacePoint[];
  /** Índices de triángulos (3 por triángulo) sobre `points`. */
  triangles: Uint32Array;
  /** Elevación en (x, y) en metros; NaN si la superficie no tiene puntos. */
  sample(x: number, y: number): number;
  /** true si (x, y) cae dentro de algún triángulo (si no, se usó IDW). */
  insideTin(x: number, y: number): boolean;
}

export interface BuildSurfaceOptions {
  /** Longitud máxima de tramo al densificar (unidades PDF). */
  maxSegPdf?: number;
  /** Potencia del IDW (por defecto 2). */
  idwPower?: number;
  /** Vecinos usados por el IDW (por defecto 12). */
  idwNeighbors?: number;
}

/** Construye la superficie (TIN + IDW) a partir de los elementos aceptados. */
export function buildSurface(features: readonly ElevationFeature[], opts: BuildSurfaceOptions = {}): ElevationSurface {
  return buildSurfaceFromPoints(dedupePoints(featurePoints(features, opts.maxSegPdf ?? Infinity)), opts);
}

/** Igual que `buildSurface` pero a partir de vértices 3D ya preparados. */
export function buildSurfaceFromPoints(points: SurfacePoint[], opts: BuildSurfaceOptions = {}): ElevationSurface {
  const potencia = opts.idwPower ?? 2;
  const vecinos = Math.max(1, opts.idwNeighbors ?? 12);
  const triangles = delaunay(points);
  const nt = triangles.length / 3;

  // Índice espacial: rejilla uniforme de cubetas con los triángulos que tocan cada una.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const lado = Math.max(1, Math.ceil(Math.sqrt(Math.max(nt, 1))));
  const bw = (maxX - minX) / lado || 1;
  const bh = (maxY - minY) / lado || 1;
  const cubetas: number[][] = Array.from({ length: lado * lado }, () => []);
  const celda = (v: number, min: number, paso: number) => Math.min(lado - 1, Math.max(0, Math.floor((v - min) / paso)));
  for (let t = 0; t < nt; t++) {
    const A = points[triangles[3 * t]];
    const B = points[triangles[3 * t + 1]];
    const C = points[triangles[3 * t + 2]];
    const i0 = celda(Math.min(A.x, B.x, C.x), minX, bw);
    const i1 = celda(Math.max(A.x, B.x, C.x), minX, bw);
    const j0 = celda(Math.min(A.y, B.y, C.y), minY, bh);
    const j1 = celda(Math.max(A.y, B.y, C.y), minY, bh);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cubetas[j * lado + i].push(t);
  }

  /** Interpolación lineal en el triángulo que contiene (x, y), o NaN. */
  const enTin = (x: number, y: number): number => {
    if (nt === 0 || x < minX || x > maxX || y < minY || y > maxY) return NaN;
    for (const t of cubetas[celda(y, minY, bh) * lado + celda(x, minX, bw)]) {
      const A = points[triangles[3 * t]];
      const B = points[triangles[3 * t + 1]];
      const C = points[triangles[3 * t + 2]];
      const det = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
      const l1 = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / det;
      const l2 = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / det;
      const l3 = 1 - l1 - l2;
      const eps = -1e-9;
      if (l1 >= eps && l2 >= eps && l3 >= eps) return l1 * A.z + l2 * B.z + l3 * C.z;
    }
    return NaN;
  };

  /** IDW con los `vecinos` puntos más cercanos (búsqueda lineal; solo fuera de la TIN). */
  const idw = (x: number, y: number): number => {
    if (points.length === 0) return NaN;
    const cerca: { d2: number; z: number }[] = [];
    for (const p of points) {
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d2 < 1e-18) return p.z;
      if (cerca.length < vecinos) {
        cerca.push({ d2, z: p.z });
        if (cerca.length === vecinos) cerca.sort((a, b) => a.d2 - b.d2);
      } else if (d2 < cerca[vecinos - 1].d2) {
        let k = vecinos - 1;
        while (k > 0 && cerca[k - 1].d2 > d2) {
          cerca[k] = cerca[k - 1];
          k--;
        }
        cerca[k] = { d2, z: p.z };
      }
    }
    let sw = 0;
    let sz = 0;
    for (const c of cerca) {
      const w = 1 / Math.pow(c.d2, potencia / 2);
      sw += w;
      sz += w * c.z;
    }
    return sz / sw;
  };

  return {
    points,
    triangles,
    sample(x, y) {
      const z = enTin(x, y);
      return Number.isNaN(z) ? idw(x, y) : z;
    },
    insideTin: (x, y) => !Number.isNaN(enTin(x, y)),
  };
}
