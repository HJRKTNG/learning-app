# history.md

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
