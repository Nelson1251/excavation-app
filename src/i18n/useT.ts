// Hook de traducción: devuelve t(clave, params?) en el idioma actual del store.
import { useMemo } from 'react';
import { useProjectStore } from '../store/projectStore';
import { crearTraductor, type Traductor } from './index';

export function useT(): Traductor {
  const idioma = useProjectStore((s) => s.language);
  return useMemo(() => crearTraductor(idioma), [idioma]);
}
