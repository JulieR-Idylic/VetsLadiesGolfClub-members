(() => {
  // Set this page's audience filter
  // Public events page should show: "public" + "both"
  // Member events page should show: "member" + "both"
  const AUDIENCE_MODE =
  document.documentElement.getAttribute("data-audience") || "public";


  const listEl = document.getElementById("events-list");
  const emptyEl = document.getElementById("events-empty");
  const errorEl = document.getElementById("events-error");

  function parseISODate(iso) {
    // Accepts "YYYY-MM-DD". Returns a Date at local midnight.
    if (!iso || typeof iso !== "string") return null;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    return new Date(y, mo, d);
  }

  function todayAtMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function isVisibleByAudience(evt, mode) {
    const a = (evt.audience || "both").toLowerCase();
    if (mode === "public") return a === "public" || a === "both";
    if (mode === "members") return a === "members" || a === "both";
    return true;
  }

  function isPinnedNow(evt, today) {
    if (!evt.pinned) return false;
    // Only include pinnedUntil if you actually used it; if absent, pinned stays until expiresOn.
    const until = parseISODate(evt.pinnedUntil);
    if (!until) return true;
    return today <= until;
  }

  function formatDate(iso) {
    // Friendly date, e.g. "Apr 7, 2026"
    const d = parseISODate(iso);
    if (!d) return iso || "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function buildEventCard(evt) {
    const article = document.createElement("article");
    article.className = "card";

    const h2 = document.createElement("h2");
    h2.textContent = evt.title || "Untitled event";
    h2.style.marginTop = "0";

    const meta = document.createElement("p");
    const dateLabel = evt.dateEnd && evt.dateEnd !== evt.dateStart
      ? `${formatDate(evt.dateStart)} – ${formatDate(evt.dateEnd)}`
      : formatDate(evt.dateStart);

    const bits = [];
    if (dateLabel) bits.push(`<strong>Date:</strong> ${dateLabel}`);
    if (evt.time) bits.push(`<strong>Time:</strong> ${evt.time}`);
    if (evt.location) bits.push(`<strong>Location:</strong> ${evt.location}`);

    meta.innerHTML = bits.join("<br>");

    const desc = document.createElement("p");
    desc.textContent = evt.description || "";

    article.appendChild(h2);
    if (bits.length) article.appendChild(meta);
    if (evt.description) article.appendChild(desc);

    return article;
  }

  async function loadAndRender() {
    if (!listEl) return;

    try {
      const res = await fetch("data/events.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load events.json (HTTP ${res.status})`);
      const data = await res.json();
      const events = Array.isArray(data.events) ? data.events : [];

      const today = todayAtMidnight();

      // Filter: audience + not expired
      const active = events
        .filter(evt => isVisibleByAudience(evt, AUDIENCE_MODE))
        .filter(evt => {
          const exp = parseISODate(evt.expiresOn);
          // If expiresOn missing or invalid, keep it visible (more forgiving)
          return !exp || today <= exp;
        });

      // Split pinned vs normal
      const pinned = active.filter(evt => isPinnedNow(evt, today));
      const normal = active.filter(evt => !isPinnedNow(evt, today));

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
      if (finalList.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }
      if (emptyEl) emptyEl.hidden = true;

      finalList.forEach(evt => listEl.appendChild(buildEventCard(evt)));
    } catch (err) {
      console.error(err);
      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = "Sorry — events could not be loaded. Please try again later.";
      }
    }
  }

  loadAndRender();
})();
