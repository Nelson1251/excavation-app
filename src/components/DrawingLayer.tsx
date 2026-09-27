// Capa de dibujo del lienzo: zonas (polígonos rellenos con nombre y área), borrador del polígono o
// rectángulo en curso y línea de calibración. Todo en unidades PDF; los grosores y tamaños de
// texto se dividen por el zoom para verse iguales en pantalla.
import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva';
import { useProjectStore } from '../store/projectStore';
import { useT } from '../i18n/useT';
import { CLOSE_RADIUS_PX, distance, planToScreen, polygonAreaM2, polygonCentroid } from '../lib/geometry';
import { formatearArea, formatearLongitud, formatearNumero } from '../lib/units';
import { nombreZona } from '../lib/zones';
import type { Point } from '../types';

const COLORES = {
  corte: { relleno: 'rgba(239, 68, 68, 0.25)', rellenoSel: 'rgba(239, 68, 68, 0.42)', borde: '#dc2626' },
  relleno: { relleno: 'rgba(14, 165, 233, 0.25)', rellenoSel: 'rgba(14, 165, 233, 0.42)', borde: '#0284c7' },
} as const;
const AMBAR = '#f59e0b';
const CIAN = '#0891b2';
const FUENTE_PX = 12;
const INTERLINEA = 1.2;
const RELLENO_PX = 3;

const plano = (pts: Point[]) => pts.flatMap((p) => [p.x, p.y]);

// Contexto 2D compartido para medir el ancho del texto de las etiquetas (fuente por defecto de Konva).
let ctxMedida: CanvasRenderingContext2D | null = null;
function anchoTexto(lineas: string[]): number {
  ctxMedida ??= document.createElement('canvas').getContext('2d');
  if (!ctxMedida) return 120;
  ctxMedida.font = `bold ${FUENTE_PX}px Arial`;
  return Math.max(...lineas.map((l) => ctxMedida!.measureText(l).width));
}

/**
 * Etiqueta centrada en `centro` con fondo claro semitransparente para leerse sobre el plano.
 * Tamaño constante en pantalla: `k` = unidades PDF por píxel de pantalla.
 */
function Etiqueta({ centro, texto, k, color }: { centro: Point; texto: string; k: number; color: string }) {
  const lineas = texto.split('\n');
  const w = Math.ceil(anchoTexto(lineas)) + 2;
  const h = lineas.length * FUENTE_PX * INTERLINEA;
  return (
    <Group x={centro.x} y={centro.y} listening={false}>
      <Rect
        x={(-w / 2 - RELLENO_PX) * k}
        y={(-h / 2 - RELLENO_PX) * k}
        width={(w + 2 * RELLENO_PX) * k}
        height={(h + 2 * RELLENO_PX) * k}
        fill="rgba(255, 255, 255, 0.8)"
        cornerRadius={3 * k}
      />
      <Text
        x={(-w / 2) * k}
        y={(-h / 2) * k}
        width={w * k}
        align="center"
        text={texto}
        fontSize={FUENTE_PX * k}
        lineHeight={INTERLINEA}
        fontStyle="bold"
        fill={color}
      />
    </Group>
  );
}

interface Props {
  puntos: Point[];
  rect: { a: Point; b: Point } | null;
  cursor: Point | null;
}

export default function DrawingLayer({ puntos, rect, cursor }: Props) {
  const t = useT();
  const zones = useProjectStore((s) => s.zones);
  const seleccionada = useProjectStore((s) => s.zonaSeleccionada);
  const setSeleccionada = useProjectStore((s) => s.setZonaSeleccionada);
  const metersPerPdfUnit = useProjectStore((s) => s.metersPerPdfUnit);
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const herramienta = useProjectStore((s) => s.herramienta);
  const vista = useProjectStore((s) => s.vista);
  const calibracion = useProjectStore((s) => s.puntosCalibracion);
  const k = 1 / vista.zoom; // px de pantalla → unidades PDF
  const navegando = herramienta === 'navegar';

  // Primer vértice resaltado cuando el cursor está lo bastante cerca para cerrar.
  const cercaDelPrimero =
    puntos.length >= 3 &&
    cursor !== null &&
    distance(planToScreen(puntos[0], vista), planToScreen(cursor, vista)) <= CLOSE_RADIUS_PX;

  // Línea de calibración: dos puntos fijos o el primero + cursor.
  const lineaCal: Point[] | null =
    calibracion.length === 2
      ? calibracion
      : calibracion.length === 1 && cursor && herramienta === 'calibrar'
        ? [calibracion[0], cursor]
        : null;

  return (
    <Layer>
      {/* Zonas: se ordena la seleccionada al final para que quede encima. */}
      {zones
        .map((z, i) => ({ z, i }))
        .sort((a, b) => Number(a.z.id === seleccionada) - Number(b.z.id === seleccionada))
        .map(({ z, i }) => {
          const sel = z.id === seleccionada;
          const c = COLORES[z.tipo];
          const centro = polygonCentroid(z.puntos);
          const area = metersPerPdfUnit
            ? formatearArea(polygonAreaM2(z.puntos, metersPerPdfUnit), sistema)
            : t('zone.areaNeedsScale');
          const seleccionar = () => {
            if (navegando) setSeleccionada(z.id);
          };
          return (
            <Group key={z.id} name={`zona-${z.id}`}>
              <Line
                points={plano(z.puntos)}
                closed
                fill={sel ? c.rellenoSel : c.relleno}
                stroke={sel ? AMBAR : c.borde}
                strokeWidth={(sel ? 3 : 1.5) * k}
                listening={navegando}
                onClick={seleccionar}
                onTap={seleccionar}
              />
              <Etiqueta centro={centro} texto={`${nombreZona(z, i, t)}\n${area}`} k={k} color={sel ? '#92400e' : '#0f172a'} />
            </Group>
          );
        })}

      {/* Rectángulo en arrastre */}
      {rect && (
        <Rect
          x={Math.min(rect.a.x, rect.b.x)}
          y={Math.min(rect.a.y, rect.b.y)}
          width={Math.abs(rect.b.x - rect.a.x)}
          height={Math.abs(rect.b.y - rect.a.y)}
          fill="rgba(245, 158, 11, 0.18)"
          stroke={AMBAR}
          strokeWidth={2 * k}
          dash={[6 * k, 4 * k]}
          listening={false}
        />
      )}

      {/* Polígono en curso: relleno de vista previa, lados fijos, línea elástica al cursor y vértices. */}
      {puntos.length > 0 && (
        <Group listening={false}>
          {cursor && puntos.length >= 2 && (
            <Line points={plano([...puntos, cursor])} closed fill="rgba(245, 158, 11, 0.12)" strokeEnabled={false} />
          )}
          <Line points={plano(puntos)} stroke={AMBAR} strokeWidth={2 * k} lineJoin="round" />
          {cursor && (
            <Line
              points={plano([puntos[puntos.length - 1], cursor])}
              stroke={AMBAR}
              strokeWidth={1.5 * k}
              dash={[6 * k, 4 * k]}
            />
          )}
          {cursor && puntos.length >= 2 && (
            <Line points={plano([cursor, puntos[0]])} stroke={AMBAR} strokeWidth={1 * k} dash={[2 * k, 4 * k]} opacity={0.7} />
          )}
          {puntos.map((p, i) => (
            <Circle
              key={i}
              x={p.x}
              y={p.y}
              radius={(i === 0 ? (cercaDelPrimero ? 8 : 6) : 4) * k}
              fill={i === 0 && cercaDelPrimero ? '#22c55e' : 'white'}
              stroke={i === 0 ? '#15803d' : AMBAR}
              strokeWidth={2 * k}
            />
          ))}
        </Group>
      )}

      {/* Línea de calibración */}
      {lineaCal && (
        <Group listening={false}>
          <Line points={plano(lineaCal)} stroke={CIAN} strokeWidth={2.5 * k} dash={[8 * k, 4 * k]} />
          {lineaCal.map((p, i) => (
            <Group key={i}>
              <Line points={[p.x - 7 * k, p.y, p.x + 7 * k, p.y]} stroke={CIAN} strokeWidth={1.5 * k} />
              <Line points={[p.x, p.y - 7 * k, p.x, p.y + 7 * k]} stroke={CIAN} strokeWidth={1.5 * k} />
              <Circle x={p.x} y={p.y} radius={3 * k} fill="white" stroke={CIAN} strokeWidth={1.5 * k} />
            </Group>
          ))}
          <Etiqueta
            centro={{ x: (lineaCal[0].x + lineaCal[1].x) / 2, y: (lineaCal[0].y + lineaCal[1].y) / 2 - 16 * k }}
            k={k}
            color="#155e75"
            texto={
              `${formatearNumero(distance(lineaCal[0], lineaCal[1]), 1)} ${t('canvas.pdfUnits')}` +
              (metersPerPdfUnit
                ? ` ≈ ${formatearLongitud(distance(lineaCal[0], lineaCal[1]) * metersPerPdfUnit, sistema)}`
                : '')
            }
          />
        </Group>
      )}
    </Layer>
  );
}
