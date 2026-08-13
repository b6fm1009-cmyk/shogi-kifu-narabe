/**
 * ボタンの有効／無効状態を扱う共通ヘルパー（修正⑫）
 *
 * 背景：ネイティブの disabled 属性を使うと、iOS Safariが disabled 要素への
 * タッチイベント配送を省略することがある（本来ボタンに来るはずのtouchendが
 * ボタンの祖先要素にすり替わって配送される）。これにより、以下のような不具合が
 * 連鎖的に発生していた。
 *   - touch-guard.js のダブルタップズーム抑制ロジックが disabled ボタンを
 *     正しく検出できず、無効化されたボタンを連打するとブラウザ標準の
 *     ダブルタップズームが誤爆する（一度発生すると reload 以外に解除手段がない）。
 *   - タッチ座標から document.elementFromPoint で判定し直す対症療法を試みたが、
 *     状態が高速に切り替わる場面（棋譜を連打で戻す等）では、直前のタッチ配送先が
 *     ボタンかその祖先かがフレームごとに揺れ、再現条件を完全には塞ぎきれなかった。
 *
 * 対策：ネイティブ disabled は使わず、ボタンは常に有効な <button>（タッチは常に
 * ボタン自身に配送される）のまま、見た目は CSS クラス（is-disabled）で、
 * 機能の無効化は aria-disabled 属性 + クリックハンドラ側のガードで行う。
 * これにより「タッチが配送されるか」というブラウザ依存の不確実な挙動から
 * 完全に切り離せる。aria-disabled はスクリーンリーダーにも「無効」であることが
 * 正しく伝わるため、アクセシビリティ上の後退もない。
 */

/**
 * ボタンの有効／無効を切り替える。
 * @param {HTMLButtonElement} btn
 * @param {boolean} isDisabled
 */
export function setButtonDisabled(btn, isDisabled) {
  btn.classList.toggle('is-disabled', isDisabled);
  if (isDisabled) {
    btn.setAttribute('aria-disabled', 'true');
  } else {
    btn.removeAttribute('aria-disabled');
  }
}

/**
 * ボタンが現在無効化されているかを判定する。
 * クリックハンドラの先頭で `if (isButtonDisabled(btn)) return;` の形で使う。
 * @param {HTMLButtonElement} btn
 * @returns {boolean}
 */
export function isButtonDisabled(btn) {
  return btn.getAttribute('aria-disabled') === 'true';
}
