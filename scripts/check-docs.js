/**
 * docs/ 再構成の整合性チェックスクリプト
 *
 * 実行方法：node scripts/check-docs.js
 *
 * 目的：
 *   docs/ のリンク・参照の「壊れ」（分割ミス・古い参照・破損した節サフィックスの持ち越し）を
 *   機械で検出し、手メンテの日付やツリー表記に頼らずに整合性を保つ。
 *
 * チェック内容：
 *   [エラー] A. 破損サフィックス  `.md<番号>節` / `.md章`（.mdに節・章が直接くっつく形）
 *   [エラー] B. 参照先の実在       markdownリンク（ファイル/ディレクトリ）と平文の `*.md` 参照
 *   [警告]   C. 節番号の実存       参照する `X.md N節` の番号が、対象文書の見出しに存在するか
 *
 * 終了コード：エラーが1件でもあれば 1（警告のみなら 0）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

const errors = [];
const warnings = [];

/** docs/ 配下の .md を再帰収集し、{abs, rel} の配列を返す */
function collectMd(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(collectMd(p));
    else if (e.name.endsWith('.md')) {
      files.push({
        abs: p,
        rel: path.relative(DOCS, p).split(path.sep).join('/'),
      });
    }
  }
  return files;
}

/** 対象ファイルの見出し番号集合（先頭の `\d+(\.\d+)*`）を収集する */
function headingNumbers(file) {
  const set = new Set();
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^#{1,4}\s+(\d+(?:\.\d+)*)/);
    if (m) set.add(m[1]);
  }
  return set;
}

const mdFiles = collectMd(DOCS);
const headingCache = new Map();
function getHeadings(rel) {
  const file = mdFiles.find((f) => f.rel === rel);
  if (!file) return null;
  if (!headingCache.has(file.abs)) {
    headingCache.set(file.abs, headingNumbers(file.abs));
  }
  return headingCache.get(file.abs);
}

// Check A + リンク/平文参照の走査
for (const f of mdFiles) {
  const lines = fs.readFileSync(f.abs, 'utf8').split(/\r?\n/);

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    const where = `${f.rel}:${ln}`;

    // --- A. 破損サフィックス ---
    const aMatch = line.match(/\.md\.?\d*\.?\d*[章節]/);
    if (aMatch) {
      errors.push(`${where}: 破損サフィックス(.md<番号>節/.md章) → "${aMatch[0]}" : ${line.trim().slice(0, 110)}`);
    }

    // --- B-1. markdown リンクの参照先実在チェック ---
    const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
    let lm;
    while ((lm = linkRe.exec(line)) !== null) {
      let target = lm[1].trim();
      // アンカー部を除去
      const clean = target.split('#')[0].trim();
      if (!clean) continue;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(clean)) continue; // 外部URL
      if (clean.startsWith('/')) continue; // ルート絶対パス（スキップ）
      const resolved = path.resolve(path.dirname(f.abs), clean);
      if (!fs.existsSync(resolved)) {
        errors.push(`${where}: リンク参照先が存在しません → "${target}"`);
      }
    }

    // --- B-2. 平文の *.md 参照先実在チェック + C. 節番号の実存 ---
    const plainRe = /([\w./-]+\.md)[ \u3000]+(\d+(?:\.\d+)*)?\s*([章節])?/g;
    // リンク記法の中と、自ファイル名そのものは対象外にするため、まず該当行のリンク部を一時除去
    const withoutLinks = line.replace(/\[[^\]]*\]\([^)]*\)/g, '');
    let pm;
    while ((pm = plainRe.exec(withoutLinks)) !== null) {
      const refFile = pm[1];
      if (refFile === f.rel || refFile === 'README.md') continue; // 自分自身・READMEは対象外
      // 平文参照は「docs/ ルート基準」で書かれる（例: modules/apply-move.md, domain-model.md）。
      // ただし `../` 付きの相対参照もあり得るため、現在ファイル基準もフォールバックとして試す。
      const candidates = [
        path.resolve(DOCS, refFile),
        path.resolve(path.dirname(f.abs), refFile),
      ];
      const targetAbs = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!targetAbs) {
        errors.push(`${where}: 平文参照先が存在しません → "${refFile}"`);
        continue;
      }
      // --- C. 節番号の実存（警告） ---
      const num = pm[2];
      const suffix = pm[3];
      if (num && suffix) {
        const targetRel = path.relative(DOCS, targetAbs).split(path.sep).join('/');
        const set = getHeadings(targetRel);
        if (set && !set.has(num)) {
          warnings.push(`${where}: 参照番号 ${num}${suffix} は ${refFile} の見出しに存在しません`);
        }
      }
    }
  });
}

// 出力
console.log('=== docs 整合性チェック ===');
console.log(`対象 .md ファイル: ${mdFiles.length}件`);
if (warnings.length) {
  console.log('\n[警告]（参照番号の誤りか見出しの改番の可能性）:');
  warnings.forEach((w) => console.log('  ' + w));
} else {
  console.log('\n[警告] なし');
}
if (errors.length) {
  console.log('\n[エラー]:');
  errors.forEach((e) => console.log('  ' + e));
  console.log(`\nエラー ${errors.length} 件。要修正。`);
  process.exit(1);
} else {
  console.log(`\nエラー 0 件。OK。`);
  process.exit(0);
}
