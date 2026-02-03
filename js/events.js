(() => {
  const listEl = document.getElementById("events-list");
  const emptyEl = document.getElementById("events-empty");
  const errorEl = document.getElementById("events-error");

  if (!listEl) return;

  function parseISODate(iso) {
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
    const exp = parseISODate(evt.expiresOn);
    if (!exp) return false;
    return today > exp;
  }

  function formatMonthDay(iso) {
    const d = parseISODate(iso);
    if (!d) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit"
    });
  }

  function buildEventRow(evt) {
    const row = document.createElement("div");
    row.className = "event-row";

    // Line 1: date + title
    const top = document.createElement("div");
    top.className = "event-topline";

    const date = document.createElement("div");
    date.className = "event-date";
    date.textContent = formatMonthDay(evt.dateStart);

    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = evt.title || "Event";

    top.appendChild(date);
    top.appendChild(title);
    row.appendChild(top);

    // Line 2: description
    if (evt.description) {
      const desc = document.createElement("div");
      desc.className = "event-desc";
      desc.textContent = evt.description;
      row.appendChild(desc);
    }

    // Line 3: location / time
    const location = (evt.location || "").trim();
    const time = (evt.time || "").trim();

    let meta = "";
    if (location && time) meta = `${location} · ${time}`;
    else meta = location || time;

    if (meta) {
      const metaDiv = document.createElement("div");
      metaDiv.className = "event-meta";
      metaDiv.textContent = meta;
      row.appendChild(metaDiv);
    }

    return row;
  }

  function addSectionTitle(text) {
    const h = document.createElement("h3");
    h.className = "event-section-title";
    h.textContent = text;
    listEl.appendChild(h);
  }

  function addDivider() {
    const div = document.createElement("div");
    div.className = "event-section-divider";
    listEl.appendChild(div);
  }

  async function loadEvents() {
    try {
      const res = await fetch("data/events.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const events = Array.isArray(data.events) ? data.events : [];

      const today = todayAtMidnight();

      const active = events.filter(evt => !isExpired(evt, today));

      const pinned = active.filter(evt => evt.pinned);
      const normal = active.filter(evt => !evt.pinned);

      const byStart = (a, b) => {
        const da = parseISODate(a.dateStart) || new Date(0);
        const db = parseISODate(b.dateStart) || new Date(0);
        return da - db;
      };

      pinned.sort(byStart);
      normal.sort(byStart);

      listEl.innerHTML = "";
      if (errorEl) errorEl.hidden = true;

      if (!pinned.length && !normal.length) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      if (pinned.length) {
        addSectionTitle("Pinned Events");
        pinned.forEach(evt => listEl.appendChild(buildEventRow(evt)));
        if (normal.length) addDivider();
      }

      if (normal.length) {
        addSectionTitle(pinned.length ? "All Events" : "Upcoming Events");
        normal.forEach(evt => listEl.appendChild(buildEventRow(evt)));
      }

    } catch (err) {
      console.error(err);
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "Events could not be loaded.";
      }
    }
  }

  loadEvents();
})();
