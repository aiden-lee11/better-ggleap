// Runs in the extension's isolated world (content.js runs in the page's world and
// can't reach chrome.storage). Turns the colors saved from the popup into CSS
// variables on the page, and re-applies them live whenever the popup changes one.
(() => {
  const STATES = globalThis.GGU_STATES;

  // Black or white label text, whichever reads better on the chosen fill.
  function textOn(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return luminance > 0.4 ? "#111" : "#fff";
  }

  const style = document.createElement("style");
  style.id = "gg-uptime-colors";

  function apply(colors = {}) {
    const custom = STATES.filter((st) => /^#[0-9a-f]{6}$/i.test(colors[st.key] || ""));
    const vars = custom.map((st) => `--ggu-${st.key}: ${colors[st.key]};`).join(" ");
    // `html` prefix: outrank content.js's default label colors
    const labels = custom
      .map((st) => `${GGU_SELECTORS(st).title.map((sel) => `html ${sel}`).join(", ")} { color: ${textOn(colors[st.key])} !important; }`)
      .join("\n");
    style.textContent = `:root { ${vars} }\n${labels}`;
    if (!style.isConnected) (document.head || document.documentElement).append(style);
  }

  chrome.storage.local.get("colors").then(({ colors }) => apply(colors));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.colors) apply(changes.colors.newValue);
  });
})();
