# Cubicación de excavación · Corte y relleno

Aplicación web para la **cuantificación de volúmenes de movimiento de tierras (corte y relleno)** a partir de planos en PDF.
El usuario carga un plano, calibra la escala, dibuja zonas (polígonos) sobre un lienzo interactivo, asigna a cada zona
su tipo (corte o relleno) y su profundidad promedio, y obtiene áreas, volúmenes, balance neto, volúmenes con factores
de abundamiento/contracción y número de viajes de camión.

> Estado actual: **esqueleto del proyecto (fase 0)**. Funciona la carga y visualización del PDF con zoom y paneo;
> la calibración y el dibujo de zonas están preparados como stubs.

## Stack

| Área | Herramienta |
| --- | --- |
| UI | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Estado | Zustand |
| Render de PDF | pdfjs-dist (pdf.js) |
| Lienzo interactivo | Konva + react-konva |
| Geometría | @turf/turf |
| Exportar a Excel | xlsx (SheetJS, instalado desde el CDN oficial `cdn.sheetjs.com`) |
| Generar/editar PDF | pdf-lib |

## Estructura de carpetas

```
excavation-app/
├── public/
│   ├── favicon.svg
│   └── sample-plan.pdf          # plano de prueba 1:500 (generado con pdf-lib)
├── scripts/
│   └── make-sample-pdf.mjs      # genera public/sample-plan.pdf
├── src/
│   ├── components/
│   │   ├── Canvas.tsx           # Stage de Konva: capa PDF + capa de zonas; zoom con rueda y paneo
│   │   ├── Toolbar.tsx          # Cargar PDF, Calibrar escala, Dibujar zona, Zoom +/-
│   │   ├── ZoneList.tsx         # lista de zonas y totales
│   │   └── ScaleCalibration.tsx # panel de calibración (stub)
│   ├── lib/
│   │   ├── geometry.ts          # área por shoelace, conversión unidades PDF → metros
│   │   ├── volumes.ts           # volumen por zona y totales (corte, relleno, neto)
│   │   └── factors.ts           # abundamiento, contracción, viajes de camión
│   ├── store/
│   │   └── projectStore.ts      # estado global (Zustand)
│   ├── types/
│   │   └── index.ts             # Point, Zone, Factors, ProjectState…
│   ├── App.tsx                  # diseño: barra superior, lienzo, panel lateral
│   ├── index.css                # Tailwind
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig*.json
└── vite.config.ts
```

## Conceptos clave

- **Unidades PDF**: el lienzo trabaja en unidades PDF (1 u = 1/72 de pulgada en papel). Los polígonos se guardan en
  estas unidades, independientes del zoom.
- **Escala** (`metersPerPdfUnit`): metros reales por unidad PDF. Un plano 1:500 impreso a tamaño real equivale a
  `500 × 0.0254 / 72 ≈ 0.1764 m/u`. Las áreas se convierten con la escala al cuadrado.
- **Volumen** de una zona = área (m²) × profundidad promedio (m).
- **Factores**: volumen suelto = banco × (1 + abundamiento); material para relleno = compactado / (1 − contracción);
  viajes = ⌈suelto / capacidad del camión⌉.

## Requisitos

- Node.js **20.19+** (o 22.12+) y npm.
- Navegador moderno (Chrome, Edge, Firefox o Safari recientes).

## Comandos

```bash
npm install          # instalar dependencias
npm run dev          # servidor de desarrollo (http://localhost:5173)
npm run build        # verificación de tipos + compilación de producción en dist/
npm run preview      # servir la compilación de producción
npm run sample-pdf   # regenerar public/sample-plan.pdf
```

Al abrir la app se carga por defecto `/sample-plan.pdf`. Usa **Cargar PDF** para abrir un plano propio.
Rueda del ratón = zoom sobre el puntero; arrastrar = desplazar el plano.

## Próximos pasos (fases)

1. **Fase 1 – Calibración de escala**: trazar una línea sobre una distancia conocida (p. ej. la barra de 20 m),
   capturar la distancia real y calcular `metersPerPdfUnit`. Opción de escala 1:N directa.
2. **Fase 2 – Dibujo de zonas**: dibujar polígonos con clics en la capa superior, cerrar con doble clic,
   editar vértices, validar auto-intersecciones (Turf), colores por tipo (corte/relleno).
3. **Fase 3 – Propiedades y cálculo**: editar nombre, tipo y profundidad por zona; editar factores; soporte para
   varias páginas y descuento de huecos.
4. **Fase 4 – Exportación**: reporte en Excel (SheetJS) y PDF anotado con las zonas y la tabla de volúmenes (pdf-lib).
5. **Fase 5 – Persistencia**: guardar/abrir proyectos (JSON / IndexedDB) y deshacer/rehacer.
6. **Fase 6 – Métodos avanzados**: profundidad variable por vértices, secciones transversales, malla de cotas
   (terreno natural vs. proyecto).
