/**
 * 盤マス・駒コマの実ピクセルサイズを比率から算出する（設計書 第4部8章）
 */

/**
 * 盤マス1つの実ピクセルサイズを算出する。
 * @param {{width: number, height: number}} boardImageSize - 現在表示中の盤画像の実表示サイズ（px）
 * @param {Object} boardLayout - board-layout.json をパースしたオブジェクト
 * @returns {{width: number, height: number}} 盤マス1つの実ピクセルサイズ
 */
export function getSquareSizePx(boardImageSize, boardLayout) {
  return {
    width: boardImageSize.width * boardLayout.cell_ratio.width,
    height: boardImageSize.height * boardLayout.cell_ratio.height
  };
}

/**
 * 駒コマの描画矩形を算出する。
 * @param {{width: number, height: number}} squareSizePx - getSquareSizePx() の返り値
 * @param {{width: number, height: number}} pieceImageNaturalSize - 選択中の駒画像の実サイズ
 * @param {Object} pieceLayout - piece-layout.json をパースしたオブジェクト
 * @param {Object} pieceFit - piece-fit.json をパースしたオブジェクト
 * @returns {{width: number, height: number, offsetX: number, offsetY: number}}
 */
export function getPieceRenderRect(squareSizePx, pieceImageNaturalSize, pieceLayout, pieceFit) {
  // 駒コマ1つぶんの縦横比
  const cellWidth = pieceImageNaturalSize.width / pieceLayout.grid.cols;
  const cellHeight = pieceImageNaturalSize.height / pieceLayout.grid.rows;
  const cellAspect = cellWidth / cellHeight;

  // 駒の目標表示枠
  const targetWidth = squareSizePx.width * pieceFit.scale_ratio;
  const targetHeight = squareSizePx.height * pieceFit.scale_ratio;

  let renderWidth;
  let renderHeight;

  if (pieceFit.fit_mode === 'contain') {
    // 縦横比を保ったまま目標表示枠に収まる最大サイズ
    const targetAspect = targetWidth / targetHeight;
    if (cellAspect > targetAspect) {
      // 駒が横長 → 幅に合わせる
      renderWidth = targetWidth;
      renderHeight = targetWidth / cellAspect;
    } else {
      // 駒が縦長 → 高さに合わせる
      renderHeight = targetHeight;
      renderWidth = targetHeight * cellAspect;
    }
  } else {
    throw new Error(`未対応の fit_mode: ${pieceFit.fit_mode}`);
  }

  // オフセット計算
  let offsetX = 0;
  let offsetY = 0;

  if (pieceFit.horizontal_align === 'center') {
    offsetX = (squareSizePx.width - renderWidth) / 2;
  } else if (pieceFit.horizontal_align === 'left') {
    offsetX = 0;
  } else if (pieceFit.horizontal_align === 'right') {
    offsetX = squareSizePx.width - renderWidth;
  } else {
    throw new Error(`未対応の horizontal_align: ${pieceFit.horizontal_align}`);
  }

  if (pieceFit.vertical_align === 'bottom') {
    offsetY = squareSizePx.height - renderHeight;
  } else if (pieceFit.vertical_align === 'top') {
    offsetY = 0;
  } else if (pieceFit.vertical_align === 'center') {
    offsetY = (squareSizePx.height - renderHeight) / 2;
  } else {
    throw new Error(`未対応の vertical_align: ${pieceFit.vertical_align}`);
  }

  return { width: renderWidth, height: renderHeight, offsetX, offsetY };
}

/**
 * 駒種から piece-layout.json 上の座標を求める。
 * @param {PieceType} pieceType - 駒種（成る前の駒種を渡す。OUの場合はkingLabelと組み合わせる）
 * @param {Side} side - 先手／後手
 * @param {boolean} promoted - 成り状態かどうか
 * @param {'OU'|'GYOKU'|null} kingLabel - pieceType==='OU'の場合のみ使用。それ以外はnull。
 * @param {Object} pieceLayout - piece-layout.json をパースしたオブジェクト
 * @returns {{row: number, col: number}}
 */
export function resolvePieceCell(pieceType, side, promoted, kingLabel, pieceLayout) {
  const facing = side === 'SENTE' ? 'upright' : 'inverted';

  if (pieceType === 'OU') {
    // 玉/王：col0固定。kingLabelで行を選ぶ
    const useGyoku = kingLabel === 'GYOKU';
    const rowEntry = pieceLayout.rows_meaning.find(
      r => r.facing === facing && r.promoted === useGyoku
    );
    if (!rowEntry) throw new Error(`piece-layout.json に行が見つかりません: facing=${facing}, promoted=${useGyoku}`);
    return { row: rowEntry.row, col: 0 };
  }

  // 通常の駒
  const rowEntry = pieceLayout.rows_meaning.find(
    r => r.facing === facing && r.promoted === promoted
  );
  if (!rowEntry) throw new Error(`piece-layout.json に行が見つかりません: facing=${facing}, promoted=${promoted}`);

  const colEntry = pieceLayout.columns.find(
    c => (promoted ? c.promotedId === pieceType : c.base === pieceType)
  );
  if (!colEntry) throw new Error(`piece-layout.json に列が見つかりません: pieceType=${pieceType}, promoted=${promoted}`);

  // 空セルチェック
  const isEmpty = pieceLayout.empty_cells.some(
    e => e.row === rowEntry.row && e.col === colEntry.col
  );
  if (isEmpty) {
    throw new Error(`空セルを参照しようとしました: row=${rowEntry.row}, col=${colEntry.col}`);
  }

  return { row: rowEntry.row, col: colEntry.col };
}
