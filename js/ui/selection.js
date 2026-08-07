/**
 * 選択・移動操作の共通ルール（設計書 第4部5節）
 */
import { selectSource, clearSelection, commitMove } from '../state/app-state.js';
import { applyMove } from '../core/apply-move.js';
import { canPromote } from '../core/nari-judge.js';

let currentTarget = null;

/**
 * タップイベントを処理する。
 * @param {'BOARD'|'HAND'} origin - タップされた対象の種類
 * @param {Square|null} square - BOARDの場合の座標
 * @param {PieceType|null} pieceType - HANDの場合の駒種
 * @param {Side|null} side - 駒の所属
 * @param {BoardState} boardState - 現在の盤面
 * @param {SelectedSource|null} currentSelected - 現在の選択状態
 */
export function handleTap(origin, square, pieceType, side, boardState, currentSelected) {
  if (origin === 'BOARD') {
    return handleBoardTap(square, boardState, currentSelected);
  } else if (origin === 'HAND') {
    // 持ち駒タップ
    const source = { origin: 'HAND', square: null, pieceType, side };
    selectSource(source);
  }
}

/**
 * 盤上のタップを処理する。
 */
function handleBoardTap(square, boardState, currentSelected) {
  const piece = boardState.squares[square.file - 1][square.rank - 1];

  if (!currentSelected) {
    // 未選択 → 駒があれば選択
    if (piece) {
      const source = { origin: 'BOARD', square, pieceType: piece.type, side: piece.side };
      selectSource(source);
    }
    return;
  }

  // 選択中に、選択中の駒自身のマスを再タップ → 選択解除（自分自身への移動として処理しない）
  if (currentSelected.origin === 'BOARD'
      && currentSelected.square && currentSelected.square.file === square.file
      && currentSelected.square.rank === square.rank) {
    clearSelection();
    return;
  }

  // 選択中 → タップ先に自分の駒があれば選び直し
  if (piece && piece.side === currentSelected.side) {
    const source = { origin: 'BOARD', square, pieceType: piece.type, side: piece.side };
    selectSource(source);
    return;
  }

  // 選択中 → 移動先タップ（空マス、または相手の駒＝取る）
  currentTarget = square;
  processMove(currentSelected, square, boardState);
}

/**
 * 移動を確定する。
 */
function processMove(source, target, boardState) {
  // 持ち駒を打つ場合は成り判定なし
  if (source.origin === 'HAND') {
    const result = applyMove(source, target, null, boardState);
    commitMove(result.move, result.boardState);
    clearSelection();
    return;
  }

  // 成れる手かどうか
  const canPromoteResult = canPromote(source.pieceType, source.side, source.square, target);
  if (canPromoteResult) {
    // 成りポップアップを表示
    import('./nari-popup.js').then(({ showNariPopup }) => {
      // 修正④: 将棋ウォーズ準拠のため、成りポップアップの駒画像は常に正立で表示する。
      // source.side（駒の実所属=先手/後手）をそのまま渡すと後手の駒が倒立表示になって
      // しまうため、向き決定用の引数には駒の実所属ではなく固定で'SENTE'（正立扱い）を渡す。
      showNariPopup(source.pieceType, 'SENTE', (result) => {
        if (result === 'CANCEL') {
          clearSelection();
          return;
        }
        const moveResult = applyMove(source, target, result, boardState);
        commitMove(moveResult.move, moveResult.boardState);
        clearSelection();
      });
    });
  } else {
    const result = applyMove(source, target, null, boardState);
    commitMove(result.move, result.boardState);
    clearSelection();
  }
}