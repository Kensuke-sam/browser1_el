# Browser El - クイックスタートガイド

## 🚀 5分で始める

### ステップ 1: Rustをインストール

```bash
# セットアップスクリプトを実行 (Rustを自動インストール)
./setup.sh
```

または手動でインストール:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### ステップ 2: 依存関係をインストール

```bash
# フロントエンド依存関係
cd frontend
npm install
cd ..
```

### ステップ 3: 起動!

```bash
cargo tauri dev
```

これで Browser El が起動します! 🎉

---

## 📁 プロジェクト構造

```
browser-el/
├── crates/           # Rustコード
│   ├── browser-el-core/    # タブ、スペース、ナビゲーション管理
│   ├── browser-el-storage/ # SQLite ブックマーク・履歴
│   ├── browser-el-ipc/     # Tauri コマンド (API)
│   └── browser-el-native/  # macOS/Windows/Linux 固有機能
├── src-tauri/       # Tauri アプリ本体
├── frontend/        # Web UI (HTML/CSS/TypeScript)
└── Cargo.toml      # Rustワークスペース設定
```

---

## 🔧 よく使うコマンド

```bash
# 開発モード (ホットリロード有効)
cargo tauri dev

# テスト実行
cargo test --workspace

# リリースビルド
cargo tauri build

# コードフォーマット
cargo fmt

# Lint
cargo clippy

# 依存関係チェック
cargo check --workspace
```

---

## 🎯 最初にやること

### 1. 新しいタブを作成

ブラウザ起動後:
- **新規タブボタン**をクリック
- または `Ctrl+T` (macOS: `Cmd+T`)

### 2. スペースを作成

サイドバー上部の **+** ボタンをクリック:
- 名前: 例) "プロジェクト"
- アイコン: 例) 🚀
- **追加**をクリック

### 3. イエローモードを試す

`Ctrl+Shift+Y` で試験モード (黄色背景) をトグル

### 4. ブックマークを追加

`Ctrl+D` で現在のページをブックマーク

---

## 🐛 トラブルシューティング

### エラー: "cargo: command not found"

```bash
# Rustが正しくインストールされているか確認
source $HOME/.cargo/env

# それでもダメなら再インストール
./setup.sh
```

### エラー: "tauri dev failed"

```bash
# クリーンビルド
cargo clean
cargo tauri dev
```

### フロントエンドが表示されない

```bash
cd frontend
npm install
npm run dev
```

---

## 📚 次に読むべきドキュメント

1. [README.md](./README.md) - 詳細なアーキテクチャとAPI
2. [移行計画](/.claude/plans/zany-jingling-lighthouse.md) - 12週間の実装ロードマップ
3. [Tauri公式ドキュメント](https://v2.tauri.app/)

---

## 💡 ヒント

- **デバッグ**: F12 または右クリック → "検証"
- **ログ確認**: `RUST_LOG=debug cargo tauri dev`
- **パフォーマンス**: リリースビルドは `cargo tauri build --release`

---

**質問がある場合は、[GitHub Issues](https://github.com/browser-el/browser-el/issues) へどうぞ!**
