/**
 * ③⑤対戦相手情報・自分の情報＋持ち駒（共通化）（設計書 第4部4節）
 */
import { getPieceRenderRect, resolvePieceCell } from '../assets/asset-fit.js';
import { findPieceAsset } from '../assets/asset-manifest.js';

/**
 * 持ち駒を描画する単一関数。
 * @param {HandPieces} pieces - 描画対象の持ち駒
 * @param {'LEFT'|'RIGHT'} alignment - 詰める方向。自分側='LEFT'、相手側='RIGHT'
 * @param {PieceType[]} order - 並び順（左→右）
 * @param {HTMLElement} containerEl - 描画先のDOM要素
 * @param {PieceType|null} selectedPieceType - 選択中の駒種（なければnull）
 * @param {{width: number, height: number}} squareSizePx - 盤マス1つの実ピクセルサイズ
 * @param {string} selectedPieceId - 選択中の駒セットID
 * @param {Object} pieceLayout - piece-layout.json
 * @param {Object} pieceFit - piece-fit.json
 * @param {AssetManifest} manifest - アセットマニフェスト
 */
export function renderHandPieces(pieces, alignment, order, containerEl, selectedPieceType, squareSizePx, selectedPieceId, pieceLayout, pieceFit, manifest) {
  // フル再描画
  // 注意: containerEl（#opponent-hand/#self-hand）はHTML側で既に
  // "hand-pieces-container" クラス（flex:1で親の幅を占有する役割）を持っている。
  // ここを className = '...' で上書きすると hand-pieces-container が消え、
  // 幅が潰れて持ち駒が実質見えなくなるため、classList で追加のみ行う。
  containerEl.innerHTML = '';
  containerEl.classList.add('hand-pieces', `hand-pieces--${alignment.toLowerCase()}`);

  const pieceAsset = findPieceAsset(manifest, selectedPieceId);
  const pieceImageSize = { width: pieceAsset.width, height: pieceAsset.height };

  for (const pieceType of order) {
    const count = pieces[pieceType];
    if (!count) continue; // 0枚は非表示

    const item = document.createElement('div');
    item.className = 'hand-piece';
    item.dataset.pieceType = pieceType;
    item.style.width = `${squareSizePx.width}px`;
    item.style.height = `${squareSizePx.height}px`;

    if (selectedPieceType === pieceType) {
      item.classList.add('hand-piece--selected');
    }

    // 駒画像
    const cell = resolvePieceCell(pieceType, 'SENTE', false, null, pieceLayout);
    const renderRect = getPieceRenderRect(squareSizePx, pieceImageSize, pieceLayout, pieceFit);
    const cellWidth = pieceAsset.width / pieceLayout.grid.cols;
    const cellHeight = pieceAsset.height / pieceLayout.grid.rows;

    const img = document.createElement('img');
    img.src = pieceAsset.image;
    img.draggable = false;
    img.style.position = 'absolute';
    img.style.left = `${renderRect.offsetX}px`;
    img.style.top = `${renderRect.offsetY}px`;
    img.style.width = `${renderRect.width}px`;
    img.style.height = `${renderRect.height}px`;
    img.style.objectFit = 'none';
    img.style.objectPosition = `${-(cell.col * cellWidth)}px ${-(cell.row * cellHeight)}px`;
    img.style.pointerEvents = 'none';
    item.appendChild(img);

    // 複数枚の場合は右下に数字
    if (count > 1) {
      const countEl = document.createElement('span');
      countEl.className = 'hand-piece-count';
      countEl.textContent = String(count);
      item.appendChild(countEl);
    }

    containerEl.appendChild(item);
  }
}