/**
 * 成り選択ポップアップ（設計書 第4部6節）
 */
import { PROMOTION_MAP } from '../models/board.js';
import { resolvePieceCell, getPieceRenderRect } from '../assets/asset-fit.js';
import { loadAssetManifest, findPieceAsset } from '../assets/asset-manifest.js';
import { setNariPopupOpen } from '../state/app-state.js';

let overlayEl = null;

// piece-layout.json / piece-fit.json はアプリ内で不変のため、
// asset-manifest.js の loadAssetManifest() 同様にモジュール内でキャッシュする。
let cachedPieceLayout = null;
let cachedPieceFit = null;

function loadPieceLayout() {
  if (cachedPieceLayout) return Promise.resolve(cachedPieceLayout);
  return fetch('./assets/layout/piece-layout.json')
    .then(r => r.json())
    .then(json => (cachedPieceLayout = json));
}

function loadPieceFit() {
  if (cachedPieceFit) return Promise.resolve(cachedPieceFit);
  return fetch('./assets/layout/piece-fit.json')
    .then(r => r.json())
    .then(json => (cachedPieceFit = json));
}

/**
 * 成り選択ポップアップを表示する。
 * @param {PieceType} pieceType - 成る前の駒種
 * @param {Side} side - 駒画像の正立/倒立を決める向き。修正④（将棋ウォーズ準拠）により、
 *   駒の実所属（先手/後手）ではなく、常に'SENTE'（正立）を渡す運用とする。
 *   呼び出し元はsource.side（実所属）をそのまま渡さないこと。
 * @param {string} pieceId - 修正③: 現在ユーザーが選択中の駒アセットID。
 *   ポップアップに表示する駒画像を、盤面に表示されている駒と一致させるために必要。
 *   修正①（新規要望）: 先手用・後手用に駒セットが分かれたため、呼び出し元
 *   （selection.js）は「今動かしている駒の実所属（source.side）」に対応する
 *   selectedPieceIdSente/selectedPieceIdGoteのいずれかを解決してから渡すこと。
 * @param {(result: boolean|'CANCEL') => void} onResult
 */
export function showNariPopup(pieceType, side, pieceId, onResult) {
  setNariPopupOpen(true);

  // 既存のポップアップを削除
  if (overlayEl) overlayEl.remove();

  overlayEl = document.createElement('div');
  overlayEl.className = 'nari-popup-overlay';

  const popup = document.createElement('div');
  popup.className = 'nari-popup';

  // 成る側（左）
  const promoteBtn = document.createElement('button');
  promoteBtn.className = 'nari-popup-btn nari-popup-btn--promote';
  const promotedType = PROMOTION_MAP[pieceType] || pieceType;
  renderPieceIcon(promoteBtn, promotedType, side, true, pieceId);
  promoteBtn.addEventListener('click', () => {
    closeNariPopup();
    onResult(true);
  });

  // 成らない側（右）
  const notPromoteBtn = document.createElement('button');
  notPromoteBtn.className = 'nari-popup-btn nari-popup-btn--not-promote';
  renderPieceIcon(notPromoteBtn, pieceType, side, false, pieceId);
  notPromoteBtn.addEventListener('click', () => {
    closeNariPopup();
    onResult(false);
  });

  popup.appendChild(promoteBtn);
  popup.appendChild(notPromoteBtn);
  overlayEl.appendChild(popup);

  // 背景タップでキャンセル
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) {
      closeNariPopup();
      onResult('CANCEL');
    }
  });

  document.body.appendChild(overlayEl);
}

/**
 * ポップアップを閉じる。
 */
function closeNariPopup() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  setNariPopupOpen(false);
}

/**
 * ポップアップ内に駒アイコンを描画する。
 *
 * board-view.js / player-info.js と同じく、駒画像はスプライトシートなので
 * 1コマを原寸のまま貼ると、駒本来の意図したサイズ（マスに収まるサイズ）を
 * 無視してボタン全体に間延び・拡大されてしまう。そのため getPieceRenderRect()
 * でボタンサイズ基準の表示矩形を計算してから background-size を決める。
 */
function renderPieceIcon(btn, pieceType, side, promoted, pieceId) {
  Promise.all([loadAssetManifest(), loadPieceLayout(), loadPieceFit()])
    .then(([manifest, pieceLayout, pieceFit]) => {
      // 修正③: 常にデフォルト駒(manifest.defaults.pieces)を参照していたため、
      // ユーザーが別の駒セットを選択していてもポップアップだけデフォルト駒のまま
      // だった。呼び出し元から渡された選択中のpieceIdを使う（未指定時のみ
      // フォールバックとしてデフォルトを使う）。
      const pieceAsset = findPieceAsset(manifest, pieceId || manifest.defaults.pieces);
      const cell = resolvePieceCell(pieceType, side, promoted, null, pieceLayout);

      // ボタンの内寸（＝駒を収める枠）をピクセルで取得
      const btnRect = btn.getBoundingClientRect();
      const squareSizePx = { width: btnRect.width, height: btnRect.height };

      const pieceImageSize = { width: pieceAsset.width, height: pieceAsset.height };
      const renderRect = getPieceRenderRect(squareSizePx, pieceImageSize, pieceLayout, pieceFit);

      const cols = pieceLayout.grid.cols;
      const rows = pieceLayout.grid.rows;

      // renderRect（1コマの表示サイズ）を基準に、スプライト画像全体の表示サイズを逆算する
      const bgWidth = renderRect.width * cols;
      const bgHeight = renderRect.height * rows;
      const bgX = -(cell.col * renderRect.width);
      const bgY = -(cell.row * renderRect.height);

      // board-view.js / player-info.js と同じ理由で、<img>のobject-fit:none +
      // object-positionではなく、background-imageでスプライトを切り出す
      // （<img>のobject-positionは切り出し位置の指定としては機能しない）。
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
      btn.appendChild(spriteEl);
    })
    .catch(e => console.error('成りポップアップの駒アイコン描画に失敗しました:', e));
}