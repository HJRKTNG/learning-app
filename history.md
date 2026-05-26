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

## 2026-05-26

- Apple Developer Program加入後にiPhone実機でScreen Time API連携を確認するための最短手順を `StudyLockSpike/docs/ScreenTimeSpikeTest.md` に追記。
- Bundle Identifier、App Groups、Family Controls capability、Provisioning Profile、Developer Mode、実機ビルドコマンドの確認ポイントを整理。
- READMEの実機テスト手順案内を、Apple Developer Program加入後の設定内容が分かる表現に更新。
- iPhone実機インストールに向け、4つのiOS targetにApple Development Team `63NW3234RU` を設定し、Bundle IdentifierとApp Group IDを実機署名用の値へ更新。
- `HJRのiPhone` 向けのCLIビルドを試行し、XcodeのApple Developerアカウント状態が未有効で `No Account for Team "63NW3234RU"` によりProvisioning Profile作成前に停止したことを記録。
