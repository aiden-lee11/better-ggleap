// Runs in the extension's isolated world, because content.js runs in the page's
// world and can't reach chrome.storage. Hands the colors saved from the popup to
// content.js through a data attribute on <html>, live on every change.
//
// (It can't share states.js with content.js: Chrome injects a file only once
// per page, even when two content_scripts entries list it.)
(() => {
  const publish = (colors) => {
    document.documentElement.dataset.gguColors = JSON.stringify(colors || {});
  };

  chrome.storage.local.get("colors").then(({ colors }) => publish(colors));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.colors) publish(changes.colors.newValue);
  });
})();
