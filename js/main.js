/**
 * エントリーポイント。各モジュールの初期化・イベント登録（設計書 第1部）
 */
import { loadAssetManifest } from './assets/asset-manifest.js';
import { initBoardView, renderBoard } from './ui/board-view.js';
import { initHeaderButtons, updateHeaderButtons } from './ui/header-buttons.js';
import { initBottomControls, updateBottomControls } from './ui/bottom-controls.js';
import { renderKifuBar, getKifuBarContent } from './ui/kifu-bar.js';
import { renderHandPieces } from './ui/player-info.js';
import { initAssetDrawer, openAssetDrawer, closeAssetDrawer } from './ui/asset-drawer.js';
import { handleTap } from './ui/selection.js';
import { getState, setRenderCallback, getKifuModeInfo } from './state/app-state.js';
import { getSquareSizePx, getBoardOriginPx } from './assets/asset-fit.js';
import { registerServiceWorker } from './pwa/register-sw.js';

// レイアウトデータ
let layouts = null;

// 相手側・自分側の持ち駒並び順
const OPPONENT_HAND_ORDER = ['HI', 'KA', 'KI', 'GI', 'KE', 'KY', 'FU']; // 右詰め（要件定義書5.3節）
const SELF_HAND_ORDER = ['FU', 'KY', 'KE', 'GI', 'KI', 'KA', 'HI'];     // 左詰め（要件定義書5.5節）

/**
 * アプリ初期化。
 */
async function init() {
  try {
    // アセットマニフェストの読み込み
    const manifest = await loadAssetManifest();
    manifestRef = manifest;

    // レイアウトJSONの読み込み
    const [boardLayout, pieceLayout, pieceFit] = await Promise.all([
      fetch('./assets/layout/board-layout.json').then(r => r.json()),
      fetch('./assets/layout/piece-layout.json').then(r => r.json()),
      fetch('./assets/layout/piece-fit.json').then(r => r.json())
    ]);
    layouts = { boardLayout, pieceLayout, pieceFit };

    // 盤面ビューの初期化
    const boardEl = document.getElementById('board');
    initBoardView(boardEl, layouts, manifest);

    // ハンバーガーメニュー（ドロワー）の初期化
    const drawerEl = document.getElementById('asset-drawer');
    initAssetDrawer(drawerEl, manifest, layouts, renderAll);

    // ドロワーオーバーレイのクリックで閉じる
    const overlayEl = document.getElementById('asset-drawer-overlay');
    overlayEl.addEventListener('click', () => {
      if (getState().isAssetDrawerOpen) closeAssetDrawer();
    });

    // ヘッダー・下部操作列のイベント登録
    initHeaderButtons();
    initBottomControls();

    // 盤面タップイベント
    setupBoardTapHandler();

    // 持ち駒タップイベント
    setupHandTapHandler();

    // 再描画コールバック登録
    setRenderCallback(renderAll);

    // リサイズ対応（スケーリング）
    setupScaling();

    // 初期描画
    renderAll();
  } catch (e) {
    console.error('アプリ初期化エラー:', e);
  }
}

/**
 * 画面全体を再描画する。
 */
function renderAll() {
  const state = getState();
  const { isKifuMode, kifuProgress } = getKifuModeInfo();

  // 盤面
  renderBoard(state.boardState, state.selectedBoardId, state.selectedPieceId, state.selectedSource);

  // 棋譜符号バー
  const kifuBarContent = getKifuBarContent(isKifuMode, kifuProgress, state.kifuData, state.moveHistory);
  renderKifuBar(document.getElementById('kifu-bar'), kifuBarContent, state.isKifuBarVisible);

  // 持ち駒（反転時は入れ替え）
  const boardSize = { width: 380, height: 380 }; // 盤の表示サイズはCSSで固定
  const boardImageEl = document.querySelector('.board-image');
  const actualBoardSize = boardImageEl
    ? { width: boardImageEl.clientWidth, height: boardImageEl.clientHeight }
    : boardSize;
  const squareSize = getSquareSizePx(actualBoardSize, layouts.boardLayout);

  const topPieces = state.boardState.isFlipped ? state.boardState.handSente : state.boardState.handGote;
  const bottomPieces = state.boardState.isFlipped ? state.boardState.handGote : state.boardState.handSente;

  // 選択中ハイライトの対象駒種
  const selected = state.selectedSource;
  const topSelected = selected && selected.origin === 'HAND'
    && (state.boardState.isFlipped ? selected.side === 'SENTE' : selected.side === 'GOTE')
    ? selected.pieceType : null;
  const bottomSelected = selected && selected.origin === 'HAND'
    && (state.boardState.isFlipped ? selected.side === 'GOTE' : selected.side === 'SENTE')
    ? selected.pieceType : null;

  renderHandPieces(topPieces, 'RIGHT', OPPONENT_HAND_ORDER,
    document.getElementById('opponent-hand'), topSelected, squareSize,
    state.selectedPieceId, layouts.pieceLayout, layouts.pieceFit, manifestRef);

  renderHandPieces(bottomPieces, 'LEFT', SELF_HAND_ORDER,
    document.getElementById('self-hand'), bottomSelected, squareSize,
    state.selectedPieceId, layouts.pieceLayout, layouts.pieceFit, manifestRef);

  // 対戦者名（反転時は入れ替え）
  const senteName = state.kifuData ? state.kifuData.header.senteName : '先手';
  const goteName = state.kifuData ? state.kifuData.header.goteName : '後手';
  document.getElementById('opponent-name').textContent = state.boardState.isFlipped ? senteName : goteName;
  document.getElementById('self-name').textContent = state.boardState.isFlipped ? goteName : senteName;

  // ボタン更新
  updateHeaderButtons();
  updateBottomControls();

  // ドロワーの開閉状態を反映
  const drawerEl = document.getElementById('asset-drawer');
  const overlayEl = document.getElementById('asset-drawer-overlay');
  if (state.isAssetDrawerOpen) {
    drawerEl.classList.add('asset-drawer--open');
    overlayEl.classList.add('asset-drawer-overlay--visible');
  } else {
    drawerEl.classList.remove('asset-drawer--open');
    overlayEl.classList.remove('asset-drawer-overlay--visible');
  }
}

// マニフェスト参照（renderAll から使用）
let manifestRef = null;

/**
 * 盤面タップイベントを設定する。
 */
function setupBoardTapHandler() {
  const boardEl = document.getElementById('board');
  boardEl.addEventListener('click', (e) => {
    const pieceEl = e.target.closest('.board-piece');
    if (pieceEl) {
      // 駒タップ
      const file = parseInt(pieceEl.dataset.file, 10);
      const rank = parseInt(pieceEl.dataset.rank, 10);
      handleTap('BOARD', { file, rank }, null, null, getState().boardState, getState().selectedSource);
      return;
    }

    // 空マスタップ：座標を計算
    const boardImageEl = boardEl.querySelector('.board-image');
    if (!boardImageEl) return;

    // 盤画像自体の実表示位置を基準にする（boardEl はflexで中央寄せされる領域のため、
    // boardEl基準だとその余白の分だけ盤画像の実位置とズレる。board-view.js の
    // boardWrapEl と同じ考え方）。
    const rect = boardImageEl.getBoundingClientRect();
    const scale = getCurrentScale();
    const rawX = (e.clientX - rect.left) / scale;
    const rawY = (e.clientY - rect.top) / scale;

    const boardWidth = boardImageEl.clientWidth;
    const boardHeight = boardImageEl.clientHeight;
    const squareSize = getSquareSizePx({ width: boardWidth, height: boardHeight }, layouts.boardLayout);
    const boardOrigin = getBoardOriginPx({ width: boardWidth, height: boardHeight }, layouts.boardLayout);

    // boardOrigin（外枠の余白分）を差し引いてから、マス目に対する相対座標にする。
    // board-view.js の駒配置（boardOrigin + (displayFile-1)*squareSize）と対になる変換。
    const x = rawX - boardOrigin.x;
    const y = rawY - boardOrigin.y;

    // displayFile/displayRank: 画面左上を(1,1)とした「見た目上のマス位置」（1〜9）
    const displayFile = Math.floor(x / squareSize.width) + 1;
    const displayRank = Math.floor(y / squareSize.height) + 1;
    if (displayFile >= 1 && displayFile <= 9 && displayRank >= 1 && displayRank <= 9) {
      // 見た目上のマス位置から実際の筋・段への変換は、board-view.js の描画ロジック
      // （displayFile = isFlipped ? file : 10 - file）の逆変換と一致させる必要がある。
      // 非反転時：画面左端(displayFile=1)は9筋、画面右端(displayFile=9)は1筋 → file = 10 - displayFile
      // 反転時：画面左端(displayFile=1)は1筋 → file = displayFile
      const actualFile = getState().boardState.isFlipped ? displayFile : 10 - displayFile;
      const actualRank = getState().boardState.isFlipped ? 10 - displayRank : displayRank;
      handleTap('BOARD', { file: actualFile, rank: actualRank }, null, null,
        getState().boardState, getState().selectedSource);
    }
  });
}

/**
 * 持ち駒タップイベントを設定する。
 */
function setupHandTapHandler() {
  const opponentHand = document.getElementById('opponent-hand');
  const selfHand = document.getElementById('self-hand');

  [opponentHand, selfHand].forEach((container) => {
    container.addEventListener('click', (e) => {
      const pieceEl = e.target.closest('.hand-piece');
      if (!pieceEl) return;
      const pieceType = pieceEl.dataset.pieceType;
      const isOpponent = container === opponentHand;
      const isFlipped = getState().boardState.isFlipped;
      // 相手側（③）＝後手、自分側（⑤）＝先手（反転時は入れ替え）
      const side = isOpponent ? (isFlipped ? 'SENTE' : 'GOTE') : (isFlipped ? 'GOTE' : 'SENTE');
      handleTap('HAND', null, pieceType, side, getState().boardState, getState().selectedSource);
    });
  });
}

/**
 * 現在のスケールを取得する。
 */
function getCurrentScale() {
  const scaleRoot = document.getElementById('scale-root');
  return scaleRoot.dataset.scale ? parseFloat(scaleRoot.dataset.scale) : 1;
}

/**
 * 画面スケーリングの設定（設計書 第1部2.6節）。
 *
 * iPhone等のスマホ幅では、幅を画面いっぱいにフィットさせることを優先する
 * （= scale は window.innerWidth / 390 のみで決める）。詳細はstyle.cssのコメント参照。
 * 高さの余剰・不足分は #scale-root 側の縦スクロールで吸収する。
 *
 * iPad等の広い画面では、従来通りMath.minで全体を画面内に収め、余白に畳を見せる。
 */
function setupScaling() {
  const scaleRoot = document.getElementById('scale-root');
  const appFrame = document.getElementById('app-frame');

  // スマホ幅とみなす閾値。iPhone Pro Max等の最大幅より少し余裕を持たせる。
  const PHONE_WIDTH_THRESHOLD = 500;

  function applyScale() {
    const isPhoneWidth = window.innerWidth <= PHONE_WIDTH_THRESHOLD;

    const scale = isPhoneWidth
      ? window.innerWidth / 390
      : Math.min(window.innerWidth / 390, window.innerHeight / 844);

    appFrame.style.transform = `scale(${scale})`;
    scaleRoot.dataset.scale = String(scale);
    scaleRoot.classList.toggle('scale-root--phone', isPhoneWidth);
  }

  window.addEventListener('resize', applyScale);
  applyScale();
}

// 起動
init();

// PWA（開発中は無効。最終段階で有効化）
registerServiceWorker();
