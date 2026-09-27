// Triangulación de Delaunay (Bowyer–Watson) sin dependencias, suficiente para las decenas de
// miles de vértices de un plano de nivelación trazado a mano. Si algún día hace falta más
// velocidad, `delaunator` (MIT, sin dependencias) expone el mismo resultado: índices de
// triángulos en un arreglo plano.

/** Punto 2D mínimo (coordenadas en cualquier unidad consistente). */
export interface XY {
  x: number;
  y: number;
}

interface Tri {
  a: number;
  b: number;
  c: number;
  /** Circuncírculo: centro y radio². */
  cx: number;
  cy: number;
  r2: number;
}

function circumcircle(p: XY[], a: number, b: number, c: number): Tri {
  const A = p[a];
  const B = p[b];
  const C = p[c];
  const bx = B.x - A.x;
  const by = B.y - A.y;
  const cx = C.x - A.x;
  const cy = C.y - A.y;
  const d = 2 * (bx * cy - by * cx);
  if (Math.abs(d) < 1e-18) {
    // Triángulo degenerado (colineal): circuncírculo "infinito" para que se rehaga pronto.
    return { a, b, c, cx: A.x, cy: A.y, r2: Infinity };
  }
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const ux = (cy * b2 - by * c2) / d;
  const uy = (bx * c2 - cx * b2) / d;
  return { a, b, c, cx: A.x + ux, cy: A.y + uy, r2: ux * ux + uy * uy };
}

/**
 * Triangula los puntos y devuelve los índices de los triángulos en un arreglo plano
 * [a0, b0, c0, a1, b1, c1, …] (orientación antihoraria en ejes x→derecha, y→arriba).
 * Los puntos duplicados deben eliminarse antes (ver `dedupePoints`).
 */
export function delaunay(points: readonly XY[]): Uint32Array {
  const n = points.length;
  if (n < 3) return new Uint32Array(0);

  // Normalizar a un cuadro unitario centrado mejora la precisión numérica.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const escala = Math.max(maxX - minX, maxY - minY) || 1;
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  const pts: XY[] = points.map((p) => ({ x: (p.x - mx) / escala, y: (p.y - my) / escala }));

  // Supertriángulo que contiene todo.
  const M = 100;
  pts.push({ x: -M, y: -M }, { x: M, y: -M }, { x: 0, y: M });
  let tris: Tri[] = [circumcircle(pts, n, n + 1, n + 2)];

  // Insertar en orden de x reduce el número de triángulos "malos" por iteración.
  const orden = [...Array(n).keys()].sort((i, j) => pts[i].x - pts[j].x || pts[i].y - pts[j].y);
  for (const i of orden) {
    const p = pts[i];
    const buenos: Tri[] = [];
    const aristas = new Map<string, [number, number] | null>();
    const agregarArista = (u: number, v: number) => {
      const clave = u < v ? `${u},${v}` : `${v},${u}`;
      // Una arista compartida por dos triángulos malos es interior: se descarta.
      aristas.set(clave, aristas.has(clave) ? null : [u, v]);
    };
    for (const t of tris) {
      const dx = p.x - t.cx;
      const dy = p.y - t.cy;
      if (dx * dx + dy * dy < t.r2 * (1 + 1e-12)) {
        agregarArista(t.a, t.b);
        agregarArista(t.b, t.c);
        agregarArista(t.c, t.a);
      } else {
        buenos.push(t);
      }
    }
    for (const arista of aristas.values()) {
      if (arista) buenos.push(circumcircle(pts, arista[0], arista[1], i));
    }
    tris = buenos;
  }

  const salida: number[] = [];
  for (const t of tris) {
    if (t.a >= n || t.b >= n || t.c >= n) continue; // toca el supertriángulo
    const A = pts[t.a];
    const B = pts[t.b];
    const C = pts[t.c];
    const orient = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    if (Math.abs(orient) < 1e-14) continue; // degenerado
    if (orient > 0) salida.push(t.a, t.b, t.c);
    else salida.push(t.a, t.c, t.b);
  }
  return Uint32Array.from(salida);
}
