# Claude.ai 利用枠モニタ - Chrome 拡張機能 実装仕様書

> バージョン: 0.1.0(MVP)
> 想定実行エージェント: Claude Code または Antigravity
> 関連ドキュメント: `phase1-recon-claude.md`(API 仕様の根拠)、`AI_Dashboard_Specification`(全体設計書)

---

## 0. このドキュメントの使い方(エージェントへの指示)

このドキュメントは、ローカルのコーディングエージェント(Claude Code または Antigravity)へ渡すための **実装指示書** です。

### Claude Code に渡す場合

1. ターミナルで、プロジェクトを置きたい親ディレクトリに `cd`(例: `~/projects/`)
2. このファイル(`implementation-spec.md`)をその場所に配置
3. `claude` を起動してこのファイルを読ませる:
   ```
   このディレクトリの implementation-spec.md を読んで、その内容に従ってプロジェクトを実装してください。
   ```

### Antigravity に渡す場合

1. このファイルをワークスペースに追加
2. 「このスペックに従って Chrome 拡張機能を実装」と指示

### 実装後のヒトの作業

エージェントが実装完了したら、ヒト側で以下を実施:
1. Chrome の `chrome://extensions/` を開き「デベロッパー モード」を有効化
2. 「パッケージ化されていない拡張機能を読み込む」をクリックし、プロジェクトフォルダを選択
3. Claude.ai にログインした状態で、拡張機能アイコンをクリックして動作確認
4. 後日、アイコン画像を `icons/` フォルダに配置 + manifest 更新(後述)

---

## 1. プロジェクト概要

### 1.1 目的

Claude.ai サブスクリプション(MAX 5x / MAX 20x / Pro / Free)の利用枠を、Chrome ツールバーから 1 クリックで確認できるようにする。

### 1.2 提供する機能

- 5 時間枠の使用率(%)とリセットまでの時間を表示
- 週間枠の使用率(%)とリセットまでの時間を表示
- 現在のプラン名(MAX 5x など)を表示
- 未ログイン時はログインを促すガイドを表示
- エラー発生時は内容を表示し、再試行ボタンを提供

### 1.3 アーキテクチャ

- **Chrome 拡張機能 1 個で完結**(バックエンド・API キー・データベース なし)
- **Manifest V3**
- **認証**: Cookie 透過型 (`credentials: 'include'`)。拡張機能から `claude.ai` の API を呼ぶとき、ブラウザが自動的にログイン Cookie を付与する
- **データ永続化なし**: ポップアップを開くたびに最新値を fetch する単純な構造
- **トリガー**: ポップアップを開いた瞬間に fetch 実行

### 1.4 スコープ外(将来対応)

- ChatGPT / Gemini 対応
- バックグラウンド定期取得・通知
- 履歴蓄積・グラフ表示
- 詳細なモデル別利用枠(Sonnet 専用枠など)

---

## 2. プロジェクト構造

エージェントは以下の構造で実装してください。

```
claude-usage-monitor/        ← プロジェクトのルート
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
└── icons/                    ← 空でも OK(後日アイコン追加時に使用)
    └── .gitkeep              ← 空フォルダを git で追跡したい場合のみ
```

ディレクトリ名は `claude-usage-monitor` を提案しますが、変更しても構いません。

---

## 3. ファイル仕様

### 3.1 manifest.json

```json
{
  "manifest_version": 3,
  "name": "Claude Usage Monitor",
  "version": "0.1.0",
  "description": "Claude.ai サブスクリプションの利用枠を一目で確認",
  "action": {
    "default_popup": "popup.html",
    "default_title": "Claude Usage Monitor"
  },
  "host_permissions": [
    "https://claude.ai/*"
  ]
}
```

#### ポイント

- **`manifest_version: 3`** — 現行 Chrome 拡張機能の標準
- **`host_permissions`** — `https://claude.ai/*` を指定することで、拡張機能から `claude.ai` への fetch が Cookie 付きで実行可能になる
- **アイコンは現時点では指定しない** — `icons` キーと `action.default_icon` を意図的に省略。Chrome のデフォルトのパズルピース アイコンで動作する。後日アイコン画像を追加するときに、後述のスニペットを追加すること
- **permissions は指定しない** — `storage` や `tabs` などの追加権限は MVP では不要

### 3.2 popup.html

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Claude Usage</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="app">
    <div class="header">
      <h1 class="title">Claude Usage</h1>
      <span id="plan-tag" class="plan-tag"></span>
    </div>
    <div id="content" class="content"></div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

#### ポイント

- `id="plan-tag"` にプラン名(MAX 5x など)を JS から挿入
- `id="content"` にメインコンテンツ(利用枠 / エラー / ガイド)を JS から挿入
- インラインスクリプト・インライン on-handlers は **使わない**(Manifest V3 の CSP で禁止されているため)

### 3.3 popup.css

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  background: #fafafa;
  color: #1a1a1a;
}

.app {
  padding: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.plan-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  background: #d97757;
  color: white;
  border-radius: 10px;
  letter-spacing: 0.5px;
}

.plan-tag:empty {
  display: none;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading {
  text-align: center;
  padding: 32px 0;
  color: #888;
}

.quota-section {
  background: white;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
}

.quota-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}

.quota-label {
  font-weight: 500;
  color: #555;
}

.quota-value {
  font-size: 18px;
  font-weight: 600;
}

.quota-bar {
  height: 6px;
  background: #ececec;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.quota-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.bar-low { background: #4caf50; }
.bar-mid { background: #ff9800; }
.bar-high { background: #f44336; }
.bar-na { background: #ccc; }

.quota-reset {
  font-size: 12px;
  color: #888;
}

.message-block {
  text-align: center;
  padding: 24px 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
}

.message-block.error {
  background: #fef2f2;
  border-color: #fca5a5;
}

.message {
  font-size: 14px;
  margin-bottom: 8px;
}

.message-detail {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
  font-family: 'SF Mono', Monaco, monospace;
  word-break: break-all;
}

.action-link {
  display: inline-block;
  margin-top: 8px;
  padding: 6px 16px;
  background: #1a1a1a;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 13px;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.action-link:hover {
  background: #333;
}
```

#### ポイント

- ポップアップ幅は **320px** に固定(Chrome 拡張機能ポップアップとして標準的なサイズ)
- 利用率の色分け: **0-49% 緑 / 50-79% オレンジ / 80-100% 赤**(視認性重視)
- アクセントカラー `#d97757`(Anthropic ブランドに近い暖色)— 好みで変更可
- `--` で表示する箇所(`null` のとき)は灰色のバーで「データなし」を視覚化

### 3.4 popup.js

```javascript
// Claude.ai 利用枠取得・表示ロジック
// 認証は Cookie 透過型(credentials: 'include')

const API_BASE = 'https://claude.ai/api';

// プラン識別子 → 表示名
const PLAN_DISPLAY_NAMES = {
  'default_claude_max_20x': 'MAX 20x',
  'default_claude_max_5x': 'MAX 5x',
  'default_claude_pro': 'Pro',
  'default_claude_free': 'Free',
};

// ---- データ取得 ---------------------------------------------------------

async function fetchUsage() {
  try {
    // Step 1: 組織一覧を取得
    const orgsRes = await fetch(`${API_BASE}/organizations`, {
      credentials: 'include',
    });

    if (orgsRes.status === 401 || orgsRes.status === 403) {
      return { status: 'logged_out' };
    }
    if (!orgsRes.ok) {
      return {
        status: 'error',
        code: orgsRes.status,
        message: `組織情報の取得に失敗: HTTP ${orgsRes.status}`,
      };
    }

    const orgs = await orgsRes.json();

    // chat capability を持つ組織を選ぶ(API 専用組織を除外)
    const chatOrg = orgs.find(org => org.capabilities?.includes('chat'));
    if (!chatOrg) {
      return { status: 'no_chat_plan' };
    }

    // Step 2: その組織の利用量を取得
    const usageRes = await fetch(
      `${API_BASE}/organizations/${chatOrg.uuid}/usage`,
      { credentials: 'include' }
    );

    if (!usageRes.ok) {
      return {
        status: 'error',
        code: usageRes.status,
        message: `利用量情報の取得に失敗: HTTP ${usageRes.status}`,
      };
    }

    const usage = await usageRes.json();

    return {
      status: 'ok',
      planTier: chatOrg.rate_limit_tier,
      fiveHour: {
        utilization: usage.five_hour?.utilization ?? null,
        resetsAt: usage.five_hour?.resets_at ?? null,
      },
      sevenDay: {
        utilization: usage.seven_day?.utilization ?? null,
        resetsAt: usage.seven_day?.resets_at ?? null,
      },
    };
  } catch (err) {
    return {
      status: 'error',
      message: err?.message || '不明なエラー',
    };
  }
}

// ---- フォーマッタ -------------------------------------------------------

function formatPlan(tier) {
  return PLAN_DISPLAY_NAMES[tier] || tier || '不明';
}

function formatReset(isoString) {
  if (!isoString) return '--';
  const reset = new Date(isoString);
  if (isNaN(reset.getTime())) return '--';

  const now = new Date();
  const diffMs = reset - now;

  if (diffMs <= 0) return 'リセット済み';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 60) {
    return `${diffMinutes}分後`;
  }
  if (diffHours < 24) {
    const m = diffMinutes % 60;
    return m > 0 ? `${diffHours}時間${m}分後` : `${diffHours}時間後`;
  }
  // 24時間以上先 → 日付+時刻
  return reset.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getBarColorClass(percent) {
  if (percent == null) return 'bar-na';
  if (percent < 50) return 'bar-low';
  if (percent < 80) return 'bar-mid';
  return 'bar-high';
}

// HTML エスケープ(API レスポンス・エラーメッセージなどを innerHTML に埋めるとき用)
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- レンダリング ------------------------------------------------------

function renderQuotaSection(label, data) {
  const pct = data.utilization;
  const colorClass = getBarColorClass(pct);
  const displayPct = pct == null ? '--' : pct;
  const widthPct = pct ?? 0;
  return `
    <div class="quota-section">
      <div class="quota-header">
        <span class="quota-label">${escapeHtml(label)}</span>
        <span class="quota-value">${escapeHtml(displayPct)}%</span>
      </div>
      <div class="quota-bar">
        <div class="quota-fill ${colorClass}" style="width: ${widthPct}%"></div>
      </div>
      <div class="quota-reset">リセット: ${escapeHtml(formatReset(data.resetsAt))}</div>
    </div>
  `;
}

function renderLoading() {
  document.getElementById('plan-tag').textContent = '';
  document.getElementById('content').innerHTML = `
    <div class="loading">読み込み中...</div>
  `;
}

function render(state) {
  const planTag = document.getElementById('plan-tag');
  const content = document.getElementById('content');

  if (state.status === 'logged_out') {
    planTag.textContent = '';
    content.innerHTML = `
      <div class="message-block">
        <p class="message">Claude.ai にログインしてください</p>
        <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" class="action-link">Claude.ai を開く</a>
      </div>
    `;
    return;
  }

  if (state.status === 'no_chat_plan') {
    planTag.textContent = '';
    content.innerHTML = `
      <div class="message-block">
        <p class="message">Claude.ai のサブスクリプションが見つかりませんでした</p>
      </div>
    `;
    return;
  }

  if (state.status === 'error') {
    planTag.textContent = '';
    content.innerHTML = `
      <div class="message-block error">
        <p class="message">エラーが発生しました</p>
        <p class="message-detail">${escapeHtml(state.message)}</p>
        <button id="retry-btn" class="action-link">再試行</button>
      </div>
    `;
    document.getElementById('retry-btn').addEventListener('click', () => {
      renderLoading();
      fetchUsage().then(render);
    });
    return;
  }

  // status === 'ok'
  planTag.textContent = formatPlan(state.planTier);
  content.innerHTML = `
    ${renderQuotaSection('5時間枠', state.fiveHour)}
    ${renderQuotaSection('週間枠', state.sevenDay)}
  `;
}

// ---- エントリポイント --------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  renderLoading();
  fetchUsage().then(render);
});
```

#### 実装上のポイント

- **`credentials: 'include'`** を fetch オプションに必ず付ける(これが無いと Cookie が送られず 401 になる)
- **`?.`(optional chaining)と `?? null`(nullish coalescing)を多用** — recon ドキュメントの警告通り、API レスポンスは一部フィールドが `null` または不在になり得るため
- **エラーメッセージは `escapeHtml` で必ずエスケープ** — XSS 防止
- **インライン on-handlers を使わない** — `addEventListener` で代替(Manifest V3 の CSP 制約)

---

## 4. アイコンの追加(後日対応)

### 4.1 必要なファイル

| ファイル名 | サイズ | 用途 |
|---|---|---|
| `icons/icon16.png` | 16x16 | ツールバー / ファビコン |
| `icons/icon48.png` | 48x48 | 拡張機能管理ページ |
| `icons/icon128.png` | 128x128 | Chrome Web Store / インストール画面 |

### 4.2 manifest.json への追記

アイコン画像を配置したら、`manifest.json` を以下のように更新:

```json
{
  "manifest_version": 3,
  "name": "Claude Usage Monitor",
  "version": "0.1.0",
  "description": "Claude.ai サブスクリプションの利用枠を一目で確認",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "Claude Usage Monitor",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "host_permissions": [
    "https://claude.ai/*"
  ]
}
```

### 4.3 アイコン生成プロンプト案(Gemini 用)

Gemini で生成する際の参考プロンプト:

> ミニマルでモダンな Chrome 拡張機能アイコンを作成してください。テーマは「利用量・クォータの可視化」。デザイン要素: 円形のゲージメーター、または横向きの進捗バー、または "C" の文字 + パーセンテージ表示風モチーフ。配色: 暖色系(オレンジ/コーラル)を主にした 2-3 色構成。背景は透過(PNG)。シンプルで、16px に縮小しても識別可能なデザインに。サイズ: 128x128px。

サイズが大きいものを 1 枚生成して、ピクセルアートツールや画像縮小ツール(例: ImageMagick の `convert input.png -resize 16x16 icon16.png`)で 16 / 48 にダウンサンプルすると効率的。

---

## 5. Chrome への読み込み手順(ヒトの作業)

1. Chrome のアドレスバーに `chrome://extensions/` を入力して開く
2. 画面右上の「**デベロッパー モード**」トグルを ON
3. 左上に現れる「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. ファイル選択ダイアログで `claude-usage-monitor/` フォルダを指定
5. 拡張機能一覧に "Claude Usage Monitor" が追加される
6. Chrome ツールバー右上のジグソーパズル アイコンから、Claude Usage Monitor を「ピン留め」しておくと便利
7. Claude.ai に **ログインした状態** で、ツールバーのアイコンをクリックしてポップアップを表示

---

## 6. 動作確認チェックリスト

実装完了後、以下を確認:

- [ ] Chrome の拡張機能一覧に "Claude Usage Monitor" が表示される
- [ ] エラーメッセージ・警告がコンソールに出ていない(右クリック →「ポップアップを検証」で開発者ツールを起動)
- [ ] ログイン済みでポップアップを開くと、プラン名と 2 つの利用枠(5時間枠/週間枠)が表示される
- [ ] 使用率に応じてバーの色が変わる(緑 < 50% / オレンジ 50-79% / 赤 ≥ 80%)
- [ ] リセット時刻が「X 分後」「X 時間後」「日付+時刻」のいずれかで表示される
- [ ] Claude.ai からログアウトしてポップアップを開くと、ログインを促すガイドが表示される
- [ ] 「Claude.ai を開く」リンクをクリックすると新しいタブで Claude.ai が開く
- [ ] エラー時に「再試行」ボタンが機能する(ネットワークを一時的に切るなどして確認)

---

## 7. トラブルシューティング

| 症状 | 想定原因 | 対処 |
|---|---|---|
| ポップアップが「Claude.ai にログインしてください」と出続ける | Cookie が送られていない | `host_permissions` に `https://claude.ai/*` が含まれているか、fetch に `credentials: 'include'` があるか確認 |
| `default_popup is not a valid path` のエラー | `manifest.json` のパス指定ミス | `popup.html` がプロジェクトルートにあるか確認 |
| 何も表示されず空白のまま | popup.js のエラー | 「ポップアップを検証」で DevTools を開き、コンソールエラーを確認 |
| プラン名が `default_claude_max_5x` のような生の文字列で表示される | `PLAN_DISPLAY_NAMES` マップ未対応のプラン | マップにエントリを追加(recon ドキュメント参照) |

---

## 8. recon ドキュメントへの参照

API 仕様の詳細は `phase1-recon-claude.md` を参照:

- **API エンドポイント仕様** → recon 第 2 節
- **JSON フィールドと UI 表示の対応** → recon 第 3 節
- **認証メカニズム** → recon 第 5 節
- **プラン判別** → recon 第 6 節
- **想定リスク** → recon 第 8 節

---

## 9. 今回スコープ外・今後の TODO

MVP 完成後の発展案:

- [ ] アイコン画像を Gemini で生成して配置
- [ ] バックグラウンドの定期取得(`chrome.alarms` API 使用)
- [ ] 使用率が閾値を超えた際の通知(`chrome.notifications` API)
- [ ] モデル別利用枠(Sonnet 専用枠、Claude Design 枠など)の詳細表示
- [ ] ChatGPT 対応(プラン名のみ・recon 結果に基づき縮退実装)
- [ ] Gemini 対応(recon 継続が必要)
- [ ] 設定画面(更新間隔、表示項目の取捨選択)
- [ ] 履歴蓄積 → Web ダッシュボード連携(設計書の Phase 3)
- [ ] Anthropic API 課金状況の統合(設計書の Phase 1)

---

## 10. ライセンス・配布

- **個人利用前提**(Chrome Web Store への公開は予定なし)
- 公開する際は別途検討事項(プライバシーポリシー記載、Anthropic 商標利用の確認、など)
