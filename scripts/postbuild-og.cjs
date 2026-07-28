/**
 * postbuild-og.cjs
 *
 * OG por-ruta para una SPA estática. Vite emite un único dist/index.html con
 * los OG del sitio; este script lo clona a dist/infraestructura/escuelas.html
 * cambiando solo los meta OpenGraph/Twitter por los de la sección. Un rewrite
 * en vercel.json sirve ese HTML en /infraestructura/escuelas (transparente: la
 * URL no cambia y el bundle es el mismo, así que el SPA rutea igual).
 *
 * La descripción se deriva del JSON del informe para no desincronizarse.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const idxPath = path.join(ROOT, 'dist', 'index.html');
if (!fs.existsSync(idxPath)) {
  console.error('  ⚠️  postbuild-og: dist/index.html no existe (¿corriste vite build?)');
  process.exit(0);
}

const data = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public', 'data', 'infraestructura', 'escuelas.json'), 'utf8'),
);
const total = data.charts.find(c => c.type === 'map').data.length;
const pct = data.mapData[0].formatted; // ej. "54,6%"

const OG = {
  title: 'Estado edilicio de las escuelas — Morón · Radar-PBA',
  desc: `${total} escuelas relevadas en Morón: el ${pct} en estado rojo. Mapa del semáforo edilicio, escuela por escuela.`,
  image: 'https://moron.openarg.org/infraestructura/og-escuelas.png',
  url: 'https://moron.openarg.org/infraestructura/escuelas',
};

const html = fs.readFileSync(idxPath, 'utf8')
  .replace(/<title>[^<]*<\/title>/, `<title>${OG.title}</title>`)
  .replace(/(<meta name="description" content=")[^"]*(")/, `$1${OG.desc}$2`)
  .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${OG.url}$2`)
  .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${OG.title}$2`)
  .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${OG.desc}$2`)
  .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${OG.image}$2`)
  .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${OG.url}$2`)
  .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${OG.title}$2`)
  .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${OG.desc}$2`)
  .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${OG.image}$2`);

const outDir = path.join(ROOT, 'dist', 'infraestructura');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'escuelas.html'), html, 'utf8');
console.log(`  ✓ dist/infraestructura/escuelas.html (OG de la sección · ${total} esc · ${pct} rojo)`);
