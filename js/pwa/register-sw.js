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
            // 新バージョンが利用可能になったことを通知
            import('../ui/toast.js').then(({ showToast }) => {
              showToast('更新があります', 5000);
            });
            // ユーザー操作後に新SWを有効化
            window.addEventListener('click', () => {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }, { once: true });
          }
        });
      });
    });
  });
}