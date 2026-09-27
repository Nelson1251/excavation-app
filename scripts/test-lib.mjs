// Prueba rápida (sin dependencias extra) de los módulos puros de src/lib:
// units.ts (conversión/formato), factors.ts, volumes.ts, soils.ts (abundamiento y contracción) y
// geometry.ts (área shoelace, escala, rectángulo por arrastre, conversión pantalla ↔ plano).
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
const modulos = ['lib/units', 'lib/factors', 'lib/volumes', 'lib/soils', 'lib/concrete', 'lib/asphalt', 'i18n/en', 'i18n/es', 'i18n/index', 'lib/geometry'];
// El directorio temporal va dentro de node_modules para que las dependencias (p. ej. @turf/turf en
// geometry.ts) se resuelvan desde los archivos transpilados; node_modules está en .gitignore.
const dir = mkdtempSync(join(existsSync(join(raiz, 'node_modules')) ? join(raiz, 'node_modules') : tmpdir(), '.test-lib-'));
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
const [u, f, v, s, c, a, enMod, esMod, i18n, g] = await Promise.all(modulos.map(cargar));
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
// Campo de pies de texto (antes type=number: Chrome convertía "1/4" en "14" al descartar "/").
cerca(u.evaluarPiesPulgadas('5', '1/4').metros, (60 + 0.25) * 0.0254, "5 ft + 1/4 in");
igual(u.formatearPiesPulgadas(u.evaluarPiesPulgadas('5', '1/4').metros), `5' 0 1/4"`, "eco 5' 0 1/4\"");
cerca(u.evaluarPiesPulgadas('5', '1/2').metros, 1.5367, "5 ft + 1/2 in = 1.5367 m");
igual(u.leerCampoPies('5'), { pies: 5, pulgadas: 0 }, 'pies: 5');
igual(u.leerCampoPies('5.5'), { pies: 5, pulgadas: 6 }, 'pies decimales 5.5 → 5 ft 6 in');
igual(u.leerCampoPies('5,5'), { pies: 5, pulgadas: 6 }, 'pies decimales con coma');
igual(u.leerCampoPies("5.5'"), { pies: 5, pulgadas: 6 }, "pies decimales con marca 5.5'");
igual(u.leerCampoPies('5 1/4'), { pies: 5, pulgadas: 0.25 }, 'pies todo junto: 5 1/4');
igual(u.leerCampoPies('5-1/4'), { pies: 5, pulgadas: 0.25 }, 'pies todo junto: 5-1/4');
igual(u.leerCampoPies("5' 1/4"), { pies: 5, pulgadas: 0.25 }, "pies todo junto: 5' 1/4");
igual(u.leerCampoPies("5'1/4\""), { pies: 5, pulgadas: 0.25 }, "pies todo junto: 5'1/4\"");
igual(u.leerCampoPies("5' 7 1/2\""), { pies: 5, pulgadas: 7.5 }, "pies todo junto: 5' 7 1/2\"");
igual(u.leerCampoPies("5'-7 1/2"), { pies: 5, pulgadas: 7.5 }, "pies todo junto: 5'-7 1/2");
igual(u.leerCampoPies('5ft 7'), { pies: 5, pulgadas: 7 }, 'pies todo junto: 5ft 7');
igual(u.leerCampoPies('5 7'), { pies: 5, pulgadas: 7 }, 'pies todo junto: 5 7');
igual(u.leerCampoPies('1/4'), { pies: 0, pulgadas: 0.25 }, 'fracción sola en pies = pulgadas');
igual(u.leerCampoPies('3/4"'), { pies: 0, pulgadas: 0.75 }, 'fracción con marca de pulgadas');
igual(u.leerCampoPies('7"'), { pies: 0, pulgadas: 7 }, 'pulgadas con marca en el campo de pies');
igual(u.leerCampoPies(''), { pies: 0, pulgadas: 0 }, 'pies vacío = 0');
igual(u.leerCampoPies('14'), { pies: 14, pulgadas: 0 }, '14 sigue siendo 14 ft');
igual(u.leerCampoPies('5 1/3'), { error: 'distance.err.denominator' }, 'pies todo junto con denominador inválido');
igual(u.leerCampoPies('x'), { error: 'distance.err.feetInvalid' }, 'pies inválidos');
igual(u.leerCampoPies('-5'), { error: 'distance.err.feetInvalid' }, 'pies negativos');
cerca(u.evaluarPiesPulgadas('5 1/4', '').metros, (60.25) * 0.0254, "evaluar: '5 1/4' en pies");
cerca(u.evaluarPiesPulgadas('1/4', '').metros, 0.25 * 0.0254, "evaluar: '1/4' en pies = 1/4 in");
cerca(u.evaluarPiesPulgadas('3.5', '').metros, 3.5 * 0.3048, 'evaluar: 3.5 ft');
igual(u.evaluarPiesPulgadas('5 1/4', '2').pulgadas, 2.25, 'pulgadas de ambos campos se suman');
igual(u.evaluarPiesPulgadas('', ''), { error: 'distance.err.empty' }, 'ambos vacíos');
igual(u.evaluarPiesPulgadas('x', '1'), { error: 'distance.err.feetInvalid' }, 'pies inválidos');
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

// --- Geometría (dibujo de zonas y calibración) ---
// Área shoelace en unidades PDF², independiente del sentido de giro.
const rect240x160 = [{ x: 380, y: 300 }, { x: 620, y: 300 }, { x: 620, y: 460 }, { x: 380, y: 460 }];
cerca(g.shoelaceArea(rect240x160), 38400, 'shoelace rectángulo 240×160');
cerca(g.shoelaceArea([...rect240x160].reverse()), 38400, 'shoelace sentido antihorario');
cerca(g.shoelaceArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }]), 25, 'shoelace triángulo');
// Polígono en L (100×100 menos un cuadrado de 50×50) = 7500.
const ele = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 100 }];
cerca(g.shoelaceArea(ele), 7500, 'shoelace polígono en L (cóncavo)');
cerca(g.shoelaceArea([{ x: 0, y: 0 }, { x: 5, y: 5 }]), 0, 'shoelace con 2 puntos = 0');
cerca(g.shoelaceArea([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 10 }]), 0, 'shoelace colineal = 0');

// Escala: 1:500 impreso a tamaño real → 500 × 0.0254 / 72 m por unidad PDF.
const m500 = (500 * 0.0254) / 72;
cerca(g.metersPerPdfUnitFromRatio(500), m500, 'escala 1:500');
// Calibración con la barra de 20 m del plano de ejemplo (113.386 u. PDF de largo) → misma escala.
const barraU = 20 / m500;
cerca(g.metersPerPdfUnitFromReference({ x: 60, y: 745 }, { x: 60 + barraU, y: 745 }, 20), m500, 'calibración con barra de 20 m');
// Línea inclinada 3-4-5: 50 u. PDF = 10 m → 0.2 m/u.
cerca(g.metersPerPdfUnitFromReference({ x: 0, y: 0 }, { x: 30, y: 40 }, 10), 0.2, 'calibración línea inclinada');
igual(g.metersPerPdfUnitFromReference({ x: 5, y: 5 }, { x: 5, y: 5 }, 10), null, 'calibración con puntos iguales = null');
// Calibración en pies: 65' 7 3/8" (= 20 m) sobre la barra da la misma escala.
cerca(g.metersPerPdfUnitFromReference({ x: 0, y: 0 }, { x: barraU, y: 0 }, u.piesPulgadasAMetros(65, 7.375)), m500, 'calibración en pies y pulgadas (redondeo a 1/8")', 1e-5);
// Área real = shoelace × escala²: la plataforma de ejemplo (240×160 u.) a 1:500 = 1194.72 m².
cerca(g.polygonAreaM2(rect240x160, m500), 38400 * m500 * m500, 'área m² = shoelace × escala²');
cerca(g.polygonAreaM2(rect240x160, m500), 1194.7407, 'plataforma de ejemplo en m² (42.33 × 28.22 m)', 1e-3);
cerca(g.pdfAreaToSquareMeters(100, 0.5), 25, 'u.PDF² → m² (escala al cuadrado)');
cerca(g.pdfUnitsToMeters(100, 0.5), 50, 'u.PDF → m');
cerca(g.polygonAreaM2([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], 0.2), 4, 'cuadrado 10 u. a 0.2 m/u = 4 m²');
// En modo Pies el área se muestra en ft² (nunca m²).
igual(u.formatearArea(g.polygonAreaM2(rect240x160, m500), 'imperial'), '12,860.08 ft²', 'área de la plataforma en ft²');
igual(u.formatearArea(g.polygonAreaM2(rect240x160, m500), 'metrico'), '1,194.74 m²', 'área de la plataforma en m²');

// Rectángulo a partir de un arrastre: mismas 4 esquinas en cualquier dirección.
const esperadoRect = [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 70 }, { x: 10, y: 70 }];
igual(g.rectFromDrag({ x: 10, y: 20 }, { x: 110, y: 70 }), esperadoRect, 'rect arrastre ↘');
igual(g.rectFromDrag({ x: 110, y: 70 }, { x: 10, y: 20 }), esperadoRect, 'rect arrastre ↖');
igual(g.rectFromDrag({ x: 110, y: 20 }, { x: 10, y: 70 }), esperadoRect, 'rect arrastre ↙');
igual(g.rectFromDrag({ x: 10, y: 70 }, { x: 110, y: 20 }), esperadoRect, 'rect arrastre ↗');
cerca(g.shoelaceArea(g.rectFromDrag({ x: 10, y: 20 }, { x: 110, y: 70 })), 5000, 'área del rect arrastrado');
igual(g.isSimplePolygon(g.rectFromDrag({ x: 10, y: 20 }, { x: 110, y: 70 })), true, 'rect arrastrado es simple');
// Umbral de arrastre (px de pantalla): más de 5 px = rectángulo; menos = clic (polígono).
igual(g.isDrag({ x: 0, y: 0 }, { x: 3, y: 4 }), false, '5 px = clic');
igual(g.isDrag({ x: 0, y: 0 }, { x: 6, y: 0 }), true, '6 px = arrastre');
igual(g.isDrag({ x: 0, y: 0 }, { x: 2, y: 2 }, 2), true, 'umbral configurable');
// Polígono que se cruza (moño) → no simple.
igual(g.isSimplePolygon([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }]), false, 'moño no es simple');
// Pantalla ↔ plano con paneo y zoom (inversa exacta).
const vista = { zoom: 2.5, x: 120, y: -40 };
igual(g.planToScreen({ x: 100, y: 200 }, vista), { x: 370, y: 460 }, 'plano → pantalla');
igual(g.screenToPlan({ x: 370, y: 460 }, vista), { x: 100, y: 200 }, 'pantalla → plano');
// Centroide (posición de la etiqueta).
igual(g.polygonCentroid(rect240x160), { x: 500, y: 380 }, 'centroide del rectángulo');
igual(g.polygonCentroid([{ x: 0, y: 0 }, { x: 4, y: 0 }]), { x: 2, y: 0 }, 'centroide degenerado = promedio');

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
