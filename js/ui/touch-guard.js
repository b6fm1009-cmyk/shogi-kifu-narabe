/**
 * ダブルタップズーム抑制ユーティリティ（修正②）
 *
 * 背景：CSSの touch-action: manipulation はボタン等に既に指定済みだが、
 * iOS Safariでは disabled 状態の <button> に対してこの指定が無視されることがあり、
 * 無効化された「次」「最後」ボタンを連打するとブラウザ標準のダブルタップズームが
 * 発生してしまう（要望②の実際の原因）。
 *
 * disabled要素自体にはタッチイベントが配送されない場合があるため、常に有効な
 * 親コンテナ側でタッチを監視し、短時間内の2回目のtouchendだけをpreventDefault()する。
 * これにより「誤操作によるダブルタップズーム」だけを防ぎ、ピンチズーム（2本指）や
 * 通常のスクロールなど他のジェスチャーには影響しない。
 */

// iOSのダブルタップズーム判定のしきい値。一般的なダブルタップ検出の目安（300ms）に合わせる。
const DOUBLE_TAP_THRESHOLD_MS = 300;

/**
 * 指定した要素配下で、ダブルタップによるズームだけを抑制する。
 * @param {HTMLElement} containerEl - 常に有効な親要素（ボタン自体がdisabledでも配下として監視できる）
 */
export function suppressDoubleTapZoom(containerEl) {
  let lastTouchEndTime = 0;

  containerEl.addEventListener('touchend', (e) => {
    // 2本指以上（ピンチズーム等の意図的な操作）は対象外
    if (e.touches.length > 0) return;

    const now = Date.now();
    if (now - lastTouchEndTime <= DOUBLE_TAP_THRESHOLD_MS) {
      // 短時間の連続タップ＝ダブルタップズームのトリガーとみなし、ズームだけを止める。
      // クリック自体（＝ボタンの本来の操作）は妨げない。
      e.preventDefault();
    }
    lastTouchEndTime = now;
  }, { passive: false });
}

/**
 * 長押しによる画像保存メニュー等を抑制する（修正②）。
 *
 * 背景：盤・駒の画像は配布素材であり、無断で保存できる状態は望ましくない。
 * CSSの user-select:none / -webkit-touch-callout:none で大半のケースは防げるが、
 * それらが効かない環境向けの保険として、JS側でも contextmenu（長押しメニュー）と
 * dragstart（画像のドラッグ保存）を明示的に止める。
 *
 * @param {HTMLElement} containerEl - 対象領域の親要素（盤・駒・成りポップアップ・
 *   アセットドロワーのサムネイルなど、配布素材の画像を含むコンテナ）
 */
export function suppressImageSaveGestures(containerEl) {
  containerEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  containerEl.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });
}
