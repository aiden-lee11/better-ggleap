# Privacy Policy: Uptime Badges for ggLeap

_Last updated: September 23, 2026 (version 1.1.0)_

Uptime Badges for ggLeap is a Chrome extension for gaming-center staff. It adds labels to the device dashboard on `admin.ggleap.com`. This policy explains what data it touches and what it does with that data.

## What it accesses

The extension runs only on pages under `https://admin.ggleap.com/`, and only while you are signed in to ggLeap.

- **Your ggLeap session token.** The extension reuses the login you already have. It copies the `Authorization` header from the ggLeap admin page's own requests, or reads `jwt_token` from that page's local storage. It sends the token only to `api.ggleap.com`, the same server the admin page already talks to.
- **Data from ggLeap's API**, requested with that token:
  - the machine list: PC names, states, and the ID of the user logged in to each PC
  - today's bookings: start time, length, and which PCs are booked
  - each logged-in user's play time for today (`TimePlayed` activity graph)

## What it does with that data

- It uses the data only to draw time badges, bubble colors and the legend on the dashboard you are viewing.
- It keeps the data in memory in that browser tab. The data is gone when you close or reload the tab.
- It does **not** send any data to the developer or to any server other than `api.ggleap.com`.
- It has no analytics, tracking, ads or remote code.
- It does not sell, share or transfer data to anyone.

## What it stores

Everything it stores stays in your browser:

- **Display preferences:** whether "Show all" is checked and whether the legend is open. These go in the browser's local storage for `admin.ggleap.com`, and clearing that site's data removes them.
- **Your color choices** from the extension's popup. These go in the extension's own storage (`chrome.storage.local`) on your computer. They are never synced or sent anywhere, and "Reset all colors" or removing the extension clears them.

## Contact

Questions: open an issue on the extension's repository, or contact the Northwestern Esports gameroom admins.
