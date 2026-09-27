// Cuadro flotante sobre el lienzo que aparece justo después del segundo clic de calibración:
// distancia real (metros, o pies + pulgadas con fracciones) + Aplicar / Volver a marcar / Cancelar.
import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useT } from '../i18n/useT';
import { distance, metersPerPdfUnitFromReference } from '../lib/geometry';
import { formatearNumero } from '../lib/units';
import DistanceInput from './DistanceInput';

const ID_CAMPO = 'distancia-real';

export default function CalibrationPrompt() {
  const t = useT();
  const puntos = useProjectStore((s) => s.puntosCalibracion);
  const setScale = useProjectStore((s) => s.setScale);
  const setHerramienta = useProjectStore((s) => s.setHerramienta);
  const setPuntosCalibracion = useProjectStore((s) => s.setPuntosCalibracion);
  const [distanciaRealM, setDistanciaRealM] = useState<number | null>(null);

  // Foco en el primer campo para escribir la distancia enseguida.
  useEffect(() => {
    document.getElementById(ID_CAMPO)?.focus();
  }, []);

  if (puntos.length !== 2) return null;
  const longitudPdf = distance(puntos[0], puntos[1]);
  const escala = distanciaRealM ? metersPerPdfUnitFromReference(puntos[0], puntos[1], distanciaRealM) : null;

  const aplicar = () => {
    if (!escala || !distanciaRealM) return;
    setScale(escala, { tipo: 'calibrada', referenciaM: distanciaRealM, longitudPdf });
    setHerramienta('navegar'); // también borra la línea de calibración
  };

  return (
    <form
      role="dialog"
      aria-label={t('canvas.cal.step3')}
      className="pointer-events-auto w-80 rounded-lg border border-cyan-400 bg-slate-900/95 p-3 text-left shadow-xl"
      onSubmit={(e) => {
        e.preventDefault();
        aplicar();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setPuntosCalibracion([]);
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-xs text-slate-300">{t('scale.lineLength', { units: formatearNumero(longitudPdf, 1) })}</p>
      <DistanceInput
        id={ID_CAMPO}
        etiqueta={t('scale.realDistance')}
        valorM={distanciaRealM}
        onChange={setDistanciaRealM}
        permitirCero={false}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPuntosCalibracion([])}
          className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
        >
          {t('scale.redo')}
        </button>
        <button
          type="button"
          onClick={() => setHerramienta('navegar')}
          className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
        >
          {t('scale.cancel')}
        </button>
        <button
          type="submit"
          disabled={!escala}
          title={escala ? t('scale.apply.title') : t('scale.needLine')}
          className="rounded-md bg-amber-500 px-3 py-1 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {t('scale.apply')}
        </button>
      </div>
    </form>
  );
}
