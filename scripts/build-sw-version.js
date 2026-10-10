/**
 * Service Workerのビルドスクリプト（設計書 第6部3.2節）
 * 要件定義書8.5節：キャッシュ対象ファイルの中身からSHA-256ハッシュを算出し、CACHE_NAMEに埋め込む。
 * あわせて、assets/ 配下の画像一覧を service-worker.js の ASSET_URLS に注入する。
 *
 * 実行方法：node scripts/build-sw-version.js
 * デプロイ前に1回実行する（実行を忘れると CACHE_NAME が 'shogi-app-dev' のままになり、
 * コードを更新しても全ユーザーに古いキャッシュが配信され続ける）。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SW_FILE = path.join(ROOT, 'service-worker.js');
const MANIFEST_FILE = path.join(ROOT, 'assets', 'layout', 'assets-manifest.json');

// キャッシュ対象のディレクトリ（要件定義書8.5節）
// assets/ 配下に assets/samples（同梱サンプル棋譜）も含まれるため、サンプルを変更しても
// CACHE_NAME は自動で変わる（collectFiles が assets/ を再帰的に巡回する）。
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
  // ハッシュ対象は「アプリの資産ファイル」に限定する。SWファイル自身は含めない。
  // 含めると「書き換えたCACHE_NAMEを含むSW内容」が次回のハッシュ入力になり、
  // 何も変更していないのに実行のたびにハッシュが変わる（冪等性が壊れる）。
  const allFiles = [path.join(ROOT, 'index.html')];

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

// assets/ 配下の画像ファイルを列挙する（service-worker.js の ASSET_URLS に注入するため）
function collectImageFiles() {
  const assetsRoot = path.join(ROOT, 'assets');
  if (!fs.existsSync(assetsRoot)) return [];

  const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (IMG_EXTS.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  })(assetsRoot);

  return files
    .map((file) => './' + path.relative(ROOT, file).split(path.sep).join('/'))
    .sort();
}

// service-worker.js の ASSET_URLS マーカー行（__ASSETS_CACHE_URLS_START__〜END__）の間に
// 画像一覧を注入する。「assets にファイルを追加したのにキャッシュに入れ忘れる」を
// 防ぐための処理で、一覧は常に実ファイルから生成する。
function injectAssetUrls(swContent) {
  const ASSET_START = '// __ASSETS_CACHE_URLS_START__';
  const ASSET_END = '// __ASSETS_CACHE_URLS_END__';
  const startIdx = swContent.indexOf(ASSET_START);
  const endIdx = swContent.indexOf(ASSET_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('service-worker.js に ASSET_URLS のマーカー行が見つかりません');
  }

  const head = swContent.slice(0, startIdx + ASSET_START.length);
  const tail = swContent.slice(endIdx);
  const assetUrls = collectImageFiles();
  const body = assetUrls.length === 0
    ? '\r\n  // (assets配下に画像は無い)'
    : '\r\n' + assetUrls.map((url) => `  '${url}',`).join('\r\n') + '\r\n';
  return head + body + tail;
}

// 同梱サンプル棋譜（assets/samples/）を列挙する（service-worker.js の CACHE_URLS に注入するため）。
// 盤・駒などの見た目素材と同じ assets/ 配下に置く（既定の fetch 解決経路に載せ、オフライン
// キャッシュの一覧（collectImageFiles→ASSET_URLS）とも同じ管理単位にする）。
// データファイルのため、assets/ 配下の「画像」収集とは別に扱う。
// assets/layout 配下の sample-manifest.json もサンプル読込に必要なためセットで含める。
function collectSampleUrls() {
  const urls = ['./assets/layout/sample-manifest.json'];
  const samplesRoot = path.join(ROOT, 'assets', 'samples');
  if (!fs.existsSync(samplesRoot)) return urls;

  const entries = fs.readdirSync(samplesRoot);
  for (const name of entries.sort()) {
    if (path.extname(name).toLowerCase() === '.kif') {
      urls.push('./assets/samples/' + name.split(path.sep).join('/'));
    }
  }
  return urls;
}

// service-worker.js の CACHE_URLS にあるサンプル用マーカー行
// （__SAMPLE_CACHE_URLS_START__〜END__）の間に実ファイル一覧を注入する。
// 「サンプルを assets/samples/ に追加したのにキャッシュに入れ忘れる」を防ぐための処理。
function injectSampleUrls(swContent) {
  const SAMPLE_START = '// __SAMPLE_CACHE_URLS_START__';
  const SAMPLE_END = '// __SAMPLE_CACHE_URLS_END__';
  const startIdx = swContent.indexOf(SAMPLE_START);
  const endIdx = swContent.indexOf(SAMPLE_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('service-worker.js に SAMPLE_CACHE_URLS のマーカー行が見つかりません');
  }

  const head = swContent.slice(0, startIdx + SAMPLE_START.length);
  const tail = swContent.slice(endIdx);
  const sampleUrls = collectSampleUrls();
  const body = '\r\n' + sampleUrls.map((url) => `  '${url}',`).join('\r\n') + '\r\n';
  return head + body + tail;
}

// service-worker.js の ASSET_URLS 注入と CACHE_NAME 書き換えを行う
function updateServiceWorker() {
  let swContent = fs.readFileSync(SW_FILE, 'utf8');

  // 1) 現在の assets 画像一覧を ASSET_URLS へ注入（手書きで一覧を管理するリスクを排除）
  swContent = injectAssetUrls(swContent);

  // 1.5) 同梱サンプル棋譜一覧を CACHE_URLS へ注入
  swContent = injectSampleUrls(swContent);

  // 2) アプリ資産の中身から算出したハッシュを CACHE_NAME に埋め込む。
  //    CACHE_NAME が変わることで SW のスクリプト文字列が変わり、ブラウザが
  //    再インストールして古いキャッシュごと差し替えてくれる
  //    （cache-first運用の前提となる仕組み）。
  const versionHash = computeHash();
  const updated = swContent.replace(
    /const CACHE_NAME = '[^']*';/,
    `const CACHE_NAME = 'shogi-app-${versionHash}';`
  );
  fs.writeFileSync(SW_FILE, updated, 'utf8');
  console.log(`CACHE_NAME updated: shogi-app-${versionHash}`);
}

updateServiceWorker();