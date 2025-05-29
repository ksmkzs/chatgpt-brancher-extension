# ChatGPT Brancher Extension

ChatGPTの会話履歴を**ツリー形式**で可視化し、**分岐した会話**を簡単に管理できるChrome拡張機能です。

![ChatGPT Brancher Demo](https://via.placeholder.com/800x400?text=ChatGPT+Brancher+Demo)

## 🌟 主な機能

### 📊 会話ツリー可視化
- ChatGPTの会話履歴をGitブランチのようなツリー形式で表示
- ユーザーメッセージ（青色）とアシスタントメッセージ（灰色）を区別
- 選択中のノードは色で識別（緑/赤）

### 🎯 分岐ナビゲーション
- ツリーノードをクリックして特定の会話分岐に移動
- 複数の回答がある場合の切り替えが簡単
- 会話の全体構造を一目で把握

### 🗺️ ミニマップ機能
- 大きなツリーの全体構造を俯瞰
- 現在の表示範囲をハイライト表示
- スムーズなナビゲーション体験

### 💬 メッセージプレビュー
- ノードにマウスオーバーでメッセージ内容をプレビュー
- 長い会話でも素早く内容を確認可能

## 🚀 インストール方法

### Chrome Web Storeから（推奨）
1. [Chrome Web Store](https://chrome.google.com/webstore) で「ChatGPT Brancher」を検索
2. 「Chromeに追加」をクリック
3. ChatGPTページを開くと自動的に動作開始

### 手動インストール（開発者向け）
1. このリポジトリをクローンまたはダウンロード
```bash
git clone https://github.com/yourusername/chatgpt-brancher-extension.git
```

2. Chromeで `chrome://extensions/` を開く
3. 「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. ダウンロードしたフォルダを選択

## 🎮 使い方

1. **ChatGPT**を開く
2. 右上に**会話ツリー**が自動表示される
3. **ノードをクリック**して会話分岐を移動
4. **マウスオーバー**でメッセージプレビューを表示
5. **ミニマップ**で大きなツリーをナビゲート

### ノードの色の意味
- 🔵 **青色**: ユーザーメッセージ
- ⚪ **灰色**: アシスタントメッセージ（複数回答をまとめたもの）
- 🔴 **赤色**: 現在選択中のノード
- 🟢 **緑色**: 選択中のユーザーメッセージ
- ⚫ **黒色**: ルートノード

## 🛠️ 技術仕様

- **対象サイト**: ChatGPT (chatgpt.com)
- **ブラウザ**: Chrome, Edge, その他Chromium系
- **必要権限**: アクティブタブ、ChatGPTドメインへのアクセス
- **使用技術**: D3.js, Vanilla JavaScript

## 📋 システム要件

- Google Chrome 88+ またはMicrosoft Edge 88+
- ChatGPTアカウント
- インターネット接続

## 🔧 開発者向け情報

### プロジェクト構造
```
chatgpt-brancher-extension/
├── manifest.json          # 拡張機能設定
├── content_script.js      # メインロジック
├── popup.html            # ポップアップUI
├── popup.js             # ポップアップロジック
├── icons/               # アイコンファイル
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── lib/
    └── d3.min.js        # D3.jsライブラリ
```

### ビルド方法
```bash
# アイコン生成
open create_icons.html

# 拡張機能パッケージ化（Chrome Developer Dashboard用）
zip -r chatgpt-brancher.zip . -x "*.git*" "*.DS_Store*" "create_icons.html" "generate_icons.js"
```

### 主要機能の実装
- **会話データ取得**: ChatGPT APIレスポンスをインターセプト
- **ツリー構築**: D3.jsのhierarchy機能を使用
- **状態管理**: LocalStorageで会話選択状態を永続化
- **UI描画**: SVGベースの動的レンダリング

## 🐛 既知の問題

- 非常に長い会話（100+メッセージ）でのパフォーマンス低下
- 一部のChatGPT UIアップデートでの互換性問題
- Canvas機能を利用したチャットでの動作不可
- ページスクロールの問題

## 🤝 コントリビューション

プルリクエストやIssue報告を歓迎します！

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトは[MIT License](LICENSE)の下で公開されています。

## 🙏 謝辞

- [D3.js](https://d3js.org/) - データ可視化ライブラリ
- [OpenAI](https://openai.com/) - ChatGPTプラットフォーム

## 📞 サポート

- 🐛 **バグ報告**: [GitHub Issues](https://github.com/ksmkzs/chatgpt-brancher-extension/issues)
- 💡 **機能リクエスト**: [GitHub Discussions](https://github.com/ksmkzs/chatgpt-brancher-extension/discussions)

---

⭐ このプロジェクトが役に立ったら、GitHub でスターをお願いします！
