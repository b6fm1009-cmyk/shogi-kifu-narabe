/**
 * ⑥下部操作列・局面選択モーダル（追加②：n手目ジャンプ）
 *
 * 将棋ウォーズの「棋譜一覧」画面を参考に、棋譜データの全手順を1行1手のリストで表示し、
 * タップした手数の局面へ直接移動できるようにする。
 * 一覧は常にkifuData.entries（元のKIFファイルの手順）を表示する。分岐モード中に
 * 開いた場合も同様で、選ぶとgoToKifuMoveNumber()により棋譜側の該当手数へ移動する
 * （＝分岐から棋譜モードへ復帰する経路の1つとして機能する）。
 */
import { getState, setMoveListOpen, goToKifuMoveNumber } from '../state/app-state.js';
import { formatMoveText, formatSpecialText } from './kifu-bar.js';
import { buildModalScaffold } from './modal-scaffold.js';

let overlayEl = null;

/**
 * 局面選択モーダルを開く。
 */
export function openMoveListPopup() {
  const { kifuData, moveHistory } = getState();
  if (!kifuData) return;

  setMoveListOpen(true);

  if (overlayEl) overlayEl.remove();

  const { overlayEl: newOverlayEl, listEl } = buildModalScaffold({
    overlayClassName: 'move-list-overlay',
    popupClassName: 'move-list-popup',
    title: '局面を選択',
    renderList: (listEl) => renderList(listEl, kifuData, moveHistory.length),
    onClose: closeMoveListPopup
  });
  overlayEl = newOverlayEl;

  // 現在地の行までスクロールしておく（末尾付近の棋譜を並べている最中に開いた場合、
  // 毎回リスト最上部からスクロールし直す手間を省く）
  const currentEl = listEl.querySelector('.move-list-row--current');
  if (currentEl) {
    currentEl.scrollIntoView({ block: 'center' });
  }
}

/**
 * 局面選択モーダルを閉じる。
 */
export function closeMoveListPopup() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  setMoveListOpen(false);
}

/**
 * 一覧本体を描画する。
 * @param {HTMLElement} listEl
 * @param {KifuData} kifuData
 * @param {number} currentMoveNumber - 現在のmoveHistory.length（ハイライト用）
 */
function renderList(listEl, kifuData, currentMoveNumber) {
  listEl.innerHTML = '';

  // 開始局面（0手目）
  listEl.appendChild(createRow('開始局面', 0, currentMoveNumber === 0));

  let moveNumber = 0;
  let prevMove = null;
  for (const entry of kifuData.entries) {
    if (entry.move !== null) {
      moveNumber += 1;
      const text = `${moveNumber} ${formatMoveText(entry.move, prevMove)}`;
      listEl.appendChild(createRow(text, moveNumber, moveNumber === currentMoveNumber));
      prevMove = entry.move;
    } else {
      // 投了等の特殊表記（要件定義書6.6節：手数のカウント対象には含めない。表示のみ）
      const row = createRow(formatSpecialText(entry.specialNotation), null, false);
      row.classList.add('move-list-row--special');
      listEl.appendChild(row);
    }
  }
}

/**
 * 一覧の1行を生成する。
 * @param {string} text
 * @param {number|null} moveNumber - タップ時に移動する手数。nullの場合はタップ無効（特殊表記行）。
 * @param {boolean} isCurrent
 */
function createRow(text, moveNumber, isCurrent) {
  const row = document.createElement('div');
  row.className = 'move-list-row';
  if (isCurrent) row.classList.add('move-list-row--current');
  row.textContent = text;

  if (moveNumber !== null) {
    row.addEventListener('click', () => {
      goToKifuMoveNumber(moveNumber);
      closeMoveListPopup();
    });
  } else {
    row.classList.add('move-list-row--disabled');
  }

  return row;
}
