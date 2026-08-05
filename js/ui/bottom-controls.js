/**
 * ⑥下部操作列（設計書 第5部）
 */
import { getState, flipBoard, jumpToKifuProgress, undoLastMove, advanceToKifuProgress, getKifuModeInfo } from '../state/app-state.js';

/**
 * 下部操作列のイベント登録。
 */
export function initBottomControls() {
  // 盤面反転
  document.getElementById('btn-flip').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    flipBoard();
  });

  // 最初
  document.getElementById('btn-first').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    jumpToKifuProgress(0);
  });

  // 前
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    undoLastMove();
  });

  // 次
  document.getElementById('btn-next').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    const { kifuProgress } = getKifuModeInfo();
    advanceToKifuProgress(kifuProgress + 1);
  });

  // 最後
  document.getElementById('btn-last').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    const { kifuData } = getState();
    if (!kifuData) return;
    const kifuMoves = kifuData.entries.filter(e => e.move !== null);
    advanceToKifuProgress(kifuMoves.length);
  });
}

/**
 * 下部操作列の表示状態を更新する。
 */
export function updateBottomControls() {
  const { isNariPopupOpen, isAssetDrawerOpen } = getState();
  const { isKifuMode, kifuProgress } = getKifuModeInfo();
  const { kifuData } = getState();

  const disabled = isAnyControlDisabled();

  // 常に活性（要件定義書5.6節）：盤面反転・最初・前
  document.getElementById('btn-flip').disabled = disabled;
  document.getElementById('btn-first').disabled = disabled;
  document.getElementById('btn-prev').disabled = disabled;

  // 次・最後：棋譜モードかつ棋譜の末尾に未到達の場合のみ活性化
  let forwardEnabled = false;
  if (isKifuMode && kifuData) {
    const kifuMoves = kifuData.entries.filter(e => e.move !== null);
    forwardEnabled = kifuProgress < kifuMoves.length;
  }
  document.getElementById('btn-next').disabled = disabled || !forwardEnabled;
  document.getElementById('btn-last').disabled = disabled || !forwardEnabled;
}

function isAnyControlDisabled() {
  const { isNariPopupOpen, isAssetDrawerOpen } = getState();
  return isNariPopupOpen || isAssetDrawerOpen;
}