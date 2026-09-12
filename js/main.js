/**
 * エントリーポイント。各モジュールの初期化・イベント登録（設計書 第1部）
 */
import { loadAssetManifest } from './assets/asset-manifest.js';
import { initBoardView, renderBoard } from './ui/board-view.js';
import { initHeaderButtons, updateHeaderButtons } from './ui/header-buttons.js';
import { initBottomControls, updateBottomControls } from './ui/bottom-controls.js';
import { renderKifuBar, getKifuBarContent } from './ui/kifu-bar.js';
import { renderHandPieces, renderPlayerInfoBox } from './ui/player-info.js';
import { initAssetDrawer, openAssetDrawer, closeAssetDrawer } from './ui/asset-drawer.js';
import { initInfoPopup } from './ui/info-popup.js';
import { handleTap } from './ui/selection.js';
import { getState, setRenderCallback, getKifuModeInfo } from './state/app-state.js';
import { getSquareSizePx, getBoardOriginPx } from './assets/asset-fit.js';
import { registerServiceWorker } from './pwa/register-sw.js';
import { suppressDoubleTapZoom, suppressImageSaveGestures } from './ui/touch-guard.js';

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

    // 盤面ビューの初期化。contain設計ではapp-frame自体が等倍のため
    // scale再計算コールバックは不要。画像ロード完了時はrenderAllのみ行う。
    const boardEl = document.getElementById('board');

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

    // 使い方インフォボタンの初期化
    initInfoPopup();

    // 修正⑧: ダブルタップズームの抑制対象を document.body 全体に拡張する。
    // 従来は .header と .bottom-controls のみを個別に監視していたが、
    // #kifu-bar（棋譜符号欄）や .player-info（対局者名欄）など、後から追加された
    // 要素がガードの対象外のまま素通りし、そこをダブルタップされるとブラウザ標準の
    // ズームが発生してしまっていた（viewport の user-scalable=no がユーザーの
    // アクセシビリティ設定により無視されるケースがあるため、この保険が必要）。
    // 個別要素を都度指定する方式は「新しい要素を追加するたびにガード登録も足す」
    // 運用を要求し、抜け漏れの温床になる。body単位で一括監視すれば、今後DOM構造が
    // 増えても追加対応が不要になる。
    // 修正⑫: ボタンの無効化はネイティブdisabled属性ではなく.is-disabledクラス＋
    // aria-disabledで行う方式に変更した（js/ui/button-state.js, js/ui/touch-guard.js
    // 参照）。これによりtouch-guard.js側は「button要素かどうか」だけを見れば良く、
    // 無効化中のボタンでもタッチは確実にボタン自身へ配送される。
    suppressDoubleTapZoom(document.body);

    // 修正②: 盤・駒画像は配布素材のため、長押しでの画像保存を防止する。
    // 盤・駒レイヤー、成りポップアップ、アセットドロワーのサムネイルはすべて動的に
    // 生成される要素なので、document.body単位でイベント委譲することで、
    // 生成タイミングに関わらずまとめて対象にする。
    suppressImageSaveGestures(document.body);

    // 盤面タップイベント
    setupBoardTapHandler();

    // 持ち駒タップイベント
    setupHandTapHandler();

    // 再描画コールバック登録
    setRenderCallback(renderAll);

    // リサイズ対応は不要（contain設計ではapp-frame自体が等倍フルードのため。
    // 盤マス計算はboard-view.jsがclientWidth基準で都度取得する）。

    // 盤面ビューの初期化。盤画像ロード完了時はrenderAllのみ行う。
    initBoardView(boardEl, layouts, manifest, renderAll);

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
  // 修正①（新規要望）: 先手用・後手用の駒セットを別々に渡す
  // 修正②（新規要望）: 直前に指した駒が視覚的にわかるよう、moveHistoryの最後の手を渡す。
  // 手番の制約自体（8.6節）は撤廃されたままであり、これはあくまで表示上のヒント
  // （「この駒を動かしたなら逆側の手番」）であって入力を制限するものではない。
  const lastMove = state.moveHistory.length > 0
    ? state.moveHistory[state.moveHistory.length - 1]
    : null;
  renderBoard(state.boardState, state.selectedBoardId,
    { sente: state.selectedPieceIdSente, gote: state.selectedPieceIdGote },
    state.selectedSource, lastMove);

  // 棋譜符号バー
  const kifuBarContent = getKifuBarContent(isKifuMode, kifuProgress, state.kifuData, state.moveHistory);
  renderKifuBar(document.getElementById('kifu-bar'), kifuBarContent, state.isKifuBarVisible);

  // 持ち駒（反転時は入れ替え）
  // 盤画像は要素の実測サイズを使う（.board-wrapはcontainで可変のため、
  // 固定値をフォールバックにすると実際の駒サイズとズレる）。画像がまだ無い初回のみ
  // app-frame幅の目安値（正方形仮置き）を使う。描画完了後のrenderAllで実測に置き換わる。
  const boardImageEl = document.querySelector('.board-image');
  const fallbackBoardSize = { width: 320, height: 350 };
  const actualBoardSize = boardImageEl
    ? { width: boardImageEl.clientWidth, height: boardImageEl.clientHeight }
    : fallbackBoardSize;
  const squareSize = getSquareSizePx(actualBoardSize, layouts.boardLayout);

  const topPieces = state.boardState.isFlipped ? state.boardState.handSente : state.boardState.handGote;
  const bottomPieces = state.boardState.isFlipped ? state.boardState.handGote : state.boardState.handSente;

  // 修正①（新規要望）: 持ち駒欄も「今その駒を保有している陣営」の駒セットを使う。
  // topPieces/bottomPiecesの由来（handSente/handGote）と同じ式で、どちらの陣営の
  // 駒セットIDを使うかを対応させる（画面上の位置=奥/手前ではなく、実際の所属で決める）。
  const topPieceId = state.boardState.isFlipped ? state.selectedPieceIdSente : state.selectedPieceIdGote;
  const bottomPieceId = state.boardState.isFlipped ? state.selectedPieceIdGote : state.selectedPieceIdSente;

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
    topPieceId, layouts.pieceLayout, layouts.pieceFit, manifestRef,
    'GOTE'); // 修正③: 画面奥は常に倒立（将棋ウォーズ準拠。isFlippedと無関係に固定）

  renderHandPieces(bottomPieces, 'LEFT', SELF_HAND_ORDER,
    document.getElementById('self-hand'), bottomSelected, squareSize,
    bottomPieceId, layouts.pieceLayout, layouts.pieceFit, manifestRef,
    'SENTE'); // 修正③: 画面手前は常に正立（将棋ウォーズ準拠。isFlippedと無関係に固定）

  // 対戦者名・段級位（反転時は入れ替え）
  const senteName = state.kifuData ? state.kifuData.header.senteName : '先手';
  const goteName = state.kifuData ? state.kifuData.header.goteName : '後手';
  const senteRank = state.kifuData ? state.kifuData.header.senteRank : null;
  const goteRank = state.kifuData ? state.kifuData.header.goteRank : null;

  const opponentSide = state.boardState.isFlipped ? 'SENTE' : 'GOTE';
  const selfSide = state.boardState.isFlipped ? 'GOTE' : 'SENTE';
  renderPlayerInfoBox(
    document.getElementById('opponent-label'), document.getElementById('opponent-name'),
    opponentSide, opponentSide === 'SENTE' ? senteName : goteName, opponentSide === 'SENTE' ? senteRank : goteRank
  );
  renderPlayerInfoBox(
    document.getElementById('self-label'), document.getElementById('self-name'),
    selfSide, selfSide === 'SENTE' ? senteName : goteName, selfSide === 'SENTE' ? senteRank : goteRank
  );

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
    // contain設計ではapp-frame自体が等倍のためscale除算は不要。
    // rect基準の差分のみでboardOriginPx/squareSizePx（clientWidth基準）と一致する。
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

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

// 起動
init();

// PWA（開発中は無効。最終段階で有効化）
registerServiceWorker();
