// Capa ligera de internacionalización (sin dependencias): diccionarios en/es y función de traducción.
import { en, type Clave, type Diccionario } from './en';
import { es } from './es';

export type { Clave };

/** Idiomas disponibles. 'en' es el predeterminado. */
export type Idioma = 'en' | 'es';
export const IDIOMA_POR_DEFECTO: Idioma = 'en';
export const IDIOMAS: readonly Idioma[] = ['en', 'es'];

/** Parámetros para interpolar en el texto: "Zones ({count})" + { count: 3 }. */
export type Params = Record<string, string | number>;
/** Función de traducción ligada a un idioma. */
export type Traductor = (clave: Clave, params?: Params) => string;

const DICCIONARIOS: Record<Idioma, Diccionario> = { en, es };

export function esIdioma(v: unknown): v is Idioma {
  return v === 'en' || v === 'es';
}

/** Traduce una clave al idioma dado, sustituyendo {parámetros}. Si falta, usa inglés y luego la clave. */
export function traducir(idioma: Idioma, clave: Clave, params?: Params): string {
  const texto: string = DICCIONARIOS[idioma][clave] ?? en[clave] ?? clave;
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, nombre: string) => (nombre in params ? String(params[nombre]) : m));
}

/** Crea un traductor para un idioma (útil fuera de React, p. ej. en exportaciones o pruebas). */
export function crearTraductor(idioma: Idioma): Traductor {
  return (clave, params) => traducir(idioma, clave, params);
}
