// Diseño principal: barra de herramientas arriba, lienzo al centro y panel lateral a la derecha.
import { useEffect } from 'react';
import Canvas from './components/Canvas';
import ScaleCalibration from './components/ScaleCalibration';
import Toolbar from './components/Toolbar';
import ZoneList from './components/ZoneList';
import ConcretePanel from './components/modules/ConcretePanel';
import AsphaltPanel from './components/modules/AsphaltPanel';
import { useProjectStore } from './store/projectStore';
import { useT } from './i18n/useT';

export default function App() {
  const idioma = useProjectStore((s) => s.language);
  const modulo = useProjectStore((s) => s.modulo);
  const t = useT();

  // Mantener el atributo lang y el título de la página en el idioma actual.
  useEffect(() => {
    document.documentElement.lang = idioma;
    document.title = t('app.title');
  }, [idioma, t]);

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <Toolbar />
      {/* El módulo de excavación se mantiene montado (oculto) para no volver a rasterizar el PDF. */}
      <main className={`min-h-0 flex-1 ${modulo === 'excavacion' ? 'flex' : 'hidden'}`}>
        <div className="min-w-0 flex-1">
          <Canvas />
        </div>
        <aside className="flex w-96 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-800 bg-slate-900/40 p-3">
          <ScaleCalibration />
          <ZoneList />
        </aside>
      </main>
      {modulo === 'concreto' && (
        <main className="min-h-0 flex-1">
          <ConcretePanel />
        </main>
      )}
      {modulo === 'asfalto' && (
        <main className="min-h-0 flex-1">
          <AsphaltPanel />
        </main>
      )}
    </div>
  );
}
