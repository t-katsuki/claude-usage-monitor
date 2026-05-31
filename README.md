# Claude Usage Monitor

An unofficial Chrome extension that displays Claude.ai subscription usage quotas in the toolbar.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/elmlmmfbppcphpjnfhigdocindjglolm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What it does

Claude Usage Monitor adds a small icon to your Chrome toolbar. Click it to see your current Claude.ai usage at a glance — the 5-hour limit, the weekly limit, when each one resets, and which plan you're on (MAX 5x, MAX 20x, Pro, Free, etc.).

No more guessing how much capacity you have left before your next deep-research run.

## Features

- 📊 5-hour quota utilization and reset time
- 📈 Weekly quota utilization and reset time
- 🏷️ Plan tier badge (MAX 5x / MAX 20x / Pro / Free / etc.)
- 🎨 Color-coded progress bars (green / orange / red)
- 🔒 Zero data collection, zero analytics, zero third-party servers
- 🪶 Lightweight: popup-only, no background process

## How it works

The extension reads your subscription information directly from your authenticated `claude.ai` browser session — the same session you use to chat with Claude. It calls two `claude.ai` API endpoints:

- `GET https://claude.ai/api/organizations`
- `GET https://claude.ai/api/organizations/{org_uuid}/usage`

Both requests use your existing browser cookies (`credentials: 'include'`). No login form, no API key, no separate account. Everything is computed locally inside the popup and discarded when you close it.

## Installation

The extension is published on the Chrome Web Store as an unlisted item, so the link is the only way to install it:

**👉 [Install from Chrome Web Store](https://chromewebstore.google.com/detail/elmlmmfbppcphpjnfhigdocindjglolm)**

Or install from source:

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `extension/` directory
5. The icon should appear in your toolbar

## Requirements

- Google Chrome (or any Chromium-based browser)
- A signed-in `claude.ai` session in the same browser (any plan: Free, Pro, MAX)

## Privacy

This extension does not collect, store, transmit, or share any data. All processing happens locally inside the browser popup. See the full [privacy policy](https://neon-tarsier-9d2ddd.netlify.app/) for details.

## Project structure

```
claude-usage-monitor/
├── extension/         ← The Chrome extension itself
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── icons/
└── docs/              ← Development notes
    └── implementation-spec.md
```

## Disclaimer

This is an **unofficial, independent third-party tool**. It is not affiliated with, endorsed by, sponsored by, or otherwise connected to Anthropic. "Claude" and "claude.ai" are trademarks of Anthropic, used here in a descriptive sense to identify the service this extension reads from.

This extension was built by a Claude.ai subscriber who wanted a quicker way to check their own usage.

## License

[MIT](LICENSE) — feel free to fork, modify, or learn from this code.

## Acknowledgements

Built with the help of [Claude](https://claude.ai) (Anthropic) and [Claude Code](https://www.anthropic.com/claude-code). The Phase 1 reconnaissance of the `claude.ai` internal API, the MVP scaffolding, and even this README went through iterative collaboration with Claude.
