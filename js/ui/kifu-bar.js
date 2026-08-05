/**
 * ②棋譜符号バーの表示内容組み立て（設計書 第4部7節）
 */
import { PIECE_TYPE_LABEL_JA } from '../models/board.js';

const MAX_KIFU_BAR_MOVES = 7;

/**
 * 棋譜符号バーの表示内容を組み立てる。
 * @param {boolean} isKifuMode
 * @param {number} kifuProgress
 * @param {KifuData|null} kifuData
 * @param {Move[]} moveHistory
 * @returns {{ mode: 'KIFU'|'BRANCH', moves: KifuBarMoveDisplay[] }}
 */
export function getKifuBarContent(isKifuMode, kifuProgress, kifuData, moveHistory) {
  if (isKifuMode && kifuData) {
    // 棋譜モード：残りの棋譜符号を先頭7手分表示
    const kifuMoves = kifuData.entries.filter(e => e.move !== null);
    const upcoming = kifuMoves.slice(kifuProgress, kifuProgress + MAX_KIFU_BAR_MOVES);
    const moves = upcoming.map((entry, index) => {
      const prevMove = index === 0
        ? (kifuMoves[kifuProgress - 1]?.move ?? null)
        : (kifuMoves[kifuProgress + index - 1]?.move ?? null);
      return {
        text: formatMoveText(entry.move, prevMove),
        emphasis: index === 0 ? 'NEXT' : 'UPCOMING'
      };
    });
    return { mode: 'KIFU', moves };
  }

  // 分岐モード：moveHistory の末尾1手のみ
  if (moveHistory.length > 0) {
    const lastMove = moveHistory[moveHistory.length - 1];
    const prevMove = moveHistory.length >= 2 ? moveHistory[moveHistory.length - 2] : null;
    return {
      mode: 'BRANCH',
      moves: [{
        text: `（棋譜分岐中）${formatMoveText(lastMove, prevMove)}`,
        emphasis: 'BRANCH'
      }]
    };
  }

  return { mode: 'BRANCH', moves: [] };
}

/**
 * Moveを表示用の符号文字列に変換する。
 * @param {Move} move
 * @param {Move|null} prevMove - 「同」判定用の直前手
 * @returns {string}
 */
function formatMoveText(move, prevMove) {
  const sideMark = move.side === 'SENTE' ? '▲' : '△';
  const pieceLabel = PIECE_TYPE_LABEL_JA[move.pieceType] || move.pieceType;

  // 「同」表記
  let sameText = '';
  if (prevMove && move.to.file === prevMove.to.file && move.to.rank === prevMove.to.rank) {
    sameText = '同';
  }

  // 成り表記
  const promoteText = move.promoted ? '成' : '';

  if (move.kind === 'DROP') {
    const toText = `${move.to.file}${kanjiRank(move.to.rank)}`;
    return `${sideMark}${sameText || toText}${pieceLabel}打`;
  }

  const fromText = move.from ? `${move.from.file}${kanjiRank(move.from.rank)}` : '';
  const toText = sameText || `${move.to.file}${kanjiRank(move.to.rank)}`;
  return `${sideMark}${fromText}${toText}${pieceLabel}${promoteText}`;
}

/**
 * 段（1〜9）を漢数字（一〜九）に変換する。
 * @param {number} rank
 * @returns {string}
 */
function kanjiRank(rank) {
  const kanji = ['一','二','三','四','五','六','七','八','九'];
  return kanji[rank - 1] || String(rank);
}

/**
 * 棋譜符号バーを描画する。
 * @param {HTMLElement} containerEl
 * @param {{ mode: 'KIFU'|'BRANCH', moves: KifuBarMoveDisplay[] }} content
 * @param {boolean} isVisible
 */
export function renderKifuBar(containerEl, content, isVisible) {
  containerEl.classList.toggle('kifu-bar--hidden', !isVisible);
  containerEl.innerHTML = '';

  for (const move of content.moves) {
    const el = document.createElement('span');
    el.className = `kifu-move kifu-move--${move.emphasis.toLowerCase()}`;
    el.textContent = move.text;
    containerEl.appendChild(el);
  }
}