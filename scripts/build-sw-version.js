/**
 * Service WorkerのCACHE_NAMEをハッシュから自動生成するビルドスクリプト（設計書 第6部3.2節）
 * 要件定義書8.5節：キャッシュ対象ファイルの中身からSHA-256ハッシュを算出し、CACHE_NAMEに埋め込む。
 *
 * 実行方法：node scripts/build-sw-version.js
 * デプロイ前に1回実行する。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SW_FILE = path.join(ROOT, 'service-worker.js');
const MANIFEST_FILE = path.join(ROOT, 'assets', 'layout', 'assets-manifest.json');

// キャッシュ対象のディレクトリ（要件定義書8.5節）
const CACHE_DIRS = ['css', 'js', 'lib', 'assets'];

// ハッシュ計算対象ファイルを収集
function collectFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// キャッシュ対象ファイルのハッシュを計算
function computeHash() {
  const hash = crypto.createHash('sha256');
  const allFiles = [path.join(ROOT, 'index.html'), SW_FILE];

  for (const dir of CACHE_DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (fs.existsSync(dirPath)) {
      allFiles.push(...collectFiles(dirPath));
    }
  }

  // assets-manifest.json も含める（盤・駒の選択肢が変わったらバージョンが変わる）
  if (fs.existsSync(MANIFEST_FILE)) {
    allFiles.push(MANIFEST_FILE);
  }

  // ファイル順を安定させる
  allFiles.sort();

  for (const file of allFiles) {
    const content = fs.readFileSync(file);
    hash.update(content);
  }

  return hash.digest('hex').slice(0, 12);
}

// service-worker.js の CACHE_NAME を書き換える
function updateServiceWorker() {
  const versionHash = computeHash();
  const swContent = fs.readFileSync(SW_FILE, 'utf8');
  const updated = swContent.replace(
    /const CACHE_NAME = '[^']*';/,
    `const CACHE_NAME = 'shogi-app-${versionHash}';`
  );
  fs.writeFileSync(SW_FILE, updated, 'utf8');
  console.log(`CACHE_NAME updated: shogi-app-${versionHash}`);
}

updateServiceWorker();