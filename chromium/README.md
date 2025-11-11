# NDX Webform Presets - Chromium Extension

A browser extension to save and fill webform data securely with encrypted presets by NDX Pty Ltd. Never stores passwords.

## Directory Structure

```text
chromium/
├── manifest.json           # Extension manifest (Manifest V3)
├── background.js          # Service worker (handles encryption, storage, context menus)
├── content.js             # Content script (captures/fills forms)
├── popup.html             # Extension popup UI
├── options.html           # Management console
├── unlock.html            # Master password unlock page
├── icons/                 # Extension icons (16x16, 32x32, 48x48, 128x128)
│   ├── icon16.png        
│   ├── icon32.png        
│   ├── icon48.png        
│   └── icon128.png       
├── lib/                   # Third-party libraries
│   └── jszip.min.js      # JSZip 3.10.1 for export/import
├── scripts/
│   ├── popup.js          # Popup logic
│   ├── options.js        # Management console logic
│   ├── unlock.js         # Unlock page logic
│   └── utils.js          # Shared utility functions
└── styles/
    ├── popup.css         # Popup styles
    ├── options.css       # Management console styles
    └── unlock.css        # Unlock page styles
```

## Installation for Testing

### Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chromium` folder
5. The extension should now appear in your extensions list

### Brave

1. Open Brave and navigate to `brave://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chromium` folder
5. The extension should now appear in your extensions list

## Quick Start Testing

1. Load the extension in Chrome/Brave (see Installation above)
2. Navigate to any website with a form
3. Click the extension icon and set a master password
4. Fill out some fields in the form
5. Right-click on a form field → "NDX Webform Presets" → "Save Webform Preset"
6. Name your preset and click Save
7. Clear the form and right-click on a form field again
8. Select a preset from the context menu to fill the form
9. Form fields should auto-fill (except password fields)

## Features

- **Secure Storage**: All data stored locally with AES-GCM 256-bit encryption
- **Password Exclusion**: Never captures or stores password fields
- **Collection Password**: In-memory encryption key derived with PBKDF2 (100,000 iterations)
- **Multi-Collection Support**: Multiple password-protected preset groups (work/personal/etc.)
- **Context Menu Integration**: Right-click in form fields to save or fill (restricted to form elements only)
- **Smart Form Detection**: Automatically detects which form you right-clicked in on multi-form pages
- **Two Fill Modes**: Overwrite mode fills all fields, Update mode skips modified fields
- **Management Console**: View, edit, delete, search, and backup presets with statistics
- **Scope Support**: Save presets for entire domains or specific URLs
- **Dynamic Menus**: Available presets shown in context menu automatically
- **Import/Export**: ZIP-compressed backups with data integrity verification
- **Modal-Free UX**: Toast notifications and two-click confirmations (no alert boxes)

## Usage

### First Time Setup

1. Click the extension icon or use a context menu item
2. You'll be prompted to set a collection password on the unlock page
3. Enter a strong password (recommended: use a password manager)
4. Extension is now unlocked for this browser session

**Multi-Collection Support:**
- If you enter a password that doesn't match an existing collection, you'll be prompted to create a new collection
- Each collection is independently encrypted and isolated
- Useful for separating work and personal data, or different contexts

### Saving a Form

**Single Form on Page:**
1. Fill out a form on any website
2. Right-click in any form field
3. Select "NDX Webform Presets" → "Save as Preset..."
4. Form is automatically detected from your right-click location

**Multiple Forms on Page:**
1. Right-click in a field from the form you want to save
2. Extension automatically detects that specific form
3. If detection fails, a selection modal appears with intelligently labeled form options

**Save Dialog:**
- Preset name field
- Scope selection (Domain or Exact URL)
- List of detected fields with checkboxes
- Password fields are automatically excluded
- Click "Save Preset"
- Success toast notification appears

### Filling a Form

**Two Fill Modes:**
- **Fill (Overwrite)**: Fills all fields, replacing any existing values
- **Update**: Only fills fields that haven't been modified since page load

**Using Context Menu:**
1. Navigate to a page with a saved preset
2. Right-click in a form field
3. Select "NDX Webform Presets" → "Fill with..." → [preset name]
4. Form fields will be automatically filled
5. Success toast shows number of fields filled

**Using Popup:**
1. Click extension icon
2. View available presets for current page
3. Click "Fill" or "Update" button on desired preset

### Managing Presets

1. Click the extension icon → "Manage Presets"
2. Or right-click in a form field → "NDX Webform Presets" → "Manage Presets"
3. View all saved presets organized by scope

**Management Features:**
- Search bar to filter presets
- Statistics display (collection count, preset count, domains)
- Export presets as ZIP file (includes JSON + README)
- Import previously exported ZIP or JSON files
- Delete individual presets
- Delete all collections (with two-click confirmation)
- View usage statistics per preset

## Security Notes

- **Encryption**: AES-GCM 256-bit encryption for all preset data
- **Key Derivation**: PBKDF2-SHA256 with 100,000 iterations
- **In-Memory Key**: Encryption key never written to disk
- **No Cloud Sync**: All data stays on your device only (unless using optional sync service)
- **Session Based**: Automatically locks when browser closes
- **Password Exclusion**: Password fields never captured or stored
- **XSS Protection**: All user data is HTML-escaped before rendering
- **Multi-Collection Isolation**: Each collection encrypted independently with separate keys

## Known Limitations

- No multi-device sync by default (optional sync service available separately)
- Manual unlock required each browser session (by design for security)
- Context menu only appears in form fields (by design for clarity)
- Form detection may not work with heavily dynamic SPAs
- No automatic form filling on page load (by design for security)
- Export files contain encrypted data but domain names are visible in metadata

## Development

### File Purposes

- **manifest.json**: Extension metadata, permissions, and component definitions
- **background.js**: Service worker handling encryption, storage, and context menu coordination
- **content.js**: Injected into pages to detect forms, capture data, and fill fields
- **scripts/utils.js**: Shared utilities for modals, toasts, and HTML escaping
- **popup.html/js**: Quick access UI when clicking extension icon
- **options.html/js**: Full-featured management interface with search/export/import
- **unlock.html/js**: Secure password entry and key derivation

### Debugging

- **Extension pages**: Right-click on popup/options/unlock → Inspect
- **Background script**: `chrome://extensions` → Details → Inspect service worker
- **Content script**: Open DevTools on the web page (F12)
- **Console logs**: All components output debug information
- **Storage inspection**: DevTools → Application → Storage → Local

### Architecture

```text
┌─────────────┐
│  Background │  ← Service Worker (persistent encryption key)
│   Worker    │  ← Handles encryption/decryption
└──────┬──────┘  ← Manages chrome.storage.local
       │         ← Updates context menus
       │
   ┌───┴───┬──────────┬────────────┐
   │       │          │            │
┌──▼───┐ ┌▼─────┐ ┌──▼──────┐ ┌───▼────┐
│Popup │ │Options│ │Content  │ │Unlock  │
│  UI  │ │  UI   │ │ Script  │ │  Page  │
└──────┘ └───────┘ └─────────┘ └────────┘
                       │
                   ┌───▼────┐
                   │ Web    │
                   │ Forms  │
                   └────────┘
```

## Completed Implementation

- [x] Complete extension boilerplate with Manifest V3
- [x] AES-GCM encryption with PBKDF2 key derivation
- [x] Collection password unlock system
- [x] Multi-collection support with independent encryption
- [x] Form detection and data capture
- [x] Smart form detection (auto-detects from right-click location)
- [x] Password field exclusion
- [x] Save preset modal with field selection
- [x] Fill preset functionality with two modes (overwrite/update)
- [x] Dynamic context menus showing available presets (restricted to form fields)
- [x] Management console with search and statistics
- [x] Export/import with ZIP compression
- [x] Toast notification system (modal-free UX)
- [x] Modal UI system with styling isolation
- [x] Lock/unlock flow
- [x] Session-based security (key cleared on browser close)

## Future Enhancements

- [ ] Add actual icon files (currently using placeholders)
- [ ] Keyboard shortcuts for quick access
- [ ] Preset templates and categories
- [ ] Field mapping/transformation (e.g., "First Name" → "fname")
- [ ] Auto-lock timer (configurable session timeout)
- [ ] Enhanced form detection for complex React/Vue/Angular apps
- [ ] Statistics dashboard (most used presets, etc.)
- [ ] Dark mode support
- [ ] Optional cloud sync integration

## License

See LICENSE file in the root directory.
