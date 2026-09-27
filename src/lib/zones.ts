// Utilidades de presentación de zonas compartidas por la lista y el lienzo.
import type { Traductor } from '../i18n';
import type { TipoZona, Zone } from '../types';

/** Nombre visible de una zona: clave i18n (ejemplos) → nombre del usuario → "Zone n"/"Zona n" traducido. */
export const nombreZona = (z: Zone, indice: number, t: Traductor) =>
  z.nombreClave ? t(z.nombreClave) : z.nombre.trim() || t('zone.defaultName', { n: indice + 1 });

/** true si el valor es un tipo de zona válido ('corte' | 'relleno'). */
export const esTipoZona = (v: unknown): v is TipoZona => v === 'corte' || v === 'relleno';
