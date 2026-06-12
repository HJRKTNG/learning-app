# history.md

## 2026-06-12

- GitHubリモート `https://github.com/HJRKTNG/learning-app` を `origin` として登録し、`main` ブランチをpushして共同開発できるようにした。
- リポジトリ直下に `.gitignore` を追加し、`.DS_Store` を追跡対象から除外。
- UI設計資料 `学習アプリワークフロー/`（UIマップHTML、ワイヤーフロー、スクリーンショット）をリポジトリに追加し、共同開発者が参照できるようにした。

## 2026-05-23

- 作業開始時点で既存のReact Nativeプロジェクト、iosディレクトリ、package.json、Podfile、Xcode workspace/project、Gitリポジトリが存在しないことを確認。
- 新規プロジェクトとして `StudyLockSpike` を作成する前提で、履歴管理用の `history.md` を追加。
- React Nativeプロジェクト `StudyLockSpike` を新規作成し、iOSネイティブコードを含む構成を追加。
- iOS側に `FamilyControls`、`ManagedSettings`、`DeviceActivity`、`SwiftUI` を使う `ScreenTimeModule` と管理処理を実装。
- `DeviceActivityMonitorExtension`、`ShieldConfigurationExtension`、`ShieldActionExtension` を追加し、スケジュール開始・終了時の制限切り替えと最小ブロック画面文言を実装。
- React Native側に `ScreenTimeSpikeScreen` と `ScreenTimeModule` 型定義を追加し、権限確認、アプリ選択、即時ブロック、解除、スケジュール操作の検証UIを実装。
- 実機テスト手順を `StudyLockSpike/docs/ScreenTimeSpikeTest.md` に追加し、READMEから参照できるように更新。
- 日本語パス配下で `pod install` が失敗する問題に対応するため、React Native Coreをソース利用に切り替え、Hermes tarballを指定してPodsをインストール。
- `npx tsc --noEmit`、`npm run lint -- --max-warnings=0`、`xcodebuild -list`、iOSシミュレータ向け `xcodebuild` が成功したことを確認。実機でのScreen Time動作確認は未実施。

## 2026-05-26

- Apple Developer Program加入後にiPhone実機でScreen Time API連携を確認するための最短手順を `StudyLockSpike/docs/ScreenTimeSpikeTest.md` に追記。
- Bundle Identifier、App Groups、Family Controls capability、Provisioning Profile、Developer Mode、実機ビルドコマンドの確認ポイントを整理。
- READMEの実機テスト手順案内を、Apple Developer Program加入後の設定内容が分かる表現に更新。
- iPhone実機インストールに向け、4つのiOS targetにApple Development Team `63NW3234RU` を設定し、Bundle IdentifierとApp Group IDを実機署名用の値へ更新。
- `HJRのiPhone` 向けのCLIビルドを試行し、XcodeのApple Developerアカウント状態が未有効で `No Account for Team "63NW3234RU"` によりProvisioning Profile作成前に停止したことを記録。
- 既存Provisioning Profileと実機ビルド結果に合わせてApple Developer Teamを `JR3QAG9C64` に修正し、`HJRのiPhone` へのインストールと起動が成功したことを確認。

## 2026-06-08

- 外部の問題生成API `gen-study-api` (https://gen-study-api.onrender.com/generate) の動作確認を実施。`/health`・認証・ルーティングは正常だが、`/generate` の生成本体が極端に遅く（東大レベル確率漸化式で約526秒、高校二次方程式で約177秒）、短いタイムアウトでは無応答に見えることを確認。出力内容自体は数学的にも正確な良問だった。
- 生成された2問（確率漸化式／二次方程式）の問題・解答を、数式をMathJaxでレンダリングして整形したHTML/PDFとして `生成問題集/` フォルダに保存（`問題集_2026-06-08.html`、`問題集_2026-06-08.pdf`、A4・全4ページ）。LaTeXツール未導入のためChromeヘッドレス（`--headless=old --print-to-pdf`）でPDF化。

## 2026-06-11

- `StudyLockSpike` にReact Native Web/Viteの開発用ブラウザ環境を追加し、`npm run web` でiPhoneにインストールせずUI確認できる構成にした。
- `学習アプリワークフロー` のUIマップを参考に、ホーム、ロック通知、ミッション、問題、撮影、採点、結果、再挑戦、解除、設定のReact Native画面と、左側の調整ダッシュボードを実装。
- 問題生成API `https://gen-study-api.onrender.com/generate` を呼び出すクライアントを追加し、Bearer tokenは `.env.local` または開発ダッシュボードから入力する形にしてソースへ直書きしない運用にした。
- Windows共同開発者向けにブラウザ起動手順とAPI環境変数の設定方法を `StudyLockSpike/README.md` に追記。
- Windows PowerShellでも迷わず起動できるように、`.env.local` 作成手順を `Copy-Item` 付きで追記。
- `npx tsc --noEmit`、`npm run lint -- --max-warnings=0`、`npm test -- --runInBand`、`npm run web:build` が成功し、Chromeヘッドレスで `http://localhost:5173/` のWebプレビュー表示を確認。
- CCSDD（Context/Contract/Scenario/Design/Development）形式で、生成問題、TeX表示、答案撮影、OCR、AI採点の設計方針を `StudyLockSpike/docs/CCSDD-LearningWorkflow.md` に追加。
- 生成APIレスポンスの正規化を強化し、問題文・解答・解説・LaTeX/MMDを `GeneratedProblem` として扱うようにした。
- WebプレビューでKaTeXによるTeX整形表示を追加し、ネイティブ側は読みやすいテキスト表示へフォールバックする `MathContent` を実装。
- ブラウザで答案撮影、画像アップロード、手動入力ができる `CameraCapture` と、将来のOCR/AI採点APIへ差し替え可能な `GradingService` を追加。
- 問題画面、撮影画面、採点中画面、正解/不正解画面を生成問題・撮影答案・採点結果に接続し、単なる静的モックではなく一連の学習フローとして動くようにした。
- `?screen=problem` や `?screen=camera` で開発ブラウザの初期画面を直接指定できるようにし、ChromeヘッドレスでTeX問題画面と撮影画面を確認。
- TeX分割と採点サービス境界のJestテストを追加し、`lint`、`tsc`、`jest`、`web:build` が成功したことを確認。
