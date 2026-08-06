/**
 * ハンバーガーメニュー：盤・駒選択ドロワー（設計書 第4部10章）
 */
import { selectPieceAsset, selectBoardAsset, setAssetDrawerOpen, getState } from '../state/app-state.js';
import { getPieceRenderRect, resolvePieceCell } from '../assets/asset-fit.js';

let drawerEl = null;
let overlayEl = null;
let activeTab = 'PIECE';
let manifest = null;
let pieceLayout = null;
let pieceFit = null;
let renderCallback = null;

/**
 * ドロワーの初期化。
 * @param {HTMLElement} containerEl - ドロワーコンテナ
 * @param {AssetManifest} assetManifest
 * @param {Object} layouts - { pieceLayout, pieceFit }
 * @param {() => void} onRender - 選択変更後の再描画コールバック
 */
export function initAssetDrawer(containerEl, assetManifest, layouts, onRender) {
  drawerEl = containerEl;
  manifest = assetManifest;
  pieceLayout = layouts.pieceLayout;
  pieceFit = layouts.pieceFit;
  renderCallback = onRender;

  // ドロワー構造を作成
  drawerEl.innerHTML = `
    <div class="asset-drawer-header">
      <div class="asset-drawer-tabs">
        <button class="asset-drawer-tab asset-drawer-tab--piece" data-tab="PIECE">駒</button>
        <button class="asset-drawer-tab asset-drawer-tab--board" data-tab="BOARD">盤</button>
      </div>
      <button class="asset-drawer-close">×</button>
    </div>
    <div class="asset-drawer-body"></div>
  `;

  drawerEl.querySelector('.asset-drawer-close').addEventListener('click', closeAssetDrawer);
  drawerEl.querySelectorAll('.asset-drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      updateTabs();
      renderBody();
    });
  });
}

/**
 * ドロワーを開く。
 */
export function openAssetDrawer() {
  activeTab = 'PIECE'; // 開くたびに駒タブにリセット（要件定義書5.9節）
  setAssetDrawerOpen(true);
  updateTabs();
  renderBody();
}

/**
 * ドロワーを閉じる。
 */
export function closeAssetDrawer() {
  setAssetDrawerOpen(false);
}

/**
 * タブの表示を更新する。
 */
function updateTabs() {
  drawerEl.querySelectorAll('.asset-drawer-tab').forEach(tab => {
    tab.classList.toggle('asset-drawer-tab--active', tab.dataset.tab === activeTab);
  });
}

/**
 * ドロワー本体を描画する。
 */
function renderBody() {
  const body = drawerEl.querySelector('.asset-drawer-body');
  body.innerHTML = '';
  if (activeTab === 'PIECE') {
    renderPieceTab(body);
  } else {
    renderBoardTab(body);
  }
}

/**
 * 駒タブを描画する。
 */
function renderPieceTab(body) {
  for (const piece of manifest.pieces) {
    const row = document.createElement('div');
    row.className = 'asset-row asset-row--piece';
    row.dataset.id = piece.id;
    if (isPieceSelected(piece.id)) {
      row.classList.add('asset-row--selected');
    }

    // 4サムネイル（飛・竜・桂・成桂）
    const thumbs = document.createElement('div');
    thumbs.className = 'asset-row-thumbs';
    const thumbCells = [
      { type: 'HI', promoted: false },
      { type: 'HI', promoted: true },
      { type: 'KE', promoted: false },
      { type: 'KE', promoted: true }
    ];
    for (const tc of thumbCells) {
      const thumb = document.createElement('span');
      thumb.className = 'asset-thumb';
      renderPieceThumb(thumb, piece, tc);
      thumbs.appendChild(thumb);
    }
    row.appendChild(thumbs);

    const label = document.createElement('span');
    label.className = 'asset-row-label';
    label.textContent = piece.label;
    row.appendChild(label);

    row.addEventListener('click', () => {
      selectPieceAsset(piece.id);
      renderBody();
      if (renderCallback) renderCallback();
    });

    body.appendChild(row);
  }
}

/**
 * 駒サムネイルにスプライト画像を描画する。
 * board-view.js / player-info.js と同じく、スプライトシートを
 * background-image + background-size + background-position で1コマ分切り出す。
 */
function renderPieceThumb(thumbEl, pieceAsset, tc) {
  try {
    const pieceImageSize = { width: pieceAsset.width, height: pieceAsset.height };
    // .asset-thumb のCSSサイズ（40x48）を基準に、駒の表示矩形を算出する
    const squareSizePx = { width: 40, height: 48 };

    const cell = resolvePieceCell(tc.type, 'SENTE', tc.promoted, null, pieceLayout);
    const renderRect = getPieceRenderRect(squareSizePx, pieceImageSize, pieceLayout, pieceFit);

    const cols = pieceLayout.grid.cols;
    const rows = pieceLayout.grid.rows;
    const bgWidth = renderRect.width * cols;
    const bgHeight = renderRect.height * rows;
    const bgX = -(cell.col * renderRect.width);
    const bgY = -(cell.row * renderRect.height);

    thumbEl.style.backgroundImage = `url(${pieceAsset.image})`;
    thumbEl.style.backgroundRepeat = 'no-repeat';
    thumbEl.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
    thumbEl.style.backgroundPosition = `${bgX}px ${bgY}px`;
    thumbEl.style.position = 'relative';
    thumbEl.style.overflow = 'hidden';
  } catch (e) {
    console.error(`駒サムネイルの描画に失敗しました (piece=${pieceAsset.id}, type=${tc.type}, promoted=${tc.promoted}):`, e);
  }
}

/**
 * 盤タブを描画する。
 */
function renderBoardTab(body) {
  for (const board of manifest.boards) {
    const row = document.createElement('div');
    row.className = 'asset-row asset-row--board';
    row.dataset.id = board.id;
    if (isBoardSelected(board.id)) {
      row.classList.add('asset-row--selected');
    }

    const thumb = document.createElement('span');
    thumb.className = 'asset-board-thumb';
    const img = document.createElement('img');
    img.src = board.image;
    img.alt = board.label;
    thumb.appendChild(img);
    row.appendChild(thumb);

    const label = document.createElement('span');
    label.className = 'asset-row-label';
    label.textContent = board.label;
    row.appendChild(label);

    row.addEventListener('click', () => {
      selectBoardAsset(board.id);
      renderBody();
      if (renderCallback) renderCallback();
    });

    body.appendChild(row);
  }
}

/**
 * 選択中の駒セットかどうか。
 */
function isPieceSelected(id) {
  return getSelectedPieceId() === id;
}

/**
 * 選択中の盤かどうか。
 */
function isBoardSelected(id) {
  return getSelectedBoardId() === id;
}

function getSelectedPieceId() {
  return getState().selectedPieceId;
}

function getSelectedBoardId() {
  return getState().selectedBoardId;
}