# Twilio SMS/音声認証システム

TwilioとGoogle Cloud Functions、Firebase Hostingを使用したSMS・音声通話による認証システムです。

## デモ

https://sakuma-pandatest.web.app

## 機能

### バックエンド（Cloud Functions）
- SMS送信による認証コード送信
- 音声通話による認証コード読み上げ
- Firestoreでの認証コード管理（tw_verification_codesコレクション）
- 認証コードの検証
- 有効期限管理（5分）

### フロントエンド（Firebase Hosting）
- モダンなWebUI
- 電話番号入力とバリデーション
- SMS/音声通話の選択
- 認証コード入力と検証
- レスポンシブデザイン

## 必要な環境

- Node.js 20以上
- Google Cloud SDK
- Firebase CLI
- Twilioアカウント
- Firebase/Firestoreプロジェクト（課金有効化必須）

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/sa1210/twiliosample.git
cd twiliosample
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数ファイルの作成

`.env.yaml`ファイルをプロジェクトルートに作成してください：

```yaml
TWILIO_ACCOUNT_SID: "あなたのTwilio Account SID"
TWILIO_AUTH_TOKEN: "あなたのTwilio Auth Token"
TWILIO_PHONE_NUMBER: "+1234567890"  # あなたのTwilio電話番号
```

**重要**:
- サービスアカウントのJSONファイルは**不要**です（Cloud Functionsがデフォルト認証を使用）
- `.env.yaml`はGitにコミットされません（機密情報のため）

### 4. Google Cloud プロジェクトの設定

```bash
# Google Cloudにログイン
gcloud auth login

# プロジェクトを設定（あなたのプロジェクトIDに変更）
gcloud config set project YOUR_PROJECT_ID

# 必要なAPIを有効化
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable run.googleapis.com
```

### 5. Cloud Functionsのデプロイ

```bash
# 個別にデプロイする場合
gcloud functions deploy sendVerificationCode \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file .env.yaml \
  --region asia-northeast1 \
  --gen2

gcloud functions deploy verifyCode \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file .env.yaml \
  --region asia-northeast1 \
  --gen2
```

### 6. フロントエンドの設定変更

`public/index.html`を開き、先頭の設定セクションを自分のプロジェクトIDに変更してください：

```javascript
// ========================================
// 設定: 以下を自分のプロジェクトに合わせて変更してください
// ========================================
const PROJECT_ID = 'YOUR_PROJECT_ID';  // あなたのGoogle CloudプロジェクトID
const REGION = 'asia-northeast1';      // Cloud Functionsのリージョン
```

### 7. Firebase Hostingのデプロイ

```bash
# Firebase CLIにログイン
firebase login

# .firebasercのプロジェクトIDも更新（必要に応じて）
# { "projects": { "default": "YOUR_PROJECT_ID" } }

# Hostingをデプロイ
firebase deploy --only hosting
```

デプロイ後、表示されるURLでWebUIにアクセスできます。

## API 使用方法

### 1. 認証コード送信 (sendVerificationCode)

SMS送信の場合:

```bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/sendVerificationCode \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+819012345678",
    "method": "sms"
  }'
```

音声通話の場合:

```bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/sendVerificationCode \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+819012345678",
    "method": "voice"
  }'
```

レスポンス例:

```json
{
  "success": true,
  "message": "Verification code sent via sms",
  "twilioSid": "SM...",
  "expiresAt": "2024-01-01T12:05:00.000Z"
}
```

### 2. 認証コード検証 (verifyCode)

```bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/verifyCode \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+819012345678",
    "code": "123456"
  }'
```

レスポンス例:

```json
{
  "success": true,
  "message": "Verification successful",
  "phoneNumber": "+819012345678"
}
```

## エラーハンドリング

### sendVerificationCode

- `400`: パラメータ不足または無効なmethod
- `500`: Twilio送信エラーまたはFirestoreエラー

### verifyCode

- `400`: パラメータ不足、無効なコード、期限切れ、または既に使用済み
- `404`: 認証コードが見つからない
- `500`: Firestoreエラー

## Firestoreデータ構造

コレクション名: `tw_verification_codes`

ドキュメントID: 電話番号 (E.164形式)

フィールド:

```javascript
{
  code: "123456",              // 6桁の認証コード
  phoneNumber: "+819012345678", // 電話番号
  method: "sms",               // 送信方法: "sms" or "voice"
  expiresAt: Timestamp,        // 有効期限
  createdAt: Timestamp,        // 作成日時
  verified: false,             // 検証済みフラグ
  verifiedAt: Timestamp        // 検証日時（検証後のみ）
}
```

## ローカルテスト

Cloud Functions Frameworkを使用してローカルでテストできます:

```bash
# インストール
npm install -g @google-cloud/functions-framework

# ローカルで起動
export TWILIO_ACCOUNT_SID="AC..."
export TWILIO_AUTH_TOKEN="..."
export TWILIO_PHONE_NUMBER="+1..."

functions-framework --target=sendVerificationCode --port=8080
```

## クローン後に必要な設定

他の人がこのリポジトリをクローンした場合、以下の設定が必要です：

### 1. 作成が必要なファイル
- **`.env.yaml`** - Twilioの認証情報を記載（上記セットアップ参照）

### 2. 変更が必要なファイル
- **`public/index.html`** - PROJECT_IDを自分のプロジェクトIDに変更
- **`.firebaserc`** (オプション) - プロジェクトIDを自分のものに変更

### 3. 不要なファイル
- **サービスアカウントJSON** - Cloud Functionsはデフォルト認証を使用するため不要
- **id.txt** - 開発時のメモファイル（削除済み）

## セキュリティ注意事項

- 本番環境では `--allow-unauthenticated` を外して認証を追加してください
- レート制限の実装を検討してください（悪用防止）
- 環境変数ファイル（`.env.yaml`）は絶対にGitにコミットしないでください
- Twilio認証情報を安全に管理してください

## 料金について

### Cloud Functions & Firebase
- 無料枠: 月200万回の呼び出し、40万GB秒のコンピューティング
- テストで数回〜数十回叩く程度なら完全無料

### Twilio
- SMS送信: 約$0.0075/通（約1円/通）
- 音声通話: 約$0.013/分（約2円/分）
- **テスト10回程度なら10〜20円程度**

## トラブルシューティング

### Twilioからメッセージが届かない

- Twilioの電話番号が有効か確認
- Twilioアカウントの残高を確認
- 送信先の電話番号がE.164形式（+81...）であることを確認

### Cloud Functionsデプロイエラー

- Google Cloud Projectで課金が有効になっているか確認
- 必要なAPIが有効化されているか確認
- `.env.yaml`ファイルが正しく作成されているか確認

### Firestoreエラー

- Firestoreが有効になっているか確認
- Cloud FunctionsのサービスアカウントにFirestore権限があるか確認

## ライセンス

MIT
