/**
 * ハンバーガーメニュー：盤・駒選択ドロワー（設計書 第4部10章）
 */
import { selectPieceAsset, selectBoardAsset, setAssetDrawerOpen, setPieceAssetLinked, getState } from '../state/app-state.js';
import { getPieceRenderRect, resolvePieceCell, getGridOverlayForCoverBox } from '../assets/asset-fit.js';
import { PROMOTION_MAP } from '../models/board.js';
import { loadSampleManifest, importSampleKifu } from '../kifu-io/sample-import.js';

let drawerEl = null;
let overlayEl = null;
let activeTab = 'PIECE';
let scrollPositions = { PIECE: 0, BOARD: 0, KIFU: 0 }; // タブごとのスクロール位置を個別に記憶する
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
let boardLayout = null;
let renderCallback = null;

/**
 * ドロワーの初期化。
 * @param {HTMLElement} containerEl - ドロワーコンテナ
 * @param {AssetManifest} assetManifest
 * @param {Object} layouts - { boardLayout, pieceLayout, pieceFit }
 * @param {() => void} onRender - 選択変更後の再描画コールバック
 */
export function initAssetDrawer(containerEl, assetManifest, layouts, onRender) {
  drawerEl = containerEl;
  manifest = assetManifest;
  pieceLayout = layouts.pieceLayout;
  pieceFit = layouts.pieceFit;
  boardLayout = layouts.boardLayout;
  renderCallback = onRender;

  // ドロワー構造を作成
  drawerEl.innerHTML = `
    <div class="asset-drawer-header">
      <div class="asset-drawer-tabs">
        <button class="asset-drawer-tab asset-drawer-tab--piece" data-tab="PIECE">駒</button>
        <button class="asset-drawer-tab asset-drawer-tab--board" data-tab="BOARD">盤</button>
        <button class="asset-drawer-tab asset-drawer-tab--kifu" data-tab="KIFU">棋譜</button>
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
 * 修正（新規要望）: 従来はopenAssetDrawer()のたびにactiveTabを'PIECE'、
 * activeSideを'SENTE'へ強制リセットしていたため、「後手用の駒を選ぶ→
 * 見た目確認のため閉じる→もう一度開く」だけで先手用タブに戻ってしまい、
 * 駒・盤・棋譜のいずれのタブを開いていても選び直しのたびに毎回先頭状態から
 * やり直す必要があった。activeTab/activeSideはモジュール内プライベート変数と
 * してこの関数の外に保持されているため、ここで代入しなければ「直前に閉じた
 * ときの状態」がそのまま残る。よって、初回オープン時の初期値（'PIECE'/'SENTE'）
 * を変数宣言側に残しつつ、ここでのリセットは行わない。
 */
export function openAssetDrawer() {
  setAssetDrawerOpen(true);
  updateTabs();
  // 表示するタブ・先手/後手の選択・スクロール位置のいずれも直前の状態を
  // 維持したまま再描画する。「駒/盤を選んで一旦閉じ、盤面で見た目を確認して
  // からまた開いて選び直す」という一連の往復操作を想定しており、その都度
  // 先頭状態に戻ると選び直しの度に毎回タブ切替・スクロールをやり直す手間が
  // 生まれるため。
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
 * 修正（新規要望）: 駒/盤を選択すると renderBody() でリスト全体を作り直す
 * （body.innerHTML = ''）ため、DOM要素が総入れ替えとなりブラウザが
 * スクロール位置を保持できず、常に一番上へ巻き戻ってしまう不具合があった。
 * 特に駒タブを縦積みレイアウトにしたことでリストが縦に長くなり、
 * 下の方の駒を選ぶたびに先頭へ戻される挙動が目立つようになった。
 *
 * ハンバーガーメニューは「駒や盤を選んで見た目を変え、都度いったん閉じて
 * 盤面で確認し、また開いて選び直す」という使い方が中心のため、
 * 駒/盤の選択操作はもちろん、タブの行き来（駒⇔盤⇔棋譜）や
 * 「先手用/後手用」「先後一括変更」の切り替え、ドロワーを閉じて
 * 開き直す操作でも、それぞれの一覧のスクロール位置を保ったままにする
 * （openAssetDrawer()が毎回「駒タブ」を表示する仕様はそのまま維持しつつ、
 * 駒タブ自体のスクロール位置は保持する）。
 * scrollPositionsにタブ単位で位置を記憶しておき、renderBody()の呼び出し時に
 * 「直前に表示していたタブ」（lastRenderedTab、モジュール内で自動追跡）の
 * 位置を保存してから、これから表示するタブの記憶位置を復元する。
 */
let lastRenderedTab = null;

function renderBody() {
  const body = drawerEl.querySelector('.asset-drawer-body');
  if (lastRenderedTab && lastRenderedTab in scrollPositions) {
    scrollPositions[lastRenderedTab] = body.scrollTop;
  }
  body.innerHTML = '';
  if (activeTab === 'PIECE') {
    renderPieceControlBar(body);
    renderPieceTab(body);
  } else if (activeTab === 'BOARD') {
    renderBoardTab(body);
  } else {
    renderKifuTab(body);
  }
  // 記憶していたスクロール位置を復元する。まだ記憶がない（0のまま）場合や、
  // 再構築後のコンテンツがそれより短い場合は、ブラウザ側で自動的に
  // 収まる範囲へ丸められる。
  body.scrollTop = scrollPositions[activeTab] || 0;
  lastRenderedTab = activeTab;
}

/**
 * 修正③（新規要望）: 駒タブ上部の固定コントロール領域を描画する。
 * 「先後一括変更」トグルと「先手用/後手用」セグメントを1つのsticky要素にまとめて
 * 描画することで、トグルの高さが変わってもセグメントのtop位置がズレる心配がない
 * （2つを別々のsticky要素にすると、片方の高さをもう片方のtop値に決め打ちする必要が
 * 出てしまい、CSS変更のたびにJS側の高さと同期が必要になってしまうため）。
 *
 * ON（デフォルト）: 駒セットを1つ選ぶと、先手用・後手用の両方に同じIDが反映される
 *   （一括変更。selectPieceAsset()参照）。トグルをONにした瞬間はまだ何も選び直して
 *   いないため、先手/後手の駒セットはそれぞれ直前の状態のまま変化しない。
 *   セグメントは表示しない（個別選択の意味がなくなるため。分けて見せるとOFF時の
 *   機能と誤解されるので一覧は1つだけ見せる）。
 * OFF: 従来通り「先手用」「後手用」セグメントで個別に選べる（修正①の挙動）。
 */
function renderPieceControlBar(body) {
  const bar = document.createElement('div');
  bar.className = 'asset-piece-control-bar';

  // 一括変更トグル（意匠変更：チェックボックス+テキストラベルから、
  // 「一括変更／個別変更」の2面をフリップ表示するトグルボタンに変更。
  // input[type=checkbox]自体は状態保持・アクセシビリティのため維持し、
  // 見た目はlabel内の.tgl-btnをCSSで3Dフリップさせる。）
  const toggleWrap = document.createElement('label');
  toggleWrap.className = 'asset-piece-link-toggle';
  toggleWrap.setAttribute('aria-label', '先後の駒を一括変更する');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = getState().isPieceAssetLinked;
  checkbox.addEventListener('change', () => {
    setPieceAssetLinked(checkbox.checked);
    // 一括ONに切り替えた時点では先手/後手いずれの駒セットも変更されない
    // （setPieceAssetLinked()参照）。ここでのactiveSide初期化は、OFF時に別れていた
    // 「先手用」「後手用」セグメントをONでは1つの一覧に戻す際、表示だけを
    // 先手基準に揃えるためのもの。
    activeSide = 'SENTE';
    renderBody();
    if (renderCallback) renderCallback();
  });
  toggleWrap.appendChild(checkbox);
  const tglBtn = document.createElement('span');
  tglBtn.className = 'tgl-btn';
  tglBtn.setAttribute('aria-hidden', 'true');
  toggleWrap.appendChild(tglBtn);
  bar.appendChild(toggleWrap);

  // 先手用/後手用セグメント（一括OFF時のみ）
  if (!getState().isPieceAssetLinked) {
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
    bar.appendChild(switchEl);
  }

  body.appendChild(bar);
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

    // 修正: サムネイルの切り出し計算はDOM実測サイズ（CSS変数 --asset-thumb-w/h の
    // 実際の反映結果）を使うため、body.appendChild(row) で実際にレイアウトツリーに
    // 接続した「後」に描画する。appendChild前に呼ぶとclientWidth/Heightが0になり、
    // 描画に失敗する（renderPieceThumb内でtry/catchはしているが、正しく描けない）。
    const thumbEls = thumbs.querySelectorAll('.asset-thumb');
    thumbCells.forEach((tc, i) => renderPieceThumb(thumbEls[i], piece, tc));
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
    // 修正: 「.asset-thumbのCSSサイズ=40x48px」を前提にしたJS側の固定値は廃止。
    // html { font-size: clamp(...) } により1remの実ピクセル値は画面サイズで変動する上、
    // 将来ドロワー自体を縮小表示する際にも .asset-thumb のCSS変数
    // (--asset-thumb-w/--asset-thumb-h) だけ変えればJS側は自動追従してほしいため、
    // 実際にDOMへ接続された後のthumbElのサイズをそのまま基準値として使う。
    // getBoundingClientRectは小数px（サブピクセル）まで取れるため、
    // 端数丸めによる隙間や重なりを避けたい場合はここでMath.round等を検討してよい。
    const rect = thumbEl.getBoundingClientRect();
    const squareSizePx = { width: rect.width, height: rect.height };

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
 * 棋譜タブを描画する（同梱サンプル棋譜の一覧）。
 * sample-manifest.json を非同期で読み込むため、まず「読み込み中」を出し、
 * 取得後に一覧を組み立てる。タップで importSampleKifu() を実行して盤面へ反映し、
 * ドロワーを閉じる。
 * スクロール領域は .asset-drawer-body なので、行は縦並びのまま流せる
 * （touch-action: pan-y は style.css の .asset-drawer-body で既に許可済み）。
 */
function renderKifuTab(body) {
  body.textContent = '読み込み中…';

  loadSampleManifest()
    .then((samples) => {
      // 読み込み中に別タブへ切り替わっていたら描画しない
      if (activeTab !== 'KIFU') return;
      body.textContent = '';

      if (!samples.length) {
        const empty = document.createElement('div');
        empty.className = 'asset-row asset-row--sample-empty';
        empty.textContent = 'サンプル棋譜がありません。';
        body.appendChild(empty);
        return;
      }

      for (const sample of samples) {
        const row = document.createElement('div');
        row.className = 'asset-row asset-row--sample';
        row.dataset.id = sample.id;

        const info = document.createElement('div');
        info.className = 'asset-sample-info';

        const title = document.createElement('div');
        title.className = 'asset-sample-title';
        title.textContent = `${sample.sente} 対 ${sample.gote}`;

        const meta = document.createElement('div');
        meta.className = 'asset-sample-meta';
        meta.textContent = sample.date + (sample.note ? `・${sample.note}` : '');

        info.appendChild(title);
        info.appendChild(meta);
        row.appendChild(info);

        row.addEventListener('click', async () => {
          row.classList.add('asset-row--loading');
          await importSampleKifu(sample);
          closeAssetDrawer();
        });

        body.appendChild(row);
      }
    })
    .catch(() => {
      if (activeTab !== 'KIFU') return;
      body.textContent = '';
      const err = document.createElement('div');
      err.className = 'asset-row asset-row--sample-empty';
      err.textContent = 'サンプル一覧を読み込めませんでした。';
      body.appendChild(err);
    });
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

    // gridOverlay.enabledな盤（画像自体に線が焼き込まれていないテクスチャ盤）だけ、
    // サムネイルにも格子線・星をSVGで重ね描画する。wood/polyvinyl_chloride/darkの
    // ように画像そのものに線が入っている盤はgridOverlayを持たないため、ここでは
    // 何もしない（=盤面本体と同じ「二重描画を避ける」規則をサムネイルにも適用する）。
    // thumbがDOMに接続された後（clientWidth/Heightが取得できる状態）でないと
    // 正しいboxサイズが取れないため、appendChild後にこの処理を行う。
    if (board.gridOverlay && board.gridOverlay.enabled) {
      renderBoardThumbGridOverlay(thumb, img, board.gridOverlay);
    }
  }
}

/**
 * 盤サムネイル（.asset-board-thumb、object-fit:coverで表示中のimg）に
 * 格子線・星をSVGで重ね描画する。
 *
 * サムネイルの<img>はCSSで object-fit:cover のため、盤画像本来の縦横比
 * （878:960相当）のまま拡大され、正方形の枠からはみ出た上下（または左右）が
 * クロップされて表示されている。asset-fit.js の getGridOverlayForCoverBox() が
 * そのクロップ位置を踏まえた線・星の座標をbox基準で返すため、ここではその結果を
 * そのままSVGの座標として使うだけでよい（board-view.js の renderGridOverlay() と
 * 見た目のトーン・線幅・色を完全に揃えている）。
 * @param {HTMLElement} thumbEl - .asset-board-thumb 要素（box）
 * @param {HTMLImageElement} imgEl
 * @param {{enabled: boolean, lineColor: 'white'|'black', showStars: boolean}} overlay
 */
function renderBoardThumbGridOverlay(thumbEl, imgEl, overlay) {
  const draw = () => {
    // 既に描画済みなら描き直さない（同じboardが再描画対象になることはないが、念のため）
    const existing = thumbEl.querySelector('.grid-overlay-layer');
    if (existing) existing.remove();

    const box = { width: thumbEl.clientWidth, height: thumbEl.clientHeight };
    if (!box.width || !box.height || !boardLayout) return;

    const { grid, stars, starsOrigin } = getGridOverlayForCoverBox(box, boardLayout);
    // 盤面本体（board-view.js renderGridOverlay）と同じ配色・線幅に揃える。
    const strokeColor = overlay.lineColor === 'white' ? '#d8d8d5' : '#272725';

    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('class', 'grid-overlay-layer');
    svg.setAttribute('width', String(box.width));
    svg.setAttribute('height', String(box.height));
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.pointerEvents = 'none';

    const linesGroup = document.createElementNS(svgNs, 'g');
    linesGroup.setAttribute('stroke', strokeColor);
    linesGroup.setAttribute('stroke-width', '1');
    linesGroup.setAttribute('shape-rendering', 'crispEdges');

    grid.vertical.forEach(x => {
      const line = document.createElementNS(svgNs, 'line');
      const px = grid.originX + x;
      line.setAttribute('x1', String(px));
      line.setAttribute('y1', String(grid.originY));
      line.setAttribute('x2', String(px));
      line.setAttribute('y2', String(grid.originY + grid.innerHeight));
      linesGroup.appendChild(line);
    });

    grid.horizontal.forEach(y => {
      const line = document.createElementNS(svgNs, 'line');
      const py = grid.originY + y;
      line.setAttribute('x1', String(grid.originX));
      line.setAttribute('y1', String(py));
      line.setAttribute('x2', String(grid.originX + grid.innerWidth));
      line.setAttribute('y2', String(py));
      linesGroup.appendChild(line);
    });

    svg.appendChild(linesGroup);

    if (overlay.showStars) {
      const starsGroup = document.createElementNS(svgNs, 'g');
      starsGroup.setAttribute('fill', strokeColor);
      starsGroup.setAttribute('opacity', '0.45');
      stars.forEach(pt => {
        const circle = document.createElementNS(svgNs, 'circle');
        circle.setAttribute('cx', String(starsOrigin.x + pt.x));
        circle.setAttribute('cy', String(starsOrigin.y + pt.y));
        circle.setAttribute('r', '1.2');
        starsGroup.appendChild(circle);
      });
      svg.appendChild(starsGroup);
    }

    thumbEl.style.position = 'relative';
    thumbEl.appendChild(svg);
  };

  if (imgEl.complete && imgEl.naturalWidth) {
    draw();
  } else {
    imgEl.addEventListener('load', draw);
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