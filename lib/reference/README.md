# json-kifu-format 参照用ソース・型定義

このディレクトリは**調査専用**。アプリの実行には使わない（実行時は引き続き `lib/json-kifu-format.min.js` を読み込む）。

## 出所

- パッケージ: [`json-kifu-format`](https://www.npmjs.com/package/json-kifu-format)
- バージョン: **1.3.1**（`lib/json-kifu-format.min.js` と完全に同一バージョン。取得元は `https://registry.npmjs.org/json-kifu-format/-/json-kifu-format-1.3.1.tgz` の `dist/` をそのままコピー）
- 中身は `bundle/json-kifu-format-1.3.1.min.js`（= プロジェクト同梱のmin.js）と実体一致を確認済み（webpackのモジュールID採番が違うだけ）

アプリ側のmin.jsを更新したら、このディレクトリも同じバージョンのtarballから取り直すこと。バージョンがズレると型定義とmin.jsの実装が食い違う。

## 構成

```
json-kifu-format.js          # 非圧縮ソース（コンパイル済み・可読）
json-kifu-format.js.LICENSE.txt
src/
  main.d.ts                  # エントリポイントの型（ここから辿るのが早い）
  jkfplayer.d.ts             # JKFPlayerクラスの型（parse/parseKIF/forward/backward等）
  Formats.d.ts                # IJSONKifuFormat, IMoveFormat 等のデータ構造の型
  normalizer.d.ts            # normalizeKIF/normalizeKI2/normalizeCSA等の型
  peg/parsers.d.ts           # parseKIF/parseKI2/parseCSAの型
  peg/ambient.d.ts
```

## 使い方の目安

1. まず `src/main.d.ts` を見て、`Normalizer` / `JKFPlayer` / `Parsers` / `Formats` / `Shogi` のどれを触るか当たりをつける。
2. 戻り値の形を知りたいときは `src/Formats.d.ts`（`IJSONKifuFormat`, `IMoveFormat` など）を見る。ここに型さえあれば、Node.js上で毎回実験して確認しなくても済むことが多い。
3. `JKFPlayer` のメソッド一覧（`parse`, `parseKIF`, `forward`, `backward`, `getState` 等）は `src/jkfplayer.d.ts` を参照。
4. それでも挙動が分からない場合は、`.claude/skills/e2e-testing/references/node-vm-library-testing.md` の手順でNode.js上で実際に動かして確認する（型だけでは分からない実行時の分岐がある）。
