// Diseño principal: barra de herramientas arriba, lienzo al centro y panel lateral a la derecha.
import Canvas from './components/Canvas';
import ScaleCalibration from './components/ScaleCalibration';
import Toolbar from './components/Toolbar';
import ZoneList from './components/ZoneList';

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <Toolbar />
      <main className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <Canvas />
        </div>
        <aside className="flex w-96 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-800 bg-slate-900/40 p-3">
          <ScaleCalibration />
          <ZoneList />
        </aside>
      </main>
    </div>
  );
}
