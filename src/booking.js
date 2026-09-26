// Books a reservation handed over from the NU Esports bot's "Book in ggLeap" button.
// The bot links to /booking/grid#nue=<base64url JSON>; this picks the payload up,
// asks for a click, then calls create_booking the same way the booking dialog does.
(() => {
  const API = "https://api.ggleap.com/production/";
  const CREATE_URL = API + "create_booking";
  const USERS_URL = API + "user_summaries_requests"; // every user in one page, with Email
  const TZ = "America/Chicago";
  const PENDING_KEY = "gg-booking-pending"; // sessionStorage: survives the login redirect
  const DONE_KEY = "gg-booking-done"; // localStorage: link -> BookingUuid, so a re-click can't double book
  const COLOR = "#4e2a84"; // Northwestern purple, same as the bot's reservation embed

  // --------------------------------------------------------------- capture

  // Runs at document_start, before Angular routes (and maybe redirects to login
  // and drops the fragment), so grab it now and clean the address bar.
  function capture() {
    const match = location.hash.match(/^#nue=([A-Za-z0-9_-]+)$/);
    if (!match) return;
    history.replaceState(history.state, "", location.pathname + location.search);
    try {
      sessionStorage.setItem(PENDING_KEY, match[1]);
    } catch {}
  }

  function decode(encoded) {
    try {
      const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const r = JSON.parse(new TextDecoder().decode(bytes));
      const ok =
        r?.v === 1 &&
        typeof r.team === "string" &&
        Array.isArray(r.pcs) &&
        r.pcs.every(Number.isInteger) &&
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(r.start) &&
        Number.isInteger(r.duration) &&
        r.duration > 0;
      return ok ? r : null;
    } catch {
      return null;
    }
  }

  function pending() {
    try {
      return sessionStorage.getItem(PENDING_KEY);
    } catch {
      return null;
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {}
  }

  function doneBookings() {
    try {
      return JSON.parse(localStorage.getItem(DONE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function markDone(encoded, bookingUuid) {
    const done = doneBookings();
    done[encoded] = bookingUuid;
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(done));
    } catch {}
  }

  // ------------------------------------------------------------------ data

  // Bot PC numbers -> ggLeap machines: 0 is the stream PC, n is "Desk 00n".
  function machineFor(pc, machines) {
    return machines.find((m) => {
      if (typeof m.Name !== "string") return false;
      if (pc === 0) return /stream/i.test(m.Name);
      const desk = m.Name.match(/^desk\s*0*(\d+)$/i);
      return desk && Number(desk[1]) === pc;
    });
  }

  const pcName = (pc) => (pc === 0 ? "Stream" : `PC ${pc}`);

  // "2026-09-29T17:15:00" in Central, to compare against the reservation's start
  function nowCentral() {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());
    return parts.replace(" ", "T");
  }

  // StartLocal is Central wall-clock; format it as-is instead of converting.
  function describeSlot(r) {
    const start = new Date(r.start + "Z");
    const end = new Date(start.getTime() + r.duration * 60_000);
    const day = start.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
    const time = (d) => d.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
    return `${day} · ${time(start)} – ${time(end)}`;
  }

  // The booking dialog's user picker filters this same list client-side.
  async function findUser(email) {
    if (!email) throw new Error("the bot has no email for this manager; book it by hand");
    const res = await fetch(USERS_URL, { headers: window.__ggAuthHeaders() });
    if (!res.ok) throw new Error(`couldn't load ggLeap users (HTTP ${res.status})`);
    const users = (await res.json())?.Users || [];
    const want = email.trim().toLowerCase();
    const user = users.find((u) => u.Email?.trim().toLowerCase() === want);
    if (!user) throw new Error(`no ggLeap account uses ${email}`);
    return user;
  }

  // content.js loads the machine list within a second or two of the page opening
  async function loadedMachines() {
    for (let i = 0; i < 20; i++) {
      const machines = window.__ggUptime?.machines;
      if (machines?.length) return machines;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("couldn't load the PC list; reload and try again");
  }

  async function createBooking(r, user) {
    const machines = await loadedMachines();
    const found = r.pcs.map((pc) => [pc, machineFor(pc, machines)]);
    const missing = found.filter(([, m]) => !m).map(([pc]) => pcName(pc));
    if (missing.length) throw new Error(`ggLeap has no machine for ${missing.join(", ")}`);

    const body = {
      booking: {
        BookingUuid: null,
        Name: r.team,
        StartLocal: r.start,
        Duration: r.duration,
        Paid: true,
        Color: COLOR,
        Machines: found.map(([, m]) => m.Uuid),
        UserUuid: user.Uuid,
        GuestName: null,
        BookerPhone: null,
        BookerEmail: user.Email,
        ShouldLockPc: true,
        ConsoleUuids: [],
      },
    };
    const res = await fetch(CREATE_URL, {
      method: "POST",
      headers: { ...window.__ggAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    if (!res.ok || !json?.BookingUuid) {
      const reason = json?.Message || json?.message || text.slice(0, 200) || `HTTP ${res.status}`;
      throw new Error(reason);
    }
    return json.BookingUuid;
  }

  // -------------------------------------------------------------------- UI

  function ensureStyle() {
    if (document.getElementById("gg-booking-style")) return;
    const style = document.createElement("style");
    style.id = "gg-booking-style";
    style.textContent = `
      #gg-booking {
        position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 100000;
        width: min(460px, calc(100vw - 32px)); box-sizing: border-box; padding: 12px 14px;
        font: 500 13px/1.4 system-ui, sans-serif; color: #c9ced8;
        background: #3b4250; border-radius: 10px; box-shadow: 0 0 0 1.5px #22262e, 0 8px 24px rgba(0,0,0,.35);
      }
      #gg-booking h2 { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #e7e9ee; }
      #gg-booking dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; }
      #gg-booking dt { color: #9aa3b2; }
      #gg-booking dd { margin: 0; color: #e7e9ee; overflow-wrap: anywhere; }
      #gg-booking .note { margin: 8px 0 0; color: #f0c674; }
      #gg-booking .note.error { color: #ff8a80; }
      #gg-booking .note.ok { color: #8fd694; }
      #gg-booking .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
      #gg-booking button {
        font: 600 12px/1 system-ui, sans-serif; padding: 7px 12px; border-radius: 7px; cursor: pointer;
        border: 0; background: #4e5566; color: #e7e9ee;
      }
      #gg-booking button.primary { background: ${COLOR}; color: #fff; }
      #gg-booking button:disabled { opacity: .55; cursor: default; }
      #gg-booking button:focus-visible { outline: 2px solid #9aa3b2; outline-offset: 1px; }
    `;
    document.head.append(style);
  }

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  }

  function show(encoded) {
    document.getElementById("gg-booking")?.remove();
    const r = decode(encoded);
    ensureStyle();

    const note = el("p", { className: "note" });
    const setNote = (text, kind = "") => {
      note.textContent = text;
      note.className = `note ${kind}`;
      note.hidden = !text;
    };
    const dismiss = el("button", { type: "button", textContent: "Dismiss" });
    const book = el("button", { type: "button", className: "primary", textContent: "Create booking" });
    const box = el("div", { id: "gg-booking", role: "dialog", ariaLabel: "Booking from Discord" });
    const close = () => {
      clearPending();
      box.remove();
    };
    dismiss.addEventListener("click", close);

    if (!r) {
      box.append(
        el("h2", { textContent: "Booking from Discord" }),
        note,
        el("div", { className: "actions" }, [dismiss]),
      );
      setNote("This link's reservation couldn't be read. Book it by hand.", "error");
      document.body.append(box);
      return;
    }

    const row = (k, v) => [el("dt", { textContent: k }), el("dd", { textContent: v })];
    const bookerName = el("dd", { textContent: r.email || "No email on file" });
    const booker = [el("dt", { textContent: "Booker" }), bookerName];
    let userLookup = null;
    const lookUpUser = () => {
      userLookup ??= findUser(r.email).then(
        (u) => {
          const name = [u.FirstName, u.LastName].filter(Boolean).join(" ");
          bookerName.textContent = `${u.Username}${name ? ` (${name})` : ""} · ${u.Email}`;
          return u;
        },
        (e) => {
          userLookup = null; // retry on the next click, e.g. after signing in
          throw e;
        },
      );
      return userLookup;
    };
    box.append(
      el("h2", { textContent: "Book this reservation from Discord?" }),
      el("dl", {}, [
        ...row("Team", r.team),
        ...row("When", describeSlot(r)),
        ...row("PCs", r.pcs.map(pcName).join(", ")),
        ...booker,
      ]),
      note,
      el("div", { className: "actions" }, [dismiss, book]),
    );

    const already = doneBookings()[encoded];
    if (already) {
      setNote("You already booked this one from Discord. Booking again makes a duplicate.");
      book.textContent = "Book again";
    } else if (r.start < nowCentral()) {
      setNote("This reservation's start time has already passed.");
    } else {
      setNote("");
    }
    // show who it'll be booked under before anyone clicks
    if (window.__ggAuthHeaders?.().authorization) {
      lookUpUser().catch((e) => setNote(`Can't book this: ${e.message}`, "error"));
    }

    book.addEventListener("click", async () => {
      if (!window.__ggAuthHeaders?.().authorization) {
        setNote("Sign in to ggLeap first, then click again.", "error");
        return;
      }
      book.disabled = dismiss.disabled = true;
      setNote("Booking…");
      try {
        const uuid = await createBooking(r, await lookUpUser());
        markDone(encoded, uuid);
        clearPending();
        setNote("Booked. Reload the grid to see it.", "ok");
        const reload = el("button", { type: "button", className: "primary", textContent: "Reload" });
        reload.addEventListener("click", () => location.reload());
        dismiss.textContent = "Close";
        dismiss.disabled = false;
        dismiss.removeEventListener("click", close);
        dismiss.addEventListener("click", () => box.remove());
        book.replaceWith(reload);
      } catch (e) {
        setNote(`Couldn't book: ${e.message}`, "error");
        book.disabled = dismiss.disabled = false;
      }
    });

    document.body.append(box);
  }

  capture();
  const start = () => {
    const encoded = pending();
    if (encoded) show(encoded);
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
