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
 * @param {'SENTE'|'GOTE'} facingSide - 駒の正立/倒立を決める向き（将棋ウォーズ準拠の仕様変更）。
 *   持ち駒の実際の所属（先手/後手）とは無関係に、画面上の表示位置だけで決まる：
 *   画面奥（③対戦相手側）は常に 'GOTE'（倒立）、画面手前（⑤自分側）は常に 'SENTE'（正立）を渡す。
 *   盤面反転（isFlipped）時も③④の表示位置自体が入れ替わるだけで、
 *   「画面奥は倒立・画面手前は正立」というこのルール自体は変化しない。
 */
export function renderHandPieces(pieces, alignment, order, containerEl, selectedPieceType, squareSizePx, selectedPieceId, pieceLayout, pieceFit, manifest, facingSide) {
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

    // 駒画像（board-view.js と同じ理由で、<img>のobject-fit:none + object-positionではなく
    // background-image + background-size + background-positionでスプライトを切り出す）
    let cell;
    try {
      cell = resolvePieceCell(pieceType, facingSide, false, null, pieceLayout);
    } catch (e) {
      console.error(`持ち駒の描画に失敗しました (pieceType=${pieceType}):`, e);
      containerEl.appendChild(item);
      continue;
    }
    const renderRect = getPieceRenderRect(squareSizePx, pieceImageSize, pieceLayout, pieceFit);

    const cols = pieceLayout.grid.cols;
    const rows = pieceLayout.grid.rows;
    const bgWidth = renderRect.width * cols;
    const bgHeight = renderRect.height * rows;
    const bgX = -(cell.col * renderRect.width);
    const bgY = -(cell.row * renderRect.height);

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
    item.appendChild(spriteEl);

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

// 修正③: 名前が固定幅ボックスに収まらない場合に段階的に縮小するフォントサイズ候補。
// 通常サイズ(14px)を基本としつつ、はみ出る場合のみ縮小する。将棋ウォーズのユーザー名は
// 半角15文字が上限、プロ棋士名でも全角5〜6文字程度（例：「三枚堂 達也」）が実用上の
// 上限帯であるため、通常はこの範囲で14px運用に収まる想定。極端に長い例外名への対処として
// フォントサイズ縮小を用意する（省略記号での切り捨てだと対局者名が判読不能になるため避ける）。
const PLAYER_NAME_FONT_SIZES = [14, 12, 10, 9];

/**
 * ③⑤対局者名ボックス（先手/後手ラベル＋段級位＋名前）を描画する単一関数。
 * @param {HTMLElement} labelEl - ラベル（「先手 六段」等）を表示する要素
 * @param {HTMLElement} nameEl - 名前を表示する要素
 * @param {'SENTE'|'GOTE'} side - このボックスに表示する対局者の陣営
 *   （画面上の位置＝奥/手前ではなく、実際にどちらの駒か。反転時の入れ替えは
 *   呼び出し元（main.js）が既存のisFlippedルールに従って解決済みの値を渡す）
 * @param {string} name - 表示する名前（デフォルト値「先手」「後手」は呼び出し元で解決済み）
 * @param {string|null} rank - 段級位。KIFヘッダーに存在しない場合はnull。
 */
export function renderPlayerInfoBox(labelEl, nameEl, side, name, rank) {
  const sideLabel = side === 'SENTE' ? '先手' : '後手';
  labelEl.textContent = rank ? `${sideLabel} ${rank}` : sideLabel;
  nameEl.textContent = name;

  // 修正③: 固定幅ボックスに収まるかを実測し、収まらなければフォントサイズを
  // 段階的に縮小する。まず基本サイズにリセットしてから測定する
  // （前回描画時に縮小された状態が残っていると正しく測定できないため）。
  nameEl.style.fontSize = '';
  for (const size of PLAYER_NAME_FONT_SIZES) {
    if (nameEl.scrollWidth <= nameEl.clientWidth) break;
    nameEl.style.fontSize = `${size}px`;
  }
}