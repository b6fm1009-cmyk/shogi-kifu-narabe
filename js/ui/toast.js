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
 * @param {{label: string, onClick: () => void}} [action] - 任意のアクションボタン。
 *   指定時はボタンが本文の右に付き、押すとトーストを閉じて onClick を呼ぶ。
 *   なぜ: SW更新のように「ユーザーの明示操作に応じて初めて処理を走らせたい」場合は、
 *   ページ全体の任意クリックを拾うより狙った操作だけに反応するボタンを持たせた方が、
 *   「誤操作で勝手に処理が走る」事故を防げる。既存の表示専用トースト（本文のみ）は
 *   従来どおり action 未指定で使える。
 */
export function showToast(message, durationMs = 3000, action = null) {
  const container = getContainer();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  let timer = null;
  function dismiss() {
    // なぜ: ボタン押下とタイマー発火が重なると remove が二重実行になるため、
    // 先にタイマーを必ず解除してから閉じる。
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }

  if (action) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action';
    actionBtn.textContent = action.label;
    actionBtn.addEventListener('click', () => {
      dismiss();
      action.onClick();
    });
    toast.appendChild(actionBtn);
  }

  // アニメーション用に一度フレームを挟む
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  timer = setTimeout(dismiss, durationMs);
}