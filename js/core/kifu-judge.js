/**
 * judgeKifuMode()：棋譜モード／分岐モード判定（設計書 第3部3節）
 */
import { movesEqual } from '../models/move.js';

/**
 * 棋譜モード／分岐モードを判定する。
 * @param {Move[]} moveHistory
 * @param {KifuData|null} kifuData
 * @returns {{ isKifuMode: boolean, kifuProgress: number }}
 */
export function judgeKifuMode(moveHistory, kifuData) {
  if (kifuData === null) {
    return { isKifuMode: false, kifuProgress: 0 };
  }

  // 特殊表記（move === null）を除外した比較対象配列
  const kifuMoves = kifuData.entries
    .filter(entry => entry.move !== null)
    .map(entry => entry.move);

  let kifuProgress = 0;
  let isKifuMode = true;

  for (let i = 0; i < moveHistory.length; i++) {
    if (i >= kifuMoves.length) {
      // moveHistory が棋譜より長い（棋譜の末尾を超えて指した）
      isKifuMode = false;
      kifuProgress = kifuMoves.length;
      break;
    }
    if (!movesEqual(moveHistory[i], kifuMoves[i])) {
      // 不一致発生 → 恒久的に分岐モード
      isKifuMode = false;
      kifuProgress = i;
      break;
    }
    kifuProgress = i + 1;
  }

  return { isKifuMode, kifuProgress };
}