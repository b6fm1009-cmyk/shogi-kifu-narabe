/**
 * ⑥下部操作列（設計書 第5部）
 */
import { getState, flipBoard, jumpToKifuProgress, undoLastMove, advanceToKifuProgress, getKifuModeInfo, isAnyControlDisabled, isBackwardNavigationEnabled, isForwardNavigationEnabled, isLastButtonEnabled, advanceBranch, getNextBranchCandidates } from '../state/app-state.js';
import { openMoveListPopup } from './move-list-popup.js';
import { openBranchPopup } from './branch-popup.js';
import { setButtonDisabled, isButtonDisabled } from './button-state.js';

// 新規要望：「次」ボタンの長押し検出用しきい値・タイマー
const LONG_PRESS_THRESHOLD_MS = 500;
let longPressTimer = null;
let longPressTriggered = false;

/**
 * 下部操作列のイベント登録。
 */
export function initBottomControls() {
  // 盤面反転
  const flipBtn = document.getElementById('btn-flip');
  flipBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(flipBtn)) return;
    flipBoard();
  });

  // 最初
  const firstBtn = document.getElementById('btn-first');
  firstBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(firstBtn)) return;
    jumpToKifuProgress(0);
  });

  // 前
  const prevBtn = document.getElementById('btn-prev');
  prevBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(prevBtn)) return;
    undoLastMove();
  });

  // 次
  // 新規要望：棋譜分岐中モードでも「次」を押せるようにする。
  // advanceBranch()が「直近に検討していた変化があればそちらを優先し、
  // 無ければ棋譜本譜の次の手」という優先順位を内部で解決するため、
  // ここでは棋譜モード／分岐モードを区別せず一本化して呼び出せばよい。
  // 長押し（LONG_PRESS_THRESHOLD_MS以上）の場合は、分岐候補が複数あれば
  // 選択ポップアップを開く（click本来の処理はlongPressTriggeredで抑止する）。
  const nextBtn = document.getElementById('btn-next');
  nextBtn.addEventListener('pointerdown', () => {
    if (isAnyControlDisabled() || isButtonDisabled(nextBtn)) return;
    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
      const candidates = getNextBranchCandidates();
      if (candidates.length >= 2) {
        longPressTriggered = true;
        openBranchPopup(candidates);
      }
    }, LONG_PRESS_THRESHOLD_MS);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
    nextBtn.addEventListener(evt, () => {
      clearTimeout(longPressTimer);
    });
  });
  nextBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(nextBtn)) return;
    if (longPressTriggered) {
      // 長押しでポップアップを開いた分のclickは、通常の1手進める処理をしない
      longPressTriggered = false;
      return;
    }
    advanceBranch();
  });

  // 最後
  const lastBtn = document.getElementById('btn-last');
  lastBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(lastBtn)) return;
    const { kifuData } = getState();
    if (!kifuData) return;
    const kifuMoves = kifuData.entries.filter(e => e.move !== null);
    advanceToKifuProgress(kifuMoves.length);
  });

  // 局面選択（追加②：n手目ジャンプ）
  const moveListBtn = document.getElementById('btn-move-list');
  moveListBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(moveListBtn)) return;
    const { kifuData } = getState();
    if (!kifuData) return;
    openMoveListPopup();
  });
}

/**
 * 下部操作列の表示状態を更新する。
 */
export function updateBottomControls() {
  const { kifuData } = getState();

  const disabled = isAnyControlDisabled();

  // 盤面反転：常に活性（要件定義書5.6節）
  setButtonDisabled(document.getElementById('btn-flip'), disabled);

  // 修正①: 最初・前は「1手でも指した後（moveHistoryが空でない）」のみ活性化する。
  // 初期局面（moveHistory.length === 0）より前の局面は存在しないため、
  // 「次」「最後」ボタン（isForwardNavigationEnabled）と対称的に無効化する。
  const backwardEnabled = isBackwardNavigationEnabled();
  setButtonDisabled(document.getElementById('btn-first'), disabled || !backwardEnabled);
  setButtonDisabled(document.getElementById('btn-prev'), disabled || !backwardEnabled);

  // 次：棋譜モードで末尾未到達、または分岐モード中で検討済みの変化がキャッシュに
  // 残っている場合に活性化（新規要望）。
  // 最後：従来通り、棋譜モードで末尾未到達の場合のみ活性化（分岐モード中は対象外）。
  const nextBtn = document.getElementById('btn-next');
  setButtonDisabled(nextBtn, disabled || !isForwardNavigationEnabled());
  setButtonDisabled(document.getElementById('btn-last'), disabled || !isLastButtonEnabled());

  // 新規要望：分岐候補が複数（2件以上）ある場合のみ「次」に分岐可能マークを付ける
  // （長押しで選択肢が出せることの目印）。棋譜モード／分岐モードを問わず、
  // isForwardNavigationEnabledと同じ「分岐キャッシュ優先」の考え方に合わせる。
  const candidates = getNextBranchCandidates();
  nextBtn.classList.toggle('bottom-btn--branchable', candidates.length >= 2);

  // 局面選択：棋譜データが読み込まれていれば、棋譜モード／分岐モードを問わず活性
  // （分岐中でも棋譜側の手数へ戻れる仕様のため。次・最後ボタンとは活性条件が異なる）
  setButtonDisabled(document.getElementById('btn-move-list'), disabled || !kifuData);
}