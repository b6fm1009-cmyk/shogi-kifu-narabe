/**
 * canPromote()：成れるかどうかの判定（設計書 第4部3節）
 */

import { isPromotedPiece } from '../models/board.js';

/**
 * 成れる手かどうかを判定する。
 * @param {PieceType} pieceType - 移動する駒の種類（成る前）
 * @param {Side} side
 * @param {Square} from
 * @param {Square} to
 * @returns {boolean} 成れる手かどうか
 */
export function canPromote(pieceType, side, from, to) {
  // 金・玉は成れない
  if (pieceType === 'KI' || pieceType === 'OU') return false;

  // すでに成っている駒は成れない（将棋のルール）
  if (isPromotedPiece(pieceType)) return false;

  // 敵陣内（移動先が敵陣）であれば成れる
  if (side === 'SENTE' && to.rank <= 3) return true;
  if (side === 'GOTE' && to.rank >= 7) return true;

  return false;
}