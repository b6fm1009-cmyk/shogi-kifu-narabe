/**
 * KIFテキスト→JKF→アプリ内KifuData変換（設計書 第4部・第6部）
 */
import { createEmptyHandPieces } from '../models/board.js';

let JSONKifuFormat = null;

function getLibrary() {
  if (JSONKifuFormat) return JSONKifuFormat;
  if (typeof window !== 'undefined' && window.JSONKifuFormat) {
    JSONKifuFormat = window.JSONKifuFormat;
    return JSONKifuFormat;
  }
  throw new Error('json-kifu-format ライブラリが読み込まれていません');
}

/**
 * KIFテキストをパースしてアプリ内KifuDataに変換する。
 * @param {string} kifText
 * @returns {{ success: true, data: KifuData } | { success: false, error: string }}
 */
export function parseKifText(kifText) {
  try {
    const jkf = getLibrary();
    // parseKIF() は { header, initial?, moves } を直接持つオブジェクトを返す
    // （JKFPlayerインスタンスではない。Node.js検証で確認済み）。
    const kifu = jkf.Parsers.parseKIF(kifText);

    if (!kifu || !kifu.moves || !kifu.header) {
      return { success: false, error: '不正な棋譜です。インポートに対応しているのはKIF (.kif / .kifu) のみです。' };
    }

    // ヘッダー情報
    const header = {
      senteName: kifu.header['先手'] || '先手',
      goteName: kifu.header['後手'] || '後手'
    };

    // 初期局面
    let initial = null;
    let isHandicap = false;
    if (kifu.initial && kifu.initial.preset && kifu.initial.preset !== 'HIRATE') {
      isHandicap = true;
      // JKFのinitialから盤面を構築（平手以外のプリセットの場合）
      // 現バージョンでは簡易対応：initial.dataがあればそれを使う
      const squares = Array.from({ length: 9 }, () => Array(9).fill(null));
      const handSente = createEmptyHandPieces();
      const handGote = createEmptyHandPieces();

      if (kifu.initial.data) {
        const data = kifu.initial.data;
        // data.squares / data.hands から盤面を構築
        if (data.squares) {
          for (const sq of data.squares) {
            const file = sq.x;
            const rank = sq.y;
            squares[file - 1][rank - 1] = {
              type: sq.piece,
              side: sq.color === 0 ? 'SENTE' : 'GOTE',
              id: `init_p${file}_${rank}`
            };
          }
        }
        if (data.hands) {
          if (data.hands[0]) {
            for (const [type, count] of Object.entries(data.hands[0])) {
              if (type in handSente) handSente[type] = count;
            }
          }
          if (data.hands[1]) {
            for (const [type, count] of Object.entries(data.hands[1])) {
              if (type in handGote) handGote[type] = count;
            }
          }
        }
      }

      initial = { squares, handSente, handGote, isHandicap: true };
    }

    // 手順（moves[0]はプレースホルダなのでスキップ）
    const entries = [];
    // 「同」表記（same: true）の手の移動先を展開するための直前の手の移動先
    let lastTo = null;
    // 指し手の手番を補完するためのカウンタ（KIFは先手から始まり交互に手番が進む）
    let moveCount = 0;
    for (let i = 1; i < kifu.moves.length; i++) {
      const moveData = kifu.moves[i];
      if (!moveData) continue;

      if (moveData.special) {
        // 特殊表記（指し手ではないため lastTo / moveCount は更新しない）
        entries.push({ move: null, specialNotation: moveData.special });
      } else if (moveData.move) {
        const m = moveData.move;
        const kind = m.from ? 'BOARD' : 'DROP';

        // 「同」表記（same: true）の手は to が省略されているため、
        // 直前の指し手の移動先（lastTo）から展開する（設計書 第2部7.3節）。
        // 直前の指し手が存在しない場合は不正な棋譜として扱う。
        let to;
        if (m.same) {
          if (!lastTo) {
            return { success: false, error: '不正な棋譜です。インポートに対応しているのはKIF (.kif / .kifu) のみです。' };
          }
          to = lastTo;
        } else {
          if (!m.to) {
            return { success: false, error: '不正な棋譜です。インポートに対応しているのはKIF (.kif / .kifu) のみです。' };
          }
          to = { file: m.to.x, rank: m.to.y };
        }

        // side の補完：JKFの parseKIF は color を補完しないため、
        // 指し手の順序（先手→後手→先手→…）から判定する。
        // m.color が存在する場合はそれを優先する。
        const side = m.color !== undefined
          ? (m.color === 0 ? 'SENTE' : 'GOTE')
          : (moveCount % 2 === 0 ? 'SENTE' : 'GOTE');

        const move = {
          kind,
          from: m.from ? { file: m.from.x, rank: m.from.y } : null,
          to,
          pieceType: m.piece,
          side,
          promoted: m.promote === true,
          capturedPieceType: m.capture || null,
          isCapture: !!m.capture
        };
        entries.push({ move, specialNotation: null });
        lastTo = to;
        moveCount++;
      }
    }

    return {
      success: true,
      data: { header, initial, entries }
    };
  } catch (e) {
    return {
      success: false,
      error: '不正な棋譜です。インポートに対応しているのはKIF (.kif / .kifu) のみです。'
    };
  }
}
