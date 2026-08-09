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
    //
    // 【2026-08-09 修正】Normalizer.normalizeKIF() を挟む理由：
    // KIF記法自体には「何を取ったか」を示すマーカーが無く、取った駒種（capture）は
    // 盤面を実際にシミュレートしないと判定できない。ライブラリ内部では
    // normalizeKIF() が Shogi インスタンスで全手を1手ずつ再生し、取った駒があれば
    // move.capture に補完する設計になっている（json-kifu-format側の一次資料：
    // lib/json-kifu-format.min.js 内 Normalizer.normalizeKIF の実装を参照）。
    // raw の Parsers.parseKIF() はテキストの構文解析のみを行い、この補完を一切
    // 行わないため、normalizeKIF を通さないと m.capture が常に undefined になり、
    // 下記の capturedPieceType が全指し手で null になる（実際に119手中119手で
    // 発生することをNode.js上で確認済み。E2E Instructions for Claude.md 参照）。
    // normalizeKIF は kifu.initial を書き換えない（HIRATE以外はそのまま保持する
    // 実装になっている）ため、駒落ち等のinitial処理には影響しない。
    // 副作用として m.color（手番）も同時に補完されるが、下記122-124行目の
    // 「m.color があれば優先」ロジックと矛盾しない値になるため問題ない。
    // 不正な棋譜（合法手でない手を含む棋譜）が渡された場合、normalizeKIF内部の
    // Shogiシミュレーションが例外をthrowするが、これは既存のtry/catchが
    // 「不正な棋譜です」エラーとして正しく拾う（元々の意図した動作と変わらない）。
    const kifu = jkf.Normalizer.normalizeKIF(jkf.Parsers.parseKIF(kifText));

    if (!kifu || !kifu.moves || !kifu.header) {
      return { success: false, error: '不正な棋譜です。インポートに対応しているのはKIF (.kif / .kifu) のみです。' };
    }

    // ヘッダー情報
    // 修正②: 段級位（先手段級／後手段級）も取得する。KIFヘッダーに存在しない場合は
    // null とし、表示側で「段級位欄ごと非表示にする」判定に使う（名前のような
    // デフォルト文言は設けない。要件定義書8.8節rev3参照）。
    const header = {
      senteName: kifu.header['先手'] || '先手',
      goteName: kifu.header['後手'] || '後手',
      senteRank: kifu.header['先手段級'] || null,
      goteRank: kifu.header['後手段級'] || null
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
