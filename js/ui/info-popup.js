/**
 * 使い方インフォボタン／ポップアップ（②棋譜符号バー右端）
 *
 * 表示ルール：
 *  - ボタン自体は常に表示された状態でスタートする。
 *  - 「棋譜貼付」または「棋譜読込」が成功したタイミングでのみ非表示にする
 *    （hideInfoButton()を呼ぶのは js/kifu-io/clipboard-import.js と
 *    js/kifu-io/file-import.js の成功パスのみ）。
 *  - 同梱サンプル棋譜の再生（js/kifu-io/sample-import.js）は既存の loadKifu() を
 *    共有して使うが、そちらからは hideInfoButton() を呼ばないことで
 *    「サンプル再生では消えない」という要件を満たす。
 */

const INFO_HTML = `
  <p class="info-popup-lead">棋譜並べを、効率よく繰り返すための場所です。</p>
  <p>まず自動再生で1周、流れをつかむ。<br>2周目からは自分の指で一手ずつ動かして、体に入れる。</p>

  <h3>① 自動再生</h3>
  <p>再生ボタンを押すだけ。駒は自動で動きます。<br>→ 最初の1周、全体の流れを見るのに。</p>

  <h3>② 手動並べ</h3>
  <p>盤上の駒を指でタップして動かします。正しく指せると、画面上部の符号が進みます。<br>→ 2周目以降、繰り返し並べて覚えるのに。</p>

  <h3>はじめかた</h3>
  <ol>
    <li>棋譜を用意する（.kif形式のみ対応。ki2・CSA・SFENなどは非対応です）</li>
    <li>ここのトップ画面に戻る</li>
    <li>「棋譜貼付」を押す</li>
  </ol>

  <h3>棋譜（.kif）はどこで手に入る？</h3>
  <p>「（対局者名や大会名）kif」で検索すると、多くの場合見つかります。</p>
  <p class="info-popup-example">例：「藤井聡太 kif」「王将戦 kif」</p>
  <ul>
    <li>将棋の棋譜配信サイト（将棋DBなど）</li>
    <li>将棋ソフト・アプリの「棋譜を保存/コピー」機能</li>
    <li>自分で対局した棋譜を将棋ソフトから書き出したもの</li>
  </ul>
`;

/**
 * インフォボタン・ポップアップのイベント登録。
 */
export function initInfoPopup() {
  const infoBtn = document.getElementById('btn-info');
  const overlay = document.getElementById('info-popup-overlay');
  const closeBtn = document.getElementById('btn-info-close');
  const body = document.getElementById('info-popup-body');

  body.innerHTML = INFO_HTML;

  infoBtn.addEventListener('click', () => {
    overlay.classList.add('info-popup-overlay--visible');
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('info-popup-overlay--visible');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('info-popup-overlay--visible');
    }
  });
}

/**
 * インフォボタンを非表示にする。
 * 「棋譜貼付」または「棋譜読込」の成功時にのみ呼び出すこと
 * （サンプル棋譜の再生からは呼び出さない）。
 */
export function hideInfoButton() {
  const infoBtn = document.getElementById('btn-info');
  if (infoBtn) infoBtn.classList.add('info-btn--hidden');
  const overlay = document.getElementById('info-popup-overlay');
  if (overlay) overlay.classList.remove('info-popup-overlay--visible');
}
