/**
 * AppState定義・更新関数・派生値算出関数（設計書 第3部）
 */
import { createInitialBoardState } from '../models/board.js';
import { applyMoveToBoard } from '../core/apply-move.js';
import { judgeKifuMode } from '../core/kifu-judge.js';

/**
 * @typedef {Object} SelectedSource
 * @property {'BOARD'|'HAND'} origin - 選択元が盤上か持ち駒か
 * @property {Square|null} square    - origin==='BOARD' の場合の座標。'HAND'の場合はnull。
 * @property {PieceType|null} pieceType - origin==='HAND' の場合の駒種。'BOARD'の場合はnull。
 * @property {Side} side             - 選択した駒の所属
 */

/**
 * @typedef {Object} AppState
 * @property {BoardState} boardState
 * @property {Move[]} moveHistory
 * @property {KifuData|null} kifuData
 * @property {SelectedSource|null} selectedSource
 * @property {boolean} isKifuBarVisible
 * @property {boolean} isNariPopupOpen
 * @property {boolean} isAssetDrawerOpen
 * @property {boolean} isMoveListOpen
 * @property {string} selectedBoardId
 * @property {string} selectedPieceIdSente - 先手側（自分の駒・自分の持ち駒欄）に使う駒セットID
 * @property {string} selectedPieceIdGote - 後手側（相手の駒・相手の持ち駒欄）に使う駒セットID
 */

// モジュール内プライベート状態
// 修正①（新規要望）: 先手用・後手用の駒セットを別々に選択できるよう、selectedPieceId（単一）を
// selectedPieceIdSente / selectedPieceIdGote の2つに分割した。両方の初期値は同じデフォルト駒
// （assets-manifest.jsonのdefaults.pieces）にしておくことで、従来通り「先手も後手も同じ駒」の
// 見た目から始まる（ユーザーが片方だけ変更しない限り旧来の挙動と同じに見える）。
let state = {
  boardState: createInitialBoardState(null),
  moveHistory: [],
  kifuData: null,
  selectedSource: null,
  isKifuBarVisible: true,
  isNariPopupOpen: false,
  isAssetDrawerOpen: false,
  isMoveListOpen: false,
  selectedBoardId: 'wood',
  selectedPieceIdSente: 'maki_ryoko_1_letter',
  selectedPieceIdGote: 'maki_ryoko_1_letter'
};

// 再描画コールバック（main.js が登録する）
let renderCallback = null;

/** @param {() => void} callback */
export function setRenderCallback(callback) {
  renderCallback = callback;
}

function notifyRender() {
  if (renderCallback) renderCallback();
}

/** @returns {AppState} 現在の状態（読み取り専用として扱う） */
export function getState() {
  return state;
}

/** 派生値：isKifuMode / kifuProgress */
export function getKifuModeInfo() {
  return judgeKifuMode(state.moveHistory, state.kifuData);
}

/** 派生値：isAnyControlDisabled */
export function isAnyControlDisabled() {
  return state.isNariPopupOpen || state.isAssetDrawerOpen || state.isMoveListOpen;
}

/** 派生値：isBackToKifuButtonEnabled */
export function isBackToKifuButtonEnabled() {
  return !getKifuModeInfo().isKifuMode;
}

/** 派生値：isForwardNavigationEnabled（次・最後ボタン） */
export function isForwardNavigationEnabled() {
  const { isKifuMode, kifuProgress } = getKifuModeInfo();
  if (!isKifuMode) return false;
  if (state.kifuData === null) return false;
  const kifuMoves = state.kifuData.entries.filter(e => e.move !== null);
  return kifuProgress < kifuMoves.length;
}

/**
 * 派生値：isBackwardNavigationEnabled（最初・前ボタン）
 * 修正①: 初期局面（moveHistory.length === 0）より前の局面は存在しないため、
 * この状態では「最初」「前」ボタンを無効化する。isForwardNavigationEnabled()
 * （次・最後ボタン）と対称的に、後退方向にこれ以上進める余地があるかどうかを
 * 単一の判定関数として提供する。棋譜未読込（kifuData === null）でも
 * moveHistoryが空である限り無効化の判定は成立する（棋譜のインポート有無に
 * かかわらず「動かした手がゼロなら戻れない」という条件のみで判定できるため）。
 */
export function isBackwardNavigationEnabled() {
  return state.moveHistory.length > 0;
}

/**
 * 盤面を再構築する（全手再生方式）。
 * @param {Move[]} moveHistory
 * @param {InitialPosition|null} initial
 * @param {boolean} [isFlipped=false]
 *   再構築後の盤面に引き継ぐ反転状態。createInitialBoardState()は常にfalseを返すため、
 *   「盤面反転」ボタンでisFlippedをtrueにした後にrebuildBoardState()が呼ばれる
 *   （＝棋譜再生モードで「前」「次」「最初」「最後」を押す）と、ここを指定しない限り
 *   反転状態が失われてしまう。呼び出し側は必ず現在のstate.boardState.isFlippedを渡すこと。
 * @returns {BoardState}
 */
export function rebuildBoardState(moveHistory, initial, isFlipped = false) {
  let boardState = createInitialBoardState(initial);
  if (isFlipped) {
    boardState = { ...boardState, isFlipped: true };
  }
  for (const move of moveHistory) {
    const result = applyMoveToBoard(boardState, move);
    boardState = result.boardState;
  }
  return boardState;
}

/** 選択状態を更新する */
export function selectSource(source) {
  state = { ...state, selectedSource: source };
  notifyRender();
}

/** 選択をクリアする */
export function clearSelection() {
  state = { ...state, selectedSource: null };
  notifyRender();
}

/** 指し手を確定し、moveHistory と boardState を更新する */
export function commitMove(move, newBoardState) {
  state = {
    ...state,
    moveHistory: [...state.moveHistory, move],
    boardState: newBoardState,
    selectedSource: null
  };
  notifyRender();
}

/** 棋譜を読み込む */
export function loadKifu(kifuData) {
  state = {
    ...state,
    kifuData,
    moveHistory: [],
    boardState: createInitialBoardState(kifuData ? kifuData.initial : null),
    selectedSource: null
  };
  notifyRender();
}

/** 棋譜符号バーの表示／非表示をトグルする */
export function toggleKifuBarVisibility() {
  state = { ...state, isKifuBarVisible: !state.isKifuBarVisible };
  notifyRender();
}

/** 盤面を反転する */
export function flipBoard() {
  state = {
    ...state,
    boardState: { ...state.boardState, isFlipped: !state.boardState.isFlipped }
  };
  notifyRender();
}

/** 1手戻る */
export function undoLastMove() {
  if (state.moveHistory.length === 0) return;
  const newHistory = state.moveHistory.slice(0, -1);
  const initial = state.kifuData ? state.kifuData.initial : null;
  const boardState = rebuildBoardState(newHistory, initial, state.boardState.isFlipped);
  state = { ...state, moveHistory: newHistory, boardState, selectedSource: null };
  notifyRender();
}

/** 指定手数まで巻き戻す（分岐に戻る・最初ボタン） */
export function jumpToKifuProgress(targetProgress) {
  if (state.moveHistory.length === 0 && targetProgress === 0) return;
  const clamped = Math.min(targetProgress, state.moveHistory.length);
  const newHistory = state.moveHistory.slice(0, clamped);
  const initial = state.kifuData ? state.kifuData.initial : null;
  const boardState = rebuildBoardState(newHistory, initial, state.boardState.isFlipped);
  state = { ...state, moveHistory: newHistory, boardState, selectedSource: null };
  notifyRender();
}

/** 棋譜を先に進める（次・最後ボタン） */
export function advanceToKifuProgress(targetProgress) {
  if (state.kifuData === null) return;
  const { kifuProgress } = getKifuModeInfo();
  if (targetProgress < kifuProgress) return;

  const kifuMoves = state.kifuData.entries.filter(e => e.move !== null).map(e => e.move);
  const movesToAdd = kifuMoves.slice(kifuProgress, targetProgress);
  const newHistory = [...state.moveHistory, ...movesToAdd];
  const initial = state.kifuData.initial;
  const boardState = rebuildBoardState(newHistory, initial, state.boardState.isFlipped);
  state = { ...state, moveHistory: newHistory, boardState, selectedSource: null };
  notifyRender();
}

/**
 * 棋譜上の指定手数の局面へ直接移動する（手数選択リストからのジャンプ専用）。
 * targetMoveNumberは「棋譜データ上の何手目まで進めた状態にするか」（0=開始局面）。
 * 分岐モード中に棋譜側の手数（kifuProgressより前）へ戻る場合と、棋譜モード中に
 * 先の手数へ進める場合の両方を1つの入口でまとめて扱う。
 * - moveHistory.length以下（現在地より過去または同じ）へ移動する場合：単純に
 *   moveHistoryを切り詰める（jumpToKifuProgress()と同じロジック）。分岐中でも
 *   棋譜側の手数へ戻せる。
 * - moveHistory.lengthより先へ移動する場合：現在のmoveHistoryの続きとして
 *   棋譜データの手を追加する。ただしこれは「分岐していない（moveHistoryが
 *   kifuProgressまでは棋譜と一致している）」場合のみ意味を持つため、
 *   isKifuMode===falseの状態で先の手数を指定した場合は何もしない
 *   （分岐中は「次に指すべき棋譜の手」という概念自体が存在しないため。
 *   要件定義書6.3節）。
 * @param {number} targetMoveNumber
 */
export function goToKifuMoveNumber(targetMoveNumber) {
  if (state.kifuData === null) return;

  if (targetMoveNumber <= state.moveHistory.length) {
    jumpToKifuProgress(targetMoveNumber);
    return;
  }

  const { isKifuMode, kifuProgress } = getKifuModeInfo();
  if (!isKifuMode) return; // 分岐中は先の棋譜手数へは進められない
  advanceToKifuProgress(targetMoveNumber);
}

/** 成りポップアップの開閉状態を設定する */
export function setNariPopupOpen(isOpen) {
  state = { ...state, isNariPopupOpen: isOpen };
  notifyRender();
}

/** アセットドロワーの開閉状態を設定する */
export function setAssetDrawerOpen(isOpen) {
  state = { ...state, isAssetDrawerOpen: isOpen };
  notifyRender();
}

/** 手数選択リスト（追加②）の開閉状態を設定する */
export function setMoveListOpen(isOpen) {
  state = { ...state, isMoveListOpen: isOpen };
  notifyRender();
}

/**
 * 選択中の駒セットIDを更新する。
 * 修正①（新規要望）: 先手用・後手用を別々に選べるようにしたため、どちら側の変更かを
 * side引数で明示する。呼び出し側（asset-drawer.js）はドロワー内の先手/後手切り替えに
 * 応じてこの引数を渡し分ける。
 * @param {string} pieceId
 * @param {'SENTE'|'GOTE'} side
 */
export function selectPieceAsset(pieceId, side) {
  if (side === 'SENTE') {
    state = { ...state, selectedPieceIdSente: pieceId };
  } else {
    state = { ...state, selectedPieceIdGote: pieceId };
  }
  notifyRender();
}

/** 選択中の盤IDを更新する */
export function selectBoardAsset(boardId) {
  state = { ...state, selectedBoardId: boardId };
  notifyRender();
}