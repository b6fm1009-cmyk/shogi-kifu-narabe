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

    // 修正⑩: 盤面（#board）・持ち駒欄（.hand-pieces-container）配下のタップは連打操作
    // として許可する。「駒を選択→移動先／打つ場所をタップ」という将棋アプリの正規操作は、
    // 300ms以内の連続タップになることが普通にある（速い人ほど短くなる）。ここを
    // ダブルタップズーム抑制の対象に含めると、2回目のtouchendがpreventDefault()され、
    // そこから合成されるはずのclickが握りつぶされて「移動先をタップしても駒が動かない」
    // という致命的な不具合になる（修正⑧でbody全体に監視範囲を広げた際に発生した回帰）。
    // 盤面・持ち駒欄は本来ズームされても実害が小さい領域ではなく、むしろ通常操作の
    // 頻度が極めて高い領域のため、ここだけは個別に対象外とする
    // （js/ui/selection.js の handleTap の origin='BOARD'|'HAND' に対応する領域）。
    //
    // 修正⑨→⑩の訂正: 除外セレクタを .player-info-box から .hand-pieces-container に
    // 変更した。index.html の構造上、.player-info-box は持ち駒欄そのものではなく、
    // その中に .player-name（対局者名）を子要素として含む見出し的なボックスであり、
    // closest('.player-info-box') はプレイヤー名タップも巻き込んで除外してしまっていた
    // （プレイヤー名欄のダブルタップズームがガードされない回帰）。持ち駒の連打操作に
    // 必要なのは実際に駒が描画される .hand-pieces-container だけなので、そこに絞る。
    if (e.target.closest('#board, .hand-pieces-container')) return;

    // 修正⑦: 有効なbutton要素上のタップは連打操作として許可する。
    // ここでpreventDefault()すると、そのtouchendから合成されるはずのclickイベントも
    // 一緒に握りつぶされてしまい、ボタン連打が効かなくなるため。
    // 修正⑧: ただしdisabledなbuttonはclickが合成されず「連打操作」として機能しない
    // （無効化された「最後」ボタン等を連打してもアプリの動作は何も起きない）ため、
    // 除外対象から外し、ダブルタップズームの抑制対象に含める。これにより
    // disabledボタンの連打によるズーム誤爆（今回の主症状）を防ぐ。
    //
    // 修正⑪: e.target.closest('button') による判定は、disabledなbuttonでは機能しない
    // ことが判明した。本ファイル冒頭のコメントの通り、iOS Safariはdisabled要素に
    // タッチイベント自体を配送しないことがあり、その場合 e.target は button ではなく
    // 下に重なっている親要素（例: .bottom-controls-group）になる。結果、
    // 「有効なbuttonの連打」のつもりの除外判定が外れ、disabledボタン連打時に
    // 親要素がガード対象として扱われる一方、肝心のdisabledボタン自体を狙い撃ちした
    // つもりの分岐（修正⑧）にも到達しない、という状態になっていた。
    // タッチが配送されない以上 e.target からは判定できないため、タッチ座標に実際に
    // 存在する要素を document.elementFromPoint で取得し直し、それがbuttonかどうかで
    // 判定する（disabled要素も含め、座標上に描画されている要素を正しく拾える）。
    const touch = e.changedTouches[0];
    const elementAtPoint = touch
      ? document.elementFromPoint(touch.clientX, touch.clientY)
      : e.target;
    const targetButton = elementAtPoint && elementAtPoint.closest('button');
    if (targetButton && !targetButton.disabled) return;

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
