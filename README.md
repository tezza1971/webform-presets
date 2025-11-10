# Webform Presets

A secure browser extension for saving and filling web forms with encrypted presets. Never stores passwords, works seamlessly with password managers.

## 🎯 Overview

Webform Presets helps you save time filling out repetitive web forms by storing your form data as reusable "presets". All data is encrypted locally using AES-GCM 256-bit encryption - your data never leaves your device.

**Key Features:**
- 🔐 Military-grade encryption (AES-GCM 256-bit)
- 🚫 Never stores password fields
- 💾 Local-only storage (no cloud, no sync)
- 🎯 Context menu integration
- ⚡ Fast form filling
- 🔍 Smart field detection
- 📁 Import/export backups
- 🔒 Session-based locking

## 🚀 Quick Start

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/webform-presets.git
   cd webform-presets
   ```

2. Load the extension in Chrome/Brave:
   - Open `chrome://extensions/` (or `brave://extensions/`)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chromium` folder

3. Click the extension icon to set your master password

4. You're ready to go! Try it with `test-form.html` in your browser

### Usage

**Save a form:**
1. Fill out a web form
2. Right-click → "Webform Presets" → "Save as Preset..."
3. Name your preset and select fields to include
4. Click Save

**Fill a form:**
1. Navigate to a page with saved presets
2. Right-click → "Webform Presets" → "Fill with..." → [preset name]
3. Fields are automatically filled!

**Manage presets:**
- Click extension icon → "Manage Presets"
- Search, export, import, or delete presets

## 📁 Project Structure

```text
webform-presets/
├── chromium/              # Chrome/Brave extension
│   ├── manifest.json      # Extension manifest (Manifest V3)
│   ├── background.js      # Service worker (encryption, storage)
│   ├── content.js         # Form detection and filling
│   ├── popup.html/js      # Extension popup UI
│   ├── options.html/js    # Management console
│   ├── unlock.html/js     # Master password unlock
│   ├── scripts/
│   │   └── utils.js       # Shared utilities
│   └── styles/            # CSS stylesheets
├── spec.yml               # Technical specification
├── test-form.html         # Test form for development
├── user-acceptance-tests.md  # Testing guide
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔒 Security

**Encryption:**
- AES-GCM 256-bit encryption for all stored data
- PBKDF2-SHA256 key derivation (100,000 iterations)
- Encryption key stored in memory only (never persisted)

**Privacy:**
- All data stays on your device
- No network requests
- No telemetry or analytics
- Password fields explicitly excluded
- XSS protection via HTML escaping

**Session Management:**
- Automatically locks when browser closes
- Manual unlock with master password required
- No persistent authentication tokens

## 🛠️ Development

### Prerequisites
- Chrome or Brave browser
- Basic understanding of Chrome Extensions (Manifest V3)
- Text editor (VS Code recommended)

### Testing

1. Use the included `test-form.html` for basic testing
2. Follow `user-acceptance-tests.md` for comprehensive testing
3. Test on real-world forms like dnschecker.org/smtp-test-tool.php

### Debugging

- **Background Script**: `chrome://extensions` → Inspect service worker
- **Content Script**: Open DevTools (F12) on any web page
- **UI Pages**: Right-click on popup/options/unlock → Inspect
- **Storage**: DevTools → Application → Storage → Local

### Architecture

The extension follows a service worker pattern with message passing:

```text
Background Worker (encryption/storage) ←→ Content Script (forms)
       ↓                                      ↓
Popup UI / Options UI / Unlock UI      Web Page Forms
```

See `chromium/README.md` for detailed architecture documentation.

## 📋 Documentation

- **[spec.yml](spec.yml)** - Complete technical specification
- **[chromium/README.md](chromium/README.md)** - Extension development guide
- **[user-acceptance-tests.md](user-acceptance-tests.md)** - Testing procedures

## 🔮 Roadmap

**Current Status: MVP Complete ✅**

All core functionality is implemented and ready for testing:
- ✅ Save/fill workflows
- ✅ Encryption system
- ✅ Context menus
- ✅ Management console
- ✅ Import/export

**Future Enhancements:**
- Icon design and branding
- Keyboard shortcuts
- Fill mode selection UI
- Enhanced SPA support
- Auto-lock timer
- Dark mode
- Statistics dashboard

## ⚠️ Known Limitations

- No multi-device sync (by design for security)
- Manual unlock required each browser session
- Context menus update on page refresh after saving first preset
- Basic form detection (may not work with all JavaScript frameworks)
- No automatic filling on page load
- No password verification until first decrypt attempt

## 🤝 Contributing

This is currently a personal project. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Submit a pull request with detailed description

## 📄 License

See [LICENSE](LICENSE) file for details.

## 💡 Inspiration

Built to solve the problem of repeatedly filling out web forms while maintaining security and privacy. Designed to work alongside password managers rather than replace them.

## 🙏 Acknowledgments

- Built with Chrome Extensions Manifest V3
- Uses Web Crypto API for encryption
- Follows OWASP security best practices

---

**Status:** Ready for testing | **Version:** 1.0.0-alpha | **Last Updated:** 2024
