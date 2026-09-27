// Interacción del lienzo para las herramientas Calibrar y Dibujar zona.
// Usa eventos de puntero (ratón, táctil y lápiz) y convierte las coordenadas de pantalla a
// unidades PDF con stage.getRelativePointerPosition(), que aplica la inversa del paneo/zoom.
import { useEffect, useRef, useState, type RefObject } from 'react';
import type Konva from 'konva';
import { useProjectStore } from '../store/projectStore';
import {
  CLOSE_RADIUS_PX,
  distance,
  isDrag,
  isSimplePolygon,
  planToScreen,
  rectFromDrag,
  shoelaceArea,
} from '../lib/geometry';
import { piesAMetros } from '../lib/units';
import type { Point } from '../types';

/** Aviso (clave i18n) que se muestra cuando no se puede cerrar una zona. */
export type AvisoDibujo = 'canvas.err.selfIntersect' | 'canvas.err.tooSmall' | null;

/** Dos clics más cercanos que esto (tiempo y distancia en pantalla) cuentan como doble clic. */
const DOBLE_CLIC_MS = 400;
const DOBLE_CLIC_PX = 8;
/** Área mínima de una zona en px² de pantalla (evita zonas creadas por error). */
const AREA_MIN_PX2 = 16;

type Posicion = { pantalla: Point; plano: Point };
type Presion = Posicion & { pointerId: number; arrastre: boolean };
type Paneo = { pointerId: number; inicio: Point; vista: { x: number; y: number } };

type EventoPuntero = Konva.KonvaEventObject<PointerEvent>;

export function useCanvasTools(stageRef: RefObject<Konva.Stage | null>, planListo: boolean) {
  const herramienta = useProjectStore((s) => s.herramienta);

  // Borrador: vértices del polígono en curso (unidades PDF), rectángulo en arrastre y cursor.
  // Los refs reflejan el estado de forma síncrona para eventos muy seguidos (doble clic).
  const [puntos, setPuntosEstado] = useState<Point[]>([]);
  const puntosRef = useRef<Point[]>([]);
  const [rect, setRect] = useState<{ a: Point; b: Point } | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [aviso, setAviso] = useState<AvisoDibujo>(null);
  const presion = useRef<Presion | null>(null);
  const paneo = useRef<Paneo | null>(null);
  const ultimoClic = useRef<{ t: number; pantalla: Point } | null>(null);

  const setPuntos = (p: Point[]) => {
    puntosRef.current = p;
    setPuntosEstado(p);
  };

  // Al cambiar de herramienta se descarta el borrador (patrón "ajustar estado al renderizar").
  const [herramientaPrevia, setHerramientaPrevia] = useState(herramienta);
  if (herramienta !== herramientaPrevia) {
    setHerramientaPrevia(herramienta);
    setPuntosEstado([]);
    setRect(null);
    setAviso(null);
  }
  useEffect(() => {
    puntosRef.current = [];
    presion.current = null;
    ultimoClic.current = null;
  }, [herramienta]);

  const posicion = (): Posicion | null => {
    const stage = stageRef.current;
    const pantalla = stage?.getPointerPosition();
    const plano = stage?.getRelativePointerPosition();
    return pantalla && plano ? { pantalla: { ...pantalla }, plano: { x: plano.x, y: plano.y } } : null;
  };

  const crearZona = (pts: Point[]) => {
    const { zoom } = useProjectStore.getState().vista;
    if (shoelaceArea(pts) * zoom * zoom < AREA_MIN_PX2) {
      setAviso('canvas.err.tooSmall');
      return false;
    }
    if (!isSimplePolygon(pts)) {
      setAviso('canvas.err.selfIntersect');
      return false;
    }
    const { addZone, setZonaSeleccionada, sistemaUnidades } = useProjectStore.getState();
    // Profundidad inicial redonda en el sistema actual (1 m o 3 ft); el usuario la ajusta en la lista.
    const profundidad = sistemaUnidades === 'imperial' ? piesAMetros(3) : 1;
    const id = addZone({ nombre: '', tipo: 'corte', puntos: pts, profundidad });
    setZonaSeleccionada(id);
    setAviso(null);
    return true;
  };

  const cerrarPoligono = () => {
    const pts = puntosRef.current;
    if (pts.length < 3) return;
    if (crearZona(pts)) setPuntos([]);
  };

  const clicDibujo = (pos: Posicion) => {
    const pts = puntosRef.current;
    const { vista } = useProjectStore.getState();
    const ahora = performance.now();
    const u = ultimoClic.current;
    const doble = u !== null && ahora - u.t < DOBLE_CLIC_MS && distance(u.pantalla, pos.pantalla) < DOBLE_CLIC_PX;
    ultimoClic.current = doble ? null : { t: ahora, pantalla: pos.pantalla };
    // Doble clic: el primer clic ya agregó el vértice; el segundo cierra el polígono.
    if (doble) {
      cerrarPoligono();
      return;
    }
    // Clic sobre el primer vértice: cerrar.
    if (pts.length >= 3 && distance(planToScreen(pts[0], vista), pos.pantalla) <= CLOSE_RADIUS_PX) {
      cerrarPoligono();
      return;
    }
    const ultimo = pts[pts.length - 1];
    if (ultimo && distance(planToScreen(ultimo, vista), pos.pantalla) < 2) return; // sin vértices repetidos
    setAviso(null);
    setPuntos([...pts, pos.plano]);
  };

  const onPointerDown = (e: EventoPuntero) => {
    const ev = e.evt;
    if (!ev.isPrimary) return;
    const pos = posicion();
    if (!pos) return;
    // Botón central del ratón: paneo con cualquier herramienta.
    if (ev.pointerType === 'mouse' && ev.button === 1) {
      ev.preventDefault();
      const { x, y } = useProjectStore.getState().vista;
      paneo.current = { pointerId: ev.pointerId, inicio: pos.pantalla, vista: { x, y } };
      return;
    }
    // Sin página dibujada no se registran puntos (el lienzo muestra "Carga un PDF primero").
    if (herramienta === 'navegar' || !planListo || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    ev.preventDefault();
    try {
      // Seguir recibiendo move/up aunque el puntero salga del lienzo.
      stageRef.current?.content.setPointerCapture(ev.pointerId);
    } catch {
      // sin captura de puntero: no es crítico
    }
    presion.current = { ...pos, pointerId: ev.pointerId, arrastre: false };
  };

  const onPointerMove = (e: EventoPuntero) => {
    const pos = posicion();
    setCursor(pos?.plano ?? null);
    if (!pos) return;
    const pan = paneo.current;
    if (pan && pan.pointerId === e.evt.pointerId) {
      useProjectStore.getState().setVista({
        x: pan.vista.x + pos.pantalla.x - pan.inicio.x,
        y: pan.vista.y + pos.pantalla.y - pan.inicio.y,
      });
      return;
    }
    const p = presion.current;
    if (!p || p.pointerId !== e.evt.pointerId || herramienta === 'navegar') return;
    if (!p.arrastre && isDrag(p.pantalla, pos.pantalla)) p.arrastre = true;
    if (!p.arrastre) return;
    if (herramienta === 'calibrar') useProjectStore.getState().setPuntosCalibracion([p.plano, pos.plano]);
    else if (puntosRef.current.length === 0) setRect({ a: p.plano, b: pos.plano });
  };

  const onPointerUp = (e: EventoPuntero) => {
    if (paneo.current?.pointerId === e.evt.pointerId) {
      paneo.current = null;
      return;
    }
    const p = presion.current;
    if (!p || p.pointerId !== e.evt.pointerId) return;
    presion.current = null;
    const pos = posicion() ?? p;

    if (herramienta === 'calibrar') {
      const { puntosCalibracion, setPuntosCalibracion } = useProjectStore.getState();
      if (p.arrastre) setPuntosCalibracion([p.plano, pos.plano]);
      else setPuntosCalibracion(puntosCalibracion.length === 1 ? [puntosCalibracion[0], pos.plano] : [pos.plano]);
      return;
    }
    if (herramienta !== 'dibujar') return;
    // Arrastre sin polígono en curso = rectángulo.
    if (p.arrastre && puntosRef.current.length === 0) {
      setRect(null);
      ultimoClic.current = null;
      crearZona(rectFromDrag(p.plano, pos.plano));
      return;
    }
    clicDibujo(pos);
  };

  const onPointerCancel = () => {
    presion.current = null;
    paneo.current = null;
    setRect(null);
  };

  // Teclado: Enter cierra, Esc cancela (o vuelve a Navegar si no hay nada), Retroceso borra el último punto.
  useEffect(() => {
    if (herramienta === 'navegar') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const store = useProjectStore.getState();
      if (herramienta === 'calibrar') {
        if (e.key === 'Escape') {
          if (store.puntosCalibracion.length > 0) store.setPuntosCalibracion([]);
          else store.setHerramienta('navegar');
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          store.setPuntosCalibracion(store.puntosCalibracion.slice(0, -1));
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        cerrarPoligono();
      } else if (e.key === 'Escape') {
        if (puntosRef.current.length > 0 || presion.current) {
          presion.current = null;
          setPuntos([]);
          setRect(null);
          setAviso(null);
        } else store.setHerramienta('navegar');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setPuntos(puntosRef.current.slice(0, -1));
        setAviso(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return {
    puntos,
    rect,
    cursor,
    aviso,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    limpiarCursor: () => setCursor(null),
  };
}
