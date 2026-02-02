(() => {
  const listEl = document.getElementById("events-list");
  const emptyEl = document.getElementById("events-empty");
  const errorEl = document.getElementById("events-error");

  function parseISODate(iso) {
    // Accepts "YYYY-MM-DD". Returns a Date at local midnight.
    if (!iso || typeof iso !== "string") return null;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function todayAtMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function isExpired(evt, today) {
    // Visible through expiresOn day; disappears the day after
    const exp = parseISODate(evt.expiresOn);
    if (!exp) return false; // forgiving: no expiresOn means never expires
    return today > exp;
  }

  function isPinnedNow(evt, today) {
    if (!evt.pinned) return false;
    // Optional pinnedUntil support (if you ever use it)
    const until = parseISODate(evt.pinnedUntil);
    if (!until) return true;
    return today <= until;
  }

  function formatMonthDay(iso) {
    const d = parseISODate(iso);
    if (!d) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  }

  function buildEventRow(evt) {
    const row = document.createElement("div");
    row.className = "event-row";

    // Line 1: Month+Day + Title
    const top = document.createElement("div");
    top.className = "event-topline";

    const date = document.createElement("div");
    date.className = "event-date";
    date.textContent = formatMonthDay(evt.dateStart);

    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = evt.title || "Untitled event";

    top.appendChild(date);
    top.appendChild(title);
    row.appendChild(top);

    // Line 2: Description
    if (evt.description) {
      const desc = document.createElement("div");
      desc.className = "event-desc";
      desc.textContent = evt.description;
      row.appendChild(desc);
    }

    // Line 3: Location on last line (include time if present)
    const location = (evt.location || "").trim();
    const time = (evt.time || "").trim();

    let metaText = "";
    if (location && time) metaText = `${location} · ${time}`;
    else metaText = location || time;

    if (metaText) {
      const meta = document.createElement("div");
      meta.className = "event-meta";
      meta.textContent = metaText;
      row.appendChild(meta);
    }

    return row;
  }

  async function loadEvents() {
    if (!listEl) return;

    try {
      const res = await fetch("data/events.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load events.json (HTTP ${res.status})`);

      const data = await res.json();
      const events = Array.isArray(data.events) ? data.events : [];

      const today = todayAtMidnight();

      // Filter out expired events
      const active = events.filter(e => !isExpired(e, today));

      // Split pinned vs normal
      const pinned = active.filter(e => isPinnedNow(e, today));
      const normal = active.filter(e => !isPinnedNow(e, today));

      // Sort by dateStart ascending
      const byStart = (a, b) => {
        const da = parseISODate(a.dateStart) || new Date(0);
        const db = parseISODate(b.dateStart) || new Date(0);
        return da - db;
      };
      pinned.sort(byStart);
      normal.sort(byStart);

      const finalList = [...pinned, ...normal];

      // Render
      listEl.innerHTML = "";
      if (errorEl) errorEl.hidden = true;

      if (!finalList.length) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      finalList.forEach(evt => listEl.appendChild(buildEventRow(evt)));
    } catch (err) {
      console.error(err);
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "Sorry — events could not be loaded.";
      }
    }
  }

  loadEvents();
})();
