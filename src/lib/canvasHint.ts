// Qué instrucción mostrar sobre el lienzo según la herramienta activa y el estado del plano.
import type { Clave } from '../i18n';
import type { Herramienta } from '../types';

/** Estado del plano en el lienzo. */
export type EstadoPlano = 'vacio' | 'cargando' | 'error' | 'listo';

/**
 * Clave i18n del aviso del lienzo, o null si no hay que mostrar nada (herramienta Navegar).
 * Sin plano (vacío o con error) se pide cargar un PDF en lugar de no hacer nada en silencio.
 */
export function claveAyudaLienzo(herramienta: Herramienta, estado: EstadoPlano, puntosCalibracion: number): Clave | null {
  if (herramienta === 'navegar') return null;
  if (estado === 'cargando') return 'canvas.loading';
  if (estado !== 'listo') return 'canvas.needPdf';
  if (herramienta === 'dibujar') return 'canvas.hint.draw';
  return puntosCalibracion === 0 ? 'canvas.cal.step1' : puntosCalibracion === 1 ? 'canvas.cal.step2' : 'canvas.cal.step3';
}

/**
 * Pista para un error al cargar el PDF: si el archivo en sí no es un PDF válido se sugiere otro
 * archivo; en cualquier otro caso (worker de pdf.js que no carga, módulo que no se puede importar,
 * función inexistente en un navegador antiguo…) se sugiere reiniciar la app y actualizar el navegador.
 */
export function claveAyudaErrorPdf(mensaje: string): Clave {
  return /invalid pdf|pdf header|password|missing pdf|corrupt/i.test(mensaje) ? 'canvas.errorHintFile' : 'canvas.errorHint';
}
