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
  // 백엔드 API 주소: 환경변수 우선, 없으면 Railway 배포 주소 기본값.
  const apiBase = process.env.API_BASE_URL || 'https://tranquil-peace-production-45dd.up.railway.app';
  const configJs =
    `window.MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || ${JSON.stringify(token)};\n` +
    `window.API_BASE_URL = window.API_BASE_URL || ${JSON.stringify(apiBase)};\n`;
  const configLocalJs = 'window.MAPBOX_ACCESS_TOKEN = window.MAPBOX_ACCESS_TOKEN || "";\n';
  await writeFile(resolve(distDir, 'config.js'), configJs, 'utf8');
  await writeFile(resolve(distDir, 'config.local.js'), configLocalJs, 'utf8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
