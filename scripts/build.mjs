import { mkdir, writeFile, copyFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const distDir = resolve(rootDir, 'dist');

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function copyAsset(fileName) {
  await copyFile(resolve(rootDir, fileName), resolve(distDir, fileName));
}

async function main() {
  await ensureDir(distDir);
  await Promise.all(['index.html', 'app.js', 'styles.css'].map(copyAsset));

  const token = process.env.MAPBOX_ACCESS_TOKEN || '';
  const configJs = `window.MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || ${JSON.stringify(token)};\n`;
  const configLocalJs = 'window.MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || "";\n';
  await writeFile(resolve(distDir, 'config.js'), configJs, 'utf8');
  await writeFile(resolve(distDir, 'config.local.js'), configLocalJs, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
