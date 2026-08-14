/**
 * ④盤面・座標符号の描画（設計書 第5部）
 */
import { getSquareSizePx, getBoardOriginPx, getPieceRenderRect, resolvePieceCell } from '../assets/asset-fit.js';
import { findBoardAsset, findPieceAsset } from '../assets/asset-manifest.js';
import { determineKingLabels } from '../models/kifu.js';
import { isPromotedPiece } from '../models/board.js';

let boardEl = null;
let boardWrapEl = null;
let boardImageEl = null;
let boardLayout = null;
let pieceLayout = null;
let pieceFit = null;
let manifest = null;
let imageLoadCallback = null;

/**
 * 盤面描画の初期化。
 * @param {HTMLElement} containerEl - 盤面コンテナ
 * @param {Object} layouts - { boardLayout, pieceLayout, pieceFit }
 * @param {AssetManifest} assetManifest
 * @param {() => void} [onImageLoad] - 盤画像のロード完了時に呼ばれるコールバック（任意）。
 *   app-frameがheight:autoのため、画像ロード前後で実高さが変わりうる。
 *   呼び出し側（main.js）はこれを使ってscale再計算のタイミングを取る。
 */
export function initBoardView(containerEl, layouts, assetManifest, onImageLoad) {
  boardEl = containerEl;
  boardLayout = layouts.boardLayout;
  pieceLayout = layouts.pieceLayout;
  pieceFit = layouts.pieceFit;
  manifest = assetManifest;
  imageLoadCallback = onImageLoad || null;
}

/**
 * 盤面を描画する。
 * @param {BoardState} boardState
 * @param {string} selectedBoardId
 * @param {{sente: string, gote: string}} selectedPieceIds - 修正①（新規要望）:
 *   先手用・後手用それぞれの駒セットID。盤上の各駒は piece.side（今その駒を
 *   保有している陣営）に応じてどちらの画像セットを使うかを決める。
 * @param {SelectedSource|null} selectedSource
 * @param {Move|null} [lastMove] - 直前に指された手。移動元（lastMove.from）と
 *   移動先（lastMove.to）の両マスに背景ハイライト（淡い白／やや濃い淡い白）を敷き、
 *   将棋ウォーズ準拠で今どちらの手番かを視覚的にわかるようにする
 *   （placeSquareHighlights()参照。旧・黄色点滅の.board-piece--last-moveは廃止し、
 *   移動先の表現はこの静的背景ハイライトに一本化した）。
 */
export function renderBoard(boardState, selectedBoardId, selectedPieceIds, selectedSource, lastMove) {
  if (!boardEl) return;

  const boardAsset = findBoardAsset(manifest, selectedBoardId);
  const pieceAssetBySide = {
    SENTE: findPieceAsset(manifest, selectedPieceIds.sente),
    GOTE: findPieceAsset(manifest, selectedPieceIds.gote)
  };

  // 盤画像コンテナ
  boardEl.innerHTML = '';
  boardEl.className = 'board-container';

  // 盤画像と駒レイヤーの基準を一致させるためのラッパー。
  // .board-container 自体はflexで中央寄せされる領域（画像より広い場合がある）ため、
  // pieces-layer を直接 .board-container 基準（top:0,left:0,100%）で重ねると、
  // 中央寄せによる余白の分だけ盤画像の実位置とズレる。
  // このラッパーに position:relative を持たせ、画像とpieces-layerの両方をこの中に置くことで、
  // ラッパー自体がflexで中央寄せされても、内部の座標系（top:0,left:0,100%）は常に画像に一致する。
  boardWrapEl = document.createElement('div');
  boardWrapEl.className = 'board-wrap';
  boardEl.appendChild(boardWrapEl);

  // 盤画像
  boardImageEl = document.createElement('img');
  boardImageEl.src = boardAsset.image;
  boardImageEl.className = 'board-image';
  boardImageEl.draggable = false;
  boardWrapEl.appendChild(boardImageEl);

  // 画像ロード後にマス計算・駒配置・座標符号の描画を行う。
  // 3つとも boardImageEl.clientWidth/clientHeight（盤画像の実表示サイズ）に
  // 依存する計算のため、ロード完了を待たずに呼ぶと座標が0基準のまま描画されてしまう。
  // そのため必ずこの1関数にまとめてから呼び出す（個別に呼び出し口を増やさない）。
  const renderDependents = () => {
    placeSquareHighlights(boardState, lastMove);
    placePieces(boardState, pieceAssetBySide, selectedSource);
    renderCoordinates(boardState.isFlipped);
    if (imageLoadCallback) imageLoadCallback();
  };

  if (boardImageEl.complete) {
    renderDependents();
  } else {
    boardImageEl.addEventListener('load', renderDependents);
  }
}

/**
 * 盤面座標(file, rank)を、反転状態を加味した表示上の座標(displayFile, displayRank)に変換する。
 * placePieces() 内の座標計算と同一の規則（1筋=画面右端が非反転時の標準表記）に必ず合わせること。
 * @param {number} file
 * @param {number} rank
 * @param {boolean} isFlipped
 * @returns {{displayFile: number, displayRank: number}}
 */
function toDisplayCoord(file, rank, isFlipped) {
  const displayFile = isFlipped ? file : 10 - file;
  const displayRank = isFlipped ? 10 - rank : rank;
  return { displayFile, displayRank };
}

/**
 * 修正③（新規要望）: 直前に指した手の「移動元マス」「移動先マス（現在位置）」に
 * 背景ハイライトを描く。placePieces() は駒が存在するマスしかループしないため、
 * 移動元（多くの場合、駒が去った空マス）はここで別途描画する必要がある。
 * pieces-layer と同じ座標系（boardWrapEl基準）に重ねる別レイヤーとして追加し、
 * この関数は必ず placePieces() より先に呼ぶ（駒の下に敷く＝視覚的に駒が前面に来る）。
 * @param {BoardState} boardState
 * @param {Move|null} lastMove
 */
function placeSquareHighlights(boardState, lastMove) {
  const existing = boardWrapEl.querySelector('.square-highlights-layer');
  if (existing) existing.remove();

  if (!lastMove) return;

  const boardSize = { width: boardImageEl.clientWidth, height: boardImageEl.clientHeight };
  const squareSize = getSquareSizePx(boardSize, boardLayout);
  const boardOrigin = getBoardOriginPx(boardSize, boardLayout);

  const layer = document.createElement('div');
  layer.className = 'square-highlights-layer';
  boardWrapEl.appendChild(layer);

  const addHighlight = (square, modifierClass) => {
    if (!square) return; // 駒打ち（DROP）は from が null のため対象外
    const { displayFile, displayRank } = toDisplayCoord(square.file, square.rank, boardState.isFlipped);
    const el = document.createElement('div');
    el.className = `board-square-highlight ${modifierClass}`;
    el.style.left = `${boardOrigin.x + (displayFile - 1) * squareSize.width}px`;
    el.style.top = `${boardOrigin.y + (displayRank - 1) * squareSize.height}px`;
    el.style.width = `${squareSize.width}px`;
    el.style.height = `${squareSize.height}px`;
    layer.appendChild(el);
  };

  addHighlight(lastMove.from, 'board-square-highlight--from');
  addHighlight(lastMove.to, 'board-square-highlight--to');
}

/**
 * 駒を配置する。
 * @param {BoardState} boardState
 * @param {{SENTE: Object, GOTE: Object}} pieceAssetBySide - 修正①（新規要望）:
 *   陣営ごとの駒画像アセット。各駒の描画時は piece.side（現在の保有者。取った駒は
 *   持ち駒になった時点で保有者側のsideに書き換わる既存仕様＝apply-move.js）で
 *   引くため、成り駒や相手から取った駒であっても「今それを持っている側」の
 *   見た目になる（要望の「取った瞬間に持ってる側の駒に変換される」と一致）。
 * @param {SelectedSource|null} selectedSource
 */
function placePieces(boardState, pieceAssetBySide, selectedSource) {
  // 既存の駒要素をクリア（pieces-layer は boardWrapEl 側に付け替えたため、そちらから探す）
  const existing = boardWrapEl.querySelector('.pieces-layer');
  if (existing) existing.remove();

  const boardSize = { width: boardImageEl.clientWidth, height: boardImageEl.clientHeight };
  const squareSize = getSquareSizePx(boardSize, boardLayout);
  const boardOrigin = getBoardOriginPx(boardSize, boardLayout);
  const kingLabels = determineKingLabels(null); // 平手初期は玉/王

  const piecesLayer = document.createElement('div');
  piecesLayer.className = 'pieces-layer';
  // boardEl（flexで中央寄せされる領域）ではなく boardWrapEl（画像とサイズが一致するラッパー）に
  // 追加することで、top:0/left:0/100% の基準を常に盤画像の実位置に一致させる。
  boardWrapEl.appendChild(piecesLayer);

  for (let file = 1; file <= 9; file++) {
    for (let rank = 1; rank <= 9; rank++) {
      const piece = boardState.squares[file - 1][rank - 1];
      if (!piece) continue;

      // 表示位置の計算（反転対応）
      // 筋（file）は「非反転時：1筋が画面右端、9筋が画面左端」が将棋の標準表記。
      // renderCoordinates() の座標ラベルはこの規則で描画しているため、駒側のX座標も
      // 同じ規則（displayFile=1のとき右端＝9マス目）に合わせる必要がある。
      const { displayFile, displayRank } = toDisplayCoord(file, rank, boardState.isFlipped);

      const kingLabel = piece.side === 'SENTE' ? kingLabels.senteKingLabel : kingLabels.goteKingLabel;
      // 駒の向き（正立/倒立）は盤の実所属（piece.side）だけでなく、盤面反転(isFlipped)も
      // 加味する必要がある。反転＝盤ごと180度回転して見ている状態なので、反転時は
      // 見た目の向きが先手・後手で入れ替わる（asset-fit.js resolvePieceCell()のコメント参照）。
      const displaySide = boardState.isFlipped
        ? (piece.side === 'SENTE' ? 'GOTE' : 'SENTE')
        : piece.side;
      // piece.type は成り状態を含む駒種（例: TO, RY）を保持しているため、
      // resolvePieceCell() には「成り後IDかどうか」を渡す必要がある。
      // ただしOU（王/玉）は成りの概念がなく、promotedはkingLabelの読み替えに使われる
      // 特殊仕様のため、常にfalseで固定する（board.js Piece.type の定義参照）。
      const promotedFlag = piece.type === 'OU' ? false : isPromotedPiece(piece.type);

      // 1マスのセル解決に失敗しても他マスの描画を止めないようにする。
      // resolvePieceCell()はpiece-layout.jsonに該当セルが無いとthrowする仕様のため、
      // ここでcatchしないと for ループ全体が中断し、以降の駒が軒並み描画されなくなる。
      let cell;
      try {
        cell = resolvePieceCell(piece.type, displaySide, promotedFlag, kingLabel, pieceLayout);
      } catch (e) {
        console.error(`駒の描画に失敗しました (file=${file}, rank=${rank}, type=${piece.type}):`, e);
        continue;
      }

      const pieceEl = document.createElement('div');
      pieceEl.className = 'board-piece';
      pieceEl.dataset.file = String(file);
      pieceEl.dataset.rank = String(rank);

      // 選択中ハイライト（修正③: 移動元と同系色の淡い白＋点滅。CSS側 .board-piece--selected 参照）
      if (selectedSource && selectedSource.origin === 'BOARD'
          && selectedSource.square && selectedSource.square.file === file
          && selectedSource.square.rank === rank) {
        pieceEl.classList.add('board-piece--selected');
      }

      // 修正③（新規要望）: 「直前に動いた駒」の点滅表示（旧 .board-piece--last-move、黄色）は廃止。
      // 移動先マスの表現は placeSquareHighlights() が描く静的な背景ハイライト
      // （濃い淡い白）に一本化した。lastMove引数は placeSquareHighlights() 側で
      // 引き続き使用するため、renderBoard/placePieces のシグネチャからは削除していない。

      // 駒画像をスプライトから切り出し
      // 修正①（新規要望）: piece.side（今この駒を保有している陣営。表示上の反転とは無関係の
      // 実所属）に応じて、先手用／後手用いずれの画像セットを使うかを決める。
      const pieceAsset = pieceAssetBySide[piece.side];
      renderPieceImage(pieceEl, pieceAsset, cell, squareSize);

      // 配置位置（盤の外枠オフセット分を加算する）
      pieceEl.style.left = `${boardOrigin.x + (displayFile - 1) * squareSize.width}px`;
      pieceEl.style.top = `${boardOrigin.y + (displayRank - 1) * squareSize.height}px`;
      pieceEl.style.width = `${squareSize.width}px`;
      pieceEl.style.height = `${squareSize.height}px`;

      piecesLayer.appendChild(pieceEl);
    }
  }
}

/**
 * 駒画像をスプライトから切り出して配置する。
 *
 * <img>のobject-fit:none + object-positionは「画像原寸をボックス内に置く」指定であり、
 * background-positionのような「切り出し位置の指定」としては機能しない。
 * そのため、divのbackground-image + background-size + background-positionで
 * スプライトシートを1コマ分だけ切り出す方式に置き換える。
 */
function renderPieceImage(pieceEl, pieceAsset, cell, squareSize) {
  const pieceImageSize = { width: pieceAsset.width, height: pieceAsset.height };
  const renderRect = getPieceRenderRect(squareSize, pieceImageSize, pieceLayout, pieceFit);

  const cols = pieceLayout.grid.cols;
  const rows = pieceLayout.grid.rows;

  // renderRect（1コマの表示サイズ）を基準に、スプライト画像全体の表示サイズを逆算する
  const bgWidth = renderRect.width * cols;
  const bgHeight = renderRect.height * rows;

  // スプライトの切り出し位置（表示サイズ基準）
  const bgX = -(cell.col * renderRect.width);
  const bgY = -(cell.row * renderRect.height);

  pieceEl.innerHTML = '';
  const spriteEl = document.createElement('div');
  spriteEl.style.position = 'absolute';
  spriteEl.style.left = `${renderRect.offsetX}px`;
  spriteEl.style.top = `${renderRect.offsetY}px`;
  spriteEl.style.width = `${renderRect.width}px`;
  spriteEl.style.height = `${renderRect.height}px`;
  spriteEl.style.overflow = 'hidden';
  spriteEl.style.pointerEvents = 'none';
  spriteEl.style.backgroundImage = `url(${pieceAsset.image})`;
  spriteEl.style.backgroundRepeat = 'no-repeat';
  spriteEl.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
  spriteEl.style.backgroundPosition = `${bgX}px ${bgY}px`;
  pieceEl.appendChild(spriteEl);
}

/**
 * 座標符号を描画する。
 */
function renderCoordinates(isFlipped) {
  // 既存の座標要素をクリア
  const existing = document.querySelectorAll('.coordinate-label');
  existing.forEach(el => el.remove());

  if (!boardWrapEl) return;

  const boardSize = { width: boardImageEl.clientWidth, height: boardImageEl.clientHeight };
  const squareSize = getSquareSizePx(boardSize, boardLayout);
  const boardOrigin = getBoardOriginPx(boardSize, boardLayout);

  // 筋（上）※ boardWrapEl は画像と同サイズなので、pieces-layer と同じ基準（top:0,left:0）で配置できる
  const files = isFlipped ? [1,2,3,4,5,6,7,8,9] : [9,8,7,6,5,4,3,2,1];
  files.forEach((file, i) => {
    const label = document.createElement('div');
    label.className = 'coordinate-label coordinate-label--file';
    label.textContent = String(file);
    label.style.left = `${boardOrigin.x + i * squareSize.width + squareSize.width / 2}px`;
    label.style.top = '-8px';
    boardWrapEl.appendChild(label);
  });

  // 段（右）
  const ranks = isFlipped ? [9,8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8,9];
  const kanji = ['一','二','三','四','五','六','七','八','九'];
  ranks.forEach((rank, i) => {
    const label = document.createElement('div');
    label.className = 'coordinate-label coordinate-label--rank';
    label.textContent = kanji[rank - 1];
    label.style.top = `${boardOrigin.y + i * squareSize.height + squareSize.height / 2}px`;
    label.style.left = `${boardSize.width + 6}px`;
    boardWrapEl.appendChild(label);
  });
}