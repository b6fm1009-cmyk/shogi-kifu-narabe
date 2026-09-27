/**
 * ⑥下部操作列・分岐選択モーダル（新規要望：棋譜分岐中モードの「次」を選択可能にする）
 *
 * 「次」ボタンの長押しで開く。move-list-popup.js（局面選択モーダル）と
 * 見た目上は同じモーダルデザインのため、CSSクラス（.move-list-*）をそのまま
 * 共有する（style.cssコメント参照：両モーダルの共通スタイルという位置づけ）。
 * 状態管理上は別モーダルとして扱う（isBranchPopupOpen）ため、
 * 局面選択モーダルと分岐選択モーダルが同時に開くことはない。
 * 一覧には、現在の局面から過去に検討した変化（分岐キャッシュの候補）を
 * 「最後に検討した順」（新しい変化が上）で表示する。選ぶとその手へ1手進める。
 */
import { getState, advanceBranch, setBranchPopupOpen } from '../state/app-state.js';
import { formatMoveText } from './kifu-bar.js';
import { buildModalScaffold } from './modal-scaffold.js';

let overlayEl = null;

/**
 * 分岐選択モーダルを開く。
 * @param {{ move: Move, lastUsedAt: number }[]} candidates - 「最後に検討した順」でソート済みの候補一覧
 */
export function openBranchPopup(candidates) {
  if (!candidates || candidates.length === 0) return;

  // このモーダル表示中も他の操作（盤面タップ等）を無効化する
  // （isAnyControlDisabledがisBranchPopupOpenを参照する）。
  setBranchPopupOpen(true);

  if (overlayEl) overlayEl.remove();

  const { moveHistory } = getState();
  const prevMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;

  const { overlayEl: newOverlayEl } = buildModalScaffold({
    overlayClassName: 'move-list-overlay',
    popupClassName: 'move-list-popup',
    title: '分岐を選択',
    renderList: (listEl) => {
      candidates.forEach((candidate, index) => {
        const row = document.createElement('div');
        row.className = 'move-list-row';
        // 先頭（最新の変化）を強調する。単押しの「次」で進む先と同じ扱いなので、
        // 局面選択モーダルの「現在地」ハイライトと同じクラスを流用する。
        if (index === 0) row.classList.add('move-list-row--current');
        row.textContent = formatMoveText(candidate.move, prevMove);
        row.addEventListener('click', () => {
          advanceBranch(candidate.move);
          closeBranchPopup();
        });
        listEl.appendChild(row);
      });
    },
    onClose: closeBranchPopup
  });
  overlayEl = newOverlayEl;
}

/**
 * 分岐選択モーダルを閉じる。
 */
export function closeBranchPopup() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  setBranchPopupOpen(false);
}
