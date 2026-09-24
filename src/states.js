// Every bubble color the extension knows about. Used by the page script
// (content.js) and the popup (popup/).
//
// - `css`: what the bubble uses when the user hasn't picked a color. For ggLeap's
//   own states this is ggLeap's CSS variable, so uncustomized bubbles look exactly
//   like ggLeap draws them.
// - `hex`: the same color as a hex value, for the popup's color picker.
// - `host`: a class the extension puts on the bubble (kickable / booked), or
// - `statuses`: ggLeap's `pc-item__status_*` classes that make up this state.
(() => {
  globalThis.GGU_STATES = [
    { key: "kick", label: "Kickable", note: "on 2h+ today, not booked", css: "#ffa503", hex: "#ffa503", host: "gg-kick" },
    { key: "booked", label: "Booked", note: "in a ggLeap booking right now", css: "#9b59b3", hex: "#9b59b3", host: "gg-reserved" },
    {
      key: "inuse", label: "In use", css: "var(--gg-ui-alert-error, #d65e5c)", hex: "#d65e5c",
      statuses: ["user-logged-in", "user-logged-in-no-time-remaining"],
    },
    { key: "admin", label: "Admin mode", css: "var(--gg-ui-alert-info, #4ab6e8)", hex: "#4ab6e8", statuses: ["admin-mode"] },
    { key: "open", label: "Open", css: "var(--gg-widget-green, #7ab889)", hex: "#7ab889", statuses: ["ready-for-user"] },
    {
      // ggLeap draws these in nearly the same orange as kickable, so default them to pink
      key: "busy", label: "Busy", note: "starting, restarting, logging in/out, shutting down", css: "#f08cc0", hex: "#f08cc0",
      statuses: ["starting-up", "restarting", "user-logging-in", "user-logging-out", "shutting-down", "idle-shutting-down"],
    },
    { key: "locked", label: "Locked", css: "var(--gg-radiobutton-locked, rgba(255,255,255,.32))", hex: "#727579", statuses: ["locked"] },
    { key: "off", label: "Off", css: "var(--gg-radiobutton-off, #171a1c)", hex: "#171a1c", statuses: ["off"] },
    { key: "unknown", label: "Unknown", css: "#ffffff", hex: "#ffffff", statuses: ["unknown"] },
  ];

  const BUBBLE = "glp-pc-layout-pc-item[aria-label]";

  // Selectors for one state's bubble fill (the round .pc-item__status) and its label text.
  globalThis.GGU_SELECTORS = (state) => {
    if (state.host) {
      const host = `${BUBBLE}.${state.host}`;
      // `.pc-item` adds specificity so kickable/booked beat the ggLeap state underneath
      return { fill: [`${host} .pc-item .pc-item__status`], title: [`${host} .pc-item .pc-item__title`] };
    }
    return {
      fill: state.statuses.map((s) => `${BUBBLE} .pc-item__status.pc-item__status_${s}`),
      title: state.statuses.map((s) => `${BUBBLE} .pc-item__title.pc-item__status_${s}`),
    };
  };
})();
