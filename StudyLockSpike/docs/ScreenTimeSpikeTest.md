# Screen Time Spike 実機テスト手順

## 現在の構成

- React Nativeプロジェクト名: `StudyLockSpike`
- Xcodeで開くファイル: `ios/StudyLockSpike.xcworkspace`
- iOS Deployment Target: `16.0`
- メインBundle Identifier: `com.hjrktng.studylockspike`
- DeviceActivityMonitor Extension: `com.hjrktng.studylockspike.DeviceActivityMonitorExtension`
- ShieldConfiguration Extension: `com.hjrktng.studylockspike.ShieldConfigurationExtension`
- ShieldAction Extension: `com.hjrktng.studylockspike.ShieldActionExtension`
- App Group ID: `group.com.hjrktng.studylockspike.screentime`
- 必要Capability: Family Controls、App Groups

## Apple Developer Program加入後の最短実機確認

このSpikeは、React Nativeから `FamilyControls`、`ManagedSettings`、`DeviceActivity` を呼び出す最小構成まで実装済みです。
Apple Developer Programに加入済みなら、まずは開発用Provisioning Profileで実機確認できます。
App Store配布や外部TestFlight配布では、Family Controlsの配布用entitlement承認が別途必要になる可能性があります。

1. `rtk open ios/StudyLockSpike.xcworkspace` でXcodeを開く。
2. iPhoneをUSB接続し、Xcode上部の実行先に実機を選ぶ。
3. Project Navigatorで `StudyLockSpike` projectを選び、以下4 targetを順番に開く。
   - `StudyLockSpike`
   - `DeviceActivityMonitorExtension`
   - `ShieldConfigurationExtension`
   - `ShieldActionExtension`
4. 各targetの Signing & Capabilities で同じApple Developer Teamを設定する。
5. Bundle Identifierを自分のTeamで登録できる一意な値に変える。
   - 例: `com.<yourname>.studylockspike`
   - ExtensionはメインIDにsuffixを付ける。
6. App Groupsを有効にし、4 targetすべてで同じApp Group IDを使う。
   - 例: `group.com.<yourname>.studylockspike.screentime`
   - App Group IDを変えた場合は、`ios/StudyLockSpike/ScreenTime/ScreenTimeShared.swift` の `appGroupID` も同じ値に変える。
7. Family Controls capabilityを4 targetすべてで有効にする。
8. XcodeのAutomatically manage signingでProvisioning Profileが作られることを確認する。
9. iPhone側でDeveloper Modeが必要な場合は、Settingsの案内に従って有効化して再起動する。
10. Metroを `rtk npm start` で起動してから、XcodeのRunで実機にインストールする。

コマンドでビルドだけ確認する場合は、TeamやBundle ID設定後に以下を使えます。

```sh
rtk xcrun xctrace list devices
rtk xcodebuild -workspace ios/StudyLockSpike.xcworkspace -scheme StudyLockSpike -configuration Debug -destination 'platform=iOS,name=<接続したiPhone名>' -allowProvisioningUpdates build
```

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
6. App Groupsで `group.com.hjrktng.studylockspike.screentime` を登録、または実際のApp Group IDへ変更する。
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
- Apple Developer Team `63NW3234RU` は設定済み。
- CLI実機ビルドは、Xcode側でApple Developerアカウントが有効なログイン状態として見えておらず、`No Account for Team "63NW3234RU"` で停止中。
- Family Controls entitlementのDeveloper Portal側状態は未確認。
- App Group IDは `group.com.hjrktng.studylockspike.screentime` に更新済み。Developer Portalで登録・Profile反映が必要。
- App Store配布用のFamily Controls entitlement申請は未対応。
- DeviceActivityMonitor Extensionの発火は実機・権限・Provisioning Profile依存のため未確認。
- シミュレーターではScreen Time APIの実動作確認はできない前提。

## よくある詰まりどころ

- `Provisioning profile ... doesn't include com.apple.developer.family-controls` が出る場合: そのtargetのIdentifier/Capability/ProfileにFamily Controlsが入っていません。メインアプリだけでなく3つのExtensionも確認します。
- `No Account for Team "63NW3234RU"` が出る場合: Xcode > Settings > AccountsでApple Developerアカウントへログインし直し、Teamが表示される状態にします。
- `container_create_or_lookup_app_group_path_by_app_group_identifier` 系のエラーが出る場合: App Group IDがDeveloper Portal、entitlements、`ScreenTimeShared.appGroupID` で一致していません。
- Pickerは出るがブロックされない場合: iPhone実機、Screen Time権限、App Group共有、選択済み状態、Extension targetの署名を順番に確認します。
- DeviceActivityMonitorが時間になっても発火しない場合: まず「今すぐブロック」でManagedSettings単体が効くか確認し、その後にスケジュールの開始/終了時刻を現在時刻の数分後に設定して試します。
