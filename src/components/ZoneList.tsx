// Lista de zonas con área, profundidad de corte y de relleno (una misma zona puede tener ambas),
// tipo de suelo (corte), material de relleno (relleno), abundamiento, contracción y volúmenes
// (corte en banco / suelto, relleno compactado / material necesario / suelto, neto), más totales
// preliminares que suman el corte y el relleno por separado. Todo se calcula en m / m² / m³ y solo se convierte al mostrar.
import { Fragment, useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useT } from '../i18n/useT';
import type { Clave, Traductor } from '../i18n';
import { polygonAreaM2 } from '../lib/geometry';
import { escalaDePagina, paginasConZonas } from '../lib/pages';
import { totals, zoneVolumes } from '../lib/volumes';
import { truckTrips } from '../lib/factors';
import { formatearArea, formatearLongitud, formatearNumero as fmt, formatearVolumen, leerNumero } from '../lib/units';
import {
  MATERIALES_RELLENO,
  TIPOS_SUELO,
  descripcionMaterialRelleno,
  esFillMaterial,
  esSoilType,
  etiquetaMaterialRelleno,
  etiquetaSuelo,
  pistaAbundamiento,
  pistaContraccion,
  type OrigenAbundamiento,
} from '../lib/soils';
import { factoresDeZona, movimientoZona, nombreZona, type MovimientoZona } from '../lib/zones';
import DistanceInput from './DistanceInput';

const ABUNDAMIENTO_MAX_PCT = 200;
/** fillMaterialNeeded() exige contracción < 100 %; se limita a un valor razonable. */
const CONTRACCION_MAX_PCT = 90;
const pct = (fraccion: number) => `${fmt(fraccion * 100, fraccion * 100 === Math.round(fraccion * 100) ? 0 : 1)}%`;


/** Texto traducido del origen de un factor. */
const textoOrigen = (origen: OrigenAbundamiento, esRelleno: boolean, t: Traductor) =>
  t(origen === 'manual' ? 'source.manual' : origen === 'proyecto' ? 'source.project' : esRelleno ? 'source.material' : 'source.soil');

/**
 * Campo de porcentaje por zona (Swell % o Compaction shrink %): prellenado con el valor del
 * suelo/material (o del proyecto) y editable. Vacío o "Reset" = volver al valor por defecto.
 */
function CampoPorcentaje({
  id,
  etiqueta,
  valorManual,
  valorPorDefecto,
  fuente,
  maximo,
  onChange,
}: {
  id: string;
  /** Etiqueta ya traducida. */
  etiqueta: string;
  /** Valor manual guardado en la zona (fracción) o undefined. */
  valorManual: number | undefined;
  /** Valor (fracción) que se usa sin valor manual. */
  valorPorDefecto: number;
  /** Texto de ayuda (traducido) con el origen del valor por defecto. */
  fuente: string;
  /** Porcentaje máximo aceptado. */
  maximo: number;
  /** fracción, o undefined para volver al valor por defecto. */
  onChange: (fraccion: number | undefined) => void;
}) {
  const t = useT();
  const aTexto = (f: number) => String(Math.round(f * 1000) / 10);
  const [texto, setTexto] = useState(aTexto(valorManual ?? valorPorDefecto));
  const [invalido, setInvalido] = useState(false);

  const cambiar = (valor: string, entradaInvalida: boolean) => {
    setTexto(valor);
    if (valor.trim() === '' && !entradaInvalida) {
      setInvalido(false);
      onChange(undefined);
      return;
    }
    const n = entradaInvalida ? null : leerNumero(valor);
    if (n === null || n < 0 || n > maximo) {
      setInvalido(true);
      return; // se conserva el último valor válido
    }
    setInvalido(false);
    onChange(n / 100);
  };

  const restablecer = () => {
    setTexto(aTexto(valorPorDefecto));
    setInvalido(false);
    onChange(undefined);
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] uppercase text-slate-400">
        {etiqueta}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          max={maximo}
          step="any"
          value={texto}
          onChange={(e) => cambiar(e.target.value, e.target.validity.badInput)}
          aria-invalid={invalido}
          aria-describedby={`${id}-msg`}
          className={`w-20 rounded-md border bg-slate-800 px-1.5 py-0.5 text-xs text-slate-100 outline-none focus:border-amber-500 ${
            invalido ? 'border-red-500' : 'border-slate-700'
          }`}
        />
        {valorManual !== undefined && (
          <button
            type="button"
            onClick={restablecer}
            className="text-[10px] text-amber-400 hover:text-amber-300"
            title={t('pct.resetTitle', { value: pct(valorPorDefecto) })}
          >
            {t('pct.reset')}
          </button>
        )}
      </div>
      <p id={`${id}-msg`} className={`mt-1 text-[11px] ${invalido ? 'text-red-400' : 'text-slate-500'}`}>
        {invalido
          ? t('pct.err.range', { max: maximo })
          : valorManual !== undefined
            ? t('pct.manual', { source: fuente })
            : fuente}
      </p>
    </div>
  );
}

/** Colores de la insignia según las profundidades (igual que en el lienzo). */
const CLASE_INSIGNIA: Record<MovimientoZona, string> = {
  corte: 'bg-red-500/20 text-red-300',
  relleno: 'bg-sky-500/20 text-sky-300',
  mixta: 'bg-purple-500/20 text-purple-300',
  ninguno: 'bg-slate-500/20 text-slate-300',
};

const claseSelect =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-100 outline-none focus:border-amber-500';
const claseEtiquetaCampo = 'mb-1 block text-[10px] uppercase text-slate-400';

export default function ZoneList() {
  const t = useT();
  const zones = useProjectStore((s) => s.zones);
  const escalas = useProjectStore((s) => s.escalas);
  const pageIndex = useProjectStore((s) => s.pageIndex);
  const numPaginas = useProjectStore((s) => s.numPaginas);
  const setPageIndex = useProjectStore((s) => s.setPageIndex);
  const factors = useProjectStore((s) => s.factors);
  const removeZone = useProjectStore((s) => s.removeZone);
  const updateZone = useProjectStore((s) => s.updateZone);
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const seleccionada = useProjectStore((s) => s.zonaSeleccionada);
  const setSeleccionada = useProjectStore((s) => s.setZonaSeleccionada);
  const vol = (m3: number) => formatearVolumen(m3, sistema);
  const listaRef = useRef<HTMLUListElement>(null);

  // Al seleccionar una zona (p. ej. recién dibujada) se desplaza la lista hasta ella.
  useEffect(() => {
    if (!seleccionada) return;
    listaRef.current
      ?.querySelector(`[data-zone-id="${CSS.escape(seleccionada)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [seleccionada]);

  const filas = zones.map((z, indice) => {
    // Cada zona usa la escala de su propia página (hoja).
    const escala = escalaDePagina(escalas, z.pageIndex);
    const area = escala ? polygonAreaM2(z.puntos, escala) : null;
    // Corte: abundamiento manual → tipo de suelo → proyecto. Relleno: contracción manual → material →
    // proyecto; abundamiento del acarreo del material: manual → proyecto.
    const f = factoresDeZona(z, factors);
    const volumenes = area !== null ? zoneVolumes(area, z.cutDepth, z.fillDepth, f.paraVolumen) : null;
    return { zona: z, indice, area, f, volumenes };
  });
  // Con varias hojas la lista se agrupa por hoja ("Sheet 2"); los totales suman todas las hojas.
  const variasHojas = numPaginas > 1 || paginasConZonas(zones).some((p) => p > 0);
  const filasOrdenadas = variasHojas ? [...filas].sort((a, b) => a.zona.pageIndex - b.zona.pageIndex) : filas;
  const hayZonasSinEscala = filas.some((f) => f.area === null);

  // Totales: la parte de corte y la de relleno de cada zona se suman por separado (todas las hojas).
  const tot = totals(filas.flatMap((f) => (f.volumenes ? [f.volumenes] : [])));
  const viajesCorte = truckTrips(tot.corteSuelto, factors.capacidadCamion);
  const viajesRelleno = truckTrips(tot.rellenoSuelto, factors.capacidadCamion);
  const capacidad = formatearVolumen(factors.capacidadCamion, sistema, sistema === 'imperial' ? 1 : 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">{t('zones.heading', { count: zones.length })}</h2>
        {hayZonasSinEscala && (
          <p role="status" className="mb-2 rounded-md bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
            {t('zones.needsScale')}
          </p>
        )}
        {filas.length === 0 ? (
          <p className="text-xs text-slate-500">{t('zones.empty')}</p>
        ) : (
          <ul ref={listaRef} className="flex flex-col gap-2">
            {filasOrdenadas.map(({ zona: z, indice, area, f, volumenes }, pos) => {
              const nuevaHoja = variasHojas && (pos === 0 || filasOrdenadas[pos - 1].zona.pageIndex !== z.pageIndex);
              const movimiento = movimientoZona(z);
              const claveTipo: Clave = `zoneType.${movimiento}`;
              const hayCorte = z.cutDepth > 0;
              const hayRelleno = z.fillDepth > 0;
              const neto = volumenes?.neto ?? 0;
              return (
                <Fragment key={z.id}>
                {nuevaHoja && (
                  <li
                    role="presentation"
                    data-sheet={z.pageIndex + 1}
                    className={`mt-1 text-[11px] font-semibold uppercase tracking-wide ${
                      z.pageIndex === pageIndex ? 'text-sky-300' : 'text-slate-500'
                    }`}
                  >
                    {t('zones.sheet', { n: z.pageIndex + 1 })}
                    {z.pageIndex === pageIndex && ` · ${t('zones.sheetCurrent')}`}
                  </li>
                )}
                <li
                  data-zone-id={z.id}
                  data-zone-sheet={z.pageIndex + 1}
                  aria-current={z.id === seleccionada ? 'true' : undefined}
                  onClick={() => {
                    // Seleccionar una zona de otra hoja lleva a esa hoja.
                    if (z.pageIndex !== pageIndex) setPageIndex(z.pageIndex);
                    setSeleccionada(z.id);
                  }}
                  onFocusCapture={() => {
                    if (z.pageIndex === pageIndex) setSeleccionada(z.id);
                  }}
                  className={`rounded-md border p-2 text-xs transition-colors ${
                    z.id === seleccionada
                      ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/60'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-100">{nombreZona(z, indice, t)}</span>
                    <div className="flex items-center gap-2">
                      <span
                        data-zone-kind={movimiento}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${CLASE_INSIGNIA[movimiento]}`}
                      >
                        {t(claveTipo)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeZone(z.id);
                        }}
                        className="text-slate-500 hover:text-red-400"
                        title={t('zones.delete')}
                        aria-label={t('zones.delete')}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-1 text-slate-400 [&_dd]:tabular-nums [&_dd]:text-slate-200 [&_dt]:text-[10px] [&_dt]:uppercase [&_dt]:text-slate-500">
                    <div>
                      <dt>{t('zone.area')}</dt>
                      <dd>{area !== null ? formatearArea(area, sistema) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="!text-red-300/80">{t('zone.cutDepth')}</dt>
                      <dd data-depth="cut">{formatearLongitud(z.cutDepth, sistema)}</dd>
                    </div>
                    <div>
                      <dt className="!text-sky-300/80">{t('zone.fillDepth')}</dt>
                      <dd data-depth="fill">{formatearLongitud(z.fillDepth, sistema)}</dd>
                    </div>
                    <div>
                      <dt className="!text-red-300/80" title={t('vol.cut.title')}>{t('vol.cut')}</dt>
                      <dd data-vol="cut">{volumenes ? vol(volumenes.corteBanco) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="!text-sky-300/80" title={t('vol.fill.title')}>{t('vol.fill')}</dt>
                      <dd data-vol="fill">{volumenes ? vol(volumenes.rellenoCompactado) : '—'}</dd>
                    </div>
                    <div>
                      <dt title={t('zone.net.title')}>{t('zone.net')}</dt>
                      <dd
                        data-vol="net"
                        title={t('zone.net.title')}
                        className={volumenes && neto !== 0 ? (neto > 0 ? '!text-red-300' : '!text-sky-300') : undefined}
                      >
                        {volumenes ? `${neto > 0 ? '+' : ''}${vol(neto)}` : '—'}
                      </dd>
                    </div>
                    {hayCorte && (
                      <>
                        <div>
                          <dt>{t('zone.soil')}</dt>
                          <dd className="truncate" title={etiquetaSuelo(z.soilType, t)}>
                            {etiquetaSuelo(z.soilType, t)}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('zone.swellUsed')}</dt>
                          <dd title={t('zone.source', { source: textoOrigen(f.abundCorte.origen, false, t) })}>
                            {pct(f.abundCorte.valor)}
                          </dd>
                        </div>
                        <div>
                          <dt title={t('vol.loose.title')}>{t('vol.cutLoose')}</dt>
                          <dd data-vol="cut-loose">{volumenes ? vol(volumenes.corteSuelto) : '—'}</dd>
                        </div>
                      </>
                    )}
                    {hayRelleno && (
                      <>
                        <div>
                          <dt>{t('zone.material')}</dt>
                          <dd className="truncate" title={etiquetaMaterialRelleno(z.fillMaterial, t)}>
                            {etiquetaMaterialRelleno(z.fillMaterial, t)}
                          </dd>
                        </div>
                        <div>
                          <dt>{t('zone.shrinkUsed')}</dt>
                          <dd title={t('zone.source', { source: textoOrigen(f.contr.origen, true, t) })}>
                            {pct(f.contr.valor)}
                          </dd>
                        </div>
                        <div>
                          <dt title={t('vol.needed.title')}>{t('vol.needed')}</dt>
                          <dd data-vol="fill-needed">{volumenes ? vol(volumenes.rellenoNecesario) : '—'}</dd>
                        </div>
                        <div>
                          <dt>{t('zone.haulSwellUsed')}</dt>
                          <dd title={t('zone.source', { source: textoOrigen(f.abundRelleno.origen, true, t) })}>
                            {pct(f.abundRelleno.valor)}
                          </dd>
                        </div>
                        <div>
                          <dt title={t('vol.loose.title')}>{t('vol.fillLoose')}</dt>
                          <dd data-vol="fill-loose">{volumenes ? vol(volumenes.rellenoSuelto) : '—'}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  <div className="mt-2">
                    <label htmlFor={`nombre-${z.id}`} className={claseEtiquetaCampo}>
                      {t('zone.name')}
                    </label>
                    <input
                      id={`nombre-${z.id}`}
                      type="text"
                      value={z.nombreClave ? t(z.nombreClave) : z.nombre}
                      placeholder={t('zone.defaultName', { n: indice + 1 })}
                      onChange={(e) => updateZone(z.id, { nombre: e.target.value, nombreClave: undefined })}
                      className={claseSelect}
                    />
                  </div>
                  {/* Dos profundidades en la misma zona: corte y relleno (0 = no hay esa parte). */}
                  {/* En Pies cada campo tiene pies + pulgadas: uno debajo del otro para que quepan las fracciones. */}
                  <div className={`mt-2 grid gap-2 ${sistema === 'imperial' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <div title={t('zone.cutDepth.title')} className="min-w-0">
                      <DistanceInput
                        id={`cut-depth-${z.id}`}
                        etiqueta={t('zone.cutDepth')}
                        valorM={z.cutDepth}
                        onChange={(m) => {
                          if (m !== null) updateZone(z.id, { cutDepth: m });
                        }}
                        compacto
                      />
                    </div>
                    <div title={t('zone.fillDepth.title')} className="min-w-0">
                      <DistanceInput
                        id={`fill-depth-${z.id}`}
                        etiqueta={t('zone.fillDepth')}
                        valorM={z.fillDepth}
                        onChange={(m) => {
                          if (m !== null) updateZone(z.id, { fillDepth: m });
                        }}
                        compacto
                      />
                    </div>
                  </div>
                  {hayCorte && (
                    <div className="mt-2 grid grid-cols-[1fr_auto] items-start gap-2 border-l-2 border-red-500/40 pl-2">
                      <div className="min-w-0">
                        <label htmlFor={`suelo-${z.id}`} className={claseEtiquetaCampo}>
                          {t('field.soilType')}
                        </label>
                        <select
                          id={`suelo-${z.id}`}
                          value={z.soilType ?? ''}
                          onChange={(e) =>
                            // Al cambiar el suelo se descarta el abundamiento manual y se prellena con el del suelo.
                            updateZone(z.id, {
                              soilType: esSoilType(e.target.value) ? e.target.value : undefined,
                              abundamientoManual: undefined,
                            })
                          }
                          className={claseSelect}
                        >
                          <option value="">{t('common.unspecified')}</option>
                          {TIPOS_SUELO.map((s) => (
                            <option key={s.id} value={s.id}>
                              {etiquetaSuelo(s.id, t)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* key: al cambiar el suelo se reinicia el campo con el nuevo valor típico. */}
                      <CampoPorcentaje
                        key={z.soilType ?? 'sin-suelo'}
                        id={`abund-${z.id}`}
                        etiqueta={t('field.swell')}
                        valorManual={z.abundamientoManual}
                        valorPorDefecto={f.abundCortePorDefecto.valor}
                        fuente={
                          f.abundCortePorDefecto.origen === 'suelo'
                            ? pistaAbundamiento(z.soilType, t)
                            : t('pct.noSoil', { value: pct(f.abundCortePorDefecto.valor) })
                        }
                        maximo={ABUNDAMIENTO_MAX_PCT}
                        onChange={(fraccion) => updateZone(z.id, { abundamientoManual: fraccion })}
                      />
                    </div>
                  )}
                  {hayRelleno && (
                    <div className="mt-2 grid grid-cols-[1fr_auto] items-start gap-2 border-l-2 border-sky-500/40 pl-2">
                      <div className="min-w-0">
                        <label htmlFor={`material-${z.id}`} className={claseEtiquetaCampo}>
                          {t('field.fillMaterial')}
                        </label>
                        <select
                          id={`material-${z.id}`}
                          value={z.fillMaterial ?? ''}
                          onChange={(e) =>
                            // Al cambiar el material se descarta la contracción manual y se prellena con la del material.
                            updateZone(z.id, {
                              fillMaterial: esFillMaterial(e.target.value) ? e.target.value : undefined,
                              contraccionManual: undefined,
                            })
                          }
                          title={descripcionMaterialRelleno(z.fillMaterial, t)}
                          className={claseSelect}
                        >
                          <option value="">{t('common.unspecified')}</option>
                          {MATERIALES_RELLENO.map((m) => (
                            <option key={m.id} value={m.id} title={descripcionMaterialRelleno(m.id, t)}>
                              {etiquetaMaterialRelleno(m.id, t)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* key: al cambiar el material se reinicia el campo con el nuevo valor típico. */}
                      <CampoPorcentaje
                        key={z.fillMaterial ?? 'sin-material'}
                        id={`contr-${z.id}`}
                        etiqueta={t('field.shrink')}
                        valorManual={z.contraccionManual}
                        valorPorDefecto={f.contrPorDefecto.valor}
                        fuente={
                          f.contrPorDefecto.origen === 'suelo'
                            ? pistaContraccion(z.fillMaterial, t)
                            : t('pct.noMaterial', { value: pct(f.contrPorDefecto.valor) })
                        }
                        maximo={CONTRACCION_MAX_PCT}
                        onChange={(fraccion) => updateZone(z.id, { contraccionManual: fraccion })}
                      />
                      <div className="col-span-2">
                        <CampoPorcentaje
                          id={`abund-relleno-${z.id}`}
                          etiqueta={t('field.swellHaul')}
                          valorManual={z.abundamientoRellenoManual}
                          valorPorDefecto={f.abundRellenoPorDefecto.valor}
                          fuente={t('pct.haulHint', { value: pct(f.abundRellenoPorDefecto.valor) })}
                          maximo={ABUNDAMIENTO_MAX_PCT}
                          onChange={(fraccion) => updateZone(z.id, { abundamientoRellenoManual: fraccion })}
                        />
                      </div>
                    </div>
                  )}
                </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">{t('totals.heading')}</h2>
        <table className="w-full tabular-nums">
          <tbody className="[&_td]:py-0.5 [&_td:last-child]:text-right">
            <tr>
              <td className="text-red-300">{t('totals.cutBank')}</td>
              <td className="text-slate-100" data-total="cut-bank">{vol(tot.corteBanco)}</td>
            </tr>
            <tr>
              <td className="text-red-300">{t('totals.cutLoose')}</td>
              <td className="text-slate-100" data-total="cut-loose">{vol(tot.corteSuelto)}</td>
            </tr>
            <tr>
              <td className="pt-2 text-sky-300">{t('totals.fillCompacted')}</td>
              <td className="pt-2 text-slate-100" data-total="fill-compacted">{vol(tot.rellenoCompactado)}</td>
            </tr>
            <tr>
              <td className="text-sky-300">{t('totals.fillNeeded')}</td>
              <td className="text-slate-100" data-total="fill-needed">{vol(tot.rellenoNecesario)}</td>
            </tr>
            <tr>
              <td className="text-sky-300">{t('totals.fillLoose')}</td>
              <td className="text-slate-100" data-total="fill-loose">{vol(tot.rellenoSuelto)}</td>
            </tr>
            <tr className="border-t border-slate-800">
              <td className="text-slate-300">{t('totals.net')}</td>
              <td data-total="net" className={tot.neto >= 0 ? 'text-emerald-300' : 'text-amber-300'}>
                {`${tot.neto > 0 ? '+' : ''}${vol(tot.neto)}`}
              </td>
            </tr>
            <tr>
              <td className="pt-2 text-slate-400">{t('totals.tripsCut', { capacity: capacidad })}</td>
              <td className="pt-2 text-slate-200">{viajesCorte}</td>
            </tr>
            <tr>
              <td className="text-slate-400">{t('totals.tripsFill', { capacity: capacidad })}</td>
              <td className="text-slate-200">{viajesRelleno}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-500">
          {t('totals.note', { swell: pct(factors.abundamiento), shrink: pct(factors.contraccion) })}
        </p>
        {/* TODO: editar factores y exportar a Excel (xlsx) y PDF (pdf-lib) usando t(): incluir suelo/material,
            abundamiento y contracción usados, Vol. en banco / compactado, material necesario y Vol. suelto. */}
      </div>
    </section>
  );
}
