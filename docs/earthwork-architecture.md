# Earthwork by surfaces · architecture notes

> ES: Notas técnicas del corte/relleno por superficies y del mapa de calor. El código está en
> `src/types/earthwork.ts`, `src/lib/earthwork/`, `src/store/earthworkStore.ts`; pruebas en
> `scripts/test-earthwork.mjs` (se corren con `npm test`). Aún no está conectado al lienzo.

See [ROADMAP.md](../ROADMAP.md) for phases and issues.

## Files

| File | What it is |
| --- | --- |
| `src/types/earthwork.ts` | Data model: `Surface`, `ContourLine`, `SpotElevation`, `Breakline`, `Provenance`, `SiteBoundary`, `EarthworkGrid`, `HeatmapOptions`, `EarthworkSettings`. |
| `src/lib/earthwork/delaunay.ts` | Dependency-free Bowyer–Watson Delaunay triangulation. |
| `src/lib/earthwork/surface.ts` | Accepted features → 3D points (contours/breaklines densified) → TIN with linear interpolation; IDW fallback outside the TIN or with < 3 points. |
| `src/lib/earthwork/grid.ts` | Grid-method cut/fill inside the boundary, exact boundary clipping per cell, `gridDzAt`, `suggestCellSizeM`. |
| `src/lib/earthwork/quantities.ts` | Swell/shrink (reuses `src/lib/soils.ts` + `factors.ts`), trucks, m³ ↔ yd³, elevation / depth formatting. |
| `src/lib/earthwork/heatmap.ts` | `heatColor(dz)`, `heatmapLegend`, `heatmapPixels(grid)` (RGBA buffer), `heatmapToCanvas` (browser). |
| `src/lib/earthwork/features.ts` | Factories (`makeContour`, `makeSpot`, `makeBreakline`, `makeProvenance`), `withStatus`, `nextContourElevation`, `countByStatus`. |
| `src/store/earthworkStore.ts` | Standalone zustand store (surfaces, boundaries, settings, tool, last grid, error code). Not imported anywhere yet. |
| `scripts/test-earthwork.mjs` | Tests (part of `npm test`). |
| `scripts/earthwork-demo.mjs` | `npm run earthwork-demo [-- out.png]` renders a synthetic heat map PNG (default `/workspace/heatmap-demo.png`). |

## Conventions

- Coordinates: PDF units of the page (same as `Point` everywhere else); scale = `metersPerPdfUnit` from
  `projectStore`.
- Elevations, depths, cell size, tolerances: **meters** internally. Display: Meters → m; Feet → decimal ft for
  elevations (`formatElevation`), ft-in with fractions for depths (`formatCutFillDepth`), yd³ for volumes.
- dz = proposed − existing. `dz < 0` cut, `dz > 0` fill. `net = cut − fill`.
- Only `provenance.status === 'accepted'` features are used (`isAccepted`). Manual/imported features are
  created accepted; AI suggestions are created `pending`.

## Algorithm

1. **Points** — accepted spots as-is; contours and breaklines densified so no segment exceeds `densifyM`
   (default = cell size); duplicates merged (elevations averaged).
2. **TIN** — Delaunay triangulation; each sample is linear inside its triangle (bucket-grid point location).
   Outside the TIN (boundary drawn beyond the traced lines) → IDW with the 12 nearest points, power 2.
3. **Grid** — square cells of `cellSizeM` over the boundary's bounding box. Each cell is clipped against the
   boundary polygon (Sutherland–Hodgman, row strip first), giving the exact inside area and its centroid.
   Both surfaces are sampled at that centroid: `volume = area × dz`. For planar surfaces this is exact as
   long as dz keeps its sign inside the cell; the net is exact for any linear dz.
4. **Quantities** — cut = bank; fill = compacted; material needed = fill / (1 − shrink); loose = bank × (1 + swell);
   priority manual → catalog (soil type / fill material) → project default, identical to zones.

Known limits (documented follow-ups): contours are not enforced as TIN edges (flat triangles can appear where
three vertices lie on the same contour — add spots/breaklines, later constrained TIN); IDW search is linear
(fine for typical sites, index it if needed); Bowyer–Watson is O(n²) worst case (~5k points in ~0.3 s; switch
to `delaunator` if plans get much denser); cells straddling dz = 0 assign their whole volume to one side
(split error shrinks with cell size; net unaffected).

## Wiring plan (after the in-flight Canvas work merges)

1. `Toolbar`: *Earthwork surfaces* tool group → `useEarthworkStore.setTool('boundary' | 'contour' | 'spot' | 'breakline')`
   and *Existing / Proposed* toggle (`setActiveKind`).
2. `Canvas` / `useCanvasTools`: reuse the zone polyline drawing for boundary/contours; on finish call
   `setBoundary(pageIndex, pts)` or `addFeature(activeKind, pageIndex, makeContour(pts, elevationM))`.
3. New `EarthworkLayer.tsx` (Konva `Layer`): boundary, contours (existing dashed, proposed solid), spots, pending
   AI suggestions; and the heat map `Image` (`heatmapToCanvas(heatmapPixels(grid, settings.heatmap))`,
   positioned at `x, y, widthPdf, heightPdf`, `imageSmoothingEnabled={false}`, `clipFunc` = boundary).
4. New `EarthworkPanel.tsx`: compute button, totals (`totalsInUnits`, `earthworkQuantities`), cell size, legend and
   heat map controls. Error codes from the store (`noScale`, `noBoundary`, `noExisting`, `noProposed`,
   `tooManyCells`) map to i18n keys `earthwork.err.<code>`.

## Draft i18n keys (add to both `en.ts` and `es.ts` when wiring)

| Key | EN | ES |
| --- | --- | --- |
| `earthwork.title` | Surface cut/fill | Corte/relleno por superficies |
| `earthwork.existing` | Existing grade | Terreno existente |
| `earthwork.proposed` | Proposed grade | Rasante proyectada |
| `earthwork.tool.boundary` | Site boundary | Límite del sitio |
| `earthwork.tool.contour` | Contour | Curva de nivel |
| `earthwork.tool.spot` | Spot elevation | Cota |
| `earthwork.tool.breakline` | Breakline | Línea de quiebre |
| `earthwork.elevation` | Elevation | Elevación |
| `earthwork.contourInterval` | Contour interval | Intervalo de curvas |
| `earthwork.cellSize` | Grid cell size | Tamaño de celda |
| `earthwork.compute` | Compute cut/fill | Calcular corte/relleno |
| `earthwork.cut` | Cut | Corte |
| `earthwork.fill` | Fill | Relleno |
| `earthwork.net` | Net | Neto |
| `earthwork.export` | Export | Sobrante (exportar) |
| `earthwork.import` | Import | Faltante (importar) |
| `earthwork.heatmap` | Heat map | Mapa de calor |
| `earthwork.tolerance` | On-grade tolerance | Tolerancia a rasante |
| `earthwork.opacity` | Opacity | Opacidad |
| `earthwork.onGrade` | On grade | A rasante |
| `earthwork.ai.pending` | Suggested (pending review) | Sugerido (pendiente de revisar) |
| `earthwork.ai.accept` | Accept | Aceptar |
| `earthwork.ai.reject` | Reject | Rechazar |
| `earthwork.err.noScale` | Calibrate the scale first. | Primero calibra la escala. |
| `earthwork.err.noBoundary` | Draw the site boundary. | Dibuja el límite del sitio. |
| `earthwork.err.noExisting` | Trace the existing grade (contours or spots). | Traza el terreno existente (curvas o cotas). |
| `earthwork.err.noProposed` | Trace the proposed grade (contours or spots). | Traza la rasante proyectada (curvas o cotas). |
| `earthwork.err.tooManyCells` | Grid too fine: use a larger cell size. | Malla demasiado fina: usa celdas más grandes. |
