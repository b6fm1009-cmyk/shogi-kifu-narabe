/**
 * 棋譜貼付（クリップボード読込）（設計書 第6部）
 */
import { parseKifText } from './kif-parser.js';
import { loadKifu } from '../state/app-state.js';
import { showToast } from '../ui/toast.js';
import { hideInfoButton } from '../ui/info-popup.js';

/**
 * クリップボードからKIFテキストを読み込む。
 *
 * 【不具合修正 2026-08-11】iPhone SafariでFilesアプリ等から.kifファイル自体を
 * （テキストとしてではなく）「コピー」した場合、クリップボードにはファイルが
 * 格納される。WebKitのAsync Clipboard APIは text/plain・text/html・
 * text/uri-list・image/png の4種類のMIME表現しかサポートしておらず、
 * ファイルコピー時は主に text/uri-list や image/png 等で表現され、
 * text/plain 表現を持たない。そのため navigator.clipboard.readText() は
 * 環境によって空文字列を返す、または例外を投げる（挙動はブラウザ・iOS
 * バージョンに依存）。空文字列が返った場合は旧実装では「クリップボードに
 * テキストがありません」に分岐するはずだが、実機報告では「不正な棋譜です」
 * エラーになっていた。これは image/png や text/uri-list 等、空でない
 * 別形式の文字列表現（例：ファイルのURIやプレースホルダ文字列）が
 * readText() 経由で断片的に返り、それがそのまま parseKifText() に渡って
 * パース失敗扱いになっていたためと考えられる（parseKifText 自体は
 * kif-parser.js のtry/catchで例外を全て「不正な棋譜」に丸めるため、
 * 原因がクリップボード側かパース対象の中身かがエラーメッセージからは
 * 区別できなかった）。
 *
 * 対策：navigator.clipboard.read() でクリップボードアイテムのMIME型一覧を
 * 事前に調べ、text/plain 表現が無い場合は「ファイルはこの方法では読み込めない」
 * ことが分かる専用メッセージを出す（誤って「棋譜の内容が不正」と誤解させない）。
 * text/plain がある場合は従来通り readText() で取得して解析する。
 * read() 自体が使えない/失敗する環境向けに readText() へのフォールバックも残す。
 */
export async function importFromClipboard() {
  let text;
  try {
    text = await readClipboardText();
  } catch (e) {
    if (e && e.code === 'FILE_ONLY') {
      showToast('クリップボードの中身がファイルのため読み込めません。「棋譜読込」からファイルを選んでください', 4000, {
        label: '棋譜読込を開く',
        onClick: () => document.getElementById('btn-load')?.click()
      });
    } else {
      showToast('クリップボードを読み込めませんでした。Safariの設定でこのサイトのクリップボード利用を許可してください');
    }
    return;
  }

  if (!text || !text.trim()) {
    showToast('クリップボードにテキストがありません');
    return;
  }
  const result = parseKifText(text);
  if (result.success) {
    loadKifu(result.data);
    hideInfoButton();
  } else {
    showToast(result.error);
  }
}

/**
 * クリップボードからテキストを取得する。
 * navigator.clipboard.read() が使える場合はMIME型を確認し、
 * text/plain 表現を持たない（＝ファイルのみがコピーされている）場合は
 * { code: 'FILE_ONLY' } を投げて呼び出し元に専用エラーを出させる。
 * read() が使えない環境（対応ブラウザが無い等）では readText() のみで代替する。
 * @returns {Promise<string>}
 */
async function readClipboardText() {
  if (navigator.clipboard.read) {
    const items = await navigator.clipboard.read();
    const hasPlainText = items.some(item => item.types.includes('text/plain'));
    if (!hasPlainText) {
      const err = new Error('クリップボードにテキスト表現がありません（ファイルのみ）');
      err.code = 'FILE_ONLY';
      throw err;
    }
    const textItem = items.find(item => item.types.includes('text/plain'));
    const blob = await textItem.getType('text/plain');
    return await blob.text();
  }
  // read() 非対応環境向けフォールバック
  return await navigator.clipboard.readText();
}