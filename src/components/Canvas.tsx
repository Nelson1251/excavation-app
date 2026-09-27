// Lienzo interactivo: muestra la página del PDF como imagen de Konva y, encima, la capa de
// dibujo (zonas, polígono en curso y línea de calibración). Herramientas: Navegar (paneo),
// Calibrar escala (dos puntos) y Dibujar zona (clics = polígono, arrastre = rectángulo).
import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
// Versión "legacy" de pdf.js: trae polyfills para navegadores que no están al día (la moderna usa
// APIs de JavaScript muy recientes y falla en Chrome/Edge sin actualizar).
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useProjectStore } from '../store/projectStore';
import { useT } from '../i18n/useT';
import { polygonAreaM2, rectFromDrag } from '../lib/geometry';
import { formatearArea } from '../lib/units';
import type { PdfSource } from '../types';
import { claveAyudaErrorPdf, claveAyudaLienzo, type EstadoPlano } from '../lib/canvasHint';
import CalibrationPrompt from './CalibrationPrompt';
import DrawingLayer from './DrawingLayer';
import { useCanvasTools } from './useCanvasTools';

// El worker se sirve desde una URL fija del mismo origen (plugin pdfWorker en vite.config.ts).
pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;

/** Resolución de rasterizado del PDF (píxeles por unidad PDF). Más alto = más nítido al hacer zoom. */
const RENDER_SCALE = Math.min(3, 2 * (window.devicePixelRatio || 1));
const MARGEN_AJUSTE = 32;
const FACTOR_RUEDA = 1.1;

/** Resultado del último rasterizado, asociado al origen y la página que lo produjeron. */
type Resultado = {
  fuente: PdfSource;
  pageIndex: number;
  /** Canvas fuera de pantalla con la página rasterizada. */
  imagen: HTMLCanvasElement | null;
  /** Tamaño de la página en unidades PDF. */
  pagina: { ancho: number; alto: number };
  error: string | null;
};

export default function Canvas() {
  const t = useT();
  const contenedorRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const pdfSource = useProjectStore((s) => s.pdfSource);
  const pageIndex = useProjectStore((s) => s.pageIndex);
  const vista = useProjectStore((s) => s.vista);
  const tamano = useProjectStore((s) => s.tamanoLienzo);
  const herramienta = useProjectStore((s) => s.herramienta);
  const setVista = useProjectStore((s) => s.setVista);
  const setTamanoLienzo = useProjectStore((s) => s.setTamanoLienzo);
  const setNumPaginas = useProjectStore((s) => s.setNumPaginas);
  const metersPerPdfUnit = useProjectStore((s) => s.metersPerPdfUnit);
  const sistema = useProjectStore((s) => s.sistemaUnidades);

  const puntosCalibracion = useProjectStore((s) => s.puntosCalibracion);

  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Observar el tamaño del contenedor para dimensionar el Stage.
  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;
      setTamanoLienzo(Math.floor(width), Math.floor(height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setTamanoLienzo]);

  // Cargar y rasterizar la página del PDF cuando cambia el origen o la página.
  useEffect(() => {
    if (!pdfSource) return;
    let cancelado = false;
    let renderTask: ReturnType<pdfjsLib.PDFPageProxy['render']> | null = null;
    const loadingTask = pdfjsLib.getDocument({ url: pdfSource.url });

    (async () => {
      try {
        const doc = await loadingTask.promise;
        if (cancelado) return;
        setNumPaginas(doc.numPages);
        const page = await doc.getPage(Math.min(pageIndex, doc.numPages - 1) + 1);
        const viewportBase = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: RENDER_SCALE });

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;
        if (cancelado) return;

        setResultado({
          fuente: pdfSource,
          pageIndex,
          imagen: canvas,
          pagina: { ancho: viewportBase.width, alto: viewportBase.height },
          error: null,
        });
      } catch (err) {
        if (cancelado) return;
        console.error(err);
        setResultado({
          fuente: pdfSource,
          pageIndex,
          imagen: null,
          pagina: { ancho: 0, alto: 0 },
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelado = true;
      renderTask?.cancel();
      void loadingTask.destroy();
    };
  }, [pdfSource, pageIndex, setNumPaginas]);

  // Estado derivado: el resultado solo es vigente si corresponde al origen y página actuales.
  const vigente = resultado !== null && resultado.fuente === pdfSource && resultado.pageIndex === pageIndex;
  const estado: EstadoPlano = !pdfSource ? 'vacio' : !vigente ? 'cargando' : resultado.error ? 'error' : 'listo';
  // Las herramientas solo registran clics cuando hay una página dibujada.
  const { puntos, rect, cursor, aviso, handlers, limpiarCursor } = useCanvasTools(stageRef, estado === 'listo');
  const claveAyuda = claveAyudaLienzo(herramienta, estado, puntosCalibracion.length);
  // Mientras carga un PDF nuevo se sigue mostrando el anterior.
  const imagen = resultado?.imagen ?? null;
  const pagina = resultado?.pagina ?? { ancho: 0, alto: 0 };

  // Ajustar la página a la vista al cargar un PDF nuevo (o cuando el lienzo toma tamaño).
  const listoParaAjustar = estado === 'listo' && tamano.ancho > 0 && tamano.alto > 0;
  useEffect(() => {
    if (!listoParaAjustar || !resultado) return;
    const { ancho: pw, alto: ph } = resultado.pagina;
    if (pw === 0) return;
    const { ancho, alto } = useProjectStore.getState().tamanoLienzo;
    const zoom = Math.min((ancho - MARGEN_AJUSTE * 2) / pw, (alto - MARGEN_AJUSTE * 2) / ph);
    setVista({ zoom, x: (ancho - pw * zoom) / 2, y: (alto - ph * zoom) / 2 });
  }, [listoParaAjustar, resultado, setVista]);

  // Zoom con la rueda del ratón, centrado en el puntero.
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const puntero = stage?.getPointerPosition();
    if (!stage || !puntero) return;
    const { zoom, x, y } = useProjectStore.getState().vista;
    const puntoPlano = { x: (puntero.x - x) / zoom, y: (puntero.y - y) / zoom };
    const nuevoZoom = e.evt.deltaY > 0 ? zoom / FACTOR_RUEDA : zoom * FACTOR_RUEDA;
    setVista({ zoom: nuevoZoom });
    const z = useProjectStore.getState().vista.zoom; // ya limitado por el store
    setVista({ x: puntero.x - puntoPlano.x * z, y: puntero.y - puntoPlano.y * z });
  };

  const onDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Solo el Stage se arrastra (paneo); ignorar arrastres de figuras hijas.
    if (e.target === stageRef.current) setVista({ x: e.target.x(), y: e.target.y() });
  };

  // Área en vivo del borrador (rectángulo en arrastre o polígono + cursor), si hay escala.
  const borrador = rect ? rectFromDrag(rect.a, rect.b) : cursor && puntos.length >= 2 ? [...puntos, cursor] : null;
  const areaBorrador = borrador && metersPerPdfUnit ? formatearArea(polygonAreaM2(borrador, metersPerPdfUnit), sistema) : null;

  return (
    // touch-action: none → el navegador no desplaza ni hace zoom de la página al dibujar con el dedo o lápiz.
    <div ref={contenedorRef} className="relative h-full w-full touch-none overflow-hidden bg-slate-950">
      {tamano.ancho > 0 && (
        <Stage
          ref={stageRef}
          width={tamano.ancho}
          height={tamano.alto}
          x={vista.x}
          y={vista.y}
          scaleX={vista.zoom}
          scaleY={vista.zoom}
          draggable={herramienta === 'navegar'}
          onWheel={onWheel}
          onDragMove={onDrag}
          onDragEnd={onDrag}
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlers.onPointerUp}
          onPointerCancel={handlers.onPointerCancel}
          onPointerLeave={limpiarCursor}
          onContextMenu={(e) => {
            if (herramienta !== 'navegar') e.evt.preventDefault();
          }}
          className={herramienta === 'navegar' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}
        >
          {/* Capa inferior: plano PDF (coordenadas = unidades PDF) */}
          <Layer listening={false}>
            {imagen && (
              <>
                <Rect
                  width={pagina.ancho}
                  height={pagina.alto}
                  fill="white"
                  shadowColor="black"
                  shadowBlur={20}
                  shadowOpacity={0.5}
                />
                <KonvaImage image={imagen} width={pagina.ancho} height={pagina.alto} />
              </>
            )}
          </Layer>
          {/* Capa superior: zonas, borrador y línea de calibración (coordenadas = unidades PDF). */}
          <DrawingLayer puntos={puntos} rect={rect} cursor={cursor} />
        </Stage>
      )}

      {/* Mensajes de estado */}
      {estado !== 'listo' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg bg-slate-800/90 px-4 py-2 text-sm text-slate-200 shadow">
            {estado === 'vacio' && t('canvas.empty')}
            {estado === 'cargando' && t('canvas.loading')}
            {estado === 'error' && (
              <span className="block max-w-xl text-red-300">
                {t('canvas.error', { message: resultado?.error ?? '' })}
                <span className="mt-1 block text-xs text-slate-300">{t(claveAyudaErrorPdf(resultado?.error ?? ''))}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Marco de color mientras una herramienta está activa (cian = calibrar, ámbar = dibujar). */}
      {herramienta !== 'navegar' && (
        <div
          className={`pointer-events-none absolute inset-0 border-4 ${
            herramienta === 'calibrar' ? 'border-cyan-400/80' : 'border-amber-400/80'
          }`}
        />
      )}

      {/* Instrucciones de la herramienta activa (siempre visibles, también sin plano). */}
      {claveAyuda && (
        <div
          className="pointer-events-none absolute left-1/2 top-3 flex max-w-[92%] -translate-x-1/2 flex-col items-center gap-1.5 text-center"
          data-testid="canvas-hint"
        >
          <div
            role="status"
            className={`rounded-md px-4 py-2 text-sm font-semibold shadow-lg ${
              claveAyuda === 'canvas.needPdf'
                ? 'bg-red-600 text-white'
                : herramienta === 'calibrar'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-amber-400 text-slate-950'
            }`}
          >
            {t(claveAyuda)}
          </div>
          {herramienta === 'calibrar' && estado === 'listo' && puntosCalibracion.length === 2 && <CalibrationPrompt />}
          {herramienta === 'dibujar' && estado === 'listo' && !metersPerPdfUnit && (
            <div role="status" className="rounded-md bg-slate-800/95 px-3 py-1.5 text-xs font-medium text-amber-300 shadow">
              {t('canvas.warn.noScale')}
            </div>
          )}
          {aviso && (
            <div role="alert" className="rounded-md bg-red-600/95 px-3 py-1.5 text-xs font-medium text-white shadow">
              {t(aviso)}
            </div>
          )}
          {areaBorrador && (
            <div className="rounded-md bg-slate-900/90 px-2 py-1 text-xs tabular-nums text-amber-300 shadow">
              {t('canvas.draftArea', { area: areaBorrador })}
            </div>
          )}
        </div>
      )}

      {/* Barra de estado */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-between bg-slate-900/80 px-3 py-1 text-xs text-slate-400">
        <span>
          {pdfSource?.nombre ?? t('canvas.noPdf')}
          {pagina.ancho > 0 && ` · ${pagina.ancho.toFixed(0)} × ${pagina.alto.toFixed(0)} ${t('canvas.pdfUnits')}`}
        </span>
        <span>
          {cursor ? `x: ${cursor.x.toFixed(1)}  y: ${cursor.y.toFixed(1)} (${t('canvas.pdfUnits')})` : '—'} ·{' '}
          {t('canvas.zoom')} {(vista.zoom * 100).toFixed(0)} %
        </span>
      </div>
    </div>
  );
}
