# Excavation takeoff · Cut and fill

Web app for **earthwork quantity takeoff (cut and fill)** from PDF plans, plus simple **concrete** and **asphalt**
quantity modules. The user loads a plan, calibrates the scale, draws zones (polygons) on an interactive canvas,
assigns each zone its kind (cut or fill), depth, soil type / fill material, and gets areas, bank / loose / compacted
volumes, material needed, net balance and truck trips.

> Current status: **project skeleton (phase 0) + units, i18n, soils/fill materials, concrete and asphalt modules**.
> PDF loading/zoom/pan works; scale calibration and zone drawing are still stubs. Excel/PDF export is not implemented
> yet (see "Next steps").

## Usage

- **Language**: `EN | ES` toggle in the top bar (default English). Saved in `localStorage`
  (`excavation-app:language-v2`; the old `excavation-app:language` key is ignored and removed so everyone starts
  in English once). Updates the page `<title>` and `<html lang>`.
- **Version tag**: small `v0.3.0 · <commit> · <date>` text at the right of the top bar shows which build is running.
- **Units**: `Meters | Feet` toggle in the top bar (default Meters). Saved in `localStorage`
  (`excavation-app:sistemaUnidades`). Everything is stored internally in meters / m² / m³.
  - Meters: lengths in m, areas in m², volumes in m³.
  - Feet: no metric units are shown. Lengths as feet-inches rounded to the nearest 1/8" with reduced fractions
    (e.g. `65' 7 3/8"`, `3' 6 1/2"`, `0' 8"`), areas in ft², volumes in yd³ (cubic yards), asphalt density in
    lb/ft³ and tonnage in US short tons.
  - Distance inputs: one numeric field in Meters mode; in Feet mode a **ft** field (whole numbers) and an **in**
    text field that takes fractions like tradespeople write them: `7`, `3/4`, `5/8`, `1/16`, `7 1/2`, `7-1/2`,
    `11 15/16` (denominators 2, 4, 8, 16; a plain decimal such as `7.5` is also accepted). 12 or more inches are
    carried into feet when the field loses focus. Stored values load back as fractions to 1/16 (e.g. `7 3/8`).
- **Modules** (tabs in the top bar):
  - **Earthwork**: PDF plan + zone list. Cut zones have a *Soil type* (drives the zone's *Swell %*, editable);
    fill zones have a *Fill material* (drives *Compaction shrink %*, editable). Per zone: Bank volume, Loose volume,
    Compacted volume and Material needed. Truck trips use loose volumes.
  - **Concrete**: sidewalks, columns (rectangular or round), slabs/floors, footings, beams, walls. Quantity,
    dimensions, waste % (default 5 %) and notes. Shows net volume and **Order volume (incl. waste)**.
  - **Asphalt**: road, parking lot, sidewalk topping, driveway, patch/other. Area, net volume, order volume and
    tonnage using an editable compacted density (default 2.35 t/m³ ≈ 146.7 lb/ft³, hot-mix asphalt).
- Mouse wheel = zoom at the pointer; drag = pan the plan. **Load PDF** opens your own plan
  (`/sample-plan.pdf` is loaded by default).

## Stack

| Area | Tool |
| --- | --- |
| UI | React 19 + TypeScript + Vite |
| Styles | Tailwind CSS v4 (`@tailwindcss/vite`) |
| State | Zustand |
| PDF rendering | pdfjs-dist (pdf.js) |
| Interactive canvas | Konva + react-konva |
| Geometry | @turf/turf |
| Excel export | xlsx (SheetJS, from the official CDN `cdn.sheetjs.com`) |
| PDF generation | pdf-lib |

## Folder structure

```
src/
├── components/
│   ├── Canvas.tsx            # Konva stage: PDF layer + zones layer; wheel zoom and pan
│   ├── Toolbar.tsx           # module tabs, Load PDF, Calibrate, Draw zone, zoom, Meters|Feet, EN|ES
│   ├── ZoneList.tsx          # zones (soil / fill material, swell, shrink, volumes) and totals
│   ├── ScaleCalibration.tsx  # calibration panel (stub)
│   ├── DistanceInput.tsx     # distance input: meters field or ft + in fields
│   └── modules/              # ConcretePanel, AsphaltPanel and shared ElementFields
├── i18n/                     # en.ts (keys), es.ts (same keys, type-checked), index.ts (t), useT.ts (hook)
├── lib/
│   ├── units.ts              # unit conversion and formatting (ft-in, ft², yd³, short tons…)
│   ├── soils.ts              # soil types (swell) and fill materials (shrink) with documented ranges
│   ├── geometry.ts           # shoelace area, PDF units → meters
│   ├── volumes.ts            # zone volumes (bank / compacted / material needed / loose) and totals
│   ├── factors.ts            # swell, shrink, truck trips
│   ├── concrete.ts           # concrete volumes
│   └── asphalt.ts            # asphalt area, volume and tonnage
├── store/projectStore.ts     # global state (Zustand)
└── types/index.ts
```

## Key concepts

- **PDF units**: the canvas works in PDF units (1 u = 1/72 inch on paper), independent of zoom.
- **Scale** (`metersPerPdfUnit`): real meters per PDF unit. A 1:500 plan printed at full size equals
  `500 × 0.0254 / 72 ≈ 0.1764 m/u`.
- **Zone volume** = area (m²) × average depth (m).
- **Factors**: loose = bank × (1 + swell); material needed = compacted / (1 − shrink);
  trips = ⌈loose / truck capacity⌉. Swell/shrink come from the zone's manual value, else its soil type / fill
  material (midpoint of a documented typical range, see `src/lib/soils.ts`), else the project default
  (25 % swell, 10 % shrink).

On Windows, double-click `iniciar.bat`: it installs dependencies if needed and runs `npm run dev -- --open`, so the
browser opens on the port Vite actually got (5173, or 5174 if an older server is still running — close old windows
first).

## Requirements

- Node.js **20.19+** (or 22.12+) and npm.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server (http://localhost:5173)
npm run build        # type check + production build into dist/
npm run lint         # oxlint
npm test             # quick checks of the pure modules (units, soils, volumes, concrete, asphalt, i18n)
npm run preview      # serve the production build
npm run sample-pdf   # regenerate public/sample-plan.pdf (English labels, metric 1:500 plan)
```

## Next steps

1. Scale calibration on the canvas (two points over a known distance).
2. Zone drawing (polygons, vertex editing, Turf self-intersection check).
3. Editable project factors; multiple pages; holes.
4. Export: Excel (SheetJS) and annotated PDF (pdf-lib) — zones, concrete and asphalt sheets, translated via `t()`.
5. Project persistence (JSON / IndexedDB) and undo/redo.
