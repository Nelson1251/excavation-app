import { execSync } from 'node:child_process'
import { createReadStream, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Etiqueta de versión visible en la barra superior (para saber qué versión está corriendo el usuario).
const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string })
  .version
const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
})()
const fecha = new Date().toISOString().slice(0, 10)

/** Nombre público del worker de pdf.js (se sirve en la raíz: /pdf.worker.min.mjs). */
const PDF_WORKER = 'pdf.worker.min.mjs'

/**
 * Sirve el worker de pdf.js desde una URL fija del mismo origen, sin pasar por el pipeline de
 * transformación de Vite (antes se importaba con `?url` desde /node_modules/..., y Vite lo servía
 * reescrito, dependiente de la resolución de dependencias, de server.fs y de la ruta del proyecto).
 * - dev: middleware que envía el archivo tal cual desde node_modules.
 * - build: se emite como dist/pdf.worker.min.mjs (vite preview y cualquier servidor estático lo sirven).
 * Se usa la versión "legacy" de pdf.js: incluye polyfills (core-js) para Chrome/Edge no actualizados;
 * la versión moderna usa APIs muy recientes (Map.prototype.getOrInsertComputed, Math.sumPrecise…).
 */
function pdfWorker(): Plugin {
  const require = createRequire(import.meta.url)
  const ruta = () => require.resolve(`pdfjs-dist/legacy/build/${PDF_WORKER}`)
  return {
    name: 'pdf-worker-estatico',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        if (url !== `${server.config.base}${PDF_WORKER}`) return next()
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        createReadStream(ruta()).on('error', next).pipe(res)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: PDF_WORKER, source: readFileSync(ruta()) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pdfWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
    __APP_BUILD_DATE__: JSON.stringify(fecha),
  },
})
