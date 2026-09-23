# Uptime Badges for ggLeap

A Chrome extension that labels each PC bubble on the admin.ggleap.com device dashboard with how long the current player has played today, and colors kickable PCs.

![preview](preview.png)

The layout matches the room: desks 1–5 and 6–10 as two columns, then stream / 15 / 14. Test PCs and anything else hide behind the **Show all** checkbox next to the zoom buttons. A collapsible **Legend** in the top-right corner explains the colors. Both settings are remembered per browser.

## Install in Chrome

Requires Chrome 111 or newer. Other Chromium browsers (Edge, Brave, Arc) work the same way through their own extensions page.

1. **Download the code.** On this repo's GitHub page, click the green **Code** button → **Download ZIP**, then unzip it. Or clone it:
   ```sh
   git clone https://github.com/aiden-lee11/better-ggleap.git
   ```
   Put the folder somewhere you won't delete it. Chrome loads the extension from that folder every time it starts.
2. **Open the extensions page.** Go to `chrome://extensions` in the address bar.
3. **Turn on Developer mode** with the toggle in the top-right corner.
4. **Click Load unpacked** (top left) and select the folder that contains `manifest.json`. If you downloaded the ZIP, that's the `better-ggleap-main` folder inside the unzipped download.
5. **Refresh any open ggLeap tabs.** The extension only starts on pages loaded after it's installed.
6. Open https://admin.ggleap.com, sign in, and go to the **Dashboard**. The device dashboard should show time badges, the new colors and the legend.

Optional: click the puzzle-piece icon in Chrome's toolbar and pin **Uptime Badges for ggLeap** so its button is always visible.

### Changing colors

Click the extension's toolbar button to open **Bubble colors**. Click any state's circle (Kickable, Booked, In use, Busy, etc.) to pick a new color. Open ggLeap tabs update right away, including the legend. Label text switches between black and white to stay readable.

Your colors are saved in this browser and survive restarts. Use ↺ to reset one state, or **Reset all colors** to go back to the defaults.
