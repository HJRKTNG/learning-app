# Screen Time Spike 実機テスト手順

## 現在の構成

- React Nativeプロジェクト名: `StudyLockSpike`
- Xcodeで開くファイル: `ios/StudyLockSpike.xcworkspace`
- iOS Deployment Target: `16.0`
- メインBundle Identifier: `com.studylockspike.app`
- DeviceActivityMonitor Extension: `com.studylockspike.app.DeviceActivityMonitorExtension`
- ShieldConfiguration Extension: `com.studylockspike.app.ShieldConfigurationExtension`
- ShieldAction Extension: `com.studylockspike.app.ShieldActionExtension`
- App Group仮ID: `group.com.studylockspike.screentime`
- 必要Capability: Family Controls、App Groups

## CocoaPods

通常の `pod install` は、プロジェクトパスに日本語が含まれるためReact Native 0.85のHermes podspec処理で失敗する場合があります。
この環境では `StudyLockSpike/ios` で以下を実行して成功しました。

```sh
rtk cp Pods/hermes-engine-artifacts/hermes-ios-250829098.0.10-debug.tar.gz /tmp/hermes-ios-250829098.0.10-debug.tar.gz
rtk env HERMES_ENGINE_TARBALL_PATH=/tmp/hermes-ios-250829098.0.10-debug.tar.gz pod install
```

`Podfile` ではReact Native Core/Dependenciesのprebuilt利用を無効化しています。

## Xcode側で確認・設定すること

1. `ios/StudyLockSpike.xcworkspace` をXcodeで開く。
2. iPhone実機を接続する。
3. メインアプリと3つのExtension targetのSigning & Capabilitiesを開く。
4. Apple Developer Teamを設定する。
5. Bundle Identifierを自分のDeveloper Teamで登録可能な値へ必要に応じて変更する。
6. App Groupsで `group.com.studylockspike.screentime` を登録、または実際のApp Group IDへ変更する。
7. Family Controls capabilityをメインアプリとExtension targetに追加する。
8. Provisioning ProfileにFamily Controls entitlementが含まれていることを確認する。
9. メインアプリとExtension targetのApp Groupが同じ値であることを確認する。
10. 実機向けにビルドする。

## アプリ操作テスト

1. アプリを起動する。
2. 現在の権限状態が表示されることを確認する。
3. 「スクリーンタイム連携を許可する」を押す。
4. iOSの権限ダイアログで許可する。
5. 「制限するアプリを選ぶ」を押す。
6. FamilyActivityPickerで制限対象アプリを選び、「完了」を押す。
7. 選択済み状態が「あり」になることを確認する。
8. 「今すぐブロック」を押す。
9. 選んだアプリを開いて、ブロック画面が出るか確認する。
10. 「ブロック解除」を押す。
11. 選んだアプリが開けるか確認する。
12. 開始時刻と終了時刻を入力する。
13. 「スケジュールブロック開始」を押す。
14. アプリを閉じる。
15. 指定開始時刻になったらブロックされるか確認する。
16. 指定終了時刻になったら解除されるか確認する。
17. 必要に応じて「スケジュール停止」を押す。

## 現在のブロッカー・注意点

- 実機確認は未実施。
- Apple Developer Teamは未設定。
- Family Controls entitlementのDeveloper Portal側承認は未確認。
- App Group IDは仮値のため、Developer Portalで登録するか実際の値へ変更が必要。
- App Store配布用のFamily Controls entitlement申請は未対応。
- DeviceActivityMonitor Extensionの発火は実機・権限・Provisioning Profile依存のため未確認。
- シミュレーターではScreen Time APIの実動作確認はできない前提。
