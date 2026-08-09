/**
 * Service Worker（設計書 第6部3章）
 * 開発中は register-sw.js から登録しない（要件定義書8.5節）
 * CACHE_NAME はビルド時に scripts/build-sw-version.js が注入する
 */

const CACHE_NAME = 'shogi-app-12e6c2ef03b1';

// 盤・駒・背景画像はアプリの見た目に必須だが、一覧を手で書き下すと
// 「ファイルを追加したのにキャッシュに入れ忘れる」事故が起きやすい。
// そのため assets/ 配下の画像はビルドスクリプト（scripts/build-sw-version.js）が
// 機械的に列挙し、下のマーカー行の間に注入する。
// （この配列が空のまま＝ビルド未実行＝開発中の状態）
const ASSET_URLS = [
  // __ASSETS_CACHE_URLS_START__
  './assets/background/tatami.png',
  './assets/boards/dark.png',
  './assets/boards/polyvinyl_chloride.png',
  './assets/boards/wood.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/pieces/dark_1_letter.png',
  './assets/pieces/dark_gothic_font_1_letter.png',
  './assets/pieces/gothic_font_1_letter.png',
  './assets/pieces/grain_wood_1_letter.png',
  './assets/pieces/kosho_1_letter.png',
  './assets/pieces/maki_ryoko_1_letter.png',
  './assets/pieces/maki_ryoko_2_letter.png',
  './assets/pieces/polyvinyl_chloride_1_letter.png',
  './assets/pieces/polyvinyl_chloride_2_letter.png',
// __ASSETS_CACHE_URLS_END__
];

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
  './assets/layout/piece-fit.json',
  // この2ファイルは index.html の起動時に静的にimportされるため、キャッシュ漏れすると
  // ネットワーク断でESモジュールの解決に失敗し、アプリが起動すらできなくなる
  // （main.js → ui/touch-guard.js、ui/bottom-controls.js → ui/move-list-popup.js の参照関係）。
  './js/ui/touch-guard.js',
  './js/ui/move-list-popup.js',
  ...ASSET_URLS
];

// 盤・駒・背景画像のプリキャッシュは ASSET_URLS（ビルドスクリプトが assets/ 配下から
// 自動列挙して注入）で行う。ビルド未実行の開発中は、実行時に読まれた応答を
// fetch ハンドラ側でキャッシュするため（STALE_WHILE_REVALIDATE）、オフライン化される。

// なぜ: SWのスコープ（= service-worker.js の設置場所）には、このアプリ以外のコンテンツが
// 同居する可能性がある。「URL無制限で全GETをキャッシュ優先応答」にしておくと、同居コンテンツの
// ページまでこのSWに巻き込まれ、そちらが古い版を返し続ける事故になりうる。
// そこで当アプリが把握しているファイル（CACHE_URLS＝ビルドスクリプトが実ファイルから生成した
// 一覧。ASSET_URLSもここに含まれる）のみを扱うと決め打ちし、fetchハンドラでURLを絞り込むために
// パス（pathname）の集合を事前計算しておく。扱わないURLはブラウザ標準の挙動に委ねる。
const APP_URL_PATHS = new Set(
  CACHE_URLS.map((relativeUrl) => new URL(relativeUrl, self.registration.scope).pathname)
);

// install: キャッシュにファイル一式を格納
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
  );
});

// activate: 古いキャッシュを削除し、コントロールを新SWへ即時移す
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      }),
      // 更新適用時にページ側が location.reload() しても、そのページを新SWの配下に
      // 置けるようにする。clients.claim() がないと「タブを全部閉じて次回起動」まで
      // 旧バージョンの挙動が続き、更新の案内と実挙動がズレる。
      self.clients.claim()
    ])
  );
});

// register-sw.js がユーザー操作（トーストのクリック）に応じて送る SKIP_WAITING を
// 受け取り、待機中のSWを即アクティブ化する。受ける側の実装が無いと postMessage が
// 黙って捨てられ、「更新があります」と案内するだけで何も反映されない。
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// fetch: キャッシュ優先で即応答しつつ、裏で最新版を取得してキャッシュを更新する
// （stale-while-revalidate）。
// - キャッシュの主源は install 時の PRECACHE（CACHE_URLS＋ASSET_URLS）。
// - それらの漏れや将来の資産追加に備え、ネットワーク成功時にここでキャッシュへ
//   追加しておく。これが無いと「プリキャッシュ一覧に載っていない資産」は
//   何度オンラインで使ってもオフライン非対応のままになる。
self.addEventListener('fetch', (event) => {
  // 画面表示に必要なGETのみ扱う（POST等はブラウザ標準の挙動に委ねる）
  if (event.request.method !== 'GET') return;

  // なぜ: 上で作成した APP_URL_PATHS に載っていないURLは、このSWの管理対象から外す
  // （respondWith しない＝キャッシュもせず、ネットワーク標準の挙動のまま）。
  // これにより、同じスコープ配下に置かれた他コンテンツを誤ってキャッシュし「古い版が返る」、
  // あるいは「キャッシュ容量を食う」という悪さをアプリ内のファイルだけに限定できる。
  // 副作用として、ビルドスクリプトの一覧漏れによる新規ファイルはランタイムキャッシュから
  // 外れるが、オンラインでは通常のネットワーク応答にフォールバックするため、
  // 「壊れて応答しない」ではなく「素の通信になるだけ」で済む。
  const requestUrl = new URL(event.request.url);
  if (!APP_URL_PATHS.has(requestUrl.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              // キャッシュ更新の失敗（容量超過等）は本応答を妨げてはならない
              cache.put(event.request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    )
  );
});