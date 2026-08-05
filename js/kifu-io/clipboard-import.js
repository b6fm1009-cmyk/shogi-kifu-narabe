/**
 * 棋譜貼付（クリップボード読込）（設計書 第6部）
 */
import { parseKifText } from './kif-parser.js';
import { loadKifu } from '../state/app-state.js';
import { showToast } from '../ui/toast.js';

/**
 * クリップボードからKIFテキストを読み込む。
 */
export async function importFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) {
      showToast('クリップボードにテキストがありません');
      return;
    }
    const result = parseKifText(text);
    if (result.success) {
      loadKifu(result.data);
    } else {
      showToast(result.error);
    }
  } catch (e) {
    showToast('クリップボードを読み込めませんでした');
  }
}