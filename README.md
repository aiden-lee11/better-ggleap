# Uptime Badges for ggLeap

A Chrome extension that labels each PC bubble on the admin.ggleap.com device dashboard with how long the current player has played today, and colors kickable PCs.

![preview](preview.png)

*Mock data.* Bubble colors follow `/pcs`:

- **orange** = kickable: 2h+ today and not in a current ggLeap booking
- **purple** = in a current booking
- **red** = in use
- **cyan** = admin mode
- **green** = open
- **pink** = busy: starting, logging in/out, shutting down. ggLeap's own orange-yellow is recolored so it can't be mistaken for kickable.
- **gray** = locked
- **dark gray** = off

Pills show time played today (`1h57`, `45m`). ggLeap's green PC-health ring is hidden.

The layout matches the room: desks 1–5 and 6–10 as two columns, then stream / 15 / 14. Test PCs and anything else hide behind the **Show all** checkbox next to the zoom buttons. A collapsible **Legend** in the top-right corner explains the colors. Both settings are remembered per browser.

## Install for testing

1. Run `./package.sh`, which writes `dist/uptime-badges-for-ggleap-<version>.zip`. Or skip the zip and load this folder directly.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Either click **Load unpacked** and pick this folder, or unzip the zip and pick the unzipped folder. Chrome can't install a `.zip` directly.
4. Open https://admin.ggleap.com while signed in, then go to the Dashboard.

Requires Chrome 111 or newer.

## Publish

See [STORE_LISTING.md](STORE_LISTING.md) for every field in the Chrome Web Store dashboard, and [PRIVACY.md](PRIVACY.md) for the privacy policy it asks for. Upload the zip from `./package.sh`. Bump `version` in `manifest.json` before each new upload.

## How it works

The extension reuses your own admin session. It copies the auth headers from the page's requests to `api.ggleap.com` (or falls back to `localStorage.jwt_token`). It reads `machines_list_requests` and `get_bookings`, and fetches `user_activity_graph_requests` (TimePlayed, today in Central time) for each logged-in PC. That's the same data the old `/pcs` command used. It only reads; it never changes anything in ggLeap.

Badges attach inside each `glp-pc-layout-pc-item`, matched by its `aria-label` (e.g. `009`, `TS`). Positions are rescaled from the bubble's size, so the layout survives ggLeap's zoom. If the play-time request fails, the badge falls back to time since the machine's `LastStateUpdate`. Debug state: `window.__ggUptime` in DevTools.
