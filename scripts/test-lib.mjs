// Prueba rápida (sin dependencias extra) de los módulos puros de src/lib:
// units.ts (conversión/formato), factors.ts, volumes.ts y soils.ts (abundamiento y contracción).
// Transpila los módulos con el compilador de TypeScript ya instalado y los importa desde un
// directorio temporal. Uso: npm test
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';

const raiz = join(fileURLToPath(import.meta.url), '..', '..');
// Módulos puros a probar (rutas relativas a src/, sin extensión).
const modulos = ['lib/units', 'lib/factors', 'lib/volumes', 'lib/soils', 'lib/concrete', 'lib/asphalt', 'i18n/en', 'i18n/es', 'i18n/index'];
const dir = mkdtempSync(join(tmpdir(), 'lib-'));
for (const m of modulos) {
  const fuente = readFileSync(join(raiz, `src/${m}.ts`), 'utf8');
  const { outputText } = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: true },
  });
  // Importaciones relativas ('./factors', '../i18n') → archivos .mjs transpilados.
  const js = outputText.replace(/from '(\.{1,2}\/[\w/-]+)'/g, (_, ruta) => {
    const destino = join(dirname(join(dir, m)), ruta);
    return `from '${ruta}${existsSync(join(raiz, 'src', relative(dir, destino)) + '.ts') ? '' : '/index'}.mjs'`;
  });
  mkdirSync(dirname(join(dir, m)), { recursive: true });
  writeFileSync(join(dir, `${m}.mjs`), js);
}
const cargar = (m) => import(pathToFileURL(join(dir, `${m}.mjs`)).href);
const [u, f, v, s, c, a, enMod, esMod, i18n] = await Promise.all(modulos.map(cargar));
rmSync(dir, { recursive: true, force: true });
const tEn = i18n.crearTraductor('en');
const tEs = i18n.crearTraductor('es');

let ok = 0;
const cerca = (real, esperado, nombre, tol = 1e-9) => {
  assert.ok(Math.abs(real - esperado) < tol, `${nombre}: se esperaba ${esperado}, se obtuvo ${real}`);
  ok++;
};
const igual = (real, esperado, nombre) => {
  assert.deepEqual(real, esperado, `${nombre}: se esperaba ${JSON.stringify(esperado)}, se obtuvo ${JSON.stringify(real)}`);
  ok++;
};

// Pies + pulgadas → metros
cerca(u.piesPulgadasAMetros(3, 6), 1.0668, '3 ft 6 in');
cerca(u.piesPulgadasAMetros(0, 42), 1.0668, '0 ft 42 in');
cerca(u.piesPulgadasAMetros(3.5, 0), 1.0668, '3.5 ft');
cerca(u.piesAMetros(3.5), 1.0668, 'piesAMetros(3.5)');
cerca(u.piesPulgadasAMetros(0, 6.5), 0.1651, '0 ft 6.5 in');
cerca(u.piesPulgadasAMetros(1, 0), 0.3048, '1 ft');

// Normalización de pulgadas ≥ 12
igual(u.normalizarPiesPulgadas(3, 18), { pies: 4, pulgadas: 6 }, '3 ft 18 in → 4 ft 6 in');
igual(u.normalizarPiesPulgadas(0, 42), { pies: 3, pulgadas: 6 }, '42 in → 3 ft 6 in');
igual(u.normalizarPiesPulgadas(2, 12), { pies: 3, pulgadas: 0 }, '2 ft 12 in → 3 ft 0 in');
igual(u.normalizarPiesPulgadas(0, 12.5), { pies: 1, pulgadas: 0.5 }, '12.5 in → 1 ft 0.5 in');
igual(u.normalizarPiesPulgadas(0, 11.99), { pies: 0, pulgadas: 11.99 }, '11.99 in sin cambio');
igual(u.normalizarPiesPulgadas(0, 1.0668 / 0.0254), { pies: 3, pulgadas: 6 }, 'metros → pies/pulg (1.0668 m)');

// Formato pies-pulgadas (redondeo a 1/4")
igual(u.formatearPiesPulgadas(1.0668), `3' 6"`, 'format(1.0668)');
igual(u.formatearPiesPulgadas(0.2032), `0' 8"`, 'menos de 1 pie');
igual(u.formatearPiesPulgadas(-0.2032), `-0' 8"`, 'negativo menor a 1 pie');
igual(u.formatearPiesPulgadas(-1.0668), `-3' 6"`, 'negativo');
igual(u.formatearPiesPulgadas(0), `0' 0"`, 'cero');
igual(u.formatearPiesPulgadas(-0.001), `0' 0"`, 'negativo que redondea a cero');
igual(u.formatearPiesPulgadas(u.piesPulgadasAMetros(3, 6.25)), `3' 6 1/4"`, '1/4 de pulgada');
igual(u.formatearPiesPulgadas(u.piesPulgadasAMetros(3, 6.5)), `3' 6 1/2"`, '1/2 pulgada');
igual(u.formatearPiesPulgadas(u.piesPulgadasAMetros(3, 6.8)), `3' 6 3/4"`, 'redondeo a 3/4');
igual(u.formatearPiesPulgadas(u.piesPulgadasAMetros(0, 11.9)), `0' 11 7/8"`, '11.9" → 11 7/8" (1/8")');
igual(u.formatearPiesPulgadas(u.piesPulgadasAMetros(0, 11.95)), `1' 0"`, 'acarreo 11.95" → 1\' 0"');
igual(u.formatearPiesPulgadas(u.piesPulgadasAMetros(3, 6.375)), `3' 6 3/8"`, '3/8 reducido');
igual(u.formatearPiesPulgadas(u.piesPulgadasAMetros(0, 0.25)), `0' 0 1/4"`, 'fracción sola con 0 pulgadas');
igual(u.formatearPiesPulgadas(20), `65' 7 3/8"`, '20 m → 65\' 7 3/8"');
igual(u.formatearPiesPulgadas(0.3048), `1' 0"`, '1 pie exacto');

// Áreas y volúmenes
cerca(u.m2APies2(0.09290304), 1, '1 ft²');
cerca(u.m2APies2(1), 10.763910416709722, '1 m² en ft²');
cerca(u.m3AYardas3(0.764554857984), 1, '1 yd³');
cerca(u.m3AYardas3(1), 1.3079506193143922, '1 m³ en yd³');
cerca(u.yardas3AM3(u.m3AYardas3(14)), 14, 'ida y vuelta m³ ↔ yd³');

// Formato con unidades
igual(u.formatearVolumen(0.764554857984, 'imperial'), '1.00 yd³', 'formatearVolumen imperial');
igual(u.formatearVolumen(2, 'metrico'), '2.00 m³', 'formatearVolumen métrico');
igual(u.formatearArea(0.09290304, 'imperial'), '1.00 ft²', 'formatearArea imperial');
igual(u.formatearLongitud(1.0668, 'imperial'), `3' 6"`, 'formatearLongitud imperial');
igual(u.formatearLongitud(1.5, 'metrico'), '1.50 m', 'formatearLongitud métrico');

// Lectura de campos numéricos
igual(u.leerNumero('6.5'), 6.5, 'leerNumero punto');
igual(u.leerNumero('6,5'), 6.5, 'leerNumero coma');
igual(u.leerNumero(''), null, 'leerNumero vacío');
igual(u.leerNumero('abc'), null, 'leerNumero inválido');

// Abundamiento: suelto = banco × (1 + abundamiento)
cerca(f.looseVolume(100, 0.25), 125, '100 m³ en banco con 25 % = 125 m³ sueltos');
cerca(f.truckTrips(125, 14), 9, 'viajes de camión con volumen suelto (125 / 14 → 9)');
// Contracción: material necesario = compactado / (1 − contracción)
cerca(f.fillMaterialNeeded(100, 0.2), 125, '100 m³ compactados con 20 % = 125 m³ necesarios');

// Tipos de suelo: valor representativo = punto medio del rango típico
cerca(s.abundamientoSuelo('arcilla'), 0.35, 'arcilla 30–40 % → 35 %');
cerca(s.abundamientoSuelo('arena'), 0.125, 'arena 10–15 % → 12.5 %');
cerca(s.abundamientoSuelo('roca-dura'), 0.65, 'roca dura 50–80 % → 65 %');
igual(s.abundamientoSuelo(undefined), undefined, 'sin suelo → undefined');
igual(s.abundamientoDeZona({}, 0.25), { valor: 0.25, origen: 'proyecto' }, 'sin suelo usa el del proyecto');
igual(s.abundamientoDeZona({ soilType: 'arcilla' }, 0.25).origen, 'suelo', 'con suelo usa el del suelo');
igual(s.abundamientoDeZona({ soilType: 'arcilla', abundamientoManual: 0.3 }, 0.25), { valor: 0.3, origen: 'manual' }, 'manual tiene prioridad');
igual(s.etiquetaSuelo(undefined, tEn), 'Unspecified', 'etiqueta sin suelo (en)');
igual(s.etiquetaSuelo(undefined, tEs), 'Sin especificar', 'etiqueta sin suelo (es)');
igual(s.etiquetaSuelo('arcilla', tEn), 'Clay', 'suelo en inglés');
igual(s.etiquetaSuelo('arcilla', tEs), 'Arcilla', 'suelo en español');
igual(s.pistaAbundamiento('arcilla', tEn), 'Typical swell 30–40%', 'pista abundamiento (en)');
igual(s.TIPOS_SUELO.length, 11, '11 tipos de suelo');

// Materiales de relleno: contracción representativa
cerca(s.contraccionMaterial('relleno-comun'), 0.2, 'relleno común 15–25 % → 20 %');
cerca(s.contraccionMaterial('grava'), 0.075, 'grava 5–10 % → 7.5 %');
igual(s.contraccionDeZona({}, 0.1), { valor: 0.1, origen: 'proyecto' }, 'sin material usa la del proyecto');
igual(s.contraccionDeZona({ fillMaterial: 'tepetate', contraccionManual: 0.12 }, 0.1).valor, 0.12, 'contracción manual');
igual(s.etiquetaMaterialRelleno('base-hidraulica', tEn), 'Hydraulic base', 'etiqueta material (en)');
igual(s.etiquetaMaterialRelleno('base-hidraulica', tEs), 'Base hidráulica', 'etiqueta material (es)');
igual(s.MATERIALES_RELLENO.length, 15, '15 materiales de relleno');
cerca(s.contraccionMaterial('solo-suelo'), 0.175, 'Soil only 10–25 % → 17.5 %');
igual(s.etiquetaMaterialRelleno('solo-suelo', tEn), 'Soil only', 'Soil only (en)');
igual(s.etiquetaMaterialRelleno('solo-suelo', tEs), 'Tierra (solo suelo)', 'Soil only (es)');
cerca(s.contraccionMaterial('grava-1'), 0.09, 'Grava 1" 6–12 % → 9 %');
igual(s.etiquetaMaterialRelleno('grava-1', tEn), 'Gravel 1"', 'etiqueta Gravel 1"');
igual(s.descripcionMaterialRelleno('grava-1', tEs), 'Grava que pasa malla de 1 pulgada', 'descripción Grava 1" (es)');
cerca(s.contraccionMaterial('road-mix-tricorel'), 0.15, 'Road mix / Tricorel 10–20 % → 15 %');
igual(s.pistaContraccion('road-mix-tricorel', tEs), 'Contr. típica 10–20 % (valor estimado, ajustar)', 'pista Road mix / Tricorel (es)');
igual(s.pistaContraccion('road-mix-tricorel', tEn), 'Typical shrink 10–20% (estimated value, adjust)', 'pista Road mix / Tricorel (en)');
cerca(s.contraccionMaterial('road-mix-2-minus'), 0.11, 'Road mix 2" minus 8–14 % → 11 %');
igual(s.etiquetaMaterialRelleno('road-mix-2-minus', tEn), 'Road mix 2" minus', 'etiqueta Road mix 2" minus');
igual(s.descripcionMaterialRelleno('road-mix-2-minus', tEn), 'Passes 2-inch sieve', 'descripción Road mix 2" minus');
igual(s.pistaContraccion('road-mix-2-minus', tEn), 'Typical shrink 8–14%', 'pista Road mix 2" minus');
cerca(s.contraccionMaterial('rock-mix'), 0.05, 'rock mix 0–10 % → 5 %');
igual(s.etiquetaMaterialRelleno('rock-mix', tEs), 'Rock mix (mezcla de roca)', 'etiqueta rock mix (es)');

// Volúmenes por zona
const vc = v.zoneVolumes('corte', 100, 0.25, 0.1);
cerca(vc.banco, 100, 'corte: banco = geométrico');
cerca(vc.suelto, 125, 'corte: suelto = banco × 1.25');
const vr = v.zoneVolumes('relleno', 100, 0.25, 0.2);
cerca(vr.geometrico, 100, 'relleno: compactado = geométrico');
cerca(vr.banco, 125, 'relleno: material necesario = 100 / 0.8');
cerca(vr.suelto, 156.25, 'relleno: suelto = 125 × 1.25');

// Concreto
cerca(c.volumenPrisma(10, 5, 0.1), 5, 'losa 10 × 5 × 0.10 m = 5 m³');
cerca(c.volumenCilindro(0.3, 3), 0.2120575, 'columna redonda d 0.30 h 3 = 0.212 m³', 1e-6);
cerca(c.conDesperdicio(5, 0.05), 5.25, '5 % de desperdicio sobre 5 m³ = 5.25');
const losa = { tipo: 'losa', forma: 'rectangular', largo: 10, ancho: 5, alto: 0.1, diametro: 0, cantidad: 2, desperdicio: 0.05 };
igual(Object.values(c.volumenesConcreto(losa)).map((x) => Math.round(x * 1e6) / 1e6), [10, 10.5], '2 losas: neto 10, pedido 10.5');
const col = { tipo: 'columna', forma: 'redonda', largo: 9, ancho: 9, alto: 3, diametro: 0.3, cantidad: 1, desperdicio: 0 };
cerca(c.volumenesConcreto(col).neto, 0.2120575, 'columna redonda usa diámetro (ignora largo/ancho)', 1e-6);
cerca(c.totalesConcreto([losa, col]).pedido, 10.5 + 0.2120575, 'totales de concreto', 1e-6);

// Asfalto
const calle = { largo: 100, ancho: 10, espesor: 0.05, cantidad: 1, desperdicio: 0.05 };
const ca = a.calculoAsfalto(calle, a.DENSIDAD_ASFALTO_POR_DEFECTO);
cerca(ca.area, 1000, 'asfalto: área 100 × 10 = 1000 m²');
cerca(ca.neto, 50, 'asfalto: 100 × 10 × 0.05 = 50 m³');
cerca(ca.pedido, 52.5, 'asfalto: +5 % = 52.5 m³');
cerca(ca.toneladas, 123.375, 'asfalto: 52.5 × 2.35 = 123.4 t');
igual(u.formatearNumero(ca.toneladas, 1), '123.4', 'tonelaje redondeado 123.4');
cerca(u.toneladasACortas(0.90718474), 1, '1 ton corta = 0.90718474 t');
cerca(u.tM3ALbFt3(2.35), 146.705706, '2.35 t/m³ ≈ 146.7 lb/ft³', 1e-6);
cerca(u.lbFt3ATM3(u.tM3ALbFt3(2.35)), 2.35, 'ida y vuelta densidad');
cerca(a.totalesAsfalto([calle, calle], 2.35).toneladas, 246.75, 'totales de asfalto');

// Captura pies + pulgadas (DistanceInput) → metros, y eco consistente con el campo
// Pulgadas con fracción (como en obra)
const pf = (x) => u.leerPulgadasFraccion(x);
igual(pf('1/2'), { valor: 0.5 }, "'1/2' = 0.5");
igual(pf('3/4'), { valor: 0.75 }, "'3/4' = 0.75");
igual(pf('5/8'), { valor: 0.625 }, "'5/8'");
igual(pf('1/16'), { valor: 0.0625 }, "'1/16'");
igual(pf('7 1/2'), { valor: 7.5 }, "'7 1/2' = 7.5");
igual(pf('7-3/8'), { valor: 7.375 }, "'7-3/8' = 7.375");
igual(pf('7 - 3/8'), { valor: 7.375 }, "'7 - 3/8' con espacios");
igual(pf('11 15/16'), { valor: 11.9375 }, "'11 15/16' = 11.9375");
igual(pf('7'), { valor: 7 }, "'7' = 7");
igual(pf('7.5'), { valor: 7.5 }, "'7.5' (decimal tolerado)");
igual(pf('7,5'), { valor: 7.5 }, "'7,5' (coma decimal)");
igual(pf('5/4'), { valor: 1.25 }, "'5/4' impropia sola = 1.25");
igual(pf('1/3'), { error: 'distance.err.denominator' }, "'1/3' inválido (denominador)");
igual(pf('7 1/5'), { error: 'distance.err.denominator' }, "'7 1/5' inválido (denominador)");
igual(pf('7 5/4'), { error: 'distance.err.mixedFraction' }, "'7 5/4' inválido (mixto ≥ 1)");
igual(pf('1/0'), { error: 'distance.err.denominator' }, "'1/0' inválido");
igual(pf('-2'), { error: 'distance.err.inchesInvalid' }, "'-2' inválido");
igual(pf('abc'), { error: 'distance.err.inchesInvalid' }, "'abc' inválido");
igual(u.pulgadasATextoFraccion(7.375), '7 3/8', 'texto fracción 7 3/8');
igual(u.pulgadasATextoFraccion(0.5), '1/2', 'texto fracción 1/2');
igual(u.pulgadasATextoFraccion(11.9375), '11 15/16', 'texto fracción 11 15/16');
igual(u.metrosACamposPiesPulgadas(20), { pies: '65', pulgadas: '7 3/8' }, 'campos para 20 m: 65 / 7 3/8');
igual(u.metrosACamposPiesPulgadas(1.0668), { pies: '3', pulgadas: '6' }, 'campos para 1.0668 m: 3 / 6');
igual(u.metrosACamposPiesPulgadas(1.5), { pies: '4', pulgadas: '11 1/16' }, 'campos para 1.5 m: 4 / 11 1/16');
igual(u.textoCampoPulgadas(6.5), '6 1/2', 'normalizado exacto → fracción');
igual(u.textoCampoPulgadas(0.3), '0.3', 'normalizado no exacto → decimal');

// Captura ft (entero) + in (fracción) → metros; eco y campos coinciden
const r65 = u.evaluarPiesPulgadas('65', '7 3/8', false);
cerca(r65.metros, 65 * 0.3048 + 7.375 * 0.0254, "65 ft 7 3/8 in → metros (usa pies Y pulgadas)");
cerca(r65.metros, 20, '65 ft 7 3/8 in ≈ 20 m (±1 mm)', 1e-3);
igual(u.formatearPiesPulgadas(r65.metros), `65' 7 3/8"`, 'eco = lo capturado (65\' 7 3/8")');
const campos20 = u.metrosACamposPiesPulgadas(20);
igual(u.formatearPiesPulgadas(u.evaluarPiesPulgadas(campos20.pies, campos20.pulgadas).metros), u.formatearPiesPulgadas(20), 'ida y vuelta 20 m: campos → metros → texto');
const r74 = u.evaluarPiesPulgadas('65', '7.4', false);
cerca(r74.metros, 19.99996, '65 ft 7.4 in (decimal) = 19.99996 m', 1e-9);
igual(u.formatearPiesPulgadas(r74.metros), `65' 7 3/8"`, '65\' 7.4" se muestra 65\' 7 3/8" (1/8")');
cerca(u.evaluarPiesPulgadas('3', '6').metros, 1.0668, 'ft + in: 3 y 6');
cerca(u.evaluarPiesPulgadas('', '42').metros, 1.0668, 'solo pulgadas: 42');
cerca(u.evaluarPiesPulgadas('3', '1/2').metros, 3 * 0.3048 + 0.5 * 0.0254, 'pies + fracción');
cerca(u.evaluarPiesPulgadas('0', '6.5').metros, 0.1651, 'pulgadas decimales');
igual(u.formatearPiesPulgadas(u.evaluarPiesPulgadas('3', '18').metros), `4' 6"`, 'eco normaliza 3 ft 18 in → 4\' 6"');
igual(u.evaluarPiesPulgadas('3.5', ''), { error: 'distance.err.feetInteger' }, 'pies decimales → error entero');
igual(u.evaluarPiesPulgadas('', ''), { error: 'distance.err.empty' }, 'ambos vacíos');
igual(u.evaluarPiesPulgadas('x', '1'), { error: 'distance.err.feetInteger' }, 'pies inválidos');
igual(u.evaluarPiesPulgadas('1', '-2'), { error: 'distance.err.inchesInvalid' }, 'pulgadas negativas');
igual(u.evaluarPiesPulgadas('1', '1/3'), { error: 'distance.err.denominator' }, 'denominador inválido');
igual(u.evaluarPiesPulgadas('0', '0', false), { error: 'distance.err.zero' }, 'cero no permitido');
for (const m of [0.2032, 1.0668, 1.5, 20, 123.456]) {
  assert.doesNotMatch(u.formatearLongitud(m, 'imperial'), /m/, `formatearLongitud imperial sin "m" (${m})`);
  assert.doesNotMatch(u.formatearArea(m, 'imperial'), /m²/, 'área imperial en ft²');
  assert.doesNotMatch(u.formatearVolumen(m, 'imperial'), /m³/, 'volumen imperial en yd³');
  ok += 3;
}

// Modo Pies sin metros: ningún texto que pueda verse en modo imperial contiene unidades métricas.
// Solo se permiten en las claves que se muestran exclusivamente en modo Metros (o que describen esa opción).
const SOLO_METRICO = new Set([
  'units.metric', // botón "Meters"/"Metros" del selector (siempre visible por diseño)
  'units.metric.title', // ayuda emergente de ese botón
  'scale.metric',
  'distance.labelMeters',
  'distance.hintMeters',
  'distance.err.metersInvalid',
  'asphalt.densityHint.metric',
  'asphalt.densityMetric',
  'unit.tonnes',
]);
const METRICO = /(^|[^\p{L}])(m|m²|m³|t\/m³|t|meters?|metros?|metric|métric\w*|tonnes?)(?=$|[^\p{L}\d])|\{meters\}/iu;
for (const [nombre, dic] of [['en', enMod.en], ['es', esMod.es]]) {
  for (const [clave, texto] of Object.entries(dic)) {
    if (SOLO_METRICO.has(clave)) continue;
    assert.doesNotMatch(texto, METRICO, `[${nombre}] ${clave} muestra unidades métricas en modo Pies: "${texto}"`);
    ok++;
  }
}

// i18n
igual(i18n.traducir('en', 'zones.heading', { count: 3 }), 'Zones (3)', 'interpolación en');
igual(i18n.traducir('es', 'zones.heading', { count: 3 }), 'Zonas (3)', 'interpolación es');
igual(Object.keys(esMod.es).sort(), Object.keys(enMod.en).sort(), 'en y es tienen las mismas claves');
for (const id of s.TIPOS_SUELO.map((x) => x.id)) assert.ok(`soil.${id}` in enMod.en, `falta soil.${id}`);
for (const id of s.MATERIALES_RELLENO.map((x) => x.id)) assert.ok(`fill.${id}` in enMod.en, `falta fill.${id}`);

console.log(`✓ src/lib + src/i18n: ${ok} comprobaciones correctas`);
// Tabla de referencia (para documentación)
for (const t of s.TIPOS_SUELO) console.log(`  suelo    ${s.etiquetaSuelo(t.id, tEn)}: ${t.abundamientoTipico.min}–${t.abundamientoTipico.max} % → ${s.abundamientoSuelo(t.id) * 100} %`);
for (const m of s.MATERIALES_RELLENO) console.log(`  relleno  ${s.etiquetaMaterialRelleno(m.id, tEn)}: ${m.contraccionTipica.min}–${m.contraccionTipica.max} % → ${s.contraccionMaterial(m.id) * 100} %`);
