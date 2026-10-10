/**
 * ①ヘッダー操作ボタン（設計書 第5部）
 */
import { importFromClipboard } from '../kifu-io/clipboard-import.js';
import { importFromFile } from '../kifu-io/file-import.js';
import { getState, toggleKifuBarVisibility, jumpToKifuProgress, getKifuModeInfo, isAnyControlDisabled } from '../state/app-state.js';
import { openAssetDrawer, closeAssetDrawer } from './asset-drawer.js';
import { setButtonDisabled, isInteractionBlocked } from './button-state.js';

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
    if (isInteractionBlocked(pasteBtn, isAnyControlDisabled())) return;
    importFromClipboard();
  });

  // 棋譜読込
  const loadBtn = document.getElementById('btn-load');
  loadBtn.addEventListener('click', () => {
    if (isInteractionBlocked(loadBtn, isAnyControlDisabled())) return;
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      // 【不具合修正】iPadOSのFilesピッカーで.kif/.kifuがグレーアウトして
      // 選択できない不具合への対応。
      // 原因：iOS/iPadOSのFilesアプリの新しいピッカーは、accept属性に
      // 拡張子のみを指定した場合、その拡張子に対応するUTI
      // （Uniform Type Identifier）をOS側で解決できないと、
      // 該当ファイルをグレーアウトして選択不可にすることがある
      // （.kif/.kifuは独自拡張子でOSに未登録のため発生）。
      // .txtが選択できていたのは、text/plainという標準MIMEタイプに
      // 対応するUTI（public.plain-text）が解決できるため。
      // 対応：拡張子指定に加えてtext/plainを明示的に指定することで、
      // 「プレーンテキストとして開ける」とOS側に伝え、グレーアウトを回避する。
      // これによりiPhoneとiPadで同じ挙動になることを期待する。
      // （.kif/.kifu以外のテキストファイルも選べるようになるが、
      // 拡張子と中身のバリデーションはfile-import.js側で別途行っているため、
      // 実害はない）。
      fileInput.accept = '.kif,.kifu,text/plain';
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
    if (isInteractionBlocked(backBtn, isAnyControlDisabled())) return;
    const { kifuProgress } = getKifuModeInfo();
    jumpToKifuProgress(kifuProgress);
  });

  // 指手を非表示
  const toggleBarBtn = document.getElementById('btn-toggle-bar');
  toggleBarBtn.addEventListener('click', () => {
    if (isInteractionBlocked(toggleBarBtn, isAnyControlDisabled())) return;
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