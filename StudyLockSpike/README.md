This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# StudyLockSpike

React NativeからiOS Screen Time APIを呼び出し、FamilyActivityPickerで選択したアプリをManagedSettings/DeviceActivityで制限できるか検証するための最小アプリです。

Apple Developer Program加入後の実機テスト手順、Signing & Capabilities設定、現在のブロッカーは [docs/ScreenTimeSpikeTest.md](docs/ScreenTimeSpikeTest.md) にまとめています。

## 学習アプリUIのブラウザ開発

`学習アプリワークフロー` のUIマップを参考に、React Native本体UIをブラウザで確認できる開発用シェルを追加しています。左側のダッシュボードで画面・ロック状態・進捗・問題生成API設定を切り替え、右側のiPhoneプレビューで挙動を確認できます。

```sh
npm install
cp .env.example .env.local
npm run web
```

Windows PowerShellの場合は以下です。

```powershell
npm install
Copy-Item .env.example .env.local
npm run web
```

ブラウザで `http://localhost:5173/` を開きます。Windows共同開発者も同じ手順で確認できます。

問題生成APIは以下の環境変数または左ダッシュボードから設定します。Bearer tokenは `.env.local` にだけ置き、Gitには含めないでください。

```sh
VITE_GEN_STUDY_API_URL=https://gen-study-api.onrender.com/generate
VITE_GEN_STUDY_API_TOKEN=your_local_token
VITE_OCR_API_URL=
VITE_GRADING_API_URL=
```

現在のデフォルト生成リクエストは次の内容です。

```json
{
  "subject": "math",
  "level": "University of Tokyo",
  "topic": "Probability Recurrence Relations"
}
```

APIの応答は問題画面に反映されます。外部APIの生成には時間がかかる場合があります。

### TeX表示・撮影・AI採点の設計

- 生成問題の問題文、解答、解説、LaTeX/MMDは `GeneratedProblem` に正規化してから表示します。
- WebプレビューではKaTeXでTeXを整形表示します。ネイティブ側は読みやすいテキスト表示へフォールバックします。
- ブラウザではカメラ撮影、画像アップロード、手動入力を使って答案を作れます。
- 現在の採点は `GradingService` のローカルAIシミュレーターです。OCR/AI採点APIが決まったら、UIを触らずにサービス内部を差し替えます。
- 手描き数学OCRの検討メモは [docs/CCSDD-LearningWorkflow.md](docs/CCSDD-LearningWorkflow.md) にまとめています。

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
