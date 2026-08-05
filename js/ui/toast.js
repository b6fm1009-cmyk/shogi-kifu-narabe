/**
 * 汎用トースト表示（設計書 第6部2.2節）
 */

let toastContainer = null;

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * 画面上部に一時メッセージを表示する。
 * @param {string} message
 * @param {number} durationMs - 表示時間（デフォルト3000ms）
 */
export function showToast(message, durationMs = 3000) {
  const container = getContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  // アニメーション用に一度フレームを挟む
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}