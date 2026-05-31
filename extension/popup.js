// ==========================================================================
// Claude.ai Utilization & Quota Monitoring Logic
// Authentication uses seamless Cookie Passthrough (credentials: 'include')
// ==========================================================================

const API_BASE = 'https://claude.ai/api';

// Plan tiers mapped to their user-friendly display labels
const PLAN_DISPLAY_NAMES = {
  'default_claude_max_20x': 'MAX 20x',
  'default_claude_max_5x': 'MAX 5x',
  'default_claude_pro': 'Pro',
  'default_claude_free': 'Free',
};

// ---- Data Retrieval ------------------------------------------------------

async function fetchUsage() {
  try {
    // Step 1: Fetch user's registered organizations
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

    // Select the organization equipped with chat capabilities (exclude API-only orgs)
    const chatOrg = orgs.find(org => org.capabilities?.includes('chat'));
    if (!chatOrg) {
      return { status: 'no_chat_plan' };
    }

    // Step 2: Fetch usage and utilization specifics for that chat organization
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
      message: err?.message || '不明なエラーが発生しました',
    };
  }
}

// ---- Formatting Helpers --------------------------------------------------

function formatPlan(tier) {
  return PLAN_DISPLAY_NAMES[tier] || tier || '不明';
}

function formatReset(isoString) {
  if (!isoString) return '--';
  const reset = new Date(isoString);
  if (isNaN(reset.getTime())) return '--';

  const now = new Date();
  const diffMs = reset - now;

  if (diffMs <= 0) return 'リセット完了';

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 60) {
    return `${diffMinutes}分後`;
  }
  if (diffHours < 24) {
    const m = diffMinutes % 60;
    return m > 0 ? `${diffHours}時間${m}分後` : `${diffHours}時間後`;
  }
  
  // Over 24 hours -> Local date format
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

// HTML Sanitization to prevent XSS vulnerability
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- Rendering Functions -------------------------------------------------

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
    <div class="skeleton-card">
      <div class="skeleton-shimmer skeleton-title"></div>
      <div class="skeleton-shimmer skeleton-value"></div>
      <div class="skeleton-shimmer skeleton-bar"></div>
      <div class="skeleton-shimmer skeleton-text"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-shimmer skeleton-title"></div>
      <div class="skeleton-shimmer skeleton-value"></div>
      <div class="skeleton-shimmer skeleton-bar"></div>
      <div class="skeleton-shimmer skeleton-text"></div>
    </div>
  `;
}

function render(state) {
  const planTag = document.getElementById('plan-tag');
  const content = document.getElementById('content');

  // Handle Logged Out State
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

  // Handle No Chat Plan Organization
  if (state.status === 'no_chat_plan') {
    planTag.textContent = '';
    content.innerHTML = `
      <div class="message-block">
        <p class="message">Claude.ai の有効なプランが見つかりませんでした</p>
      </div>
    `;
    return;
  }

  // Handle Errors
  if (state.status === 'error') {
    planTag.textContent = '';
    content.innerHTML = `
      <div class="message-block error">
        <p class="message">エラーが発生しました</p>
        <p class="message-detail">${escapeHtml(state.message)}</p>
        <button id="retry-btn" class="action-link">再試行</button>
      </div>
    `;
    
    // Attach listener for Retry capability
    document.getElementById('retry-btn').addEventListener('click', () => {
      renderLoading();
      fetchUsage().then(render);
    });
    return;
  }

  // Handle Success Rendering ('ok' state)
  planTag.textContent = formatPlan(state.planTier);
  content.innerHTML = `
    ${renderQuotaSection('5時間枠', state.fiveHour)}
    ${renderQuotaSection('週間枠', state.sevenDay)}
  `;
}

// ---- Extension Initializer ----------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  renderLoading();
  fetchUsage().then(render);
});
