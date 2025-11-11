# NDX Webform Presets

A secure browser extension for saving and filling web forms with encrypted presets. Never stores passwords, works seamlessly with password managers.

**By NDX Pty Ltd**

## 🎯 Overview

NDX Webform Presets helps you save time filling out repetitive web forms by storing your form data as reusable "presets". All data is encrypted locally using AES-GCM 256-bit encryption - your data never leaves your device.

**Key Features:**
- 🔐 Military-grade encryption (AES-GCM 256-bit)
- 🚫 Never stores password fields
- 💾 Local-only storage (no cloud, no sync)
- 🎯 Context menu integration (appears only in form fields)
- ⚡ Fast form filling with two modes (overwrite/update)
- 🔍 Smart field detection with multi-form support
- 📁 Import/export with ZIP compression
- 🔒 Session-based locking
- 👥 Multi-collection support (multiple password-protected preset groups)
- 🎨 Modal-free UX with smooth notifications

## 🚀 Quick Start

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/ndx-video/webform-presets.git
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
2. Right-click → "NDX Webform Presets" → "Save as Preset..."
3. Name your preset and select fields to include
4. Click Save

**Fill a form:**
1. Navigate to a page with saved presets
2. Right-click in a form field → "NDX Webform Presets" → "Fill with..." → [preset name]
3. Fields are automatically filled!

**Manage presets:**
- Click extension icon → "Manage Presets"
- Search, export, import, or delete presets
- View statistics (collection count, preset count, domains)
- Export as ZIP files with compression

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
├── UAT.md                 # User Acceptance Testing guide
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔒 Security

**Encryption:**
- AES-GCM 256-bit encryption for all stored data
- PBKDF2-SHA256 key derivation (100,000 iterations)
- Encryption key stored in memory only (never persisted)
- Each collection is independently encrypted

**Privacy:**
- All data stays on your device
- No network requests
- No telemetry or analytics
- Password fields explicitly excluded
- XSS protection via HTML escaping

**Session Management:**
- Automatically locks when browser closes
- Manual unlock with collection password required
- No persistent authentication tokens
- Support for multiple independent collections (work/personal/etc.)

**Multi-Collection Support:**
- Create multiple password-protected preset collections
- Each collection is completely isolated with its own encryption
- Switch between collections by entering different passwords
- Useful for separating work and personal data, or different contexts

## 🛠️ Development

### Prerequisites
- Chrome or Brave browser
- Basic understanding of Chrome Extensions (Manifest V3)
- Text editor (VS Code recommended)

### Testing

1. Use the included `test-form.html` for basic testing
2. Follow `UAT.md` for comprehensive testing
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
- **[UAT.md](UAT.md)** - User Acceptance Testing procedures

## 🔮 Roadmap

**Current Status: Feature Complete ✅**

All core and advanced functionality is implemented:
- ✅ Save/fill workflows with two modes (overwrite/update)
- ✅ Encryption system with multi-collection support
- ✅ Context menus (restricted to form fields only)
- ✅ Management console with statistics
- ✅ Import/export with ZIP compression
- ✅ Modal-free UX with toast notifications
- ✅ Smart form detection (right-click auto-detects form)
- ✅ Multi-collection support (multiple password-protected groups)

**Future Enhancements:**
- Icon design and branding
- Keyboard shortcuts
- Enhanced SPA support (React/Vue/Angular)
- Auto-lock timer
- Dark mode
- Cloud sync service integration (optional)

## ⚠️ Known Limitations

- No multi-device sync by default (optional sync service available separately)
- Manual unlock required each browser session (by design for security)
- Basic form detection (may not work with all heavily dynamic JavaScript frameworks)
- No automatic filling on page load (by design for security)
- Export files contain encrypted data but domain names are visible in metadata

## 🤝 Contributing

This is currently a personal project. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Submit a pull request with detailed description

## 📄 License

See [LICENSE](LICENSE) file for details.

## 💡 Why was it built?

Built to solve the problem of repeatedly filling out web forms while maintaining security and privacy. Designed to work alongside password managers rather than replace them. A lot of form fillers exist, but often they are an after-thought as part of another system (like a password manager) or they want you to send your data to the cloud, or they store your data unencrypted. Mostly, the implementations are poor quality. It's actually very difficult trying to make this functionality reliable when web forms have so much variability, and extension implementation by browser platforms have so much variability, but thousands of hours can be saved by teams who grind away at human-centric data entry. Even though AI has improved at this, there will always be a human somwhere, punching repetive data into some sort of web form or web app. The theme of data sovereignt continues even when you use the NDX Webform Sync server which allows you to share form data across multiple web browsers on the same machine, multiple machines on your private LAN, or even multiple locations on your virtual private network. We will also provide an SSO solution for enterprises who want to host their own server with IAM features.

## 🙏 Acknowledgments

- JSZip used for exports/imports
- Built with Chrome Extensions Manifest V3
- Uses Web Crypto API for encryption
- Follows OWASP security best practices

---

**Status:** Ready for testing | **Version:** 1.0.0-alpha | **Last Updated:** 2024
