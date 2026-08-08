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

    // 表示専用リスト：指し手をすべて消化した後は、entries末尾に続く特殊表記
    // （投了・中断・切れ負け等）も表示候補に含める。特殊表記はkifuProgressの
    // カウント対象外（kifu-judge.js／bottom-controls.jsのボタン活性判定と同じ前提）
    // なので、ここで新たに数えることはせず、あくまで「表示する項目」を追加するだけ。
    // entries内でmove!==nullの要素を先頭からkifuProgress個スキップし、
    // それ以降（残りの指し手＋末尾の特殊表記）を表示対象として取り出す。
    let skipped = 0;
    let startIndex = kifuData.entries.length;
    for (let i = 0; i < kifuData.entries.length; i++) {
      if (skipped === kifuProgress) { startIndex = i; break; }
      if (kifuData.entries[i].move !== null) skipped++;
    }
    const upcomingEntries = kifuData.entries.slice(startIndex, startIndex + MAX_KIFU_BAR_MOVES);

    const moves = upcomingEntries.map((entry, index) => {
      const prevMove = index === 0
        ? (kifuMoves[kifuProgress - 1]?.move ?? null)
        : (upcomingEntries[index - 1].move ?? null);
      return entry.move !== null
        ? { text: formatMoveText(entry.move, prevMove), emphasis: index === 0 ? 'NEXT' : 'UPCOMING' }
        : { text: formatSpecialText(entry.specialNotation), emphasis: index === 0 ? 'NEXT' : 'UPCOMING' };
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
export function formatMoveText(move, prevMove) {
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

  const toText = sameText || `${move.to.file}${kanjiRank(move.to.rank)}`;
  return `${sideMark}${toText}${pieceLabel}${promoteText}`;
}

/**
 * 特殊表記コード（KifuEntry.specialNotation）を日本語ラベルに変換する。
 * コード体系はCSA形式由来で、json-kifu-formatのKIFパーサーが実際に出力する値。
 * 未知のコードが来た場合はコードをそのまま表示する（表示が消えるよりは情報量が多い方を優先）。
 * @param {string} code
 * @returns {string}
 */
const SPECIAL_NOTATION_LABEL_JA = {
  TORYO: '投了',
  CHUDAN: '中断',
  SENNICHITE: '千日手',
  TIME_UP: '切れ負け',
  JISHOGI: '持将棋',
  KACHI: '勝ち宣言',
  HIKIWAKE: '引き分け宣言',
  MATTA: '待った',
  TSUMI: '詰み',
  FUZUMI: '不詰',
  ILLEGAL_MOVE: '反則負け',
  '+ILLEGAL_ACTION': '先手反則負け',
  '-ILLEGAL_ACTION': '後手反則負け',
  ILLEGAL_ACTION: '反則勝ち',
  ERROR: 'エラー'
};

export function formatSpecialText(code) {
  return SPECIAL_NOTATION_LABEL_JA[code] || code;
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