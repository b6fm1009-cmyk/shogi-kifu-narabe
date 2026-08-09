/**
 * ハンバーガーメニュー：盤・駒選択ドロワー（設計書 第4部10章）
 */
import { selectPieceAsset, selectBoardAsset, setAssetDrawerOpen, getState } from '../state/app-state.js';
import { getPieceRenderRect, resolvePieceCell } from '../assets/asset-fit.js';
import { PROMOTION_MAP } from '../models/board.js';

let drawerEl = null;
let overlayEl = null;
let activeTab = 'PIECE';
// 修正①（新規要望）: 駒タブ内で「先手用」「後手用」どちらの駒セットを選んでいるかを
// 保持する内部状態。ドロワーの開閉自体はapp-state.js（isAssetDrawerOpen）が正本だが、
// このactiveSideはドロワー内部のUI状態（どのタブ・どちらの陣営を表示中か）に過ぎず、
// 他画面の描画に影響しないため、activeTabと同様このモジュール内のプライベート変数として
// 保持する（app-stateに含めるとselectedSource等と同列の「アプリ全体の状態」に
// 見えてしまい、実態（ドロワーを閉じれば意味を失う一時的なUI状態）とずれるため）。
let activeSide = 'SENTE';
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
  activeSide = 'SENTE'; // 修正①（新規要望）: 開くたびに先手用にリセット（駒タブと同じ考え方で毎回同じ状態から始める）
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
    renderPieceSideSwitch(body);
    renderPieceTab(body);
  } else {
    renderBoardTab(body);
  }
}

/**
 * 修正①（新規要望）: 駒タブ上部に「先手用」「後手用」の切り替えセグメントを描画する。
 * 盤タブには成りの概念がなく先手/後手で見た目を分ける要望も出ていないため、この
 * 切り替えは駒タブ限定とする。
 */
function renderPieceSideSwitch(body) {
  const switchEl = document.createElement('div');
  switchEl.className = 'asset-piece-side-switch';

  const sides = [
    { side: 'SENTE', label: '先手用' },
    { side: 'GOTE', label: '後手用' }
  ];
  for (const s of sides) {
    const btn = document.createElement('button');
    btn.className = 'asset-piece-side-switch-btn';
    btn.textContent = s.label;
    btn.classList.toggle('asset-piece-side-switch-btn--active', activeSide === s.side);
    btn.addEventListener('click', () => {
      activeSide = s.side;
      renderBody();
    });
    switchEl.appendChild(btn);
  }
  body.appendChild(switchEl);
}

/**
 * 駒タブを描画する。
 * 修正①（新規要望）: 行タップ時にどちら側（activeSide）の選択を更新するかを渡す。
 * 選択中ハイライトの判定（isPieceSelected）もactiveSide基準に変わる。
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
      selectPieceAsset(piece.id, activeSide);
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

    // 追加修正②: resolvePieceCell()（asset-fit.js）は「成り状態を含む駒種」を
    // pieceTypeとして受け取る仕様（board-view.js の piece.type と同じ扱い。
    // 例: 成った飛車なら'HI'ではなく'RY'を渡す）。tc.type は常に成る前のID
    // （'HI'/'KE'）で保持しているため、tc.promoted===true の場合は
    // PROMOTION_MAP で成り後のIDに変換してから渡す。これを怠ると
    // resolvePieceCell内部の列検索（c.promotedId === pieceType）が一致せず
    // 例外が投げられ、成り駒サムネイルが空白のまま描画されない。
    const resolvedType = tc.promoted ? PROMOTION_MAP[tc.type] : tc.type;
    const cell = resolvePieceCell(resolvedType, 'SENTE', tc.promoted, null, pieceLayout);
    const renderRect = getPieceRenderRect(squareSizePx, pieceImageSize, pieceLayout, pieceFit);

    const cols = pieceLayout.grid.cols;
    const rows = pieceLayout.grid.rows;
    const bgWidth = renderRect.width * cols;
    const bgHeight = renderRect.height * rows;
    const bgX = -(cell.col * renderRect.width);
    const bgY = -(cell.row * renderRect.height);

    // 修正②: board-view.js / player-info.js と同様、thumbEl（40x48固定の枠）に
    // 直接背景を貼るのではなく、内側に renderRect のサイズ・offsetX/offsetY を反映した
    // 「切り出し窓」spriteEl を作り、そこへ背景画像を敷く。これにより
    // ・fit_mode:contain で生まれる余白（bottom寄せ分のoffsetY）が正しく反映される
    // ・spriteEl自体がoverflow:hiddenの窓になるため、隣接する行・列の絵柄が
    //   はみ出て見えることがなくなる
    thumbEl.innerHTML = '';
    thumbEl.style.position = 'relative';
    thumbEl.style.overflow = 'hidden';

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
    thumbEl.appendChild(spriteEl);
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
 * 修正①（新規要望）: activeSide（今表示中の先手用/後手用切り替え）に対応する
 * state側の駒セットIDと比較する。
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
  return activeSide === 'SENTE' ? getState().selectedPieceIdSente : getState().selectedPieceIdGote;
}

function getSelectedBoardId() {
  return getState().selectedBoardId;
}