/**
 * Service Worker（設計書 第6部3章）
 * 開発中は register-sw.js から登録しない（要件定義書8.5節）
 * CACHE_NAME はビルド時に scripts/build-sw-version.js が注入する
 */

const CACHE_NAME = 'shogi-app-dev';

// キャッシュ対象ファイル一式（要件定義書8.5節：棋譜データは含まない）
const CACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './lib/json-kifu-format.min.js',
  './js/main.js',
  './js/state/app-state.js',
  './js/models/board.js',
  './js/models/move.js',
  './js/models/kifu.js',
  './js/core/apply-move.js',
  './js/core/kifu-judge.js',
  './js/core/nari-judge.js',
  './js/assets/asset-manifest.js',
  './js/assets/asset-fit.js',
  './js/kifu-io/kif-parser.js',
  './js/kifu-io/clipboard-import.js',
  './js/kifu-io/file-import.js',
  './js/ui/toast.js',
  './js/ui/board-view.js',
  './js/ui/player-info.js',
  './js/ui/kifu-bar.js',
  './js/ui/selection.js',
  './js/ui/nari-popup.js',
  './js/ui/asset-drawer.js',
  './js/ui/header-buttons.js',
  './js/ui/bottom-controls.js',
  './js/pwa/register-sw.js',
  './assets/layout/assets-manifest.json',
  './assets/layout/board-layout.json',
  './assets/layout/piece-layout.json',
  './assets/layout/piece-fit.json'
];

// 盤・駒画像もキャッシュ対象（assets/ 配下を動的にキャッシュする）
// キャッシュ対象の盤・駒画像パスは assets-manifest.json から取得する想定だが、
// ビルドスクリプトが assets/ ディレクトリ配下の画像ファイルを機械的に列挙して
// CACHE_URLS に追加する。開発中はここに手動で追加してもよい。

// install: キャッシュにファイル一式を格納
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
  );
});

// activate: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// fetch: キャッシュ優先で応答
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});