import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {createHash} from 'crypto';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin, type ResolvedConfig} from 'vite';

/**
 * PWA hecha a mano (sin dependencias): en el build genera /sw.js a partir de src/pwa/sw-template.js
 * inyectando la lista de archivos a precachear (index.html + assets con hash + public/) y una versión
 * calculada con el contenido del build, para que cada despliegue invalide las cachés anteriores.
 * En `vite dev` no hace nada.
 */
function cjnServiceWorker(): Plugin {
  const templatePath = path.resolve(import.meta.dirname, 'src/pwa/sw-template.js');
  let config: ResolvedConfig;

  const listPublicFiles = (dir: string, prefix = ''): string[] => {
    if (!dir || !fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
      if (entry.name.startsWith('.')) return [];
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return listPublicFiles(path.join(dir, entry.name), rel);
      return rel === 'sw.js' ? [] : [rel];
    });
  };

  return {
    name: 'cjn-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    generateBundle(_options, bundle) {
      const base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      const MAX_BYTES = 3 * 1024 * 1024;
      const hash = createHash('sha256');
      const files = new Set<string>(['index.html']);

      for (const [fileName, item] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
        if (fileName === 'sw.js' || fileName.endsWith('.map')) continue;
        const content = item.type === 'chunk' ? item.code : item.source;
        if (content.length > MAX_BYTES) continue;
        files.add(fileName);
        hash.update(fileName);
        // index.html no lleva hash en el nombre: su contenido define la versión
        if (fileName.endsWith('.html')) hash.update(typeof content === 'string' ? content : Buffer.from(content));
      }
      for (const file of listPublicFiles(config.publicDir)) {
        files.add(file);
        hash.update(file);
        hash.update(fs.readFileSync(path.join(config.publicDir, file)));
      }

      const template = fs.readFileSync(templatePath, 'utf8');
      hash.update(template);
      const version = hash.digest('hex').slice(0, 12);
      const precache = [...files].map((f) => `${base}${f}`);
      const apiBase = config.env.VITE_USE_MOCK_API === 'true' ? '' : String(config.env.VITE_API_URL || '');

      const source =
        `// Generado por el build (${config.mode}) · ${new Date().toISOString()}\n` +
        template
          .replace(/= self\.__SW_VERSION__;/, `= ${JSON.stringify(version)};`)
          .replace(/= self\.__SW_PRECACHE__;/, `= ${JSON.stringify(precache, null, 2)};`)
          .replace(/= self\.__SW_API_BASE__;/, `= ${JSON.stringify(apiBase)};`);

      this.emitFile({type: 'asset', fileName: 'sw.js', source});
      config.logger.info(`\n  [pwa] sw.js versión ${version} · ${precache.length} archivos en el precache`);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), cjnServiceWorker()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        usePolling: true,
        interval: 1000,
        ignored: ['**/.git/**', '**/.aistudio/**', '**/dist/**', '**/node_modules/**'],
      },
    },
  };
});
