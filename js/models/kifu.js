/**
 * 棋譜データ（KifuData）の型定義とヘルパー関数（設計書 第2部）
 */

/**
 * @typedef {Object} KifuHeader
 * @property {string} senteName - 先手の名前。KIFヘッダーに存在しない場合は "先手"。
 * @property {string} goteName  - 後手の名前。KIFヘッダーに存在しない場合は "後手"。
 */

/**
 * @typedef {Object} KifuEntry
 * @property {Move|null} move
 *   その手数の指し手。特殊表記の場合は null。
 * @property {string|null} specialNotation
 *   「投了」「中断」「千日手」等の特殊表記の場合にその文字列を入れる。通常の指し手の場合は null。
 *   不変条件：specialNotation !== null の要素は、存在する場合 entries 配列の末尾にのみ連続して出現する。
 */

/**
 * @typedef {Object} KifuData
 * @property {KifuHeader} header
 * @property {InitialPosition|null} initial
 *   棋譜の初期局面。平手開始の場合は null。
 * @property {KifuEntry[]} entries
 *   手順（1手目から順に格納）。特殊表記エントリは末尾に付与されうる。
 */

/**
 * 局面が平手（駒落ちでない）かどうかを判定する。
 * @param {InitialPosition|null} initial
 * @returns {boolean}
 */
export function isHirate(initial) {
  if (initial === null) return true; // 棋譜未読込・平手初期化
  return !initial.isHandicap;
}

/**
 * 先手が「玉(GYOKU)」か「王(OU)」かを判定する。
 * 現バージョンのスコープ：
 *  - 駒落ちの場合：先手=王、後手=玉
 *  - それ以外（平手含む）：先手=玉、後手=王
 * @param {InitialPosition|null} initial
 * @returns {{ senteKingLabel: 'OU'|'GYOKU', goteKingLabel: 'OU'|'GYOKU' }}
 */
export function determineKingLabels(initial) {
  const isHandicap = !isHirate(initial);
  if (isHandicap) {
    return { senteKingLabel: 'OU', goteKingLabel: 'GYOKU' }; // 先手王、後手玉
  }
  return { senteKingLabel: 'GYOKU', goteKingLabel: 'OU' };   // 先手玉、後手王
}