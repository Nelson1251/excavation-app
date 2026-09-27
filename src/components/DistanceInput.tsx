// Campo reutilizable para capturar una distancia. El valor siempre se entrega en metros.
// - Sistema métrico: un solo campo numérico en metros.
// - Sistema imperial: pies ("ft", enteros) y pulgadas ("in", texto con fracciones como en obra:
//   7, 3/4, 7 1/2, 7-1/2, 11 15/16; también 7.5). 12 pulgadas o más se pasan a pies al salir del campo.
import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useT } from '../i18n/useT';
import type { Clave } from '../i18n';
import {
  PULGADAS_POR_PIE,
  evaluarPiesPulgadas,
  formatearPiesPulgadas,
  leerNumero,
  metrosACamposPiesPulgadas,
  textoCampoPulgadas,
  validarDistanciaMetros,
} from '../lib/units';

interface DistanceInputProps {
  /** Id base del campo (se usa para la etiqueta y los mensajes). */
  id: string;
  /** Etiqueta visible ya traducida, sin la unidad (se agrega automáticamente). */
  etiqueta: string;
  /** Valor actual en metros (null = vacío). */
  valorM: number | null;
  /** Se llama con el nuevo valor en metros, o con null si la entrada no es válida. */
  onChange: (metros: number | null) => void;
  /** Si es false, 0 se considera inválido (p. ej. distancia de calibración). */
  permitirCero?: boolean;
  /** Versión más pequeña para listas. */
  compacto?: boolean;
}

const claseInput = (compacto: boolean, invalido: boolean) =>
  `w-full min-w-0 rounded-md border bg-slate-800 text-slate-100 outline-none focus:border-amber-500 ${
    compacto ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
  } ${invalido ? 'border-red-500' : 'border-slate-700'}`;

const claseEtiqueta = (compacto: boolean) =>
  `mb-1 block text-slate-400 ${compacto ? 'text-[10px] uppercase' : 'text-xs'}`;

/** Redondea para mostrar en el campo sin residuos de coma flotante. */
const aTexto = (n: number, decimales: number) => String(Math.round(n * 10 ** decimales) / 10 ** decimales);

function Mensajes({ id, pista, error }: { id: string; pista: string; error: string | null }) {
  return error ? (
    <p id={`${id}-msg`} role="alert" className="mt-1 text-[11px] text-red-400">
      {error}
    </p>
  ) : (
    <p id={`${id}-msg`} className="mt-1 text-[11px] text-slate-500">
      {pista}
    </p>
  );
}

function CampoMetros({ id, etiqueta, valorM, onChange, permitirCero = true, compacto = false }: DistanceInputProps) {
  const t = useT();
  const [texto, setTexto] = useState(valorM !== null ? aTexto(valorM, 4) : '');
  // Se guarda la clave del error (no el texto) para que cambie de idioma al instante.
  const [error, setError] = useState<Clave | null>(null);

  const cambiar = (valor: string, entradaInvalida: boolean) => {
    setTexto(valor);
    const n = entradaInvalida ? null : leerNumero(valor);
    const err: Clave | null = n === null ? 'distance.err.metersInvalid' : validarDistanciaMetros(n, permitirCero);
    setError(err);
    onChange(err || n === null ? null : n);
  };

  return (
    <div>
      <label className={claseEtiqueta(compacto)} htmlFor={id}>
        {t('distance.labelMeters', { label: etiqueta })}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={texto}
        onChange={(e) => cambiar(e.target.value, e.target.validity.badInput)}
        aria-invalid={error !== null}
        aria-describedby={`${id}-msg`}
        className={claseInput(compacto, error !== null)}
      />
      <Mensajes id={id} pista={t('distance.hintMeters')} error={error && t(error)} />
    </div>
  );
}

function CamposImperiales({
  id,
  etiqueta,
  valorM,
  onChange,
  permitirCero = true,
  compacto = false,
}: DistanceInputProps) {
  const t = useT();
  // Valor inicial: metros → pies enteros + pulgadas como fracción reducida a 1/16 ("7 3/8").
  const inicial = valorM !== null ? metrosACamposPiesPulgadas(valorM) : null;
  const [pies, setPies] = useState(inicial?.pies ?? '');
  const [pulg, setPulg] = useState(inicial?.pulgadas ?? '');
  const [error, setError] = useState<Clave | null>(null);

  /** Valida ambos campos (pies enteros + pulgadas con fracción); devuelve metros o la clave del error. */
  const evaluar = (tPies: string, tPulg: string) => evaluarPiesPulgadas(tPies, tPulg, permitirCero);

  // `piesInvalidos`: el navegador rechazó el texto del campo numérico de pies (value llega vacío).
  const actualizar = (tPies: string, tPulg: string, piesInvalidos = false) => {
    const r = piesInvalidos ? { error: 'distance.err.feetInteger' as const } : evaluar(tPies, tPulg);
    if ('error' in r) {
      setError(r.error);
      onChange(null);
    } else {
      setError(null);
      onChange(r.metros);
    }
  };

  // Al salir de un campo: si hay 12" o más, pasar el excedente a pies (3' 18" → 4' 6"; 0' 13 1/2" → 1' 1 1/2").
  const normalizar = () => {
    const r = evaluar(pies, pulg);
    if ('error' in r || r.pulgadas < PULGADAS_POR_PIE) return;
    const extraPies = Math.floor(r.pulgadas / PULGADAS_POR_PIE);
    const tPies = String(r.pies + extraPies);
    const tPulg = textoCampoPulgadas(r.pulgadas - extraPies * PULGADAS_POR_PIE);
    setPies(tPies);
    setPulg(tPulg);
    actualizar(tPies, tPulg);
  };

  const r = evaluar(pies, pulg);
  // En modo Pies nunca se muestran metros: el eco es en pies-pulgadas (fracción a 1/8").
  const pista =
    'metros' in r ? t('distance.hintImperialEq', { value: formatearPiesPulgadas(r.metros) }) : t('distance.hintImperial');
  const tam = compacto ? 'text-[10px]' : 'text-xs';

  return (
    <fieldset>
      <legend className={claseEtiqueta(compacto)}>{t('distance.labelFeetInches', { label: etiqueta })}</legend>
      <div className="flex items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={pies}
          onChange={(e) => {
            setPies(e.target.value);
            actualizar(e.target.value, pulg, e.target.validity.badInput);
          }}
          onBlur={normalizar}
          aria-label={t('distance.ftAria', { label: etiqueta })}
          aria-invalid={error !== null}
          aria-describedby={`${id}-msg`}
          className={claseInput(compacto, error !== null)}
        />
        <label htmlFor={id} className={`shrink-0 text-slate-400 ${tam}`}>
          {t('distance.ft')}
        </label>
        <input
          id={`${id}-pulg`}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder={t('distance.inPlaceholder')}
          value={pulg}
          onChange={(e) => {
            setPulg(e.target.value);
            actualizar(pies, e.target.value);
          }}
          onBlur={normalizar}
          aria-label={t('distance.inAria', { label: etiqueta })}
          aria-invalid={error !== null}
          aria-describedby={`${id}-msg`}
          className={claseInput(compacto, error !== null)}
        />
        <label htmlFor={`${id}-pulg`} className={`shrink-0 text-slate-400 ${tam}`}>
          {t('distance.in')}
        </label>
      </div>
      <Mensajes id={id} pista={pista} error={error && t(error)} />
    </fieldset>
  );
}

/** Campo de distancia que cambia entre metros y pies + pulgadas según el sistema de unidades del store. */
export default function DistanceInput(props: DistanceInputProps) {
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  // Al cambiar de sistema se monta otro componente, que se reinicia a partir de valorM (en metros).
  return sistema === 'imperial' ? <CamposImperiales {...props} /> : <CampoMetros {...props} />;
}
