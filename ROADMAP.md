# Roadmap · Surface cut/fill and heat map

> **Resumen en español.** Objetivo: que la app haga el cálculo de movimiento de tierras como Foreman AI —
> trazar sobre el PDF las **curvas de nivel existentes y propuestas** (y cotas puntuales) dentro de un
> **límite del sitio**, construir las dos superficies y obtener **corte, relleno y neto** (m³ o yd³) con
> abundamiento/contracción, más un **mapa de calor** (rojo = corte, azul = relleno, verde = a rasante).
> Orden: **Fase 0** arreglos en curso (carga del PDF, cero metros en modo Pies, navegación de páginas) →
> **Fase 1** corte/relleno por superficies → **Fase 2** mapa de calor → **Fase 3** sugerencias con IA
> (detectar curvas y elevaciones del PDF; el usuario acepta o rechaza) → después: secciones, reportes,
> guardado automático y deshacer. La base de cálculo (tipos, librería y pruebas) ya está en el código
> (`src/lib/earthwork`, #4); falta conectarla al lienzo.
>
> **Hecho (v0.4.1, commit [a3388b7](https://github.com/Nelson1251/excavation-app/commit/a3388b7)):** una misma
> zona tiene **profundidad de corte** y **profundidad de relleno** por separado (ya no hay que dibujarla dos
> veces). La app calcula los dos volúmenes de la zona (corte = área × prof. de corte, relleno = área × prof. de
> relleno) y un neto con signo (corte +, relleno −); los totales, abundamiento/contracción y viajes de camión
> suman el corte y el relleno por separado. Funciona en Metros y en Pies (pies + pulgadas con fracciones). Las
> zonas del modelo anterior se convierten solas: corte d → corte d / relleno 0; relleno d → corte 0 / relleno d.

Tracking: every item below is a GitHub issue labelled `roadmap` + `phase-N` (or `later`).
Architecture notes: [docs/earthwork-architecture.md](docs/earthwork-architecture.md).

## What we are matching (Foreman AI research, Sep 2026)

- **Workflow** — set the sheet scale, trace the **existing** contours (usually dashed) and the **proposed**
  contours (solid) by clicking along each line and typing its elevation once; the tool **auto-steps by the
  contour interval** for the next line; drop **spot grades** (finished floor, pad corners, top of wall).
  Then it builds two surfaces, differences them and returns **cut CY, fill CY and net import/export** — no
  CAD files needed.[^fa-blog][^fa-earthwork]
- **Heat map** — a color map on the sheet shows where the dirt moves; red = cut, blue = fill. Foreman
  positions it as the audit: "if the red and blue land where the grading narrative says they should, the
  volume is defensible".[^fa-blog]
- **Accuracy** — tracks the plan's contour interval (same limit as any surface-from-contours method).[^fa-earthwork]
- **Swell/shrink** — volumes report as bank yards; swell gives truck (loose) yards; the user applies a
  shrink factor for compacted fill from the geotech.[^fa-earthwork]
- **AI** — Foreman reads the sheets and pairs that with *verified* manual measurements (named, correctable
  objects on calibrated sheets); cut/fill itself is traced by the user.[^fa-takeoff][^fa-help] Our Phase 3
  goes one step further by *suggesting* contours/labels, always as pending items the user accepts.

[^fa-blog]: Foreman AI blog, "How to Calculate Cut and Fill Volumes From a Grading Plan — Without CAD Files", <https://foremanai.co/blog/how-to-calculate-cut-and-fill-from-a-grading-plan>
[^fa-earthwork]: Foreman AI, "Earthwork Takeoff Software", <https://foremanai.co/takeoff-software/earthwork>
[^fa-takeoff]: Foreman AI, "AI Construction Takeoff Software", <https://foremanai.co/takeoff-software>
[^fa-help]: Foreman AI Help Center — Takeoff Studio, <https://foremanai.co/help>

## Ground rules (all phases)

- Every visible string in **EN and ES** (`src/i18n/en.ts`, `es.ts`), English default.
- **Feet mode shows zero metric units**: lengths ft-in with fractions, areas ft², volumes yd³, weights short
  tons; elevations in decimal feet (as printed on US grading plans). Everything is stored in meters.
- dz = proposed − existing: **dz < 0 = cut**, **dz > 0 = fill**; net = cut − fill (> 0 = export), same
  convention as the zone takeoff.
- Only features with `provenance.status === 'accepted'` count in volumes and the heat map.
- `npm test`, `npm run lint`, `npm run build` must pass before pushing to `main`.

## Status at a glance

| Phase | Item | Issue | Status |
| --- | --- | --- | --- |
| Phase 0 | P0-1 Reliable PDF loading (pdf.js worker) | [#1](https://github.com/Nelson1251/excavation-app/issues/1) | ✅ done (d7cdbe7) |
| Phase 0 | P0-2 Feet mode shows zero metric units | [#2](https://github.com/Nelson1251/excavation-app/issues/2) | ✅ done (closed with bdc29e5) |
| Phase 0 | P0-3 Multi-page PDF navigation | [#3](https://github.com/Nelson1251/excavation-app/issues/3) | ✅ done (bdc29e5) |
| Zone takeoff | Z-1 One zone with separate cut depth and fill depth | — | ✅ done (v0.4.1, [a3388b7](https://github.com/Nelson1251/excavation-app/commit/a3388b7)) |
| Phase 1 | P1-1 Earthwork data model, calculation library and store (scaffolding) | [#4](https://github.com/Nelson1251/excavation-app/issues/4) | ✅ scaffolding landed (not wired to UI) |
| Phase 1 | P1-2 Site boundary tool | [#5](https://github.com/Nelson1251/excavation-app/issues/5) | ⏳ planned |
| Phase 1 | P1-3 Trace existing and proposed contours with elevations | [#6](https://github.com/Nelson1251/excavation-app/issues/6) | ⏳ planned |
| Phase 1 | P1-4 Spot elevations (spot grades) | [#7](https://github.com/Nelson1251/excavation-app/issues/7) | ⏳ planned |
| Phase 1 | P1-5 Breaklines (curbs, toe/top of slope, walls) | [#8](https://github.com/Nelson1251/excavation-app/issues/8) | ⏳ planned |
| Phase 1 | P1-6 Compute surfaces and cut/fill panel (grid method) | [#9](https://github.com/Nelson1251/excavation-app/issues/9) | ⏳ planned |
| Phase 1 | P1-7 Swell/shrink and truck trips for surface cut/fill | [#10](https://github.com/Nelson1251/excavation-app/issues/10) | ⏳ planned |
| Phase 1 | P1-8 Topsoil stripping option | [#11](https://github.com/Nelson1251/excavation-app/issues/11) | ⏳ planned |
| Phase 2 | P2-1 Cut/fill heat map overlay on the plan | [#12](https://github.com/Nelson1251/excavation-app/issues/12) | ⏳ planned |
| Phase 2 | P2-2 Heat map legend, adjustable ranges and opacity | [#13](https://github.com/Nelson1251/excavation-app/issues/13) | ⏳ planned |
| Phase 2 | P2-3 Cut/fill depth readout on hover | [#14](https://github.com/Nelson1251/excavation-app/issues/14) | ⏳ planned |
| Phase 3 | P3-1 AI: detect contours and elevation labels from the PDF | [#15](https://github.com/Nelson1251/excavation-app/issues/15) | ⏳ planned |
| Phase 3 | P3-2 Review AI suggestions (accept / reject) | [#16](https://github.com/Nelson1251/excavation-app/issues/16) | ⏳ planned |
| Later | L-1 Cross sections | [#17](https://github.com/Nelson1251/excavation-app/issues/17) | ⏳ planned |
| Later | L-2 Reports and export (Excel / PDF) | [#18](https://github.com/Nelson1251/excavation-app/issues/18) | ⏳ planned |
| Later | L-3 Autosave and project files | [#19](https://github.com/Nelson1251/excavation-app/issues/19) | ⏳ planned |
| Later | L-4 Undo / redo | [#20](https://github.com/Nelson1251/excavation-app/issues/20) | ⏳ planned |

## Phase 0 — In-flight fixes (owned by the current work on `main`)

These are being done right now in the main checkout; earthwork UI work waits for them to merge (it touches the same `Canvas.tsx`, `Toolbar.tsx` and store).

### P0-1 · Reliable PDF loading (pdf.js worker) — [#1](https://github.com/Nelson1251/excavation-app/issues/1)

*ES: Carga confiable del PDF (worker de pdf.js).*

Plans must open every time (dev server, production build, Windows `iniciar.bat`). In progress by the in-flight worker; tracked here so later phases can depend on it.

**Acceptance criteria**

- Sample plan and user-loaded PDFs render in `npm run dev` and in `npm run build && npm run preview` (Chrome, Edge, Firefox).
- No stale/missing worker errors in the console; a failed load shows a translated EN/ES error message instead of a blank canvas.
- `npm test`, `npm run lint`, `npm run build` pass.

### P0-2 · Feet mode shows zero metric units — [#2](https://github.com/Nelson1251/excavation-app/issues/2)

*ES: En modo Pies no se muestra ningún metro.*

Contractors working in US units must never see m, m², m³ or t. In progress by the in-flight worker.

**Acceptance criteria**

- With `Feet` selected, no visible string contains `m`, `m²`, `m³` or metric tonnes (toolbar, scale panel, zone list, modules, tooltips, canvas labels).
- Lengths in ft-in with fractions (1/8" display, 1/16" input), areas ft², volumes yd³, tonnage short tons.
- A test asserts the Feet formatters never emit metric units.

### P0-3 · Multi-page PDF navigation — [#3](https://github.com/Nelson1251/excavation-app/issues/3)

*ES: Navegación entre páginas del PDF.*

Plan sets have many sheets; the grading sheet is rarely page 1. Zones (and later surfaces) are stored per `pageIndex`. In progress by the in-flight worker.

**Acceptance criteria**

- Previous/next page controls and a page number field (`3 / 12`), EN/ES labels.
- Zones, calibration and (later) earthwork surfaces are shown only on their own page.
- Scale can be calibrated per page (different sheets can have different scales).

## Zone takeoff — done

### Z-1 · One zone with separate cut depth and fill depth — ✅ done (v0.4.1, [a3388b7](https://github.com/Nelson1251/excavation-app/commit/a3388b7))

*ES: Una misma zona con profundidad de corte y profundidad de relleno por separado.*

Before, a zone had one depth and a Cut/Fill type, so an area that is partly cut and partly filled had to be drawn
twice. Now every zone has `cutDepth` and `fillDepth` (non-negative magnitudes in meters; either may be 0).

- Zone editor: **Cut depth / Profundidad de corte** and **Fill depth / Profundidad de relleno** inputs (Meters, or
  Feet with ft-in fractions via `DistanceInput`). Badge Cut / Fill / Cut + Fill; plan color red / blue / purple.
- Per zone: cut volume = area × cutDepth (bank; loose with the soil swell), fill volume = area × fillDepth
  (compacted; material needed with the shrink, loose with the haul swell), signed net = cut − fill (cut +, fill −).
- Totals and truck trips add cut and fill separately across all zones and sheets.
- Migration (`migrarZona`, `src/lib/zones.ts`): old cut zone d → cutDepth d / fillDepth 0; old fill zone d →
  cutDepth 0 / fillDepth d (its manual swell becomes the fill haul swell). Applied in `addZone`/`updateZone`.
- Tests in `scripts/test-lib.mjs` (volumes, totals, migration, factors, store) and the Playwright drawing test.

## Phase 1 — Surface cut/fill

Trace existing grade and proposed grade (contours with elevations and/or spot elevations, optional breaklines) plus a site boundary; build surfaces (TIN with IDW fallback); grid-method volume: cut, fill, net, with swell/shrink from the existing soil / fill-material data. Topsoil stripping comes last in the phase.

### P1-1 · Earthwork data model, calculation library and store (scaffolding) — [#4](https://github.com/Nelson1251/excavation-app/issues/4)

*ES: Modelo de datos, librería de cálculo y store de superficies (base).*

Pure, tested foundation for surface-based cut/fill: `src/types/earthwork.ts`, `src/lib/earthwork/*`, `src/store/earthworkStore.ts`, `scripts/test-earthwork.mjs`. Not wired into the UI yet (see P1-2…P1-7). **Landed with this roadmap.**

**Acceptance criteria**

- Types: `Surface`, `ContourLine`, `SpotElevation`, `Breakline`, `Provenance` (manual / ai-suggested / imported; accepted / pending / rejected), `SiteBoundary`, `EarthworkGrid`.
- TIN (Delaunay) + IDW fallback surfaces; grid-method cut/fill/net with exact boundary clipping; only accepted features count.
- Swell/shrink via the existing soil / fill-material catalog; m³ ↔ yd³; heat map colors and RGBA pixel buffer.
- Tests: flat +1 m exact, sloped planes analytic, mixed cut/fill split and net, yd³, heat map thresholds, pending/rejected AI features ignored.

### P1-2 · Site boundary tool — [#5](https://github.com/Nelson1251/excavation-app/issues/5)

*ES: Herramienta para dibujar el límite del sitio.*

Volumes are computed only inside a boundary polygon (like Foreman's limits of grading).

**Acceptance criteria**

- New canvas tool *Site boundary* draws one polygon per page (click vertices, close on first point / double-click / Enter; Backspace, Esc like zone drawing).
- Self-intersecting polygons are rejected with an EN/ES message; the boundary can be edited (drag vertices) and deleted.
- Stored via `earthworkStore.setBoundary(pageIndex, points)`; area shown in m² or ft² per unit mode.

### P1-3 · Trace existing and proposed contours with elevations — [#6](https://github.com/Nelson1251/excavation-app/issues/6)

*ES: Trazar curvas de nivel existentes y propuestas con su elevación.*

Core Foreman workflow: click along each contour line and type its elevation once; the next contour auto-steps by the contour interval.

**Acceptance criteria**

- Toggle *Existing* / *Proposed* surface; *Contour* tool draws a polyline (open or closed) in PDF coordinates.
- Elevation prompt in m (Meters) or decimal ft (Feet) — stored in meters; next contour pre-filled with ± contour interval (`nextContourElevation`), interval editable.
- Existing contours drawn dashed, proposed solid, with distinct colors and elevation labels; select, edit elevation, move vertices, delete.
- All strings EN/ES; Feet mode shows no meters.

### P1-4 · Spot elevations (spot grades) — [#7](https://github.com/Nelson1251/excavation-app/issues/7)

*ES: Cotas puntuales (spot grades).*

Finished floor, pad corners, top/bottom of wall, inverts — point elevations that refine both surfaces.

**Acceptance criteria**

- *Spot* tool places a point with elevation and optional label (FF, TW, BW, PAD) on the active surface.
- Rendered as a cross + label; editable and deletable.
- Spots participate in the TIN (verified by a test: a single spot moves the computed volume as expected).

### P1-5 · Breaklines (curbs, toe/top of slope, walls) — [#8](https://github.com/Nelson1251/excavation-app/issues/8)

*ES: Líneas de quiebre (bordillos, pie/corona de talud, muros).*

Polylines with elevation per vertex so the surface follows hard edges.

**Acceptance criteria**

- *Breakline* tool with per-vertex elevation entry (or start/end elevation with linear interpolation).
- Vertices densified into the TIN (phase 1); constrained TIN edges are a documented follow-up.
- Test: a breakline between two plateaus produces the analytic prism volume within tolerance.

### P1-6 · Compute surfaces and cut/fill panel (grid method) — [#9](https://github.com/Nelson1251/excavation-app/issues/9)

*ES: Calcular superficies y panel de corte/relleno (método de malla).*

Build both surfaces, difference them inside the boundary: cut, fill, net — the numbers the contractor bids on.

**Acceptance criteria**

- *Compute* button (and auto-recompute on change, debounced) calls `earthworkStore.computeFor(pageIndex, metersPerPdfUnit)`.
- Panel shows Cut, Fill, Net (export/import) in m³ or yd³, boundary area in m²/ft², cell size (default suggested from area, editable in m or ft).
- Clear EN/ES messages for: no scale, no boundary, no existing/proposed features, grid too fine.
- Computation for a typical site (≤ 50 contours, ≤ 100k cells) finishes in < 1 s on a laptop (move to a Web Worker if needed).

### P1-7 · Swell/shrink and truck trips for surface cut/fill — [#10](https://github.com/Nelson1251/excavation-app/issues/10)

*ES: Abundamiento/contracción y viajes de camión para el corte/relleno por superficies.*

Reuse the existing soil types and fill materials so the surface result gives bank, loose and compacted yards like the zone takeoff.

**Acceptance criteria**

- Pick soil type (cut) and fill material (fill), or type manual %; priority manual → catalog → project default (`earthworkQuantities`).
- Shows cut bank / cut loose, fill compacted / material needed, net bank balance, import or export, and truck trips with the project truck capacity.
- Values in m³ or yd³ per unit mode; EN/ES.

### P1-8 · Topsoil stripping option — [#11](https://github.com/Nelson1251/excavation-app/issues/11)

*ES: Opción de descapote (retiro de tierra vegetal).*

Stripping depth over the boundary is its own pay item and lowers the existing surface before cut/fill.

**Acceptance criteria**

- Optional strip depth (m or ft-in) in settings (`EarthworkSettings.topsoilStripM`, already reserved).
- Reports stripping volume separately (area × depth, loose volume with topsoil swell) and computes cut/fill against existing − strip depth.
- Test with flat surfaces: strip 0.15 m over 200 m² = 30 m³ and fill increases by 30 m³.

## Phase 2 — Heat map overlay

Red = cut, blue = fill, green = within ± tolerance of grade; legend, adjustable ranges, opacity. The color function and the RGBA pixel buffer already exist (`src/lib/earthwork/heatmap.ts`); this phase draws them on the canvas.

### P2-1 · Cut/fill heat map overlay on the plan — [#12](https://github.com/Nelson1251/excavation-app/issues/12)

*ES: Mapa de calor de corte/relleno sobre el plano.*

Visual audit: red where the dirt comes out, blue where it goes in, green at grade — so the contractor can check the volume against the grading plan at a glance.

**Acceptance criteria**

- A Konva `Image` layer between the PDF and the zones draws `heatmapToCanvas(heatmapPixels(grid))` at `x/y/widthPdf/heightPdf`, `imageSmoothingEnabled=false`, clipped to the boundary (`clipFunc`), `listening=false`.
- Red = cut, blue = fill, green = |dz| ≤ tolerance; intensity scales with depth up to the max ranges.
- Toggle *Show heat map*; follows zoom/pan and page changes; redraws after each compute without freezing the UI.

### P2-2 · Heat map legend, adjustable ranges and opacity — [#13](https://github.com/Nelson1251/excavation-app/issues/13)

*ES: Leyenda, rangos ajustables y opacidad del mapa de calor.*

Contractors want to tune what counts as 'at grade' and how deep the reds/blues go.

**Acceptance criteria**

- Legend bar (from `heatmapLegend`) with labels in m or ft-in (`formatCutFillDepth`), EN/ES.
- Controls: tolerance (default 0.05 m ≈ 2"), max cut, max fill, opacity slider (0–100 %); values entered in m or ft-in and stored in meters.
- Settings persist with the project (see L-3).

### P2-3 · Cut/fill depth readout on hover — [#14](https://github.com/Nelson1251/excavation-app/issues/14)

*ES: Lectura de profundidad de corte/relleno al pasar el cursor.*

Point-check depths (e.g. at a pad corner) without leaving the plan.

**Acceptance criteria**

- Tooltip near the pointer with existing elevation, proposed elevation and cut/fill depth (`gridDzAt`, `formatElevation`, `formatCutFillDepth`).
- Feet mode: elevations in decimal ft, depth in ft-in with fractions; no meters.

## Phase 3 — AI-assisted suggestions

Auto-detect contours and elevation labels from the PDF and propose them as *pending* features; the user accepts or rejects. The data model already carries `provenance` (`source`, `confidence`, `status`, `createdAt`, `reviewedAt`) for this.

### P3-1 · AI: detect contours and elevation labels from the PDF — [#15](https://github.com/Nelson1251/excavation-app/issues/15)

*ES: IA: detectar curvas de nivel y etiquetas de elevación en el PDF.*

Most civil grading sheets are vector PDFs exported from CAD, so contours and their labels can be read directly — the AI proposes, the user decides.

**Acceptance criteria**

- From pdf.js `getOperatorList()` extract polylines on the grading sheet; classify dashed (existing) vs solid (proposed) by dash pattern / line width / color.
- From `getTextContent()` read numeric elevation labels (with rotation) and attach each to the nearest candidate polyline; check consistency with the contour interval.
- Output `ContourLine` / `SpotElevation` with `provenance.source = 'ai-suggested'`, `status = 'pending'`, `confidence` 0–1; nothing enters the volumes until accepted.
- Scanned/raster sheets: optional vision/OCR model behind the same interface (stretch).

### P3-2 · Review AI suggestions (accept / reject) — [#16](https://github.com/Nelson1251/excavation-app/issues/16)

*ES: Revisar sugerencias de la IA (aceptar / rechazar).*

Keeps the takeoff verifiable: every AI element is visible, reviewable and traceable.

**Acceptance criteria**

- Pending suggestions drawn in a distinct style (e.g. orange, semi-transparent) with confidence; list panel with filters by status/confidence.
- Accept / reject one, accept all above a confidence threshold, edit before accepting; `reviewedAt` recorded.
- Volumes and heat map update only with accepted features (already enforced and tested in the library).

## Later

### L-1 · Cross sections — [#17](https://github.com/Nelson1251/excavation-app/issues/17)

*ES: Secciones transversales.*

Draw a section line and see existing vs proposed profiles — standard check for earthwork bids.

**Acceptance criteria**

- Section tool draws a line; a chart shows existing and proposed profiles with cut/fill shading.
- Station and elevation axes in m or ft; EN/ES; export as PNG/PDF.

### L-2 · Reports and export (Excel / PDF) — [#18](https://github.com/Nelson1251/excavation-app/issues/18)

*ES: Reportes y exportación (Excel / PDF).*

Hand the numbers to the estimate and to the customer.

**Acceptance criteria**

- Excel (SheetJS) and PDF (pdf-lib) export with zones, surface cut/fill, swell/shrink, trucks, and a heat map snapshot with legend.
- Everything in the selected unit system and language.

### L-3 · Autosave and project files — [#19](https://github.com/Nelson1251/excavation-app/issues/19)

*ES: Guardado automático y archivos de proyecto.*

Protect hours of tracing.

**Acceptance criteria**

- Autosave project + earthwork store to IndexedDB (debounced); restore on reload.
- Save/open a project file (JSON with schema version; PDF referenced or embedded).

### L-4 · Undo / redo — [#20](https://github.com/Nelson1251/excavation-app/issues/20)

*ES: Deshacer / rehacer.*

Tracing tools need forgiving editing.

**Acceptance criteria**

- Ctrl+Z / Ctrl+Shift+Z (and buttons) for zones, calibration and all earthwork edits (add/move/delete/accept/reject).
- History limited (e.g. 100 steps) and cleared on project load.

## Next concrete step

Once the Phase 0 Canvas/Toolbar/store changes are merged on `main`: add the earthwork tools (boundary,
contour, spot) to the canvas by reading/writing `useEarthworkStore` (P1-2 → P1-4), add the Compute panel
(P1-6), then the heat map `Konva.Image` layer (P2-1). The library side needs no changes for that.
