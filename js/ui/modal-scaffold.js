/**
 * move-list-popup.js（局面選択モーダル）と branch-popup.js（分岐選択モーダル）は、
 * 見た目上同じモーダルデザインを共有する（.move-list-* クラスをそのまま流用する設計。
 * branch-popup.js側コメント参照）。両ファイルとも
 *   overlay(.move-list-overlay) > popup(.move-list-popup) > header(タイトル+×ボタン) + list(.move-list-body)
 * という同一の骨組みをDOM生成しており、閉じるボタン・背景タップで閉じる処理も含めて
 * ほぼ丸ごと重複していたため、この骨組み部分だけを共通ヘルパーとして切り出した。
 * 一覧の中身（どの行を何個並べるか、行タップ時に何をするか）は完全に別物のため、
 * ここでは関知せず、呼び出し側が受け取った list 要素に自由に描画する。
 */

/**
 * モーダルの骨組み（overlay/popup/header/list）を組み立てて document.body に追加する。
 * @param {Object} options
 * @param {string} options.overlayClassName - 例: 'move-list-overlay'
 * @param {string} options.popupClassName - 例: 'move-list-popup'
 * @param {string} options.title - ヘッダーに表示するタイトル文字列
 * @param {(listEl: HTMLElement) => void} options.renderList - list要素（.move-list-body相当）へ
 *   中身を描画するコールバック。呼び出し側の一覧描画ロジックをそのまま渡す。
 * @param {() => void} options.onClose - 閉じるボタン・背景タップで呼ばれるコールバック
 *   （呼び出し側のclose関数。overlay自体の破棄はこの関数の責務とする）。
 * @returns {{ overlayEl: HTMLElement, listEl: HTMLElement }}
 */
export function buildModalScaffold({ overlayClassName, popupClassName, title, renderList, onClose }) {
  const overlayEl = document.createElement('div');
  overlayEl.className = overlayClassName;

  const popup = document.createElement('div');
  popup.className = popupClassName;

  const header = document.createElement('div');
  header.className = 'move-list-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'move-list-title';
  titleEl.textContent = title;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'move-list-close';
  closeBtn.setAttribute('aria-label', '閉じる');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', onClose);
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  popup.appendChild(header);

  const listEl = document.createElement('div');
  listEl.className = 'move-list-body';
  renderList(listEl);
  popup.appendChild(listEl);

  overlayEl.appendChild(popup);

  // 背景タップで閉じる（成りポップアップ・アセットドロワーと同様の誤操作対策）
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) onClose();
  });

  document.body.appendChild(overlayEl);

  return { overlayEl, listEl };
}
