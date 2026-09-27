// Pruebas del módulo de movimiento de tierras por superficies (src/lib/earthwork): TIN/IDW,
// volúmenes por malla (planos exactos, taludes, corte/relleno mixto), yd³, abundamiento/
// contracción, colores del mapa de calor y exclusión de sugerencias de IA no aceptadas.
// Mismo enfoque que scripts/test-lib.mjs: transpila con TypeScript y carga desde node_modules.
// Uso: npm test (o node scripts/test-earthwork.mjs)
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const raiz = join(fileURLToPath(import.meta.url), '..', '..');

/** Transpila los módulos puros a un directorio temporal y devuelve un cargador. */
export async function cargarEarthwork() {
  const modulos = [
    'lib/units', 'lib/factors', 'lib/soils',
    'lib/earthwork/delaunay', 'lib/earthwork/surface', 'lib/earthwork/grid',
    'lib/earthwork/quantities', 'lib/earthwork/heatmap', 'lib/earthwork/features',
  ];
  const base = existsSync(join(raiz, 'node_modules')) ? join(raiz, 'node_modules') : tmpdir();
  const dir = mkdtempSync(join(base, '.test-earthwork-'));
  for (const m of modulos) {
    const { outputText } = ts.transpileModule(readFileSync(join(raiz, `src/${m}.ts`), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: true },
    });
    const js = outputText.replace(/from '(\.{1,2}\/[\w/-]+)'/g, (_, ruta) => `from '${ruta}.mjs'`);
    mkdirSync(dirname(join(dir, m)), { recursive: true });
    writeFileSync(join(dir, `${m}.mjs`), js);
  }
  const cargar = (m) => import(pathToFileURL(join(dir, `${m}.mjs`)).href);
  const [units, grid, surface, quantities, heatmap, features, delaunay] = await Promise.all(
    ['lib/units', 'lib/earthwork/grid', 'lib/earthwork/surface', 'lib/earthwork/quantities', 'lib/earthwork/heatmap', 'lib/earthwork/features', 'lib/earthwork/delaunay'].map(cargar),
  );
  rmSync(dir, { recursive: true, force: true });
  return { units, grid, surface, quantities, heatmap, features, delaunay };
}

// Solo ejecutar las pruebas cuando se llama directamente (el demo reutiliza `cargarEarthwork`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { units: u, grid: G, surface: S, quantities: Q, heatmap: H, features: F, delaunay: D } = await cargarEarthwork();

  let ok = 0;
  const cerca = (real, esperado, nombre, tol = 1e-9) => {
    assert.ok(Math.abs(real - esperado) <= tol, `${nombre}: se esperaba ${esperado}, se obtuvo ${real}`);
    ok++;
  };
  const igual = (real, esperado, nombre) => {
    assert.deepEqual(real, esperado, `${nombre}: se esperaba ${JSON.stringify(esperado)}, se obtuvo ${JSON.stringify(real)}`);
    ok++;
  };

  // Escala: 1 unidad PDF = 0.1 m. Sitio: rectángulo NO alineado con la malla, 20 m × 10 m.
  const mpu = 0.1;
  const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const limite = rect(3.3, 7.7, 203.3, 107.7); // 200 × 100 PDF = 20 m × 10 m = 200 m²
  const manual = F.makeProvenance('manual');
  /** Cotas en las esquinas de un cuadro amplio con z = f(x_m, y_m): define un plano exacto. */
  const planoPorCotas = (f, extra = 60) => {
    const [x0, y0, x1, y1] = [3.3 - extra, 7.7 - extra, 203.3 + extra, 107.7 + extra];
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => F.makeSpot({ x, y }, f(x * mpu, y * mpu), manual));
  };
  const opciones = { metersPerPdfUnit: mpu, cellSizeM: 0.7 };

  // --- Delaunay básico ---
  const cuad = D.delaunay([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  igual(cuad.length, 6, 'cuadrado → 2 triángulos');
  const nube = Array.from({ length: 400 }, (_, i) => ({ x: (i * 7919) % 101, y: (i * 104729) % 97 + ((i * 31) % 13) / 13 }));
  const triNube = D.delaunay(S.dedupePoints(nube.map((p) => ({ ...p, z: 0 }))));
  let areaTin = 0;
  for (let t = 0; t < triNube.length; t += 3) {
    const pts = S.dedupePoints(nube.map((p) => ({ ...p, z: 0 })));
    const [A, B, C] = [pts[triNube[t]], pts[triNube[t + 1]], pts[triNube[t + 2]]];
    const o = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    assert.ok(o > 0, 'triángulos antihorarios y no degenerados');
    areaTin += o / 2;
  }
  ok++;
  assert.ok(areaTin > 0.97 * 100 * 97 && areaTin <= 101 * 98, `TIN cubre casi toda la nube (área ${areaTin})`);
  ok++;

  // --- Superficie: un plano definido por cotas se reproduce exactamente dentro de la TIN ---
  const plano = S.buildSurface(planoPorCotas((x, y) => 100 + 0.02 * x - 0.03 * y));
  cerca(plano.sample(50, 50), 100 + 0.02 * 5 - 0.03 * 5, 'TIN reproduce el plano', 1e-9);
  igual(plano.insideTin(50, 50), true, 'punto dentro de la TIN');
  // IDW: una sola cota → superficie constante.
  const unaCota = S.buildSurface([F.makeSpot({ x: 0, y: 0 }, 42, manual)]);
  cerca(unaCota.sample(1000, -30), 42, 'una sola cota → constante (IDW)');
  igual(Number.isNaN(S.buildSurface([]).sample(0, 0)), true, 'sin puntos → NaN');

  // --- 1) Plano existente vs plano 1 m más alto: relleno exacto 200 m³ ---
  const planoExist = planoPorCotas(() => 100);
  const planoProp = planoPorCotas(() => 101);
  const r1 = G.computeEarthworkGrid(planoExist, planoProp, limite, opciones);
  cerca(r1.totals.areaM2, 200, 'área del límite (recorte exacto de celdas)', 1e-9);
  cerca(r1.totals.fillM3, 200, 'relleno plano +1 m = 200 m³', 1e-9);
  cerca(r1.totals.cutM3, 0, 'sin corte', 1e-12);
  cerca(r1.totals.netM3, -200, 'neto = corte − relleno = −200', 1e-9);
  cerca(r1.totals.fillAreaM2, 200, 'área de relleno');
  // Límite no rectangular (triángulo) → área y volumen exactos igual.
  const tri = [{ x: 10, y: 10 }, { x: 150, y: 20 }, { x: 60, y: 90 }];
  const areaTri = Math.abs(G.signedArea(tri)) * mpu * mpu;
  cerca(G.computeEarthworkGrid(planoExist, planoProp, tri, opciones).totals.fillM3, areaTri, 'límite triangular exacto', 1e-9);

  // --- 2) Planos inclinados: volumen analítico ---
  // existente z = 100 + 0.05·x, propuesto z = 103 − 0.02·y (x, y en m). Sobre x∈[0.33, 20.33],
  // y∈[0.77, 10.77]: dz = 3 − 0.02y − 0.05x > 0 en todo el sitio → todo relleno.
  const vAnalitico = (() => {
    const [x0, x1, y0, y1] = [0.33, 20.33, 0.77, 10.77];
    const A = (x1 - x0) * (y1 - y0);
    return 3 * A - 0.02 * ((y1 * y1 - y0 * y0) / 2) * (x1 - x0) - 0.05 * ((x1 * x1 - x0 * x0) / 2) * (y1 - y0);
  })();
  const r2 = G.computeEarthworkGrid(planoPorCotas((x) => 100 + 0.05 * x), planoPorCotas((_, y) => 103 - 0.02 * y), limite, opciones);
  cerca(r2.totals.fillM3, vAnalitico, `taludes: relleno analítico ${vAnalitico.toFixed(4)} m³`, 1e-6);
  cerca(r2.totals.cutM3, 0, 'taludes: sin corte', 1e-12);

  // Mismo plano existente trazado con CURVAS DE NIVEL rectas cada 0.5 m (x = 10 m cada curva).
  const curvas = [];
  for (let k = -1; k <= 23; k++) {
    // z sube 0.5 m cada 10 m: curva k en x = 10k m = 100k unidades PDF, elevación 100 + 0.5k.
    curvas.push(F.makeContour([{ x: k * 100, y: -80 }, { x: k * 100, y: 200 }], 100 + 0.5 * k, manual));
  }
  const r2c = G.computeEarthworkGrid(curvas, planoPorCotas((_, y) => 103 - 0.02 * y), limite, opciones);
  cerca(r2c.totals.fillM3, vAnalitico, 'curvas de nivel rectas = mismo volumen analítico', 1e-6);

  // --- 3) Sitio mixto: existente plano 100, propuesto 99 + 0.1·x. dz = −1 + 0.1x, cero en x = 10 m ---
  // Sitio x∈[0, 30] m, y∈[0, 10] m (0..300 × 0..100 PDF): corte = 5·10 = 50 m³, relleno = 20·10 = 200 m³.
  const sitio = rect(0, 0, 300, 100);
  const mixtoProp = [0, 300].flatMap((x) => [-50, 150].map((y) => F.makeSpot({ x: x === 0 ? -50 : 350, y }, 99 + 0.1 * ((x === 0 ? -50 : 350) * mpu), manual)));
  const mixtoExist = [[-50, -50], [350, -50], [350, 150], [-50, 150]].map(([x, y]) => F.makeSpot({ x, y }, 100, manual));
  const r3 = G.computeEarthworkGrid(mixtoExist, mixtoProp, sitio, { metersPerPdfUnit: mpu, cellSizeM: 0.3 });
  cerca(r3.totals.cutM3, 50, 'mixto: corte ≈ 50 m³', 0.2);
  cerca(r3.totals.fillM3, 200, 'mixto: relleno ≈ 200 m³', 0.2);
  cerca(r3.totals.netM3, -150, 'mixto: neto exacto −150 m³ (dz lineal)', 1e-6);
  cerca(r3.totals.cutAreaM2 + r3.totals.fillAreaM2, 300, 'mixto: áreas de corte + relleno = sitio', 1e-6);
  // Con celdas que caen justo en x = 10 m (0.5 m → 20 celdas), la división es exacta.
  const r3b = G.computeEarthworkGrid(mixtoExist, mixtoProp, sitio, { metersPerPdfUnit: mpu, cellSizeM: 0.5 });
  cerca(r3b.totals.cutM3, 50, 'mixto alineado: corte exacto', 1e-6);
  cerca(r3b.totals.fillM3, 200, 'mixto alineado: relleno exacto', 1e-6);
  cerca(G.gridDzAt(r3b, { x: 27, y: 50 }), -1 + 0.1 * 2.75, 'dz en un punto (celda 2.5–3.0 m, centro 2.75 m)', 1e-9);
  igual(Number.isNaN(G.gridDzAt(r3b, { x: -5, y: 50 })), true, 'dz fuera de la malla = NaN');

  // --- 4) yd³ ---
  const enYd = Q.totalsInUnits(r1.totals, 'imperial');
  cerca(enYd.fill, 200 / 0.764554857984, '200 m³ → 261.59 yd³', 1e-9);
  igual(enYd.unit, 'yd³', 'unidad yd³ en Feet');
  igual(Q.totalsInUnits(r1.totals, 'metrico').unit, 'm³', 'unidad m³ en Meters');
  igual(Q.formatEarthworkVolume(200, 'imperial'), '261.59 yd³', 'formato yd³');
  igual(Q.formatElevation(u.piesAMetros(1234.5), 'imperial'), '1,234.50 ft', 'elevación en pies (sin metros)');
  igual(Q.formatElevation(100, 'metrico'), '100.00 m', 'elevación en metros');
  igual(Q.formatCutFillDepth(u.piesPulgadasAMetros(1, 6.5), 'imperial'), `+1' 6 1/2"`, 'dz relleno ft-in con fracción');
  igual(Q.formatCutFillDepth(-u.piesPulgadasAMetros(0, 3.25), 'imperial'), `-0' 3 1/4"`, 'dz corte ft-in');
  igual(Q.formatCutFillDepth(-0.47, 'metrico'), '-0.47 m', 'dz corte en m');
  for (const texto of [Q.formatEarthworkVolume(200, 'imperial'), Q.formatElevation(100, 'imperial'), Q.formatCutFillDepth(1, 'imperial')]) {
    assert.ok(!/\bm\b|m³|m²/.test(texto), `Feet sin metros: ${texto}`);
    ok++;
  }

  // --- Abundamiento / contracción (catálogo de soils.ts) ---
  const proyecto = { abundamiento: 0.25, contraccion: 0.1, capacidadCamion: 10 };
  const q1 = Q.earthworkQuantities({ cutM3: 100, fillM3: 45 }, { soilType: 'arcilla', fillMaterial: 'relleno-comun' }, proyecto);
  cerca(q1.swell.valor, 0.35, 'abundamiento de arcilla');
  igual(q1.swell.origen, 'suelo', 'origen del abundamiento');
  cerca(q1.cutLooseM3, 135, 'corte suelto = 100 × 1.35');
  cerca(q1.fillBankNeededM3, 45 / 0.8, 'material necesario = 45 / (1 − 0.20)');
  cerca(q1.netBankM3, 100 - 56.25, 'balance en banco');
  cerca(q1.exportLooseM3, 43.75 * 1.35, 'exportación suelta');
  igual(q1.exportTrips, Math.ceil((43.75 * 1.35) / 10), 'viajes de exportación');
  const q2 = Q.earthworkQuantities({ cutM3: 10, fillM3: 90 }, { contraccionManual: 0.1 }, proyecto);
  cerca(q2.importBankM3, 90 / 0.9 - 10, 'importación en banco');
  igual(q2.exportTrips, 0, 'sin viajes de exportación si falta material');
  igual(q2.swell.origen, 'proyecto', 'sin suelo → abundamiento del proyecto');

  // --- 5) Colores del mapa de calor en los umbrales ---
  const op = { toleranceM: 0.05, maxCutM: 2, maxFillM: 1, opacity: 0.5 };
  igual(H.heatColor(0, op), [34, 197, 94, 128], 'dz 0 → verde');
  igual(H.heatColor(0.05, op), [34, 197, 94, 128], 'dz = +tolerancia → verde');
  igual(H.heatColor(-0.05, op), [34, 197, 94, 128], 'dz = −tolerancia → verde');
  igual(H.heatColor(-0.0500001, op).slice(0, 3), [252, 165, 165], 'justo pasando la tolerancia (corte) → rojo claro');
  igual(H.heatColor(0.0500001, op).slice(0, 3), [147, 197, 253], 'justo pasando la tolerancia (relleno) → azul claro');
  igual(H.heatColor(-2, op), [185, 28, 28, 128], 'corte máximo → rojo intenso');
  igual(H.heatColor(-50, op), [185, 28, 28, 128], 'corte mayor al máximo se satura');
  igual(H.heatColor(1, op), [29, 78, 216, 128], 'relleno máximo (1 m) → azul intenso');
  igual(H.heatColor(NaN, op), [0, 0, 0, 0], 'NaN → transparente');
  igual(H.heatColor(0, { ...op, opacity: 1 })[3], 255, 'opacidad 1 → 255');
  const medio = H.heatColor(-(0.05 + 1.95 / 2), op);
  igual(medio.slice(0, 3), [219, 97, 97], 'corte a mitad de rango → rojo intermedio');
  igual(H.cutFillClass(-0.3, 0.05), 'cut', 'clase corte');
  igual(H.cutFillClass(0.3, 0.05), 'fill', 'clase relleno');
  igual(H.heatmapLegend(op).map((p) => p.kind), ['cut', 'cut', 'grade', 'fill', 'fill'], 'leyenda');

  // Búfer de píxeles: tamaño, celdas fuera del límite transparentes, color de una celda.
  const px = H.heatmapPixels(r3b, op, 2);
  igual([px.width, px.height], [r3b.cols * 2, r3b.rows * 2], 'tamaño del búfer (2 px por celda)');
  igual(px.data.length, px.width * px.height * 4, 'RGBA');
  const pix = (x, y) => [...px.data.slice((y * px.width + x) * 4, (y * px.width + x) * 4 + 4)];
  igual(pix(0, 0), H.heatColor(r3b.dzM[0], op), 'celda (0,0) = color de su dz (corte)');
  igual(pix(px.width - 1, px.height - 1), H.heatColor(r3b.dzM[r3b.dzM.length - 1], op), 'última celda = relleno');
  const pxTri = H.heatmapPixels(G.computeEarthworkGrid(planoExist, planoProp, tri, opciones), op);
  igual(pxTri.data[((pxTri.height - 1) * pxTri.width) * 4 + 3], 0, 'esquina inferior izquierda fuera del límite triangular → transparente');
  igual(pxTri.data[3], 128, 'celda del vértice (10,10) con área > 0 → pintada');
  cerca(px.widthPdf, r3b.cols * r3b.cellSizePdf, 'ancho en unidades PDF');

  // --- 6) Sugerencias de IA pendientes/rechazadas NO cuentan ---
  const ia = F.makeProvenance('ai-suggested', { confidence: 0.62 });
  igual(ia.status, 'pending', 'sugerencia de IA nace pendiente');
  const loca = F.makeSpot({ x: 100, y: 50 }, 500, ia); // cota absurda en medio del sitio
  const rechazada = F.withStatus(F.makeContour([{ x: 0, y: 0 }, { x: 300, y: 100 }], -40, F.makeProvenance('ai-suggested')), 'rejected');
  const conIa = G.computeEarthworkGrid([...planoExist, loca, rechazada], planoProp, limite, opciones);
  cerca(conIa.totals.fillM3, 200, 'pendiente + rechazada ignoradas: relleno sigue en 200 m³', 1e-9);
  const aceptada = F.withStatus(loca, 'accepted');
  igual(aceptada.provenance.status, 'accepted', 'aceptar sugerencia');
  assert.ok(typeof aceptada.provenance.reviewedAt === 'string', 'fecha de revisión');
  ok++;
  const conIaAceptada = G.computeEarthworkGrid([...planoExist, aceptada], planoProp, limite, opciones);
  assert.ok(conIaAceptada.totals.cutM3 > 100, 'al aceptarla sí cambia el resultado (corte grande)');
  ok++;
  igual(F.countByStatus([loca, rechazada, aceptada, ...planoExist]), { accepted: 5, pending: 1, rejected: 1 }, 'conteo por estado');
  igual(S.featurePoints([loca, rechazada]).length, 0, 'featurePoints ignora no aceptados');

  // --- Utilidades ---
  cerca(F.nextContourElevation(100, 0.5), 100.5, 'auto-paso de curva +0.5');
  cerca(F.nextContourElevation(100.3, 0.1, -1), 100.2, 'auto-paso de curva −0.1 sin error flotante', 0);
  igual(G.suggestCellSizeM(40_000), 1, 'celda sugerida para 4 ha');
  assert.throws(() => G.computeEarthworkGrid(planoExist, planoProp, limite, { metersPerPdfUnit: 0, cellSizeM: 1 }), /calibrate/);
  assert.throws(() => G.computeEarthworkGrid(planoExist, planoProp, limite, { metersPerPdfUnit: mpu, cellSizeM: 0.001 }), /too fine/);
  ok += 2;

  // Rendimiento aproximado: 30 curvas × 60 vértices + malla de ~20k celdas.
  const t0 = performance.now();
  const muchas = Array.from({ length: 30 }, (_, k) =>
    F.makeContour(Array.from({ length: 60 }, (_, i) => ({ x: i * 5, y: k * 10 + 3 * Math.sin(i / 5) })), 100 + k * 0.3, manual),
  );
  const rPerf = G.computeEarthworkGrid(muchas, planoProp, rect(0, 0, 295, 290), { metersPerPdfUnit: mpu, cellSizeM: 0.2 });
  const ms = performance.now() - t0;
  assert.ok(rPerf.totals.areaM2 > 0 && ms < 10_000, `rendimiento (${ms.toFixed(0)} ms)`);
  ok++;

  console.log(`✓ src/lib/earthwork: ${ok} comprobaciones correctas (malla de ${rPerf.cols}×${rPerf.rows} con ${muchas.length} curvas en ${ms.toFixed(0)} ms)`);
}
