/**
 * 棋譜読込（ファイル選択）（設計書 第6部）
 */
import { parseKifText } from './kif-parser.js';
import { loadKifu } from '../state/app-state.js';
import { showToast } from '../ui/toast.js';

/**
 * ファイルからKIFテキストを読み込む。
 * @param {File} file
 */
export async function importFromFile(file) {
  try {
    const text = await readKifFile(file);
    if (!text || !text.trim()) {
      showToast('不正な棋譜です。インポートに対応しているのはKIF (.kif / .kifu) のみです。');
      return;
    }
    const result = parseKifText(text);
    if (result.success) {
      loadKifu(result.data);
    } else {
      showToast(result.error);
    }
  } catch (e) {
    showToast('不正な棋譜です。インポートに対応しているのはKIF (.kif / .kifu) のみです。');
  }
}

/**
 * ファイルをバイト列として読み取り、エンコーディングを判定してデコードする。
 * @param {File} file
 * @returns {Promise<string>}
 */
async function readKifFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return decodeKifText(arrayBuffer);
}

/**
 * KIFテキストのエンコーディングを判定してデコードする。
 * @param {ArrayBuffer} arrayBuffer
 * @returns {string}
 */
export function decodeKifText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  // UTF-8 BOM (EF BB BF) チェック
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    const withoutBom = bytes.slice(3);
    return new TextDecoder('utf-8').decode(withoutBom);
  }

  // UTF-8として解釈できるか試行（fatal: trueで厳密に判定）
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    // UTF-8として解釈できない場合はShift_JISとしてデコード
    try {
      return new TextDecoder('shift_jis').decode(bytes);
    } catch (e2) {
      try {
        return new TextDecoder('shift-jis').decode(bytes);
      } catch (e3) {
        throw new Error('文字コードを判定できませんでした');
      }
    }
  }
}