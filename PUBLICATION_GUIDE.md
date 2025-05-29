# 拡張機能公開ガイド

## 📋 公開準備チェックリスト

### ✅ 完了済み
- [x] manifest.json の設定完了
- [x] アイコンファイル生成 (16, 32, 48, 128px)
- [x] README.md 作成
- [x] LICENSE ファイル作成
- [x] Chrome Web Store用説明文作成
- [x] .gitignore ファイル作成

### 🔄 要対応
- [ ] GitHub リポジトリ作成
- [ ] Chrome Web Store 開発者アカウント登録
- [ ] スクリーンショット撮影
- [ ] 拡張機能パッケージ化
- [ ] Chrome Web Store 申請

## 🐙 GitHub公開手順

### 1. GitHubリポジトリ作成
1. [GitHub](https://github.com) にログイン
2. 「New repository」をクリック
3. リポジトリ名: `chatgpt-brancher-extension`
4. 説明文: `Visualize ChatGPT conversations as interactive tree structures`
5. 「Public」を選択
6. 「Create repository」をクリック

### 2. ローカルリポジトリの初期化
```bash
# プロジェクトディレクトリに移動
cd /Users/ksmkzs1/Downloads/chatgpt-brancher-extension

# Gitリポジトリ初期化
git init

# ファイル追加
git add .

# 初回コミット
git commit -m "Initial commit: ChatGPT Brancher Extension"

# リモートリポジトリ追加（GitHubのURL）
git remote add origin https://github.com/yourusername/chatgpt-brancher-extension.git

# メインブランチにプッシュ
git branch -M main
git push -u origin main
```

### 3. GitHubリポジトリの設定
- **About**: 説明文とウェブサイトURL（Chrome Web StoreのURL）を追加
- **Topics**: `chatgpt`, `chrome-extension`, `javascript`, `d3js`, `visualization` を追加
- **README**: 自動的に表示される

## 🏪 Chrome Web Store公開手順

### 1. 開発者アカウント登録
1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) にアクセス
2. Googleアカウントでログイン
3. **$5の登録料**を支払い（一回限り）
4. 開発者情報を入力

### 2. 拡張機能パッケージ化
```bash
# 公開用ZIPファイル作成
zip -r chatgpt-brancher-v1.0.zip . -x "*.git*" "*.DS_Store*" "create_icons.html" "generate_icons.js" "store_description.md" "PUBLICATION_GUIDE.md"
```

### 3. スクリーンショット準備
必要なスクリーンショット（1280x800推奨）:
- [ ] メイン機能: ツリー表示画面
- [ ] ミニマップ機能
- [ ] メッセージプレビュー機能
- [ ] 会話選択状態

### 4. Chrome Web Store申請
1. Developer Dashboardで「New Item」をクリック
2. ZIPファイルをアップロード
3. 以下の情報を入力:

#### 基本情報
- **名前**: ChatGPT Brancher
- **説明**: `store_description.md`の内容を参考
- **カテゴリ**: 生産性向上
- **言語**: 日本語、英語

#### 画像素材
- **アイコン**: 128x128 (icons/icon128.png)
- **スクリーンショット**: 1280x800 × 4枚
- **プロモタイル**: 440x280 (オプション)

#### プライバシー設定
- **単一目的**: ChatGPTの会話可視化
- **権限の正当性**: ChatGPT サイトでの動作に必要
- **データ収集**: なし（ローカルストレージのみ使用）

### 5. 審査・公開
- 審査期間: 通常1-3営業日
- 問題がある場合は修正して再申請
- 承認後、自動的に公開

## 📊 公開後の管理

### 分析とフィードバック
- Chrome Web Store の分析データを確認
- ユーザーレビューへの対応
- GitHubでのIssue管理

### アップデート手順
1. コードを修正
2. manifest.json のバージョンを更新
3. 新しいZIPファイルを作成
4. Chrome Web Store で更新をアップロード
5. GitHubにコミット・プッシュ

### マーケティング
- README の改善
- ブログ記事の投稿
- SNSでの紹介
- 技術系コミュニティでの共有

## 💡 注意事項

### Chrome Web Store ポリシー
- **最小機能原則**: 説明した機能のみ実装
- **権限の最小化**: 必要最小限の権限のみ要求
- **プライバシー遵守**: ユーザーデータの適切な取り扱い
- **品質基準**: バグのない安定した動作

### GitHub Best Practices
- **定期的なコミット**: 機能追加ごとにコミット
- **Issue管理**: バグ報告や機能要求の管理
- **セキュリティ**: APIキーなどの機密情報は除外
- **ドキュメント**: README の最新化

## 🚀 次のステップ

1. **今すぐ実行**: GitHubリポジトリ作成
2. **開発者アカウント登録**: Chrome Web Store
3. **スクリーンショット撮影**: 機能デモ
4. **パッケージ化と申請**: 最終確認後
5. **プロモーション**: 公開後の宣伝活動

頑張って！あなたの拡張機能が多くの人に役立つことを願っています🎉
