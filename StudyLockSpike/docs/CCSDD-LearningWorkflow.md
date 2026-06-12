# CCSDD 学習ワークフロー設計

## Context

- 生徒は紙に途中式を書き、スマホのカメラで答案を撮影する。
- 開発中はiPhoneへ毎回インストールせず、ブラウザ上のiPhoneプレビューで生成、表示、撮影、採点導線を確認する。
- 問題生成は `gen-study-api` を使う。生成結果には問題文、解答、解説、LaTeXが混在する可能性がある。
- Bearer tokenや将来のOCR/採点APIキーは `.env.local` または開発ダッシュボードから渡し、Gitには含めない。

## Contract

- 生成問題は `GeneratedProblem` に正規化し、UIはAPIレスポンスの揺れに直接依存しない。
- TeX/Markdown混在テキストは `MathContent` で表示し、WebではKaTeX、ネイティブでは読みやすいテキストフォールバックにする。
- 答案取得は `CapturedAnswer` として扱い、画像、ファイル名、手動入力、OCR結果を同じ形で採点へ渡す。
- 採点は `GradingService` の結果だけをUIに渡す。OCR/AIベンダーはサービス内部で差し替える。

## Scenario

1. ダッシュボードでAPI token、subject、level、topicを設定する。
2. 「APIで問題を生成」を押す。
3. 生成問題をTeX整形つきで表示する。
4. 生徒が答案を撮影、または画像をアップロードする。
5. OCR候補テキストがあれば採点へ渡し、なければ手動入力で補完する。
6. AI採点結果として正誤、信頼度、フィードバック、再挑戦方針を表示する。

## Design

### OCR候補

- Gemini 2.5 Flash: 今回の手書き素材検証で使う第一候補。画像を直接入力し、手書き答案の転記、LaTeX化、信頼度、読めない箇所をJSONで返す。APIキーをクライアントへ置かないため、まずNode検証スクリプトで一括評価する。
- Mathpix Convert/OCR API: 手書き数式、STEM文書、LaTeX/MathML出力に強い。紙の数学答案を読む第一候補。
- Apple Vision: iOSオンデバイスで画像内テキスト認識を行える。一般文字や補助OCRに向くが、複雑な数式は専用OCRで補完する。
- Google ML Kit Digital Ink: カメラ画像ではなく、画面上に書いたストロークを認識する方式。将来「アプリ内手書きキャンバス」を追加する場合に有効。
- Azure Document Intelligence Read: 手書き文字を含む文書OCRに使える。答案全体の段落・行抽出や管理画面側の一括処理候補。
- MyScript: 数式手書き入力からLaTeX/MathMLへ変換できるSDK候補。アプリ内手書き解答方式を採る場合に検討する。

### 推奨アーキテクチャ

1. Phase 1: Webブラウザでカメラ撮影/画像アップロード/手動入力を実装し、採点サービス境界を固定する。
2. Phase 2: Gemini 2.5 Flashで実素材を3段階OCRする。まずページ全体から問題ごとの範囲を検出し、`sharp` で余白つきクロップを作成する。次にクロップ画像ごとに詳細OCRし、最後にrawを保持したまま補正候補・記号ジャンプ・手書きミス候補をフラグ化する。必要ならMathpixなどのSTEM OCR APIと比較する。
3. Phase 3: OCR結果、正答、問題文、採点基準をAI採点APIへ渡し、JSON schemaで正誤・部分点・解説を返す。
4. Phase 4: iOS実機ではVisionで前処理と一般OCRを補助し、数式はSTEM OCRへフォールバックする。

## Development

- 今回はPhase 1として、Web上で実カメラ/アップロード/手動入力を動かし、生成問題とTeX表示に接続する。
- 手描き素材検証は `npm run ocr:handwriting -- --limit 1 --max-blocks 2 --output tmp/ocr-handwriting/segmented-sample.json` で少数ブロックから開始する。`GEMINI_API_KEY` または `GOOGLE_API_KEY` を `.env.local` に置くと、`gemini-2.5-flash` がレイアウト、クロップ別OCR、補正候補をJSON/Markdown/HTMLへ保存する。
- 採点はローカルの `gradeCapturedAnswer` で疑似AI判定を行う。外部AI採点へ移行してもUIは変更しない。
- 検証は `lint`、`tsc`、`jest`、`web:build`、Chromeヘッドレス表示確認で行う。

## References

- Apple Vision text recognition: https://developer.apple.com/documentation/vision/recognizing-text-in-images
- Gemini API image understanding: https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini API structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Google ML Kit Digital Ink Recognition: https://developers.google.com/ml-kit/vision/digital-ink-recognition
- Mathpix OCR API: https://docs.mathpix.com/
- Azure Document Intelligence Read OCR: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/read
- MyScript SDK: https://www.myscript.com/sdk/
