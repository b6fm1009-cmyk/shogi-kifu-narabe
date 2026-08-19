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
  <h3>このサイトは何？</h3>
  <p>将棋の対局記録（棋譜）を、実際に自分の指で並べて覚えるための場所です。</p>
  <p>見るだけの棋譜再生アプリとは違い、<span class="info-popup-em">「自分の手を動かす」</span>ことで頭より先に体に入ります。</p>

  <h3>使い方</h3>
  <p class="info-popup-lead">まず自動再生で1周、流れをつかむ。<br>2周目からは自分の指で一手ずつ動かして、体に入れる。</p>

  <div class="info-popup-step">
    <div class="info-popup-step-num">①</div>
    <div class="info-popup-step-body">
      <p class="info-popup-step-title">自動再生</p>
      <p>次ボタンを押すだけ。駒は自動で動きます。</p>
    </div>
  </div>

  <div class="info-popup-step">
    <div class="info-popup-step-num">②</div>
    <div class="info-popup-step-body">
      <p class="info-popup-step-title">手動並べ</p>
      <p>盤上の駒を指でタップして動かします。正しく指せると、画面上部の符号が進みます。<br>指手を非表示にすると符号が消えるので、暗記の確認もできます。</p>
    </div>
  </div>

  <h3>はじめかた</h3>
  <ol class="info-popup-steps-list">
    <li><span class="info-popup-step-label">棋譜を用意する</span><br><span class="info-popup-note">対応形式は.kifのみです。ki2・CSA・SFENなどには対応していません。</span></li>
    <li><span class="info-popup-step-label">このトップ画面に戻る</span></li>
    <li><span class="info-popup-step-label">「棋譜貼付」を押す</span></li>
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
