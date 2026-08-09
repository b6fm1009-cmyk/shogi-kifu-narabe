/**
 * ダブルタップズーム抑制ユーティリティ（修正②、修正⑥で位置づけ変更、修正⑦でボタン除外）
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
 *
 * 修正⑥での位置づけ変更：ズームが一度発生するとリロードでしか解除できない問題（index.html
 * のviewport meta参照）を受け、根本対策として index.html の viewport に
 * maximum-scale=1・user-scalable=no を追加した。本来これだけでピンチズーム・
 * ダブルタップズームの双方がブラウザレベルで無効になるはずだが、iOS Safariの
 * バージョンや挙動差による例外を完全には保証できないため、本関数は「万一
 * viewport指定をブラウザが無視した場合の保険」として残す（多層防御。片方だけに
 * 依存すると、将来どちらかを単独で外した際に無防備になるリスクがあるため、
 * 対策の理由を明記した上であえて両方残す判断とした）。
 *
 * 修正⑦（button要素上のタップを対象外にした理由）：
 * touchendでのpreventDefault()は、ズームだけでなく、そのtouchendから合成される
 * click イベント自体の発火も止めてしまう（ブラウザの仕様）。そのため元の実装では
 * 「次」「最後」ボタンを300ms未満の間隔で連打すると、2回目以降のタップのclickが
 * 握りつぶされ、ボタンが反応しないという新たな不具合を生んでいた（意図：ズームの
 * 誤爆だけを止める／実際の挙動：ボタン本来の操作まで止めてしまっていた）。
 * button要素上のタップはそもそも「意図した操作」であり、ダブルタップズームの
 * 抑制対象として扱う必要がないため、e.target が button（またはその子要素）の
 * 場合はこの関数の対象外とし、ブラウザの標準処理（＝clickの合成）に委ねる。
 * ズーム自体はviewport meta（修正⑥）で止まっているため、ボタン上で稀に
 * ダブルタップズームが起きても実害は小さいと判断した。
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

    // 修正⑦: button要素（disabled状態を含む）上のタップは連打操作として許可する。
    // ここでpreventDefault()すると、そのtouchendから合成されるはずのclickイベントも
    // 一緒に握りつぶされてしまい、ボタン連打が効かなくなるため。
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
