// Barra de herramientas superior.
import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useT } from '../i18n/useT';
import { IDIOMAS, type Clave } from '../i18n';
import type { Herramienta, Modulo, SistemaUnidades } from '../types';

function Boton({
  children,
  onClick,
  activo = false,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  activo?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        activo
          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

/** Grupo de botones excluyentes (segmented control) con semántica de radio. */
function Segmentado<T extends string>({
  etiqueta,
  etiquetaGrupo,
  opciones,
  valor,
  onChange,
}: {
  etiqueta: string;
  etiquetaGrupo: string;
  opciones: { valor: T; texto: string; titulo: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label={etiquetaGrupo}>
      <span className="text-sm text-slate-400">{etiqueta}</span>
      <div className="flex overflow-hidden rounded-md border border-slate-700">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            title={o.titulo}
            onClick={() => onChange(o.valor)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              valor === o.valor ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

const OPCIONES_UNIDADES: { valor: SistemaUnidades; texto: Clave; titulo: Clave }[] = [
  { valor: 'metrico', texto: 'units.metric', titulo: 'units.metric.title' },
  { valor: 'imperial', texto: 'units.imperial', titulo: 'units.imperial.title' },
];

const MODULOS: readonly Modulo[] = ['excavacion', 'concreto', 'asfalto'];

export default function Toolbar() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfSource = useProjectStore((s) => s.pdfSource);
  const zoom = useProjectStore((s) => s.vista.zoom);
  const herramienta = useProjectStore((s) => s.herramienta);
  const sistema = useProjectStore((s) => s.sistemaUnidades);
  const idioma = useProjectStore((s) => s.language);
  const modulo = useProjectStore((s) => s.modulo);
  const setModulo = useProjectStore((s) => s.setModulo);
  const setPdfSource = useProjectStore((s) => s.setPdfSource);
  const setHerramienta = useProjectStore((s) => s.setHerramienta);
  const setSistema = useProjectStore((s) => s.setSistemaUnidades);
  const setIdioma = useProjectStore((s) => s.setLanguage);
  const zoomPor = useProjectStore((s) => s.zoomPor);

  // Cargar un PDF local del usuario mediante un object URL.
  const onArchivo = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setPdfSource({ tipo: 'archivo', url: URL.createObjectURL(archivo), nombre: archivo.name });
    e.target.value = ''; // permitir volver a elegir el mismo archivo
  };

  // Alternar herramienta (stub: todavía no hay interacción en el lienzo).
  const alternar = (h: Herramienta) => setHerramienta(herramienta === h ? 'navegar' : h);

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2">
      <h1 className="mr-4 text-base font-semibold tracking-tight text-amber-400">{t('toolbar.heading')}</h1>

      {/* Pestañas de módulo: movimiento de tierras (plano PDF), concreto y asfalto. */}
      <div className="flex overflow-hidden rounded-md border border-slate-700" role="tablist" aria-label={t('module.groupLabel')}>
        {MODULOS.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modulo === m}
            onClick={() => setModulo(m)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              modulo === m ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {t(`module.${m}`)}
          </button>
        ))}
      </div>

      <div className="mx-2 h-6 w-px bg-slate-700" />

      {modulo === 'excavacion' && (
        <>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onArchivo} />
          <Boton onClick={() => inputRef.current?.click()} title={t('toolbar.loadPdf.title')}>
            {t('toolbar.loadPdf')}
          </Boton>

          <div className="mx-2 h-6 w-px bg-slate-700" />

          {/* TODO: implementar la calibración de escala en el lienzo */}
          <Boton onClick={() => alternar('calibrar')} activo={herramienta === 'calibrar'} title={t('common.comingSoon')}>
            {t('toolbar.calibrate')}
          </Boton>
          {/* TODO: implementar el dibujo de polígonos de zona */}
          <Boton onClick={() => alternar('dibujar')} activo={herramienta === 'dibujar'} title={t('common.comingSoon')}>
            {t('toolbar.drawZone')}
          </Boton>

          <div className="mx-2 h-6 w-px bg-slate-700" />

          <Boton onClick={() => zoomPor(1 / 1.25)} title={t('toolbar.zoomOut')}>
            −
          </Boton>
          <span className="w-14 text-center text-sm tabular-nums text-slate-400">{(zoom * 100).toFixed(0)} %</span>
          <Boton onClick={() => zoomPor(1.25)} title={t('toolbar.zoomIn')}>
            +
          </Boton>

          <div className="mx-2 h-6 w-px bg-slate-700" />
        </>
      )}

      <Segmentado
        etiqueta={t('units.label')}
        etiquetaGrupo={t('units.groupLabel')}
        opciones={OPCIONES_UNIDADES.map((o) => ({ valor: o.valor, texto: t(o.texto), titulo: t(o.titulo) }))}
        valor={sistema}
        onChange={setSistema}
      />
      <Segmentado
        etiqueta={t('language.label')}
        etiquetaGrupo={t('language.groupLabel')}
        opciones={IDIOMAS.map((i) => ({ valor: i, texto: i.toUpperCase(), titulo: t(`language.${i}.title`) }))}
        valor={idioma}
        onChange={setIdioma}
      />

      {modulo === 'excavacion' && (
        <span className="ml-auto truncate text-sm text-slate-400" title={pdfSource?.nombre}>
          {pdfSource ? pdfSource.nombre : t('toolbar.noPlan')}
        </span>
      )}
    </header>
  );
}
