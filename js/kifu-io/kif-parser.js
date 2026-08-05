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
    const parsed = jkf.Parsers.parseKIF(kifText);

    if (!parsed || !parsed.moves || !parsed.header) {
      return { success: false, error: '不正な棋譜です。インポートに対応しているのはKIF (.kif / .kifu) のみです。' };
    }

    // ヘッダー情報
    const header = {
      senteName: parsed.header['先手'] || '先手',
      goteName: parsed.header['後手'] || '後手'
    };

    // 初期局面
    let initial = null;
    let isHandicap = false;
    if (parsed.initial && parsed.initial.preset && parsed.initial.preset !== 'HIRATE') {
      isHandicap = true;
      // JKFのinitialから盤面を構築（平手以外のプリセットの場合）
      // 現バージョンでは簡易対応：initial.dataがあればそれを使う
      const squares = Array.from({ length: 9 }, () => Array(9).fill(null));
      const handSente = createEmptyHandPieces();
      const handGote = createEmptyHandPieces();

      if (parsed.initial.data) {
        const data = parsed.initial.data;
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
    for (let i = 1; i < parsed.moves.length; i++) {
      const moveData = parsed.moves[i];
      if (!moveData) continue;

      if (moveData.special) {
        // 特殊表記
        entries.push({ move: null, specialNotation: moveData.special });
      } else if (moveData.move) {
        const m = moveData.move;
        const kind = m.from ? 'BOARD' : 'DROP';
        const move = {
          kind,
          from: m.from ? { file: m.from.x, rank: m.from.y } : null,
          to: { file: m.to.x, rank: m.to.y },
          pieceType: m.piece,
          side: m.color === 0 ? 'SENTE' : 'GOTE',
          promoted: m.promote === true,
          capturedPieceType: m.capture || null,
          isCapture: !!m.capture
        };
        entries.push({ move, specialNotation: null });
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