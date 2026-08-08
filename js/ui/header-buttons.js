/**
 * ①ヘッダー操作ボタン（設計書 第5部）
 */
import { importFromClipboard } from '../kifu-io/clipboard-import.js';
import { importFromFile } from '../kifu-io/file-import.js';
import { getState, toggleKifuBarVisibility, jumpToKifuProgress, getKifuModeInfo, isAnyControlDisabled } from '../state/app-state.js';
import { openAssetDrawer, closeAssetDrawer } from './asset-drawer.js';

let fileInput = null;

/**
 * ヘッダーボタンのイベント登録。
 */
export function initHeaderButtons() {
  // ハンバーガーメニュー
  const hamburgerBtn = document.getElementById('btn-hamburger');
  hamburgerBtn.addEventListener('click', () => {
    const { isAssetDrawerOpen } = getState();
    if (isAssetDrawerOpen) {
      closeAssetDrawer();
    } else {
      openAssetDrawer();
    }
  });

  // 棋譜貼付
  document.getElementById('btn-paste').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    importFromClipboard();
  });

  // 棋譜読込
  document.getElementById('btn-load').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.kif,.kifu';
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) importFromFile(file);
        fileInput.value = '';
      });
    }
    fileInput.click();
  });

  // 分岐に戻る
  document.getElementById('btn-back-to-kifu').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    const { kifuProgress } = getKifuModeInfo();
    jumpToKifuProgress(kifuProgress);
  });

  // 指手を非表示
  document.getElementById('btn-toggle-bar').addEventListener('click', () => {
    if (isAnyControlDisabled()) return;
    toggleKifuBarVisibility();
  });
}

/**
 * ヘッダーボタンの表示状態を更新する。
 */
export function updateHeaderButtons() {
  const { isKifuBarVisible } = getState();
  const { isKifuMode } = getKifuModeInfo();

  const disabled = isAnyControlDisabled();

  // 分岐に戻るボタン
  const backBtn = document.getElementById('btn-back-to-kifu');
  backBtn.disabled = disabled || isKifuMode;

  // 指手を非表示ボタンのラベル
  const toggleBtn = document.getElementById('btn-toggle-bar');
  toggleBtn.textContent = isKifuBarVisible ? '指手を非表示' : '指手を表示';
  toggleBtn.disabled = disabled;

  // 棋譜貼付・読込
  document.getElementById('btn-paste').disabled = disabled;
  document.getElementById('btn-load').disabled = disabled;

  // ハンバーガーメニューは常に活性
  document.getElementById('btn-hamburger').disabled = false;
}