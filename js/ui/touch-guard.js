/**
 * ダブルタップズーム抑制ユーティリティ
 * （修正②→修正⑥で位置づけ変更→修正⑦でボタン除外→修正⑧〜⑪で紆余曲折→修正⑫で方針転換）
 *
 * 背景：CSSの touch-action: manipulation はボタン等に既に指定済みだが、
 * iOS Safariのアクセシビリティ設定によってはページのviewport指定
 * （maximum-scale=1・user-scalable=no）が無視されズームが発生しうる。
 * 一度ズームが発生するとreload以外に解除手段がない構造（index.htmlのviewport
 * meta参照）のため、これをJS側でも二重に防ぐ。
 *
 * 監視方法：常に有効な親コンテナ（document.body）側でタッチを監視し、
 * 短時間内の2回目のtouchendだけをpreventDefault()する。これにより
 * 「誤操作によるダブルタップズーム」だけを防ぎ、ピンチズーム（2本指）や
 * 通常のスクロールなど他のジェスチャーには影響しない。
 *
 * 除外が必要な領域：
 *  - 盤面（#board）・持ち駒欄（.hand-pieces-container）：「駒を選択→移動先／
 *    打つ場所をタップ」という将棋アプリの正規操作は300ms以内の連続タップに
 *    なることが普通にあるため、ここをpreventDefault()すると2回目のtouchendから
 *    合成されるはずのclickが握りつぶされ、駒が動かせなくなる
 *    （js/ui/selection.js の handleTap の origin='BOARD'|'HAND' に対応する領域）。
 *  - button要素：連打そのものが意図した操作であり、ダブルタップズームの
 *    抑制対象として扱う必要がない。
 *
 * 修正⑧〜⑪の経緯（ボタンの有効／無効判定で迷走した記録）：
 * 当初はネイティブの disabled 属性で無効化ボタンを表現し、「有効なbuttonだけ
 * 除外・disabledなbuttonは抑制対象」という条件分岐（e.target.closest('button') と
 * .disabled プロパティ）で切り分けようとした。しかしiOS Safariは disabled 要素を
 * ヒットテスト対象から除外することがあり、touchendが button ではなくその祖先要素に
 * 配送されるケースが確認された。document.elementFromPoint で座標から要素を
 * 取り直す対症療法も試みたが、有効／無効が高速に切り替わる操作（棋譜を連打で
 * 戻す等）では再現条件を塞ぎきれなかった。
 *
 * 修正⑫の方針転換：問題の根はネイティブ disabled 属性が招くタッチ配送の
 * 不確実性そのものにあると判断し、disabled 属性の使用自体をやめた
 * （js/ui/button-state.js 参照）。ボタンは無効化中も常に有効な <button> のままとし、
 * 見た目は .is-disabled クラス、機能の無効化は aria-disabled 属性 + 各clickハンドラ
 * 側のガードで行う。これにより本ファイルは「button要素かどうか」だけを見れば良く
 * なり、disabled状態の判定はもう関与しない。タッチは常にボタン自身に配送される
 * ため、e.target.closest('button') の判定はブラウザ依存の例外なく機能する。
 */

// iOSのダブルタップズーム判定のしきい値。一般的なダブルタップ検出の目安（300ms）に合わせる。
const DOUBLE_TAP_THRESHOLD_MS = 300;

/**
 * 指定した要素配下で、ダブルタップによるズームだけを抑制する。
 * @param {HTMLElement} containerEl - 常に有効な親要素（通常は document.body）
 */
export function suppressDoubleTapZoom(containerEl) {
  let lastTouchEndTime = 0;

  containerEl.addEventListener('touchend', (e) => {
    // 2本指以上（ピンチズーム等の意図的な操作）は対象外
    if (e.touches.length > 0) return;

    // 盤面・持ち駒欄配下のタップは連打操作として許可する（理由は本ファイル冒頭コメント）。
    if (e.target.closest('#board, .hand-pieces-container')) return;

    // button要素上のタップは連打操作として許可する。修正⑫でネイティブdisabledを
    // 廃止したため、無効化中のボタンも含めタッチは常にボタン自身に配送される。
    // ここでpreventDefault()すると、そのtouchendから合成されるはずのclickイベントも
    // 一緒に握りつぶされてしまい、ボタン連打（有効／無効を問わず）が効かなくなるため、
    // button要素は一律で対象外とする。
    if (e.target.closest('button')) return;

    const now = Date.now();
    if (now - lastTouchEndTime <= DOUBLE_TAP_THRESHOLD_MS) {
      // 短時間の連続タップ＝ダブルタップズームのトリガーとみなし、ズームだけを止める。
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
