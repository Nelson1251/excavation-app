// Panel de calibración de escala (stub).
import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';

export default function ScaleCalibration() {
  const metersPerPdfUnit = useProjectStore((s) => s.metersPerPdfUnit);
  const herramienta = useProjectStore((s) => s.herramienta);
  const [distanciaReal, setDistanciaReal] = useState('20');

  // TODO: al pulsar "Calibrar escala", el usuario marcará dos puntos en el lienzo;
  // luego se calculará metersPerPdfUnitFromReference(a, b, distanciaReal) y se llamará a setScale().
  const aplicar = () => {
    console.info('TODO: calibración pendiente. Distancia real:', distanciaReal, 'm');
  };

  // Equivalente 1:N suponiendo impresión a tamaño real (1 u. PDF = 1/72 in).
  const escalaAprox = metersPerPdfUnit ? Math.round((metersPerPdfUnit * 72) / 0.0254) : null;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">Escala</h2>
      <p className="mb-3 text-xs text-slate-400">
        {metersPerPdfUnit
          ? `${metersPerPdfUnit.toFixed(4)} m por unidad PDF (≈ 1:${escalaAprox})`
          : 'Escala sin calibrar'}
      </p>
      <label className="mb-1 block text-xs text-slate-400" htmlFor="distancia-real">
        Distancia real (metros)
      </label>
      <div className="flex gap-2">
        <input
          id="distancia-real"
          type="number"
          min="0"
          step="0.01"
          value={distanciaReal}
          onChange={(e) => setDistanciaReal(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100 outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={aplicar}
          disabled
          title="Próximamente"
          className="rounded-md bg-slate-700 px-3 py-1 text-sm text-slate-400 disabled:cursor-not-allowed"
        >
          Aplicar
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {herramienta === 'calibrar'
          ? 'Modo calibración activo (en desarrollo): marca dos puntos sobre una cota conocida.'
          : 'Próximamente: traza una línea sobre una distancia conocida (p. ej. la barra de 20 m).'}
      </p>
    </section>
  );
}
