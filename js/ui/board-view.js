/**
 * ④盤面・座標符号の描画（設計書 第5部）
 */
import { getSquareSizePx, getPieceRenderRect, resolvePieceCell } from '../assets/asset-fit.js';
import { findBoardAsset, findPieceAsset } from '../assets/asset-manifest.js';
import { determineKingLabels } from '../models/kifu.js';

let boardEl = null;
let boardImageEl = null;
let boardLayout = null;
let pieceLayout = null;
let pieceFit = null;
let manifest = null;

/**
 * 盤面描画の初期化。
 * @param {HTMLElement} containerEl - 盤面コンテナ
 * @param {Object} layouts - { boardLayout, pieceLayout, pieceFit }
 * @param {AssetManifest} assetManifest
 */
export function initBoardView(containerEl, layouts, assetManifest) {
  boardEl = containerEl;
  boardLayout = layouts.boardLayout;
  pieceLayout = layouts.pieceLayout;
  pieceFit = layouts.pieceFit;
  manifest = assetManifest;
}

/**
 * 盤面を描画する。
 * @param {BoardState} boardState
 * @param {string} selectedBoardId
 * @param {string} selectedPieceId
 * @param {SelectedSource|null} selectedSource
 */
export function renderBoard(boardState, selectedBoardId, selectedPieceId, selectedSource) {
  if (!boardEl) return;

  const boardAsset = findBoardAsset(manifest, selectedBoardId);
  const pieceAsset = findPieceAsset(manifest, selectedPieceId);

  // 盤画像コンテナ
  boardEl.innerHTML = '';
  boardEl.className = 'board-container';

  // 盤画像
  boardImageEl = document.createElement('img');
  boardImageEl.src = boardAsset.image;
  boardImageEl.className = 'board-image';
  boardImageEl.draggable = false;
  boardEl.appendChild(boardImageEl);

  // 画像ロード後にマス計算と駒配置を行う
  if (boardImageEl.complete) {
    placePieces(boardState, pieceAsset, selectedSource);
  } else {
    boardImageEl.addEventListener('load', () => {
      placePieces(boardState, pieceAsset, selectedSource);
    });
  }

  // 座標符号
  renderCoordinates(boardState.isFlipped);
}

/**
 * 駒を配置する。
 */
function placePieces(boardState, pieceAsset, selectedSource) {
  // 既存の駒要素をクリア
  const existing = boardEl.querySelector('.pieces-layer');
  if (existing) existing.remove();

  const boardSize = { width: boardImageEl.clientWidth, height: boardImageEl.clientHeight };
  const squareSize = getSquareSizePx(boardSize, boardLayout);
  const kingLabels = determineKingLabels(null); // 平手初期は玉/王

  const piecesLayer = document.createElement('div');
  piecesLayer.className = 'pieces-layer';
  boardEl.appendChild(piecesLayer);

  for (let file = 1; file <= 9; file++) {
    for (let rank = 1; rank <= 9; rank++) {
      const piece = boardState.squares[file - 1][rank - 1];
      if (!piece) continue;

      // 表示位置の計算（反転対応）
      const displayFile = boardState.isFlipped ? 10 - file : file;
      const displayRank = boardState.isFlipped ? 10 - rank : rank;

      const kingLabel = piece.side === 'SENTE' ? kingLabels.senteKingLabel : kingLabels.goteKingLabel;
      const cell = resolvePieceCell(piece.type, piece.side, false, kingLabel, pieceLayout);

      const pieceEl = document.createElement('div');
      pieceEl.className = 'board-piece';
      pieceEl.dataset.file = String(file);
      pieceEl.dataset.rank = String(rank);

      // 選択中ハイライト
      if (selectedSource && selectedSource.origin === 'BOARD'
          && selectedSource.square && selectedSource.square.file === file
          && selectedSource.square.rank === rank) {
        pieceEl.classList.add('board-piece--selected');
      }

      // 駒画像をスプライトから切り出し
      renderPieceImage(pieceEl, pieceAsset, cell, squareSize);

      // 配置位置
      pieceEl.style.left = `${(displayFile - 1) * squareSize.width}px`;
      pieceEl.style.top = `${(displayRank - 1) * squareSize.height}px`;
      pieceEl.style.width = `${squareSize.width}px`;
      pieceEl.style.height = `${squareSize.height}px`;

      piecesLayer.appendChild(pieceEl);
    }
  }
}

/**
 * 駒画像をスプライトから切り出して配置する。
 */
function renderPieceImage(pieceEl, pieceAsset, cell, squareSize) {
  const pieceImageSize = { width: pieceAsset.width, height: pieceAsset.height };
  const renderRect = getPieceRenderRect(squareSize, pieceImageSize, pieceLayout, pieceFit);

  const cellWidth = pieceAsset.width / pieceLayout.grid.cols;
  const cellHeight = pieceAsset.height / pieceLayout.grid.rows;

  // スプライトの切り出し位置
  const bgX = -(cell.col * cellWidth);
  const bgY = -(cell.row * cellHeight);

  pieceEl.innerHTML = '';
  const img = document.createElement('img');
  img.src = pieceAsset.image;
  img.draggable = false;
  img.style.position = 'absolute';
  img.style.left = `${renderRect.offsetX}px`;
  img.style.top = `${renderRect.offsetY}px`;
  img.style.width = `${renderRect.width}px`;
  img.style.height = `${renderRect.height}px`;
  img.style.objectFit = 'none';
  img.style.objectPosition = `${bgX}px ${bgY}px`;
  img.style.pointerEvents = 'none';
  pieceEl.appendChild(img);
}

/**
 * 座標符号を描画する。
 */
function renderCoordinates(isFlipped) {
  // 既存の座標要素をクリア
  const existing = document.querySelectorAll('.coordinate-label');
  existing.forEach(el => el.remove());

  if (!boardEl) return;

  const boardRect = boardEl.getBoundingClientRect();
  const boardSize = { width: boardImageEl.clientWidth, height: boardImageEl.clientHeight };
  const squareSize = getSquareSizePx(boardSize, boardLayout);

  // 筋（上）
  const files = isFlipped ? [1,2,3,4,5,6,7,8,9] : [9,8,7,6,5,4,3,2,1];
  files.forEach((file, i) => {
    const label = document.createElement('div');
    label.className = 'coordinate-label coordinate-label--file';
    label.textContent = String(file);
    label.style.left = `${i * squareSize.width + squareSize.width / 2}px`;
    label.style.top = '-16px';
    boardEl.appendChild(label);
  });

  // 段（右）
  const ranks = isFlipped ? [9,8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8,9];
  const kanji = ['一','二','三','四','五','六','七','八','九'];
  ranks.forEach((rank, i) => {
    const label = document.createElement('div');
    label.className = 'coordinate-label coordinate-label--rank';
    label.textContent = kanji[rank - 1];
    label.style.top = `${i * squareSize.height + squareSize.height / 2}px`;
    label.style.left = `${boardSize.width + 4}px`;
    boardEl.appendChild(label);
  });
}