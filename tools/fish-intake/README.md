# 魚種追加ツール（開発者用）

ゲーム本体とは別のサイト。スマホ・タブレットから魚種を選んで参考画像を送ると、この PC の `reference/fish/<和名>/` に保存される。

```
npm run fish-intake
```

起動時に表示される `?t=` 付きの URL を開く（Tailscale の URL ならスマホから外出先でも開ける）。

## 保存される形
- `reference/fish/<和名>/main.jpg` … メインの参考画像（モデルの輪郭・体色の基準）
- `reference/fish/<和名>/ref-*.jpg` … 他の角度などの補助画像
- `reference/fish/<和名>/memo.txt` … Claude への指示メモ
- `reference/fish/_custom.json` … リスト外から追加した魚種
- 以前の形式 `reference/fish/<和名>.png` もメイン画像として扱う
