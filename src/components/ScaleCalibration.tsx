// Panel de calibración de escala (stub).
import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useT } from '../i18n/useT';
import { PDF_UNITS_PER_INCH } from '../lib/geometry';
import { formatearLongitud, formatearNumero, metrosAPies } from '../lib/units';
import DistanceInput from './DistanceInput';

/** Longitud de la barra de escala del plano de prueba (m). */
const BARRA_EJEMPLO_M = 20;

export default function ScaleCalibration() {
  const t = useT();
  const metersPerPdfUnit = useProjectStore((s) => s.metersPerPdfUnit);
  const herramienta = useProjectStore((s) => s.herramienta);
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  // Distancia real de referencia, siempre en metros (null = entrada inválida).
  const [distanciaRealM, setDistanciaRealM] = useState<number | null>(BARRA_EJEMPLO_M);

  // TODO: al pulsar "Calibrar escala", el usuario marcará dos puntos en el lienzo;
  // luego se calculará metersPerPdfUnitFromReference(a, b, distanciaRealM) y se llamará a setScale().
  const aplicar = () => {
    console.info('TODO: calibration pending. Real distance (m):', distanciaRealM);
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

  // En modo Pies solo pies-pulgadas (fracción a 1/8", igual que el valor inicial del campo: 65' 7 3/8").
  const barra = formatearLongitud(BARRA_EJEMPLO_M, sistema, 0);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">{t('scale.heading')}</h2>
      <p className="mb-3 text-xs text-slate-400">{textoEscala}</p>
      <div className="flex items-start gap-2">
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
          type="button"
          onClick={aplicar}
          disabled
          title={t('common.comingSoon')}
          className="mt-5 rounded-md bg-slate-700 px-3 py-1 text-sm text-slate-400 disabled:cursor-not-allowed"
        >
          {t('scale.apply')}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {herramienta === 'calibrar' ? t('scale.calibrating') : t('scale.hint', { length: barra })}
      </p>
    </section>
  );
}
