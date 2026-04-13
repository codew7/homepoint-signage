# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Signtv** is a digital signage system for HomePoint showrooms. It consists of a real-time content management platform where an admin panel controls content displayed across multiple TVs/screens.

**Stack:** Vanilla JavaScript/CSS, Firebase (Realtime Database + Storage + Auth), no frameworks.

---

## Architecture

### Two-Part System

**1. Reproductor (`cartelera.html`)**
- Displays content on TVs/screens in kiosk mode
- Listens to Firebase Realtime Database for content changes
- Updates in real-time without page reload
- Shows slideshow with configurable transitions (fade, zoom, slide)
- Requires Firebase Authentication login
- URL parameter `?s=screenName` identifies which screen's content to load
- Falls back to cached content if offline

**2. Admin Panel (`admin.html`)**
- Web interface to manage slides and configuration
- Firebase Authentication required
- Creates/edits/deletes/reorders slides per screen
- Uploads images to Firebase Storage (automatically compressed)
- Real-time preview via iframe
- Manages multiple screens independently
- Stores change history

### Data Flow

```
Admin: Create/Edit Slide
    ↓
Upload image to Firebase Storage → get download URL
    ↓
Save slide metadata to Realtime Database: screens/{screenId}/content/slides
    ↓
Reproductor detects change via listener
    ↓
Reload slides, display in slideshow
```

---

## Firebase Structure

```
screens/
├── {screenId}/
│   ├── content/
│   │   ├── slides/
│   │   │   ├── 0: {type, title, description, imageUrl, price, duration, active, bgColor, textColor}
│   │   │   └── ...
│   │   └── updatedAt: timestamp
│   └── config/
│       ├── transitionType, transitionSpeed, defaultDuration
│       ├── primaryColor, bgColor
│       └── showClock, showIndicators

history/
└── {auto-generated}/
    ├── message, screen, timestamp

shared/
└── content/ (for global content across all screens)
```

---

## Key Implementation Details

### Authentication
Both files use Firebase Authentication with email/password. `onAuthStateChanged()` listener controls visibility of login vs. main UI.

### Real-Time Listeners
- `cartelera.html`: Listeners on `screens/{screenId}/content` and `screens/{screenId}/config` auto-detect changes
- `admin.html`: `.on('value')` listeners load and watch for updates to populate UI

### Images
- Stored in Firebase Storage (`storage/ref('slides/{timestamp}_{random}.jpg')`)
- Admin compresses before upload using canvas API
- Only URLs are stored in database (keeps DB size minimal)

### Screen Identification
- URL parameter `?s=screenName` (changed from `?screen=` for brevity)
- Defaults to `'default'` if not specified
- Menu (click clock) allows switching screens on reproductor

### Colors & Styling
- **Default primary:** `#50d753` (green)
- **Default background:** `#000000` (black)
- Both overridable per-screen in config modal
- CSS variables for easy theming

### Offline Support
- Local Storage caches last known slides on reproductor
- If Firebase unavailable, displays cached content
- Status indicator shows connection state

---

## Common Modifications

### Adding a New Field to Slides
1. Update slide object in admin's `addSlide()` function
2. Add form input in admin HTML
3. Include field in `handleContentUpdate()` processing
4. Render field in `renderSlides()` in cartelera

### Changing URL Parameter Name
Update both files where `URLSearchParams.get('s')` is called (currently 1 place in cartelera, 1 in menu).

### Adjusting Slideshow Behavior
- `startSlideshow()` in cartelera controls rotation logic
- `scheduleNext()` handles timing
- `activateSlide()` applies CSS classes for transitions

### Firebase Realtime Database Rules
Production should restrict `.write` to authenticated users only:
```json
{
  "rules": {
    "screens": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

---

## Testing Notes

**Login:** Both files require valid Firebase users. Create test accounts in Firebase Console → Authentication.

**Preview:** Admin's iframe preview auto-reloads when screen is switched. Check browser console for auth/CORS issues.

**Multi-Screen:** Create multiple screens via admin panel "Agregar pantalla" button, then use `?s=screenName` URLs to load different content on different TVs.

---

## Important Patterns

- **No pagination/scrolling:** Slideshow is the only navigation on reproductor
- **Drag & drop:** Reorder slides by dragging in admin's slide list
- **Soft delete:** Disable slides with toggle instead of deleting; purge history separately
- **Compression:** Images always compressed client-side before upload (max 1920x1080, quality 0.7-0.85)
- **Validation:** Check Firebase rules allow read/write; verify `FIREBASE_CONFIG` matches project

---

## Files Structure

- `cartelera.html` - ~900 lines, embedded CSS + JS, requester fullscreen on first user interaction
- `admin.html` - ~1500 lines, embedded CSS + JS
- `manifest.json` - PWA manifest with fullscreen display mode
- `GUIA-CONFIGURACION.md` - Setup instructions
- `CLAUDE.md` - This file

---

## Fullscreen Behavior

`cartelera.html` automatically requests fullscreen on first user click/touch. This works with the manifest.json `"display": "fullscreen"` setting. The reproductor then displays without browser chrome, ideal for kiosk mode on TVs.
