// Panel de calibración de escala: el usuario marca dos puntos en el lienzo (herramienta Calibrar),
// escribe la distancia real entre ellos (metros, o pies + pulgadas con fracciones) y pulsa Aplicar.
// Se guarda metros por unidad PDF en el store (metersPerPdfUnitFromReference).
import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useT } from '../i18n/useT';
import { PDF_UNITS_PER_INCH, distance, metersPerPdfUnitFromReference } from '../lib/geometry';
import { formatearLongitud, formatearNumero, metrosAPies } from '../lib/units';
import DistanceInput from './DistanceInput';

/** Longitud de la barra de escala del plano de prueba (m). */
const BARRA_EJEMPLO_M = 20;

export default function ScaleCalibration() {
  const t = useT();
  const metersPerPdfUnit = useProjectStore((s) => s.metersPerPdfUnit);
  const origen = useProjectStore((s) => s.origenEscala);
  const herramienta = useProjectStore((s) => s.herramienta);
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const puntos = useProjectStore((s) => s.puntosCalibracion);
  const setScale = useProjectStore((s) => s.setScale);
  const setHerramienta = useProjectStore((s) => s.setHerramienta);
  // Distancia real de referencia, siempre en metros (null = entrada inválida).
  const [distanciaRealM, setDistanciaRealM] = useState<number | null>(BARRA_EJEMPLO_M);

  const calibrando = herramienta === 'calibrar';
  const longitudPdf = puntos.length === 2 ? distance(puntos[0], puntos[1]) : null;
  const escalaNueva =
    puntos.length === 2 && distanciaRealM ? metersPerPdfUnitFromReference(puntos[0], puntos[1], distanciaRealM) : null;

  const aplicar = () => {
    if (!escalaNueva || !distanciaRealM || !longitudPdf) return;
    setScale(escalaNueva, { tipo: 'calibrada', referenciaM: distanciaRealM, longitudPdf });
    setHerramienta('navegar'); // también borra la línea de calibración
  };

  // Equivalente 1:N suponiendo impresión a tamaño real (1 u. PDF = 1/72 in).
  const escalaAprox = metersPerPdfUnit ? Math.round((metersPerPdfUnit * 72) / 0.0254) : null;

  const textoEscala = !metersPerPdfUnit
    ? t('scale.uncalibrated')
    : sistema === 'imperial'
      ? // Por unidad PDF el valor es muy pequeño para pies-pulgadas: se muestra en pies decimales
        // y, además, cuánto representa 1 pulgada de papel en pies y pulgadas.
        t('scale.imperial', {
          value: formatearNumero(metrosAPies(metersPerPdfUnit), 4),
          paper: formatearLongitud(metersPerPdfUnit * PDF_UNITS_PER_INCH, sistema),
          ratio: escalaAprox ?? '',
        })
      : t('scale.metric', { value: metersPerPdfUnit.toFixed(4), ratio: escalaAprox ?? '' });

  const textoOrigen =
    origen?.tipo === 'calibrada'
      ? t('scale.source.calibrated', {
          length: formatearLongitud(origen.referenciaM, sistema),
          units: formatearNumero(origen.longitudPdf, 1),
        })
      : origen?.tipo === 'ejemplo'
        ? t('scale.source.sample')
        : null;

  // En modo Pies solo pies-pulgadas (fracción a 1/8", igual que el valor inicial del campo: 65' 7 3/8").
  const barra = formatearLongitud(BARRA_EJEMPLO_M, sistema, 0);

  const paso = !calibrando
    ? t('scale.hint', { length: barra })
    : puntos.length === 0
      ? t('scale.step1')
      : puntos.length === 1
        ? t('scale.step2')
        : t('scale.step3', { units: formatearNumero(longitudPdf ?? 0, 1) });

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3" aria-labelledby="scale-heading">
      <h2 id="scale-heading" className="mb-2 text-sm font-semibold text-slate-200">
        {t('scale.heading')}
      </h2>
      <p className={`text-xs ${metersPerPdfUnit ? 'text-slate-300' : 'font-medium text-amber-400'}`} data-testid="scale-value">
        {textoEscala}
      </p>
      {textoOrigen && <p className="mt-1 text-[11px] text-slate-500">{textoOrigen}</p>}

      <button
        type="button"
        onClick={() => setHerramienta(calibrando ? 'navegar' : 'calibrar')}
        aria-pressed={calibrando}
        className={`mt-3 w-full rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          calibrando ? 'bg-amber-500 text-slate-950 hover:bg-amber-400' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
        }`}
      >
        {t(calibrando ? 'scale.stop' : 'scale.start')}
      </button>
      <p className={`mt-2 text-xs ${calibrando ? 'text-cyan-300' : 'text-slate-500'}`} data-testid="scale-step">
        {paso}
      </p>
      {calibrando && longitudPdf !== null && metersPerPdfUnit && (
        <p className="mt-1 text-[11px] text-slate-500">
          {t('scale.lineAtCurrent', { length: formatearLongitud(longitudPdf * metersPerPdfUnit, sistema) })}
        </p>
      )}

      <form
        className="mt-3 flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar();
        }}
      >
        <div className="min-w-0 flex-1">
          <DistanceInput
            id="distancia-real"
            etiqueta={t('scale.realDistance')}
            valorM={distanciaRealM}
            onChange={setDistanciaRealM}
            permitirCero={false}
          />
        </div>
        <button
          type="submit"
          disabled={!escalaNueva}
          title={escalaNueva ? t('scale.apply.title') : t('scale.needLine')}
          className="mt-5 rounded-md bg-amber-500 px-3 py-1 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {t('scale.apply')}
        </button>
      </form>
    </section>
  );
}
