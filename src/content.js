// Runs in the page's own JS world on admin.ggleap.com, so it can observe the
// app's API traffic and call the same API with the same origin + credentials.
(() => {
  const API = "https://api.ggleap.com/production/";
  const MACHINES_URL = API + "machines_list_requests";
  const GRAPH_URL = API + "user_activity_graph_requests";
  const BOOKINGS_URL = API + "get_bookings";
  const TZ = "America/Chicago";
  const MACHINE_POLL_MS = 60_000;
  const GRAPH_TTL_MS = 120_000;
  const BOOKINGS_POLL_MS = 5 * 60_000;
  const LONG_SESSION_MIN = 120; // same threshold /pcs used to flag kickable PCs

  const state = {
    headers: {}, // auth headers copied from the app's own requests
    machines: [], // raw machine objects from machines_list_requests
    machinesAt: 0,
    graphs: new Map(), // userUuid -> { seconds, at, pending, error }
    bookings: [], // today's ggLeap bookings: { Start, Duration (min), Machines: [uuid] }
    bookingsAt: 0,
    bubbles: new Map(), // <glp-pc-layout-pc-item> -> machine
  };
  window.__ggUptime = state; // for poking at in DevTools

  // ---------------------------------------------------------------- network

  const KEEP_HEADERS = ["authorization", "x-gg-client"];

  function captureHeader(name, value) {
    const key = String(name).toLowerCase();
    if (KEEP_HEADERS.includes(key) && value) state.headers[key] = value;
  }

  function authHeaders() {
    const headers = { Accept: "application/json", ...state.headers };
    if (!headers.authorization) {
      const jwt = localStorage.getItem("jwt_token");
      if (jwt) headers.authorization = jwt;
    }
    return headers;
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input?.url || String(input);
    if (url.startsWith(API)) {
      const h = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      h.forEach((v, k) => captureHeader(k, v));
    }
    const p = origFetch.apply(this, arguments);
    if (url.startsWith(MACHINES_URL)) {
      p.then((res) => res.clone().json().then(onMachines)).catch(() => {});
    } else if (isTodaysBookings(url)) {
      p.then((res) => res.clone().json().then(onBookings)).catch(() => {});
    }
    return p;
  };

  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSetHeader = XHR.setRequestHeader;
  const origSend = XHR.send;
  XHR.open = function (method, url) {
    this.__ggUrl = String(url);
    return origOpen.apply(this, arguments);
  };
  XHR.setRequestHeader = function (name, value) {
    if (this.__ggUrl?.startsWith(API)) captureHeader(name, value);
    return origSetHeader.apply(this, arguments);
  };
  XHR.send = function () {
    if (this.__ggUrl?.startsWith(MACHINES_URL)) {
      this.addEventListener("load", () => {
        try {
          const body =
            this.responseType === "json" ? this.response : JSON.parse(this.responseText);
          onMachines(body);
        } catch {}
      });
    } else if (isTodaysBookings(this.__ggUrl)) {
      this.addEventListener("load", () => {
        try {
          const body =
            this.responseType === "json" ? this.response : JSON.parse(this.responseText);
          onBookings(body);
        } catch {}
      });
    }
    return origSend.apply(this, arguments);
  };

  function onMachines(payload) {
    let list = [];
    if (Array.isArray(payload)) list = payload;
    else if (payload && Array.isArray(payload.Machines)) list = payload.Machines;
    else if (payload) {
      for (const key of ["data", "machines", "items", "result"]) {
        if (Array.isArray(payload[key])) {
          list = payload[key];
          break;
        }
      }
    }
    state.machines = list;
    state.machinesAt = Date.now();
    refreshGraphs();
  }

  async function pollMachines() {
    if (document.hidden) return;
    if (Date.now() - state.machinesAt < MACHINE_POLL_MS) return;
    const headers = authHeaders();
    if (!headers.authorization) return;
    state.machinesAt = Date.now(); // don't stack requests if this one is slow
    try {
      const res = await origFetch(MACHINES_URL, { headers });
      if (res.ok) onMachines(await res.json());
    } catch {}
  }

  // /pcs only looked at today's bookings (Central time); do the same.
  const todayCentral = () => dayFmt.format(new Date());

  function isTodaysBookings(url) {
    if (!url?.startsWith(BOOKINGS_URL)) return false;
    return new URL(url).searchParams.get("date") === todayCentral();
  }

  function onBookings(payload) {
    state.bookings = Array.isArray(payload?.Bookings) ? payload.Bookings : [];
    state.bookingsAt = Date.now();
  }

  async function pollBookings() {
    if (document.hidden) return;
    if (Date.now() - state.bookingsAt < BOOKINGS_POLL_MS) return;
    const headers = authHeaders();
    if (!headers.authorization) return;
    state.bookingsAt = Date.now();
    try {
      const res = await origFetch(`${BOOKINGS_URL}?date=${todayCentral()}`, { headers });
      if (res.ok) onBookings(await res.json());
    } catch {}
  }

  function isReservedNow(machineUuid) {
    const now = Date.now();
    return state.bookings.some((b) => {
      const start = Date.parse(b.Start);
      const end = start + (b.Duration || 0) * 60_000;
      return b.Machines?.includes(machineUuid) && start <= now && now <= end;
    });
  }

  function refreshGraphs() {
    if (!state.bubbles.size) return; // only spend requests when badges are visible
    const now = Date.now();
    for (const m of state.machines) {
      const uuid = m.UserUuid;
      if (!uuid || m.State !== "UserLoggedIn") continue;
      const g = state.graphs.get(uuid);
      if (g && (g.pending || now - g.at < GRAPH_TTL_MS)) continue;
      fetchGraph(uuid, g);
    }
  }

  async function fetchGraph(uuid, prev) {
    const entry = { ...prev, pending: true, at: prev?.at ?? 0 };
    state.graphs.set(uuid, entry);
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const params = new URLSearchParams({
      TimeFrameType: "Custom",
      Start: start.toISOString(),
      End: end.toISOString(),
      UserActivityType: "TimePlayed",
      UserUuid: uuid,
    });
    try {
      const res = await origFetch(`${GRAPH_URL}?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const seconds = secondsPlayedToday(await res.json(), end);
      state.graphs.set(uuid, { seconds, at: Date.now(), pending: false });
    } catch (e) {
      state.graphs.set(uuid, { ...entry, pending: false, at: Date.now(), error: String(e) });
    }
  }

  // Port of the proxy's values_dict_from_graph + pick_source_for_today.
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });

  function secondsPlayedToday(graph, now) {
    let g = graph?.ActivityGraph ?? graph;
    let values = g?.Values ?? g;
    const buckets = [];
    const push = (key, v) => {
      const t = Date.parse(key);
      if (!Number.isNaN(t)) buckets.push({ t, v });
    };
    if (Array.isArray(values)) {
      for (const item of values) {
        if (!item || typeof item !== "object") continue;
        const ts = item.timestamp ?? item.time ?? item.date ?? item.key ?? item.Time;
        if (ts) push(ts, item);
      }
    } else if (values && typeof values === "object") {
      for (const [k, v] of Object.entries(values)) push(k, v);
    }
    if (!buckets.length) return 0;
    buckets.sort((a, b) => a.t - b.t);

    const today = dayFmt.format(now);
    const todays = buckets.filter((b) => dayFmt.format(b.t) === today);
    const prior = buckets.filter((b) => b.t <= now.getTime());
    const chosen = (todays.length ? todays : prior.length ? prior : buckets).at(-1).v;
    const raw = typeof chosen === "object" ? chosen?.source ?? chosen?.parsedValue : chosen;
    const secs = parseFloat(raw);
    return Number.isFinite(secs) && secs > 0 ? secs : 0;
  }

  // ---------------------------------------------------------------- display

  // Bubble aria-labels: "Desk 009" -> "009", "STREAM-PC" -> "ST", "TST-SAIT" -> "TS"
  function labelsFor(name) {
    const labels = new Set([name.trim()]);
    const digits = name.match(/(\d+)\s*$/);
    if (digits) labels.add(digits[1].padStart(3, "0"));
    else labels.add(name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase());
    return labels;
  }

  const BUBBLE = "glp-pc-layout-pc-item[aria-label]";
  // From states.js. Each color is a CSS variable (--ggu-<key>) that colors.js sets
  // from the popup's saved choices; unset, it falls back to the default.
  const STATES = globalThis.GGU_STATES;
  const colorOf = (state) => `var(--ggu-${state.key}, ${state.css})`;

  // Where each PC sits, matching the room (and the /pcs image): desks 1-5 and 6-10
  // as two columns, then a back-room column of stream / 15 / 14. Anything else
  // (test PCs) only shows with "Show all", in a column after that.
  function slotFor(name) {
    if (/stream/i.test(name)) return { col: 2, row: 0 };
    const desk = name.match(/^desk\s*0*(\d+)$/i);
    const n = desk ? Number(desk[1]) : NaN;
    if (n >= 1 && n <= 5) return { col: 0, row: n - 1 };
    if (n >= 6 && n <= 10) return { col: 1, row: n - 6 };
    if (n === 15) return { col: 2, row: 1 };
    if (n === 14) return { col: 2, row: 2 };
    return null;
  }

  function findBubbles() {
    const byLabel = new Map();
    for (const m of state.machines) {
      if (typeof m.Name !== "string") continue;
      for (const l of labelsFor(m.Name)) byLabel.set(l, m);
    }
    state.bubbles.clear();
    for (const el of document.querySelectorAll(BUBBLE)) {
      const m = byLabel.get(el.getAttribute("aria-label").trim());
      if (m) state.bubbles.set(el, m);
    }
  }

  // "1h57", "45m"
  function formatDuration(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}m`;
  }

  function minutesOn(machine) {
    if (machine.State !== "UserLoggedIn") return null;
    const g = state.graphs.get(machine.UserUuid);
    let secs;
    if (g?.seconds != null) {
      // keep ticking between refreshes: they're still logged in
      secs = g.seconds + (Date.now() - g.at) / 1000;
    } else if (g && !g.pending && machine.LastStateUpdate) {
      // graph fetch failed: fall back to time since this PC switched to logged-in
      secs = (Date.now() - Date.parse(machine.LastStateUpdate)) / 1000;
    } else {
      return undefined; // still loading
    }
    return Math.max(0, Math.ceil(secs / 60));
  }

  function badgeText(machine, min) {
    if (machine.State === "AdminMode") return "admin";
    if (min === undefined) return "…";
    return min === null ? null : formatDuration(min);
  }

  // Same precedence as /pcs get_entry_icon_color: kickable, then reserved;
  // otherwise ggLeap's own red / green / grey stays.
  function bubbleClass(machine, min) {
    const reserved = isReservedNow(machine.Uuid);
    if (min > LONG_SESSION_MIN && !reserved) return "gg-kick";
    if (reserved) return "gg-reserved";
    return "";
  }

  // Colors picked in the popup arrive from colors.js as JSON in <html data-ggu-colors>.
  // Set them as the --ggu-<key> variables the fill rules read, and give those
  // bubbles black or white label text, whichever reads better.
  function textOn(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.4 ? "#111" : "#fff";
  }

  function applyCustomColors() {
    let colors = {};
    try {
      colors = JSON.parse(document.documentElement.dataset.gguColors || "{}");
    } catch {}
    const custom = STATES.filter((st) => /^#[0-9a-f]{6}$/i.test(colors[st.key] || ""));
    const vars = custom.map((st) => `--ggu-${st.key}: ${colors[st.key]};`).join(" ");
    // `html` prefix: outrank the default label colors in ensureStyle
    const labels = custom
      .map((st) => `${GGU_SELECTORS(st).title.map((sel) => `html ${sel}`).join(", ")} { color: ${textOn(colors[st.key])} !important; }`)
      .join("\n");
    let style = document.getElementById("gg-uptime-colors");
    if (!style) {
      style = document.createElement("style");
      style.id = "gg-uptime-colors";
      document.head.append(style);
    }
    style.textContent = `:root { ${vars} }\n${labels}`;
  }

  function ensureStyle() {
    if (document.getElementById("gg-uptime-style")) return;
    const style = document.createElement("style");
    style.id = "gg-uptime-style";
    style.textContent = `
      ${BUBBLE} > .gg-uptime {
        position: absolute; left: 50%; top: 100%; transform: translate(-50%, -60%);
        z-index: 6; pointer-events: none; white-space: nowrap; /* above ggLeap's session ring (z 5) */
        font: 600 10px/1 system-ui, sans-serif; padding: 2px 5px; border-radius: 8px;
        background: #3b4250; color: #fff; box-shadow: 0 0 0 1.5px #22262e;
      }
      /* bubble fills; kickable/booked selectors are more specific, so they win over the ggLeap state */
      ${STATES.map((st) => `${GGU_SELECTORS(st).fill.join(", ")} { background-color: ${colorOf(st)} !important; }`).join("\n")}
      /* ggLeap also paints the label box in the state color; keep it clear so translucent fills (locked) don't double up */
      ${BUBBLE} .pc-item__title { background-color: transparent !important; }
      ${BUBBLE}.gg-reserved .pc-item__title { color: #fff !important; }
      /* ggLeap's PC health ring: nobody reads it, and it muddies the status colors */
      ${BUBBLE} svg.health-bar { display: none !important; }
      #gg-show-all {
        position: absolute; z-index: 3; display: flex; align-items: center; gap: 6px;
        font: 600 11px/1 system-ui, sans-serif; color: #c9ced8; cursor: pointer; user-select: none;
        background: #3b4250; padding: 5px 8px; border-radius: 8px; box-shadow: 0 0 0 1.5px #22262e;
      }
      #gg-show-all input { margin: 0; width: 12px; height: 12px; accent-color: #9aa3b2; cursor: pointer; }
      #gg-legend {
        position: absolute; top: 12px; right: 12px; z-index: 3; min-width: 190px; max-width: 260px;
        font: 500 11px/1.3 system-ui, sans-serif; color: #c9ced8;
        background: #3b4250; border-radius: 8px; box-shadow: 0 0 0 1.5px #22262e;
      }
      #gg-legend button {
        all: unset; box-sizing: border-box; width: 100%; display: flex; justify-content: space-between; gap: 10px;
        padding: 6px 9px; font-weight: 600; cursor: pointer; border-radius: 8px;
      }
      #gg-legend button:focus-visible { outline: 2px solid #9aa3b2; outline-offset: 1px; }
      #gg-legend.closed { min-width: 0; }
      #gg-legend.closed ul { display: none; }
      #gg-legend ul { list-style: none; margin: 0; padding: 2px 9px 9px; display: grid; gap: 6px; }
      #gg-legend li { display: grid; grid-template-columns: 14px 1fr; gap: 8px; align-items: center; }
      #gg-legend li span { color: #9aa3b2; font-weight: 400; }
      #gg-legend li b { font-weight: 600; color: #e7e9ee; }
      #gg-legend .dot { width: 14px; height: 14px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
      #gg-legend .pill {
        width: 14px; height: 9px; border-radius: 5px; background: #3b4250; box-shadow: 0 0 0 1.5px #22262e, inset 0 0 0 1px #6b7384;
      }
    `;
    document.head.append(style);
  }

  let showAll = false;
  try {
    showAll = localStorage.getItem("gg-uptime-show-all") === "1";
  } catch {}

  let legendOpen = true;
  try {
    legendOpen = localStorage.getItem("gg-uptime-legend") !== "closed";
  } catch {}


  function ensureLegend() {
    const panel = document.getElementById("pcLayoutZoomArea")?.parentElement;
    if (!panel) return;
    let box = document.getElementById("gg-legend");
    if (!box) {
      box = document.createElement("div");
      box.id = "gg-legend";
      const rows = STATES.map(
        (st) =>
          `<li><i class="dot" style="background:${colorOf(st)}"></i><div><b>${st.label}</b>${st.note ? ` <span>${st.note}</span>` : ""}</div></li>`,
      ).join("");
      box.innerHTML = `<button type="button" aria-expanded="true"><span>Legend</span><span aria-hidden="true"></span></button>
        <ul>${rows}<li><i class="pill"></i><div><b>1h57</b> <span>time played today</span></div></li></ul>`;
      const btn = box.querySelector("button");
      const sync = () => {
        box.classList.toggle("closed", !legendOpen);
        btn.setAttribute("aria-expanded", String(legendOpen));
        btn.lastElementChild.textContent = legendOpen ? "▾" : "▸";
      };
      btn.addEventListener("click", () => {
        legendOpen = !legendOpen;
        try {
          localStorage.setItem("gg-uptime-legend", legendOpen ? "open" : "closed");
        } catch {}
        sync();
      });
      sync();
    }
    if (box.parentElement !== panel) {
      if (getComputedStyle(panel).position === "static") panel.style.position = "relative";
      panel.append(box);
    }
  }

  function ensureShowAll() {
    const zoomArea = document.getElementById("pcLayoutZoomArea");
    const panel = zoomArea?.parentElement;
    if (!panel) return;
    let box = document.getElementById("gg-show-all");
    if (!box) {
      box = document.createElement("label");
      box.id = "gg-show-all";
      box.innerHTML = `Show all <input type="checkbox">`;
      const input = box.querySelector("input");
      input.checked = showAll;
      input.addEventListener("change", () => {
        showAll = input.checked;
        try {
          localStorage.setItem("gg-uptime-show-all", showAll ? "1" : "0");
        } catch {}
        render();
      });
    }
    if (box.parentElement !== panel) {
      if (getComputedStyle(panel).position === "static") panel.style.position = "relative";
      panel.append(box);
    }
    // bottom-right of the widget, just left of ggLeap's zoom buttons
    const widget = panel.closest("glp-widget-wrapper") || panel;
    const zoomOut = [...widget.querySelectorAll("button")].find((b) =>
      /zoom out/i.test(b.getAttribute("aria-label") || ""),
    );
    const pr = panel.getBoundingClientRect();
    const zr = zoomOut?.getBoundingClientRect();
    const right = zr ? pr.right - zr.left + 10 : 12;
    const bottom = zr ? pr.bottom - zr.bottom + (zr.height - box.offsetHeight) / 2 : 12;
    box.style.right = `${right}px`;
    box.style.bottom = `${bottom}px`;
  }

  // Place each bubble in its room slot. ggLeap scales top/left/width with zoom, so
  // derive the grid from the bubble's current size (40px at default zoom).
  function layout() {
    let extra = 0;
    const machines = [...state.bubbles].sort(([, a], [, b]) => a.Name.localeCompare(b.Name));
    for (const [el, machine] of machines) {
      let slot = slotFor(machine.Name);
      if (!slot) {
        if (!showAll) {
          el.style.setProperty("display", "none", "important");
          continue;
        }
        slot = { col: 3, row: extra++ };
      }
      el.style.removeProperty("display");
      const u = (el.offsetWidth || 40) / 40;
      const backGap = slot.col >= 2 ? 16 * u : 0; // small aisle before the back-room column
      const left = 26 + slot.col * 54 * u + backGap; // 26px: line the first column up with the widget title
      const top = 10 * u + slot.row * 58 * u; // extra row height leaves room for the pill
      el.style.setProperty("left", `${left}px`, "important");
      el.style.setProperty("top", `${top}px`, "important");
    }
  }

  // "009" -> "9" on the bubble itself; edit Angular's own text node in place.
  function trimLabel(el) {
    const title = el.querySelector(".pc-item__title");
    if (!title) return;
    for (const node of title.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const t = node.nodeValue.trim();
      if (/^0+\d+$/.test(t)) node.nodeValue = String(Number(t));
    }
  }

  function render() {
    ensureStyle();
    ensureShowAll();
    ensureLegend();
    for (const stale of document.querySelectorAll(".gg-uptime")) {
      if (!state.bubbles.has(stale.parentElement)) stale.remove();
    }
    for (const [el, machine] of state.bubbles) {
      trimLabel(el);
      const min = minutesOn(machine);
      for (const c of ["gg-kick", "gg-reserved"]) {
        el.classList.toggle(c, c === bubbleClass(machine, min));
      }
      const text = badgeText(machine, min);
      let badge = el.querySelector(":scope > .gg-uptime");
      if (!text) {
        badge?.remove();
        continue;
      }
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "gg-uptime";
        el.append(badge);
      }
      if (badge.textContent !== text) badge.textContent = text;
    }
    layout();
  }

  function tick() {
    pollMachines();
    pollBookings();
    findBubbles();
    refreshGraphs();
    render();
  }

  function start() {
    let scheduled = false;
    const ours = (n) =>
      n.id === "gg-show-all" ||
      n.id === "gg-legend" ||
      n.classList?.contains("gg-uptime") ||
      n.parentElement?.classList.contains("gg-uptime") ||
      n.parentElement?.closest?.("#gg-show-all, #gg-legend");
    new MutationObserver((muts) => {
      const relevant = muts.filter(
        (m) =>
          !ours(m.target) &&
          !(m.type === "attributes" && m.attributeName === "class" && m.target.matches?.(BUBBLE)) &&
          ![...m.addedNodes, ...m.removedNodes].every(ours),
      );
      if (!relevant.length) return;
      // a bubble's status class changed -> the app saw a state change; refetch now
      if (relevant.some((m) => m.type === "attributes" && m.target.classList?.contains("pc-item__status"))) {
        state.machinesAt = 0;
      }
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        tick();
      }, 250);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-label"] });
    applyCustomColors();
    new MutationObserver(applyCustomColors).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-ggu-colors"],
    });
    setInterval(tick, 1000);
    tick();
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
