# marriage-shiori

結婚の顔合わせ・食事会で渡す「しおり」を、家族紹介・写真・当日の案内とともに作成するWebアプリです。

## できること

- 16種類のしおりから選び、しおりごとに必要な入力項目とページ構成を切り替える
- 新郎新婦・両家の家族（兄弟姉妹、その配偶者、お子さんを含む）を人数制限なく登録する
- ふたりの写真に加え、思い出・会場・家族写真を複数アップロードする
- 保存済みのしおりを一覧から開く、新規作成する、削除する
- A4プレビューをブラウザの印刷画面からPDFとして保存する

写真は公開S3には置かれません。Cognitoでログインした本人だけが、期限付きURLで読み書きできます。

## 構成

| 役割 | AWSサービス |
| --- | --- |
| 静的サイト | S3 + CloudFront |
| 認証 | Amazon Cognito |
| API | API Gateway HTTP API + Lambda |
| しおりデータ | DynamoDB |
| 画像 | 非公開S3 + 期限付きURL |
| CI/CD | GitHub + CodePipeline + CodeBuild |
| IaC | Terraform |

## ローカル開発

Node.js 24以降を用意して、以下を実行します。

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

`.env.local` にはデプロイ済みのCognitoとAPIの値を設定します。`.env` はGitへ追加しません。

```powershell
npm run build
```

## インフラの更新

初回だけ、Terraformのbootstrapを実行してstateバケットとGitHub接続を作成します。その後は`infrastructure/dev`を適用します。

```powershell
terraform -chdir=infrastructure/bootstrap init
terraform -chdir=infrastructure/bootstrap apply
terraform -chdir=infrastructure/dev init
terraform -chdir=infrastructure/dev apply
```

通常のフロントエンド/Lambda更新は、`main`へpushするとCodePipelineがビルド、S3配置、CloudFront無効化まで実行します。

## PDF印刷

エディタ右上の「PDF出力」を押し、ブラウザ印刷画面で保存先を「PDFに保存」に選びます。背景グラフィックを有効にし、余白は「なし」を選ぶとプレビューに近い仕上がりになります。コンビニ印刷ではA4・両面・短辺とじを基本に、選んだしおりの見開きに合わせて確認してください。
