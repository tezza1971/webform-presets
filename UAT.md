# User Acceptance Testing (UAT) Plan
## NDX Webform Presets Browser Extension

**Version:** 1.0  
**Last Updated:** November 12, 2025  
**Test Scope:** All browsers (Chrome, Edge, Firefox, Brave, Opera, etc.)

---

## 1. Pre-Test Setup

### 1.1 Installation Verification
- [ ] Extension installs successfully from browser store/manual installation
- [ ] Extension icon appears in browser toolbar
- [ ] Extension shows correct version number in browser extensions page
- [ ] No console errors appear after installation

### 1.2 Initial State
- [ ] First-time setup prompts for password creation
- [ ] Password requirements are clearly displayed
- [ ] Extension is locked by default (no data accessible without password)

**Browser-Specific Notes:**
- **Firefox:** Check that Manifest V3 compatibility is working (or V2 for older versions)
- **Safari:** Verify permissions prompt appears correctly

---

## 2. Core Functionality Tests

### 2.1 Password & Encryption

#### 2.1.1 Password Creation
- [ ] Can set initial password (minimum 8 characters)
- [ ] Password confirmation field works correctly
- [ ] Mismatched passwords show error
- [ ] Password is required (cannot skip)
- [ ] Strong password recommendations are shown

#### 2.1.2 Password Unlock
- [ ] Correct password unlocks extension
- [ ] Incorrect password shows error message
- [ ] Lock icon shows locked/unlocked state
- [ ] Extension remains unlocked during browser session
- [ ] "Remember password" option works (if implemented)

#### 2.1.3 Password Change
- [ ] Can change password from settings
- [ ] Old password is required to change
- [ ] All presets remain accessible after password change
- [ ] Error shown if old password is incorrect

#### 2.1.4 Password Reset
- [ ] Password reset option is available
- [ ] Warning shown that all data will be lost
- [ ] Confirmation required before reset
- [ ] All data cleared after reset
- [ ] Can set new password after reset

**Test Data:**
- Weak password: `test123`
- Medium password: `Test1234!`
- Strong password: `MyS3cur3P@ssw0rd!2025`

---

### 2.2 Form Field Detection

#### 2.2.1 Input Field Recognition
- [ ] Text inputs are detected
- [ ] Email inputs are detected
- [ ] Password inputs are detected (but not filled automatically)
- [ ] Textarea elements are detected
- [ ] Number inputs are detected
- [ ] Hidden inputs are ignored
- [ ] Disabled inputs are handled correctly

#### 2.2.2 Form Structure Detection
- [ ] Single-field forms work
- [ ] Multi-field forms work
- [ ] Forms with fieldsets work
- [ ] Forms without `<form>` tags work (standalone inputs)
- [ ] Dynamically added fields are detected (SPA support)

**Test Sites:**
- Simple login: `https://example.com/login`
- Complex forms: Registration forms with 10+ fields
- Dynamic forms: React/Vue applications

**Browser-Specific Notes:**
- **Chrome/Edge:** Test with Chrome DevTools showing DOM changes
- **Firefox:** Verify content script loads before page renders

---

### 2.3 Preset Management

#### 2.3.1 Saving Presets
- [ ] Right-click on input field shows context menu
- [ ] "Save Preset" option appears in context menu
- [ ] Preset name can be entered
- [ ] Preset saves successfully with notification
- [ ] Multiple fields in same form saved together
- [ ] Sensitive fields (passwords) are properly encrypted
- [ ] Duplicate preset names are handled

#### 2.3.2 Loading Presets
- [ ] Right-click shows "Load Preset" option
- [ ] Saved presets listed in submenu
- [ ] Clicking preset fills form fields correctly
- [ ] Multi-field forms filled completely
- [ ] Fields maintain correct mapping
- [ ] Special characters preserved
- [ ] Unicode/emoji preserved

#### 2.3.3 Managing Presets
- [ ] Can view all presets in options page
- [ ] Presets grouped by domain/URL scope
- [ ] Can edit preset name
- [ ] Can edit preset values
- [ ] Can delete individual presets
- [ ] Deletion requires confirmation
- [ ] Search/filter presets works (if implemented)

#### 2.3.4 Preset Scope
- [ ] Domain-scoped presets work on all pages in domain
- [ ] URL-scoped presets work only on specific URL
- [ ] Scope can be changed after creation
- [ ] Wildcard patterns work (if implemented)

**Test Scenarios:**
1. Save login preset with username "testuser@example.com"
2. Save shipping address with full form (name, address, city, zip, country)
3. Save payment form (excluding CVV/card number for security)
4. Save search preferences
5. Save textarea content (bio, description, comments)

---

### 2.4 Context Menu Integration

#### 2.4.1 Menu Appearance
- [ ] Context menu appears on right-click
- [ ] Extension menu items clearly labeled
- [ ] Icons displayed correctly (if any)
- [ ] Menu items only shown on supported fields
- [ ] No duplicate menu items

#### 2.4.2 Menu Actions
- [ ] "Save Preset" works from context menu
- [ ] "Load Preset" shows submenu
- [ ] Submenu shows relevant presets only
- [ ] "Manage Presets" opens options page
- [ ] Menu closes after action

**Browser-Specific Notes:**
- **Firefox:** Verify context menu namespace works correctly
- **Chrome/Edge:** Check for menu flicker issues

---

### 2.5 Multi-Session/Collection Support

#### 2.5.1 Collections
- [ ] Can create new collection with unique password
- [ ] Can switch between collections
- [ ] Each collection isolated (presets don't mix)
- [ ] Current collection indicated in UI
- [ ] Collection names can be changed
- [ ] Collections can be deleted

#### 2.5.2 Collection Security
- [ ] Each collection requires separate password
- [ ] One unlocked collection doesn't unlock others
- [ ] Switching collections requires re-authentication
- [ ] Collection data encrypted independently

**Test Scenario:**
1. Create "Work" collection with password "Work123!"
2. Save work email presets
3. Create "Personal" collection with password "Personal123!"
4. Save personal email presets
5. Verify work presets not visible in personal collection
6. Verify personal presets not visible in work collection

---

### 2.6 Import/Export

#### 2.6.1 Export Functionality
- [ ] Can export current collection
- [ ] Can export all collections
- [ ] Export creates valid JSON/ZIP file
- [ ] Export filename includes date/timestamp
- [ ] Export includes metadata (version, date)
- [ ] Encrypted data remains encrypted in export
- [ ] File downloads successfully

#### 2.6.2 Import Functionality
- [ ] Import dialog shows confirmation
- [ ] Import shows what will be imported (preview)
- [ ] Warning shown about replacing existing data
- [ ] Import requires password unlock
- [ ] Import processes successfully
- [ ] Legacy format imports work (if supported)
- [ ] Version mismatch handled gracefully
- [ ] Corrupted files rejected with error message

#### 2.6.3 Data Integrity
- [ ] Exported then imported presets match original
- [ ] Special characters preserved
- [ ] Field mappings preserved
- [ ] Timestamps preserved
- [ ] Usage counts preserved

**Test Process:**
1. Create 5 presets across 3 domains
2. Export to file
3. Delete all presets
4. Import from file
5. Verify all 5 presets restored correctly

---

### 2.7 Disabled Domains

#### 2.7.1 Disabling Domains
- [ ] Can disable domain from context menu
- [ ] Confirmation shown before disabling
- [ ] Extension inactive on disabled domain
- [ ] Context menu doesn't appear on disabled domain
- [ ] Disabled domains listed in settings

#### 2.7.2 Re-enabling Domains
- [ ] Can re-enable domain from settings
- [ ] Extension becomes active after re-enabling
- [ ] Context menu reappears
- [ ] Existing presets still available

#### 2.7.3 Domain Matching
- [ ] Subdomain disabling works correctly
- [ ] Protocol (http/https) handled correctly
- [ ] Port numbers handled correctly
- [ ] Wildcard patterns work (if implemented)

**Test Domains:**
- `example.com`
- `sub.example.com`
- `http://localhost:8080`

---

## 3. Advanced Features

### 3.1 Sync Service Integration

#### 3.1.1 Sync Configuration
- [ ] Can configure sync service URL
- [ ] Can configure sync service port
- [ ] Connection test works
- [ ] Invalid URLs rejected
- [ ] Sync status displayed

#### 3.1.2 Sync Operations
- [ ] Presets sync to server
- [ ] Presets sync from server
- [ ] Conflict resolution works
- [ ] Sync errors handled gracefully
- [ ] Sync log accessible
- [ ] Manual sync trigger works

#### 3.1.3 Multi-Device Sync
- [ ] Presets available on second device
- [ ] Updates on device A appear on device B
- [ ] Deletions sync correctly
- [ ] Encryption keys handled correctly
- [ ] Device identification works

**Sync Service:** `http://localhost:8765` (local testing)

---

### 3.2 Field Type Handling

#### 3.2.1 Standard Fields
- [ ] Text inputs: `<input type="text">`
- [ ] Email inputs: `<input type="email">`
- [ ] Tel inputs: `<input type="tel">`
- [ ] URL inputs: `<input type="url">`
- [ ] Number inputs: `<input type="number">`
- [ ] Date inputs: `<input type="date">`
- [ ] Textarea: `<textarea>`

#### 3.2.2 Special Cases
- [ ] Checkboxes (checked state saved)
- [ ] Radio buttons (selected option saved)
- [ ] Select dropdowns (selected value saved)
- [ ] Multi-select (all selections saved)
- [ ] Color pickers
- [ ] Range sliders
- [ ] File inputs (handled securely - path only, not file content)

#### 3.2.3 Excluded Fields
- [ ] Password fields NOT auto-filled (security)
- [ ] Credit card numbers NOT saved (security)
- [ ] CVV codes NOT saved (security)
- [ ] SSN fields NOT saved (security)
- [ ] Fields marked `autocomplete="off"` respected

---

### 3.3 Options Page

#### 3.3.1 UI Navigation
- [ ] Options page opens from toolbar icon
- [ ] Options page opens from extension management
- [ ] All sections accessible
- [ ] Navigation smooth and responsive
- [ ] Back button works correctly

#### 3.3.2 Settings Management
- [ ] Can change password
- [ ] Can configure sync settings
- [ ] Can view/manage disabled domains
- [ ] Can view usage statistics (if implemented)
- [ ] Can clear all data
- [ ] Can reset to defaults

#### 3.3.3 Visual Feedback
- [ ] Success messages shown for actions
- [ ] Error messages shown for failures
- [ ] Loading indicators during operations
- [ ] Tooltips explain features
- [ ] Help text available

---

## 4. Security & Privacy Tests

### 4.1 Data Encryption
- [ ] Data encrypted at rest
- [ ] Encryption key derived from password
- [ ] No plain text passwords stored
- [ ] No sensitive data in console logs
- [ ] No sensitive data in error messages
- [ ] Salt used for key derivation
- [ ] Encryption algorithm documented (AES-256)

### 4.2 Data Isolation
- [ ] Extension data isolated from web pages
- [ ] Web pages cannot access extension storage
- [ ] Different domains cannot access each other's presets
- [ ] Collections isolated from each other
- [ ] Content scripts sandboxed properly

### 4.3 Permissions
- [ ] Only required permissions requested
- [ ] Permission prompts clear and justified
- [ ] Storage permission used correctly
- [ ] Context menu permission used correctly
- [ ] Active tab permission scoped correctly

**Verify:**
- No unnecessary permissions (e.g., "Read browsing history")
- Manifest permissions match actual usage
- Privacy policy available (if required)

---

## 5. Performance Tests

### 5.1 Load Time
- [ ] Extension loads within 2 seconds
- [ ] Options page loads within 1 second
- [ ] Popup opens within 500ms
- [ ] No noticeable lag when right-clicking

### 5.2 Resource Usage
- [ ] Memory usage reasonable (<50MB for typical use)
- [ ] CPU usage minimal when idle
- [ ] No memory leaks after extended use
- [ ] Storage usage reasonable (<5MB for 100 presets)

### 5.3 Scalability
- [ ] Works with 10 presets
- [ ] Works with 100 presets
- [ ] Works with 1000 presets (stress test)
- [ ] Search/filter remains fast with many presets
- [ ] No performance degradation over time

**Browser-Specific Notes:**
- **Firefox:** Check memory usage in `about:memory`
- **Chrome:** Use Task Manager (Shift+Esc)

---

## 6. Compatibility Tests

### 6.1 Browser Support
- [ ] **Chrome:** Version 120+
- [ ] **Edge:** Version 120+
- [ ] **Firefox:** Version 120+
- [ ] **Brave:** Latest version
- [ ] **Opera:** Latest version
- [ ] **Safari:** Version 17+ (if supported)

### 6.2 Operating Systems
- [ ] Windows 10/11
- [ ] macOS 13+
- [ ] Linux (Ubuntu 22.04+)
- [ ] ChromeOS (if applicable)

### 6.3 Website Compatibility
Test on various website types:
- [ ] Static HTML forms
- [ ] React applications
- [ ] Vue.js applications
- [ ] Angular applications
- [ ] WordPress sites
- [ ] Shopify checkout
- [ ] Social media login forms
- [ ] Banking login forms (test carefully!)
- [ ] Government forms

**Known Incompatibilities:**
- Sites with strict CSP (Content Security Policy) may block extension
- Sites using shadow DOM may not detect fields correctly
- iFrame-heavy sites may have limited support

---

## 7. Error Handling Tests

### 7.1 User Errors
- [ ] Invalid password shows clear error
- [ ] Empty required fields validated
- [ ] File format errors explained
- [ ] Network errors handled gracefully
- [ ] Duplicate actions prevented (double-click)

### 7.2 System Errors
- [ ] Browser storage full handled
- [ ] Sync service unavailable handled
- [ ] Corrupted data detected and reported
- [ ] Extension update preserves data
- [ ] Browser crash recovery works

### 7.3 Edge Cases
- [ ] Form with no fields
- [ ] Form with 100+ fields
- [ ] Preset name with special characters: `<>&"'/\`
- [ ] Preset value with emoji: `😀🎉👍`
- [ ] Very long preset values (10,000 characters)
- [ ] Concurrent saves on multiple tabs
- [ ] Rapid clicking actions

---

## 8. Accessibility Tests

### 8.1 Keyboard Navigation
- [ ] All UI elements keyboard accessible
- [ ] Tab order logical
- [ ] Enter key submits forms
- [ ] Escape key closes dialogs
- [ ] Focus indicators visible

### 8.2 Screen Reader Support
- [ ] Form labels read correctly
- [ ] Button actions announced
- [ ] Error messages announced
- [ ] Success messages announced
- [ ] ARIA labels present where needed

### 8.3 Visual Accessibility
- [ ] Sufficient color contrast (WCAG AA)
- [ ] Works with browser zoom (100%-200%)
- [ ] Works with high contrast mode
- [ ] Icons have text alternatives
- [ ] Font size adjustable

---

## 9. Localization Tests (If Supported)

### 9.1 Language Support
- [ ] Default language detected correctly
- [ ] Language can be changed manually
- [ ] All UI text translated
- [ ] Date/time formats localized
- [ ] Number formats localized

### 9.2 RTL Support (If Applicable)
- [ ] UI layout flips for RTL languages
- [ ] Text alignment correct
- [ ] Icons positioned correctly

---

## 10. Regression Tests

After any update, verify:
- [ ] Existing presets still load
- [ ] Password still unlocks extension
- [ ] All features from previous version work
- [ ] No new console errors
- [ ] Performance not degraded
- [ ] Settings preserved
- [ ] Disabled domains still disabled

---

## 11. User Experience Tests

### 11.1 First-Time User
- [ ] Onboarding clear and helpful
- [ ] First preset save intuitive
- [ ] First preset load works smoothly
- [ ] Help documentation findable
- [ ] Example use case provided

### 11.2 Power User
- [ ] Bulk operations available (if implemented)
- [ ] Keyboard shortcuts work (if implemented)
- [ ] Advanced settings accessible
- [ ] Export/import fast with many presets
- [ ] Search/filter efficient

### 11.3 Visual Design
- [ ] UI consistent with browser design language
- [ ] Icons clear and meaningful
- [ ] Colors appropriate (not garish)
- [ ] Layout responsive (different window sizes)
- [ ] Animations smooth (not janky)

---

## 12. Documentation Tests

### 12.1 User Documentation
- [ ] README clearly explains features
- [ ] Installation instructions accurate
- [ ] Usage examples provided
- [ ] Screenshots up-to-date
- [ ] FAQ addresses common issues

### 12.2 Technical Documentation
- [ ] API documentation complete (if sync service)
- [ ] Architecture documented
- [ ] Security model explained
- [ ] Build instructions work
- [ ] Code comments helpful

---

## 13. Store Listing Tests (Pre-Publication)

### 13.1 Store Presence
- [ ] Extension title clear and searchable
- [ ] Description accurate and compelling
- [ ] Screenshots demonstrate key features
- [ ] Icon recognizable at all sizes
- [ ] Privacy policy linked (if required)
- [ ] Support email/website provided

### 13.2 Ratings & Reviews
- [ ] Initial testing feedback positive
- [ ] Common complaints addressed
- [ ] Feature requests documented
- [ ] Bug reports triaged

---

## 14. Test Data Sets

### 14.1 Simple Test Preset
```
Name: Basic Login
Fields:
  - email: test@example.com
  - username: testuser
Scope: URL: https://example.com/login
```

### 14.2 Complex Test Preset
```
Name: Full Registration Form
Fields:
  - firstName: John
  - lastName: Doe
  - email: john.doe@example.com
  - phone: +1-555-123-4567
  - address1: 123 Main St
  - address2: Apt 4B
  - city: Anytown
  - state: CA
  - zipCode: 12345
  - country: United States
  - dateOfBirth: 1990-01-15
  - comments: This is a test registration
Scope: Domain: example.com
```

### 14.3 Special Characters Test
```
Name: Special Chars Test
Fields:
  - username: test<user>
  - displayName: John "Johnny" O'Doe
  - bio: Testing special chars: & < > " ' / \ `
  - emoji: 😀🎉👍🚀💯
  - unicode: Ñoño αβγ 中文 العربية
Scope: URL: https://test.example.com
```

---

## 15. Sign-Off Criteria

Extension is ready for release when:
- [ ] All critical tests pass (100%)
- [ ] 95%+ of high-priority tests pass
- [ ] 90%+ of medium-priority tests pass
- [ ] No critical or high-severity bugs remain
- [ ] Performance meets targets
- [ ] Security audit complete
- [ ] Documentation complete
- [ ] Store listing ready
- [ ] Rollback plan in place

---

## 16. Test Execution Log

| Date | Tester | Browser | OS | Pass Rate | Issues Found | Status |
|------|--------|---------|----|-----------|--------------| -------|
| YYYY-MM-DD | Name | Chrome 120 | Windows 11 | 95% | 3 minor | ✅ Pass |
| YYYY-MM-DD | Name | Firefox 120 | macOS 13 | 92% | 5 minor | ✅ Pass |
| YYYY-MM-DD | Name | Edge 120 | Windows 10 | 98% | 1 minor | ✅ Pass |

---

## 17. Known Issues & Limitations

Document any known issues that won't be fixed before release:

1. **Scope-based retrieval with complex URLs:**
   - **Issue:** URL encoding in path parameters doesn't work with sync service
   - **Impact:** Low - workaround available (use domain scope)
   - **Fix:** Planned for v2.0

2. **Shadow DOM support:**
   - **Issue:** Fields inside shadow DOM may not be detected
   - **Impact:** Low - affects few sites
   - **Workaround:** None currently

3. **iFrame limitations:**
   - **Issue:** Cross-origin iframes not accessible due to browser security
   - **Impact:** Medium - affects embedded forms
   - **Workaround:** Users must interact with iframed form directly

---

## 18. Test Environment Setup

### Required Software
- Target browsers (latest stable + 1 previous version)
- Local webserver (for testing sites)
- Sync service (optional): `webform-sync` on port 8765
- Test websites or HTML files

### Test Accounts
- Test email accounts for registration forms
- Test payment methods (use test/sandbox environments only)
- Admin accounts for options page testing

### Test Data Preparation
- Sample form HTML files
- Export/import test files
- Performance test datasets (100, 1000 presets)

---

## Appendix A: Browser-Specific Test Checklist

### Chrome/Edge Specific
- [ ] Manifest V3 compliance verified
- [ ] Service worker lifecycle handled
- [ ] Chrome storage API works correctly
- [ ] DevTools extension debugging works

### Firefox Specific
- [ ] Manifest V2/V3 compatibility
- [ ] Browser namespace works (not chrome)
- [ ] Firefox content security policy compatible
- [ ] about:debugging loads extension

### Safari Specific (If Supported)
- [ ] Safari extension conversion successful
- [ ] Native messaging works (if used)
- [ ] Keychain integration (if used)
- [ ] iOS Safari support (if applicable)

---

## Appendix B: Security Testing Checklist

- [ ] OWASP Top 10 vulnerabilities checked
- [ ] XSS prevention verified
- [ ] CSRF protection implemented
- [ ] SQL injection not applicable (no SQL)
- [ ] Dependency vulnerabilities scanned
- [ ] Code obfuscation/minification for production
- [ ] No hardcoded secrets in code
- [ ] Secure communication (HTTPS) for sync
- [ ] Token/session management secure
- [ ] Rate limiting implemented (if applicable)

---

## Appendix C: Automated Testing

While this is a UAT (manual) plan, these areas could be automated:

- Unit tests for utility functions
- Integration tests for storage operations
- E2E tests with Playwright/Puppeteer
- Visual regression tests
- Performance benchmarks
- Security scanning (npm audit, Snyk)

---

**Document Control:**
- **Version:** 1.0
- **Owner:** QA Team
- **Reviewers:** Development Team, Product Manager
- **Next Review:** After each major release
- **Change Log:**
  - 2025-11-12: Initial version created
