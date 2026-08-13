/**
 * ①ヘッダー操作ボタン（設計書 第5部）
 */
import { importFromClipboard } from '../kifu-io/clipboard-import.js';
import { importFromFile } from '../kifu-io/file-import.js';
import { getState, toggleKifuBarVisibility, jumpToKifuProgress, getKifuModeInfo, isAnyControlDisabled } from '../state/app-state.js';
import { openAssetDrawer, closeAssetDrawer } from './asset-drawer.js';
import { setButtonDisabled, isButtonDisabled } from './button-state.js';

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
  const pasteBtn = document.getElementById('btn-paste');
  pasteBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(pasteBtn)) return;
    importFromClipboard();
  });

  // 棋譜読込
  const loadBtn = document.getElementById('btn-load');
  loadBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(loadBtn)) return;
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
  const backBtn = document.getElementById('btn-back-to-kifu');
  backBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(backBtn)) return;
    const { kifuProgress } = getKifuModeInfo();
    jumpToKifuProgress(kifuProgress);
  });

  // 指手を非表示
  const toggleBarBtn = document.getElementById('btn-toggle-bar');
  toggleBarBtn.addEventListener('click', () => {
    if (isAnyControlDisabled() || isButtonDisabled(toggleBarBtn)) return;
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
  setButtonDisabled(backBtn, disabled || isKifuMode);

  // 指手を非表示ボタンのラベル
  const toggleBtn = document.getElementById('btn-toggle-bar');
  toggleBtn.textContent = isKifuBarVisible ? '指手を非表示' : '指手を表示';
  setButtonDisabled(toggleBtn, disabled);

  // 棋譜貼付・読込
  setButtonDisabled(document.getElementById('btn-paste'), disabled);
  setButtonDisabled(document.getElementById('btn-load'), disabled);

  // ハンバーガーメニューは常に活性
  setButtonDisabled(document.getElementById('btn-hamburger'), false);
}