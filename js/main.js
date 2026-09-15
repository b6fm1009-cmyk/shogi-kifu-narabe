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

// .player-info の height: calc(var(--piece-h) + 0.625rem) と同じバッファ値
// （css/style.cssと必ず同じ値を保つ）。px換算はhtmlのfont-sizeに依存するため
// 固定pxではなくrem値をここに記録し、使用箇所でgetComputedStyle経由のpxに変換する。
const PLAYER_INFO_BUFFER_REM = 0.625;

/**
 * 盤サイズ・駒サイズ・player-info高さを、循環参照なしで一括して算出する。
 *
 * 修正（盤サイズ循環参照の根本対応）: 従来は
 *   squareSize(盤の実測サイズから算出)
 *     → --piece-h(CSS変数)
 *       → .player-infoの実高さ(calc(--piece-h + buffer))
 *         → .board-containerの残り高さ(flexで自動計算)
 *           → 盤の実測サイズ(.board-wrapのcontain計算)
 *             → squareSize …(振り出しに戻る)
 * という循環があり、整数丸め・その場再計算（前回までの対策）を重ねても、
 * 指し手のたびに.player-info/.kifu-barの内容が変わることで1px未満の端数の
 * 丸まり方が変化し、値が2つの整数の間を往復し続けるケースがあった
 * （先手/後手で交互に盤サイズが変わって見える、として報告された）。
 *
 * 根本対応として、.board-containerのclientHeightを一切参照せず、
 * 「#app-frameの高さ－固定要素(header/kifu-bar-row/bottom-controls)の高さ
 * ＝盤の高さ＋player-info高さ×2」という関係から、盤マス1個の高さ
 * (squareSize.height)を一次方程式として直接解く。
 * squareSize.height = S とおくと、
 *   availableH = appFrameH - fixedH - 2*(S + bufferPx)
 *   boardImageHeight = availableH （高さ律速の場合、盤はこの高さいっぱいになる）
 *   S = boardImageHeight * innerHeightRatio / 9
 * を連立させ、Sについて解く:
 *   S = (appFrameH - fixedH - 2*bufferPx) * innerHeightRatio / (9 + 2*innerHeightRatio)
 * .board-containerの実測値を経由しないため、循環そのものが構造的に存在しない。
 *
 * 幅方向は.player-infoの高さと無関係（横方向のflexに.player-infoは関与しない）
 * なので、.board-containerの実測clientWidthをそのまま使ってよい。
 * 幅律速（横に窮屈な画面）の場合は、この高さ方程式の結果ではなく、
 * 幅から決まる高さのほうが小さくなるはずなので、両方を計算して小さい方
 * （＝実際にcontainされる側）を採用する。
 *
 * @param {HTMLElement} appFrameEl
 * @param {HTMLElement} boardContainerEl
 * @param {Object} boardLayout - board-layout.json
 * @returns {{squareSize: {width:number,height:number}, boardWrapWidth:number, boardWrapHeight:number} | null}
 */
function computeLayoutSizes(appFrameEl, boardContainerEl, boardLayout) {
  if (!appFrameEl || !boardContainerEl) return null;

  const appFrameH = appFrameEl.clientHeight;
  if (!appFrameH) return null;

  const headerEl = document.querySelector('.header');
  const kifuBarRowEl = document.querySelector('.kifu-bar-row');
  const bottomControlsEl = document.querySelector('.bottom-controls');
  if (!headerEl || !kifuBarRowEl || !bottomControlsEl) return null;

  const fixedH = headerEl.offsetHeight + kifuBarRowEl.offsetHeight + bottomControlsEl.offsetHeight;

  // .player-info の height: calc(var(--piece-h) + 0.625rem) と同じバッファを
  // px換算する。remのpx換算はhtmlのfont-sizeに依存するため、固定16px決め打ちに
  // せずgetComputedStyleで実際の値を取る。
  const rootFontSizePx = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const bufferPx = PLAYER_INFO_BUFFER_REM * rootFontSizePx;

  // 修正（盤とplayer-infoのわずかな被り対応）: .board-containerには座標ラベル用の
  // padding（上下）があり、盤画像(.board-wrap)はそのpaddingを除いた内側にしか
  // 描画されない。従来の方程式はこのpaddingを考慮せず「availableHをまるごと
  // 盤画像の高さ」として計算していたため、実際に必要な高さ（盤画像＋paddingY）が
  // availableHよりpaddingY分だけ大きくなり、.board-wrapがpx直接指定で
  // .board-containerの実際の残り高さをわずかに超えてはみ出していた
  // （.player-info側に食い込んで見える不具合の原因）。
  // 方程式にpaddingYを組み込み、盤画像＋padding＋player-info×2が
  // ちょうどavailableHに収まるよう解き直す。
  const boardContainerCs = window.getComputedStyle(boardContainerEl);
  const paddingY = parseFloat(boardContainerCs.paddingTop) + parseFloat(boardContainerCs.paddingBottom);

  const innerHeightRatio = 1 - boardLayout.margin_ratio.top - boardLayout.margin_ratio.bottom;
  const innerWidthRatio = 1 - boardLayout.margin_ratio.left - boardLayout.margin_ratio.right;
  const rows = boardLayout.grid.rows;
  const cols = boardLayout.grid.cols;

  // 高さ律速の場合のsquareSize.height（方程式の解）。
  // appFrameH = fixedH + 2*(S+bufferPx) + boardImageHeight + paddingY
  //           = fixedH + 2*(S+bufferPx) + (S*rows/innerHeightRatio) + paddingY
  // について S を解く。
  const heightLimitedSquareH =
    (appFrameH - fixedH - paddingY - 2 * bufferPx) /
    (rows / innerHeightRatio + 2);

  // 幅律速の場合のsquareSize（.board-containerの実測幅を使う。横方向は
  // .player-infoと無関係なので循環が発生しない）。
  const paddingX = parseFloat(boardContainerCs.paddingLeft) + parseFloat(boardContainerCs.paddingRight);
  const containerWidth = boardContainerEl.clientWidth - paddingX;
  const imageRatio = boardLayout.image.reference_width / boardLayout.image.reference_height;
  const widthLimitedBoardHeight = containerWidth / imageRatio;
  const widthLimitedSquareH = (widthLimitedBoardHeight * innerHeightRatio) / rows;

  // 小さい方（＝より厳しい制約）を採用する。これはCSSのcontainと同じ考え方。
  const squareH = Math.min(heightLimitedSquareH, widthLimitedSquareH);
  const squareW = (squareH / innerHeightRatio) * innerWidthRatio; // 縦横比を保った対応する幅側squareSize（参考値）

  const boardImageHeight = (squareH * rows) / innerHeightRatio;
  const boardImageWidth = boardImageHeight * imageRatio;

  return {
    squareSize: { width: squareW, height: squareH },
    boardWrapWidth: boardImageWidth,
    boardWrapHeight: boardImageHeight
  };
}

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

// 直前に反映した --piece-h の値（px、整数）。振動防止用に保持する。
let lastPieceHeightPx = null;

/**
 * 画面全体を再描画する。
 */
function renderAll() {
  const state = getState();
  const { isKifuMode, kifuProgress } = getKifuModeInfo();

  const lastMove = state.moveHistory.length > 0
    ? state.moveHistory[state.moveHistory.length - 1]
    : null;

  // 修正（盤サイズ循環参照の根本対応）: 従来はrenderBoard()が.board-containerの
  // 実測clientHeightから盤サイズを決め、その盤サイズから--piece-hを計算する
  // 順序だった。--piece-hは.player-infoの高さを介して.board-containerの
  // 残り高さに影響するため、この順序では常に「1周遅れた.board-container高さ」
  // を基準に盤サイズを計算することになり、指し手のたびに.player-info/
  // .kifu-barの内容が変わって端数の丸まり方が変化すると、盤サイズが
  // 値の間を往復し続ける不具合があった（詳細はcomputeLayoutSizes()参照）。
  // 対策として、renderBoard()より前にcomputeLayoutSizes()で盤サイズ・
  // squareSize・player-info高さを.board-containerの実測値を経由せずに
  // 一括算出し、--piece-hと.board-wrapのサイズを確定させてから
  // renderBoard()を呼ぶ順序に変更する。
  const appFrameEl = document.getElementById('app-frame');
  const boardContainerEl = document.getElementById('board');
  const layoutSizes = computeLayoutSizes(appFrameEl, boardContainerEl, layouts.boardLayout);

  // 修正: squareSizeは.player-info高さ計算だけでなく、この後のrenderHandPieces
  // （持ち駒の実描画サイズ）でも使うため、関数スコープで保持する。
  // layoutSizesがまだ無い（#app-frameがレイアウト前でclientHeightが0等）回は
  // nullのままにし、renderHandPieces等の呼び出し自体を後段でスキップする。
  let squareSize = null;

  if (layoutSizes) {
    squareSize = layoutSizes.squareSize;

    // 修正（player-info高さ根本対応）: 駒台(.player-info)の高さをCSSのcqw近似
    // （コンテナ幅からの推測）で決めていたが、盤が横幅ではなく縦（高さ）で頭打ちに
    // なる画面（例: iPad Pro縦）では、実際の盤サイズより過大な値になり、駒台が
    // 分厚くなりすぎて盤を圧迫していた。cqwによる近似をやめ、computeLayoutSizes()
    // が方程式で求めたsquareSize.height（駒1個の実ピクセル高さ）をCSS変数として
    // 公開し、.player-info側はこの値から高さを直接計算する（style.css参照）。
    //
    // 修正（1手ごとの盤サイズ微振動対策）: 端数のままだとサブピクセル単位の
    // 差が指し手ごとに生じうるため、整数pxに丸め、かつ前回値と同じであれば
    // style.setPropertyそのものを呼ばない（不要な再レイアウトの発生源を断つ）。
    const pieceHeightPx = Math.round(squareSize.height);
    if (pieceHeightPx !== lastPieceHeightPx) {
      lastPieceHeightPx = pieceHeightPx;
      document.documentElement.style.setProperty('--piece-h', `${pieceHeightPx}px`);
    }
  }

  // 盤面
  // 修正①（新規要望）: 先手用・後手用の駒セットを別々に渡す
  // 修正②（新規要望）: 直前に指した駒が視覚的にわかるよう、moveHistoryの最後の手を渡す。
  // 手番の制約自体（8.6節）は撤廃されたままであり、これはあくまで表示上のヒント
  // （「この駒を動かしたなら逆側の手番」）であって入力を制限するものではない。
  // 修正（盤サイズ循環参照の根本対応）: layoutSizesのboard-wrapサイズを
  // renderBoard()に直接渡す。renderBoard内部でboardWrapEl生成/使い回しの
  // 直後・駒配置の前に、このサイズを適用する（board-view.js側コメント参照）。
  // これにより.board-containerの実測clientHeightを一切経由せずに盤サイズが
  // 確定し、循環が構造的に発生しない。
  renderBoard(state.boardState, state.selectedBoardId,
    { sente: state.selectedPieceIdSente, gote: state.selectedPieceIdGote },
    state.selectedSource, lastMove,
    layoutSizes ? { width: layoutSizes.boardWrapWidth, height: layoutSizes.boardWrapHeight } : null);

  // 棋譜符号バー
  const kifuBarContent = getKifuBarContent(isKifuMode, kifuProgress, state.kifuData, state.moveHistory);
  renderKifuBar(document.getElementById('kifu-bar'), kifuBarContent, state.isKifuBarVisible);

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

  // 修正（初回描画でplayer-infoが盤に被る不具合の根本対応・続き）: 画像ロード前で
  // squareSizeがまだ計算できていない回は、駒サイズが不明な持ち駒欄の描画も
  // スキップする。画像ロード完了後にrenderBoard()のimageLoadCallback経由で
  // renderAll()が再度呼ばれ、そこで正しいsquareSizeを使って描画される。
  if (squareSize) {
    renderHandPieces(topPieces, 'RIGHT', OPPONENT_HAND_ORDER,
      document.getElementById('opponent-hand'), topSelected, squareSize,
      topPieceId, layouts.pieceLayout, layouts.pieceFit, manifestRef,
      'GOTE'); // 修正③: 画面奥は常に倒立（将棋ウォーズ準拠。isFlippedと無関係に固定）

    renderHandPieces(bottomPieces, 'LEFT', SELF_HAND_ORDER,
      document.getElementById('self-hand'), bottomSelected, squareSize,
      bottomPieceId, layouts.pieceLayout, layouts.pieceFit, manifestRef,
      'SENTE'); // 修正③: 画面手前は常に正立（将棋ウォーズ準拠。isFlippedと無関係に固定）
  }

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
