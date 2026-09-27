// Piezas de interfaz compartidas por los módulos de Concreto y Asfalto.
import { useState, type ReactNode } from 'react';
import { useT } from '../../i18n/useT';
import type { Clave } from '../../i18n';
import { leerNumero } from '../../lib/units';

const claseInput = (invalido: boolean) =>
  `w-full min-w-0 rounded-md border bg-slate-800 px-2 py-1 text-sm text-slate-100 outline-none focus:border-amber-500 ${
    invalido ? 'border-red-500' : 'border-slate-700'
  }`;
export const claseEtiqueta = 'mb-1 block text-xs text-slate-400';

/**
 * Campo numérico genérico con validación. `validar` devuelve la clave i18n del error o null.
 * Mantiene el texto local; solo llama a onChange con valores válidos.
 */
export function CampoNumero({
  id,
  etiqueta,
  valor,
  onChange,
  validar,
  paso = 'any',
  pista,
  decimales = 4,
}: {
  id: string;
  etiqueta: string;
  valor: number;
  onChange: (n: number) => void;
  validar: (n: number) => Clave | null;
  paso?: string;
  pista?: string;
  decimales?: number;
}) {
  const t = useT();
  const [texto, setTexto] = useState(String(Math.round(valor * 10 ** decimales) / 10 ** decimales));
  const [error, setError] = useState<Clave | null>(null);

  const cambiar = (v: string, entradaInvalida: boolean) => {
    setTexto(v);
    const n = entradaInvalida ? null : leerNumero(v);
    const err = n === null ? validar(Number.NaN) : validar(n);
    setError(err);
    if (!err && n !== null) onChange(n);
  };

  return (
    <div>
      <label htmlFor={id} className={claseEtiqueta}>
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={paso}
        value={texto}
        onChange={(e) => cambiar(e.target.value, e.target.validity.badInput)}
        aria-invalid={error !== null}
        aria-describedby={`${id}-msg`}
        className={claseInput(error !== null)}
      />
      {(error || pista) && (
        <p id={`${id}-msg`} className={`mt-1 text-[11px] ${error ? 'text-red-400' : 'text-slate-500'}`}>
          {error ? t(error) : pista}
        </p>
      )}
    </div>
  );
}

/** Cantidad de piezas: entero ≥ 1. */
export function CampoCantidad({ id, valor, onChange }: { id: string; valor: number; onChange: (n: number) => void }) {
  const t = useT();
  return (
    <CampoNumero
      id={id}
      etiqueta={t('el.quantity')}
      valor={valor}
      onChange={onChange}
      paso="1"
      decimales={0}
      validar={(n) => (Number.isInteger(n) && n >= 1 ? null : 'el.err.quantity')}
    />
  );
}

/** Desperdicio en % (0–100); el valor se guarda como fracción. */
export function CampoDesperdicio({
  id,
  valor,
  onChange,
}: {
  id: string;
  valor: number;
  onChange: (fraccion: number) => void;
}) {
  const t = useT();
  return (
    <CampoNumero
      id={id}
      etiqueta={t('el.waste')}
      valor={valor * 100}
      onChange={(n) => onChange(n / 100)}
      decimales={2}
      validar={(n) => (Number.isFinite(n) && n >= 0 && n <= 100 ? null : 'el.err.waste')}
    />
  );
}

/** Campo de texto simple (nombre) o área de texto (notas). */
export function CampoTexto({
  id,
  etiqueta,
  valor,
  onChange,
  multilinea = false,
  placeholder,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  multilinea?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={claseEtiqueta}>
        {etiqueta}
      </label>
      {multilinea ? (
        <textarea
          id={id}
          rows={2}
          value={valor}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${claseInput(false)} resize-y`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={valor}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={claseInput(false)}
        />
      )}
    </div>
  );
}

/** Lista desplegable con etiqueta. */
export function CampoSelect<T extends string>({
  id,
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  id: string;
  etiqueta: string;
  valor: T;
  opciones: { valor: T; texto: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={claseEtiqueta}>
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => {
          const o = opciones.find((op) => op.valor === e.target.value);
          if (o) onChange(o.valor);
        }}
        className={claseInput(false)}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Tabla de resultados (etiqueta → valor). */
export function Resultados({ filas }: { filas: { etiqueta: string; valor: string; destacado?: boolean }[] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-slate-950/60 p-2 text-xs sm:grid-cols-4">
      {filas.map((f) => (
        <div key={f.etiqueta}>
          <dt className="text-[10px] uppercase text-slate-500">{f.etiqueta}</dt>
          <dd className={`tabular-nums ${f.destacado ? 'font-semibold text-amber-300' : 'text-slate-200'}`}>
            {f.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Contenedor de un módulo: encabezado con selector de tipo + botón agregar, lista y totales. */
export function PanelModulo<T extends string>({
  titulo,
  tipos,
  onAgregar,
  vacio,
  hijos,
  totales,
  nota,
}: {
  titulo: string;
  tipos: { valor: T; texto: string }[];
  onAgregar: (tipo: T) => void;
  vacio: boolean;
  hijos: ReactNode;
  totales: ReactNode;
  nota?: ReactNode;
}) {
  const t = useT();
  const [tipo, setTipo] = useState<T>(tipos[0].valor);
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">{titulo}</h2>
          <div className="flex items-center gap-2">
            <select
              aria-label={t('el.addType')}
              value={tipo}
              onChange={(e) => {
                const o = tipos.find((op) => op.valor === e.target.value);
                if (o) setTipo(o.valor);
              }}
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-amber-500"
            >
              {tipos.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onAgregar(tipo)}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-amber-400"
            >
              {t('el.add')}
            </button>
          </div>
        </div>
        {vacio ? (
          <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            {t('el.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">{hijos}</ul>
        )}
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <h3 className="mb-1 text-sm font-semibold text-slate-200">{t('el.totals')}</h3>
          {totales}
          {nota && <p className="mt-2 text-[11px] text-slate-500">{nota}</p>}
        </section>
      </div>
    </div>
  );
}

/** Tarjeta de un elemento con botón de eliminar. */
export function TarjetaElemento({ children, onEliminar }: { children: ReactNode; onEliminar: () => void }) {
  const t = useT();
  return (
    <li className="relative rounded-lg border border-slate-800 bg-slate-900 p-3">
      <button
        type="button"
        onClick={onEliminar}
        className="absolute right-2 top-2 text-slate-500 hover:text-red-400"
        title={t('el.delete')}
        aria-label={t('el.delete')}
      >
        ✕
      </button>
      {children}
    </li>
  );
}
