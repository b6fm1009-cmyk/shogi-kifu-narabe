/**
 * 同梱サンプル棋譜の読込（ハンバーガードロワー「棋譜」タブ用）
 *
 * 「棋譜読込」（js/ui/header-buttons.js）は iOS/OS 標準のファイル選択ダイアログを開くため、
 * アプリ内に同梱したサンプル棋譜はそのボタンから選ぶことができない（ファイルピッカーは
 * 端末上のファイルしか表示しない）。そのため同梱サンプルは専用のUI（ドロワーの「棋譜」タブ）
 * から、このモジュール経由で読み込む。
 *
 * 読込パイプライン自体は既存の inport 経路と共通化する（目的：パース処理の入口を集約）。
 *  - ファイル（assets/samples/*.kif）は Shift_JIS で保存しているため、fetch したバイト列を
 *    js/kifu-io/file-import.js の decodeKifText() でエンコーディング判定してデコードする。
 *    fetch().text() による UTF-8 前提のデコードでは Shift_JIS が文字化けするため、
 *    arrayBuffer 経由で必ず decodeKifText() に通す。
 *  - デコード後は既存の parseKifText() / loadKifu() にそのまま渡す（末尾改行判定も parseKifText
 *    内で実施済みで、ここで追加の加工は不要）。
 */
import { parseKifText } from './kif-parser.js';
import { decodeKifText } from './file-import.js';
import { loadKifu } from '../state/app-state.js';
import { showToast } from '../ui/toast.js';

/** sample-manifest.json の読込結果のキャッシュ（初回1回のみ fetch） */
let cachedSamples = null;

/**
 * サンプル一覧（sample-manifest.json）を読み込む。
 * @returns {Promise<SampleManifestEntry[]>}
 */
export async function loadSampleManifest() {
  if (cachedSamples) return cachedSamples;
  const response = await fetch('./assets/layout/sample-manifest.json');
  if (!response.ok) {
    throw new Error(`sample-manifest.json の読み込みに失敗しました (${response.status})`);
  }
  const data = await response.json();
  cachedSamples = Array.isArray(data.samples) ? data.samples : [];
  return cachedSamples;
}

/**
 * サンプル棋譜を読み込んで盤面へ反映する。
 * @param {SampleManifestEntry} sample - sample-manifest.json の要素
 * @returns {Promise<boolean>} 成功したら true
 */
export async function importSampleKifu(sample) {
  try {
    const response = await fetch(sample.file);
    if (!response.ok) {
      showToast(`サンプル棋譜を読み込めませんでした (${response.status})`);
      return false;
    }
    // Shift_JIS/UTF-8 を判定してデコード（fetch().text() は UTF-8 前提なので使わない）
    const arrayBuffer = await response.arrayBuffer();
    const text = decodeKifText(arrayBuffer);
    if (!text || !text.trim()) {
      showToast('不正な棋譜です。読み込めませんでした。');
      return false;
    }
    const result = parseKifText(text);
    if (!result.success) {
      showToast(result.error);
      return false;
    }
    loadKifu(result.data);
    return true;
  } catch (e) {
    showToast('サンプル棋譜を読み込めませんでした。');
    return false;
  }
}