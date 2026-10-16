# Shadowing Studio TED対応版

## GitHubへの更新
- `index.html` と `app.js` を既存リポジトリの同名ファイルに上書きする。
- `config.js` は**既存のものを変更しない**（OAuth Client IDを保持）。
- GitHub Pagesの公開処理が成功したらSafariで再読み込み。

## Google Driveへの教材登録
親フォルダ `教材ライブラリ_shadowing studio` の中に `TED Talks` フォルダを作る。
- `Lesson001.txt`：自分で用意した英文（権利に注意）
- `Lesson001.url`：下記の1行だけをプレーンテキストで保存
  `https://www.ted.com/talks/matt_cutts_try_something_new_for_30_days`

## 操作
1. Googleログイン→シリーズ `TED Talks` → Lesson 001。
2. TED公式プレイヤーで動画を手動再生。
3. AirPods接続、マイク準備→録音開始。
4. 録音停止後、**TEDの再生もプレイヤーで手動停止**。
5. 録音の再生・保存・共有。

## 注意
- 公式プレイヤーを画面に表示し、動画や音声を抽出・ダウンロードしない。
- iPhone Safariでは公式プレイヤーと録音の同時使用が保証されないため実機テストが必要。
- 埋め込みがTED側で制限された場合は「TED公式ページを開く」から視聴する。
- TED動画の再生速度・巻き戻しは公式プレイヤー側で操作。
- `Lesson001.url` はGoogle Driveにプレーンテキストとしてアップロード。拡張子 `.url` の扱いが特殊な場合は `Lesson001.url` という名前のファイルとしてアップロードする。
