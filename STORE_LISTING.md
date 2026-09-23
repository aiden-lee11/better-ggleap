# Chrome Web Store listing

Copy these into the Chrome Web Store Developer Dashboard. Upload the zip made by `./package.sh`, from `dist/`.

## Store listing tab

**Name:** Uptime Badges for ggLeap (comes from `manifest.json`)

**Summary:** comes from the manifest `description`

**Category:** Productivity → Tools

**Language:** English

**Description:**

> Built for gaming-center staff who use ggLeap's web admin. Instead of clicking into each PC and reading time-series charts, see everything on the device dashboard at a glance.
>
> • A badge on every PC shows how long the current player has played today (e.g. 1h57, 45m).
> • Bubbles are colored by status: orange = kickable (2h+ today and not booked), purple = in a current ggLeap booking, red = in use, cyan = admin mode, green = open, pink = starting / logging in or out / shutting down, gray = locked, dark gray = off.
> • PCs are arranged like the room, with test PCs tucked behind a "Show all" checkbox.
> • A collapsible legend explains the colors.
>
> The extension uses your existing ggLeap admin session. It only reads data from ggLeap and never changes anything. No data leaves your browser except requests to ggLeap's own API.
>
> Not affiliated with or endorsed by ggCircuit / ggLeap.

**Screenshots (1280×800):** `store/screenshot-1-dashboard.png`, `store/screenshot-2-show-all.png`, `store/screenshot-3-legend-folded.png`

**Small promo tile (440×280):** `store/promo-small-440x280.png`

**Icon (128×128):** `icons/icon128.png`

## Privacy practices tab

**Single purpose:**

> Shows each PC's play time and kickable status on the ggLeap admin device dashboard.

**Permission justification: host access to `https://admin.ggleap.com/*` (content script):**

> The extension has to run on the ggLeap admin dashboard to read the page's PC bubbles and draw time badges and status colors on them. It runs on no other site.

**Remote code:** No. All JavaScript is included in the package.

**Data usage: check these boxes:**

- **Authentication information:** the user's existing ggLeap session token is reused, only to call `api.ggleap.com`.
- **Website content:** machine states, bookings and players' play time, read from ggLeap's API and shown on the page.

**Certify all three:**

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** `https://github.com/aiden-lee11/better-ggleap/blob/main/PRIVACY.md`. The repo must be public for the store to reach it.

## Distribution tab

**Visibility:** **Unlisted** (only people with the link can install), or **Private** if you publish from a Google Workspace account. Private limits installs to that Workspace domain, if the domain's admin allows it. Avoid **Public**: the room layout and Central timezone are specific to Northwestern's gameroom.
