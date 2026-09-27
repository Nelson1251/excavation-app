// Barra de herramientas superior.
import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { Herramienta } from '../types';

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

export default function Toolbar() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pdfSource = useProjectStore((s) => s.pdfSource);
  const zoom = useProjectStore((s) => s.vista.zoom);
  const herramienta = useProjectStore((s) => s.herramienta);
  const setPdfSource = useProjectStore((s) => s.setPdfSource);
  const setHerramienta = useProjectStore((s) => s.setHerramienta);
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
    <header className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2">
      <h1 className="mr-4 text-base font-semibold tracking-tight text-amber-400">
        Cubicación · Corte y Relleno
      </h1>

      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onArchivo} />
      <Boton onClick={() => inputRef.current?.click()} title="Abrir un plano en PDF">
        📄 Cargar PDF
      </Boton>

      <div className="mx-2 h-6 w-px bg-slate-700" />

      {/* TODO: implementar la calibración de escala en el lienzo */}
      <Boton onClick={() => alternar('calibrar')} activo={herramienta === 'calibrar'} title="Próximamente">
        📏 Calibrar escala
      </Boton>
      {/* TODO: implementar el dibujo de polígonos de zona */}
      <Boton onClick={() => alternar('dibujar')} activo={herramienta === 'dibujar'} title="Próximamente">
        ✏️ Dibujar zona
      </Boton>

      <div className="mx-2 h-6 w-px bg-slate-700" />

      <Boton onClick={() => zoomPor(1 / 1.25)} title="Alejar">
        −
      </Boton>
      <span className="w-14 text-center text-sm tabular-nums text-slate-400">{(zoom * 100).toFixed(0)} %</span>
      <Boton onClick={() => zoomPor(1.25)} title="Acercar">
        +
      </Boton>

      <span className="ml-auto truncate text-sm text-slate-400" title={pdfSource?.nombre}>
        {pdfSource ? pdfSource.nombre : 'Sin plano cargado'}
      </span>
    </header>
  );
}
