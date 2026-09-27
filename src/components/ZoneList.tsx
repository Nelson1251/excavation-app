// Lista de zonas con área, profundidad y volumen, más totales preliminares.
import { useProjectStore } from '../store/projectStore';
import { polygonAreaM2 } from '../lib/geometry';
import { totals, zoneVolume } from '../lib/volumes';
import { fillMaterialNeeded, looseVolume, truckTrips } from '../lib/factors';

const fmt = (n: number, dec = 2) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export default function ZoneList() {
  const zones = useProjectStore((s) => s.zones);
  const metersPerPdfUnit = useProjectStore((s) => s.metersPerPdfUnit);
  const factors = useProjectStore((s) => s.factors);
  const removeZone = useProjectStore((s) => s.removeZone);

  const filas = zones.map((z) => {
    const area = metersPerPdfUnit ? polygonAreaM2(z.puntos, metersPerPdfUnit) : null;
    const volumen = area !== null ? zoneVolume(area, z.profundidad) : null;
    return { ...z, area, volumen };
  });

  const t = totals(filas.map((f) => ({ tipo: f.tipo, volumen: f.volumen ?? 0 })));
  // Placeholder: resumen con factores (se refinará en fases siguientes).
  const corteSuelto = looseVolume(t.corte, factors.abundamiento);
  const rellenoBanco = fillMaterialNeeded(t.relleno, factors.contraccion);
  const viajes = truckTrips(corteSuelto, factors.capacidadCamion);

  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Zonas ({zones.length})</h2>
        {filas.length === 0 ? (
          <p className="text-xs text-slate-500">No hay zonas. Usa “Dibujar zona” para agregar una.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filas.map((z) => (
              <li key={z.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-2 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-slate-100">{z.nombre}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        z.tipo === 'corte' ? 'bg-red-500/20 text-red-300' : 'bg-sky-500/20 text-sky-300'
                      }`}
                    >
                      {z.tipo}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeZone(z.id)}
                      className="text-slate-500 hover:text-red-400"
                      title="Eliminar zona"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-1 text-slate-400">
                  <div>
                    <dt className="text-[10px] uppercase text-slate-500">Área</dt>
                    <dd className="tabular-nums text-slate-200">{z.area !== null ? `${fmt(z.area)} m²` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-slate-500">Profundidad</dt>
                    <dd className="tabular-nums text-slate-200">{fmt(z.profundidad)} m</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase text-slate-500">Volumen</dt>
                    <dd className="tabular-nums text-slate-200">
                      {z.volumen !== null ? `${fmt(z.volumen)} m³` : '—'}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs">
        <h2 className="mb-2 text-sm font-semibold text-slate-200">Totales (preliminar)</h2>
        <table className="w-full tabular-nums">
          <tbody className="[&_td]:py-0.5 [&_td:last-child]:text-right">
            <tr>
              <td className="text-red-300">Corte (en banco)</td>
              <td className="text-slate-100">{fmt(t.corte)} m³</td>
            </tr>
            <tr>
              <td className="text-sky-300">Relleno (compactado)</td>
              <td className="text-slate-100">{fmt(t.relleno)} m³</td>
            </tr>
            <tr className="border-t border-slate-800">
              <td className="text-slate-300">Neto (corte − relleno)</td>
              <td className={t.neto >= 0 ? 'text-emerald-300' : 'text-amber-300'}>{fmt(t.neto)} m³</td>
            </tr>
            <tr>
              <td className="pt-2 text-slate-400">Corte suelto (abund. {fmt(factors.abundamiento * 100, 0)} %)</td>
              <td className="pt-2 text-slate-200">{fmt(corteSuelto)} m³</td>
            </tr>
            <tr>
              <td className="text-slate-400">Material p/ relleno (contr. {fmt(factors.contraccion * 100, 0)} %)</td>
              <td className="text-slate-200">{fmt(rellenoBanco)} m³</td>
            </tr>
            <tr>
              <td className="text-slate-400">Viajes de camión ({fmt(factors.capacidadCamion, 0)} m³)</td>
              <td className="text-slate-200">{viajes}</td>
            </tr>
          </tbody>
        </table>
        {/* TODO: editar factores, exportar a Excel (xlsx) y a PDF (pdf-lib). */}
      </div>
    </section>
  );
}
