/**
 * 盤マス・駒コマの実ピクセルサイズを比率から算出する（設計書 第4部8章）
 */

/**
 * 盤マス1つの実ピクセルサイズを算出する。
 *
 * 注意: board-layout.json の margin_ratio（左右上下の余白）と cell_ratio（1マスのピッチ）を
 * 単純に「左余白 + 9マス + 右余白」で足し合わせると、合計が画像全体の幅/高さ(=1.0)を
 * 超えてしまう（実測時に線の中心同士のピッチを cell_ratio としているため、9マス分の
 * 「線の中心から線の中心まで」の合計が、外枠の外側までを含む margin_ratio 分と
 * 独立に決まっているわけではない）。そのため cell_ratio をそのまま使うのではなく、
 * 「画像幅から左右の余白を引いた、実際の盤の内枠の幅」を9等分して算出する。
 *
 * @param {{width: number, height: number}} boardImageSize - 現在表示中の盤画像の実表示サイズ（px）
 * @param {Object} boardLayout - board-layout.json をパースしたオブジェクト
 * @returns {{width: number, height: number}} 盤マス1つの実ピクセルサイズ
 */
export function getSquareSizePx(boardImageSize, boardLayout) {
  const innerWidthRatio = 1 - boardLayout.margin_ratio.left - boardLayout.margin_ratio.right;
  const innerHeightRatio = 1 - boardLayout.margin_ratio.top - boardLayout.margin_ratio.bottom;
  return {
    width: (boardImageSize.width * innerWidthRatio) / boardLayout.grid.cols,
    height: (boardImageSize.height * innerHeightRatio) / boardLayout.grid.rows
  };
}

/**
 * 盤の外枠（1マス目の左上）が画像の左上端から何pxオフセットしているかを算出する。
 * board-layout.json の margin_ratio は「外枠の線の中心までの距離」の比率であり、
 * これを使わずに (file-1)*squareWidth だけでマスを敷き詰めると、マスの罫線と
 * 駒の位置が右・下に行くほどズレていく。
 * @param {{width: number, height: number}} boardImageSize - 現在表示中の盤画像の実表示サイズ（px）
 * @param {Object} boardLayout - board-layout.json をパースしたオブジェクト
 * @returns {{x: number, y: number}} 盤の描画開始位置オフセット（px）
 */
export function getBoardOriginPx(boardImageSize, boardLayout) {
  return {
    x: boardImageSize.width * boardLayout.margin_ratio.left,
    y: boardImageSize.height * boardLayout.margin_ratio.top
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
