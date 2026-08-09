/**
 * Service Worker登録・更新確認導線（設計書 第6部3.5節）
 * 要件定義書8.5節：開発中は無効化する。
 * 機能が固まった最終段階で ENABLE_SW を true に変更する。
 */

const ENABLE_SW = false; // ← 開発中は無効（デプロイ前に true にする）

/**
 * Service Workerの登録と更新検知を行う。
 */
export function registerServiceWorker() {
  if (!ENABLE_SW) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then((registration) => {
      // 新しいService Workerの検出
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 新バージョンが利用可能になったことを通知。
            // なぜ: 旧実装は「ページ上のどのクリックでも SKIP_WAITING」を送っていたため、
            // 更新トーストに気づかず盤面をタップした瞬間などにリロードが走り、
            // 並べかけの棋譜が消える事故がありえた。このアプリは棋譜進行を永続化して
            // いないため、リロード＝作業ロストを「『再読込』ボタンという明示的な操作」で
            // しか起こさない設計に変える。postMessage の受け手は service-worker.js 側の
            // message リスナー（SKIP_WAITING → self.skipWaiting()）。
            import('../ui/toast.js').then(({ showToast }) => {
              showToast('新しいバージョンがあります', 10000, {
                label: '再読込',
                onClick: () => {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              });
            });

            // 新SWが制御権を獲得したら、ページを再読込して新しい資産に切り替える。
            // これが無いと「再読込」を押しても、キャッシュ済みの旧HTML/旧JSが
            // 表示され続ける。
            let refreshed = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              if (refreshed) return;
              refreshed = true;
              window.location.reload();
            });
          } else if (newWorker.state === 'redundant') {
            // なぜ: register() は成功しても install（プリキャッシュのダウンロード）に
            // 失敗すると SW は redundant になり、無言で「オンライン専用」のまま
            // 動き続ける。エラーをコンソールに出して、開発中にハズレた原因へ
            // 気づけるようにする。
            console.error(
              'Service Worker が redundant になりました。プリキャッシュ一覧（scripts/build-sw-version.js）とデプロイ先の設定を確認してください。'
            );
          }
        });

        // なぜ: install 中のスクリプト例外は statechange（redundantのみ）では
        // 拾いきれないことがあるため、error イベントも監視して検知する。
        newWorker.addEventListener('error', (event) => {
          console.error('Service Worker でエラーが発生しました:', event.error || event.message || event);
        });
      });
    }).catch((error) => {
      // 登録に失敗した場合（非HTTPS環境や file:// からの起動、開発サーバー未起動など）に
      // 例外を黙って握りつぶさない。開発中に登録導線が壊れていても気づけるようにする。
      console.error('Service Worker登録に失敗しました:', error);
    });
  });
}