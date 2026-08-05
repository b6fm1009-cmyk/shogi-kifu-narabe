/**
 * 成り選択ポップアップ（設計書 第4部6節）
 */
import { PROMOTION_MAP } from '../models/board.js';
import { resolvePieceCell } from '../assets/asset-fit.js';
import { findPieceAsset } from '../assets/asset-manifest.js';
import { setNariPopupOpen } from '../state/app-state.js';

let overlayEl = null;

/**
 * 成り選択ポップアップを表示する。
 * @param {PieceType} pieceType - 成る前の駒種
 * @param {Side} side - 成る駒の所属
 * @param {(result: boolean|'CANCEL') => void} onResult
 */
export function showNariPopup(pieceType, side, onResult) {
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
  renderPieceIcon(promoteBtn, promotedType, side);
  promoteBtn.addEventListener('click', () => {
    closeNariPopup();
    onResult(true);
  });

  // 成らない側（右）
  const notPromoteBtn = document.createElement('button');
  notPromoteBtn.className = 'nari-popup-btn nari-popup-btn--not-promote';
  renderPieceIcon(notPromoteBtn, pieceType, side);
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
 */
function renderPieceIcon(btn, pieceType, side) {
  // 駒画像を読み込んでスプライトから切り出す
  // （簡易実装：asset-manifest のデフォルト駒セットを使用）
  fetch('./assets/layout/assets-manifest.json')
    .then(r => r.json())
    .then(manifest => {
      const pieceAsset = findPieceAsset(manifest, manifest.defaults.pieces);
      const pieceLayout = { grid: { cols: 8, rows: 4 } };
      loadJson('./assets/layout/piece-layout.json').then(layout => {
        const cell = resolvePieceCell(pieceType, side, false, null, layout);
        const cellWidth = pieceAsset.width / layout.grid.cols;
        const cellHeight = pieceAsset.height / layout.grid.rows;

        const img = document.createElement('img');
        img.src = pieceAsset.image;
        img.style.position = 'absolute';
        img.style.width = `${cellWidth}px`;
        img.style.height = `${cellHeight}px`;
        img.style.objectFit = 'none';
        img.style.objectPosition = `${-(cell.col * cellWidth)}px ${-(cell.row * cellHeight)}px`;
        btn.appendChild(img);
      });
    });
}

/**
 * JSONを読み込む簡易ヘルパー。
 */
function loadJson(url) {
  return fetch(url).then(r => r.json());
}