# 🟢 PocketTrack — Clean Personal Finance & Safe-to-Spend Tracker

[![PWA Ready](https://img.shields.io/badge/PWA-Installable-10b981.svg)](manifest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-orange.svg)](https://firebase.google.com/)

> **PocketTrack** is a clean, offline-first personal finance PWA designed for everyday pocket money tracking. Built with the simplicity of WhatsApp: total balance at a glance, secondary Safe-to-Spend daily calculations, multi-wallet transfers, UPI paste parsing, and zero intrusive clutter.

---

## ✨ Key Features

- 💰 **Clear Balance Hierarchy**:
  - Total balance hero card with month-to-date income and expense summary.
  - Secondary **Safe-to-Spend** daily allowance chip based on your monthly savings targets.
- 📱 **Fast Quick Composer**:
  - 1-tap entry logging for Income and Expense with visual category chips and wallet selection.
  - Full support for editing, updating, and deleting transactions.
- ⚡ **Smart UPI SMS & Notification Parser**:
  - Paste payment messages from GPay, PhonePe, Paytm, or CRED to automatically parse amount, merchant, and category.
- 👛 **Multi-Wallet Support (`wallets.js`)**:
  - Manage Cash, Bank accounts, and UPI wallets with atomic inter-wallet transfers.
- 📊 **Visual Monthly Insights (`insights.js`)**:
  - Category breakdown bars, highest spending areas, and daily velocity tracking.
- 🔒 **Privacy Mode & PIN Lock**:
  - Instantly blur sensitive balances and transaction values with optional 4-digit PIN lock.
- 📄 **Monthly PDF Statement Export**:
  - Generate clean, printable PDF statements for any selected month.
- ☁️ **100% Offline-First Cloud Sync (`offline.js` / `auth.js`)**:
  - Full IndexedDB offline persistence. Works seamlessly on airplane mode and auto-syncs when online with Firebase.
  - Guest sandbox mode allows full usage without an account.

---

## 📁 Repository Structure

```text
pocket-tracker/
├── index.html           # Main PWA application dashboard
├── app.html             # Direct application mirror (identical to index.html)
├── landing.html         # Official product landing page & live simulator
├── contact.html         # User support and inquiries
├── privacy.html         # Plain-language privacy policy
├── terms.html           # Terms of service
├── styles.css           # Clean green-accent design system (light/dark mode)
├── icons.css            # Tabler icon glyphs & utility classes
├── app.js               # Tab navigation, modals, and app lifecycle
├── transactions.js      # Transaction CRUD, Quick Composer, UPI parser, and PDF export
├── insights.js          # Monthly analytics, breakdown charts, and safe-to-spend
├── wallets.js           # Multi-wallet management and atomic transfers
├── auth.js              # Firebase authentication, guest sandbox, and Firestore sync
├── firebase.js          # Firebase SDK initialization and IndexedDB persistence
├── offline.js           # Network status and pending write subsystem tracking
├── onboarding.js        # First-time user onboarding flow
├── sw.js                # Service worker for offline caching
├── manifest.json        # Web App Manifest for mobile installation
├── sitemap.xml          # Search engine sitemap
├── llms.txt             # Machine-readable product index
└── website/             # Standalone marketing website pages
    ├── index.html       # Marketing homepage
    ├── features.html    # Features overview
    ├── pricing.html     # Pricing & simulator
    └── style.css        # Marketing stylesheet
```

---

## 🚀 Getting Started & Deployment

### 1. Run Locally
Simply open `index.html` or `landing.html` in any modern web browser or serve with a local static server (e.g. `npx serve .`). No build step or Node dependencies required.

### 2. Automated Test Suite
Verify application integrity and launch readiness:
```bash
node test_pure_suite.js
node audit_launch_readiness.js
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
