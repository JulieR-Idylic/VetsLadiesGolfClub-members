(() => {
  const RESULTS_API = "https://script.google.com/macros/s/AKfycbximdmeQ6IHZW3rUT9c-mg8VHA2LcBDIyKMqcC5-hLZIXcU6-LW1-jMWZTSwAS8z-XbgQ/exec"; // no ?mode=

  const weekSelect = document.getElementById("weekSelect");
  const weekHeading = document.getElementById("weekHeading");
  const weekSubhead = document.getElementById("weekSubhead");
  const winnerCards = document.getElementById("winnerCards");
  const resultsTbody = document.getElementById("resultsTbody");
  const toggleDetailsBtn = document.getElementById("toggleDetails");
  const detailsPanel = document.getElementById("detailsPanel");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  const segButtons = Array.from(document.querySelectorAll(".seg-btn"));

  let selectedHoles = "18";
  let selectedDate = null;
  let weeks = [];
  let isLoading = false;

  // ---------------- UI helpers ----------------
  function hideEmpty() { emptyState?.classList.add("is-hidden"); }
  function hideError() { errorState?.classList.add("is-hidden"); }

  function showEmpty(msg) {
    if (!emptyState) return;
    emptyState.textContent = msg;
    emptyState.classList.remove("is-hidden");
    hideError();
  }

  function showError(msg) {
    if (!errorState) return;
    errorState.textContent = msg || "Couldn’t load results.";
    errorState.classList.remove("is-hidden");
    emptyState?.classList.add("is-hidden");
  }

  function enableDetailsButton(enabled) {
    if (!toggleDetailsBtn) return;
    toggleDetailsBtn.disabled = !enabled;
  }

  function setExpanded(expanded) {
    if (!toggleDetailsBtn || !detailsPanel) return;
    toggleDetailsBtn.setAttribute("aria-expanded", String(expanded));
    detailsPanel.classList.toggle("is-collapsed", !expanded);
    toggleDetailsBtn.textContent = expanded ? "Hide full results" : "View full results";
  }

  function setLoading(on, message = "Loading…", opts = {}) {
    const { resetHeader = false, clearResults = true } = opts;
    isLoading = on;

    if (weekSelect) weekSelect.disabled = on;
    segButtons.forEach(b => (b.disabled = on));
    enableDetailsButton(false); // disabled while loading

    if (on) {
      hideError();
      showEmpty(message);

      if (clearResults) {
        if (resultsTbody) resultsTbody.innerHTML = "";
        if (winnerCards) winnerCards.innerHTML = "";
      }

      if (resetHeader) {
        if (weekHeading) weekHeading.textContent = "—";
        if (weekSubhead) weekSubhead.innerHTML = "";
      }

      // Keep details collapsed while loading
      setExpanded(false);
    }
  }

  // ---------------- formatting helpers ----------------
  function fmtDate(iso) {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (ch) => (
      ch === "&" ? "&amp;" :
      ch === "<" ? "&lt;" :
      ch === ">" ? "&gt;" :
      ch === "\"" ? "&quot;" : "&#39;"
    ));
  }

  function dollars(v) {
    if (v === "" || v === null || v === undefined) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return escapeHtml(String(v));
    return Math.abs(n - Math.round(n)) < 1e-9 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
  }

  function toNumberOrNull(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function adjOrZero(v) {
    const n = toNumberOrNull(v);
    return n === null ? 0 : n;
  }

  function expectedNet(r) {
    const raw = toNumberOrNull(r.raw);
    const hcp = toNumberOrNull(r.handicap);
    if (raw === null || hcp === null) return null;
    return raw - hcp - adjOrZero(r.adjustment);
  }

  function placeRank(place) {
    if (typeof place === "number") return place;
    const s = String(place ?? "").trim().toUpperCase();
    if (s.startsWith("T")) {
      const n = parseInt(s.slice(1), 10);
      return Number.isFinite(n) ? n : 999;
    }
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 999;
  }

  function ordinalSuffix(n) {
    if (n === 1) return "st";
    if (n === 2) return "nd";
    if (n === 3) return "rd";
    return "th";
  }

  function placeLabel(place) {
    const r = placeRank(place);
    const tied = String(place ?? "").trim().toUpperCase().startsWith("T");
    return tied ? `T-${r}${ordinalSuffix(r)} Place` : `${r}${ordinalSuffix(r)} Place`;
  }

  function displayAdj(v) {
    return (v === "" || v === null || v === undefined) ? "—" : String(v);
  }

  function getTodayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function pickDefaultDate(list) {
    const today = getTodayISO();
    const onOrBefore = list.find(w => w.date <= today);
    return (onOrBefore || list[0] || null)?.date ?? null;
  }

  function setSegmentActive(holes) {
    selectedHoles = holes;
    segButtons.forEach(btn => {
      const active = btn.dataset.holes === holes;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  // ---------------- fetching ----------------
  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const text = await res.text();
    if (text.trim().startsWith("<")) {
      throw new Error(`Non-JSON response (likely HTML). Check web-app access. URL: ${url}`);
    }
    return JSON.parse(text);
  }

  async function loadPublishedWeeks() {
    const url = `${RESULTS_API}?mode=published`;
    const data = await fetchJson(url);
    if (data?.error) throw new Error(`API error: ${data.error}`);

    weeks = (Array.isArray(data?.weeks) ? data.weeks : [])
      .filter(w => w && w.date)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async function loadWeek(dateISO) {
    const url = `${RESULTS_API}?mode=week&date=${encodeURIComponent(dateISO)}`;
    const data = await fetchJson(url);
    if (data?.error) throw new Error(`API error: ${data.error}`);
    return data;
  }

  // ---------------- render ----------------
  function renderWeekDropdown() {
    if (!weekSelect) return;
    weekSelect.innerHTML = "";

    for (const w of weeks) {
      const opt = document.createElement("option");
      opt.value = w.date;
      const game = (w.gamePlanned || "").trim();
      opt.textContent = `${fmtDate(w.date)}${game ? ` — ${game}` : ""}`;
      weekSelect.appendChild(opt);
    }
  }

  function renderHeader(meta) {
    if (weekHeading) weekHeading.textContent = fmtDate(meta.date);

    const game = (meta.gamePlanned || "").trim() || "—";
    const captain = (meta.gameCaptain || "").trim() || "—";
    const notes = (meta.notes || "").trim();

    const lines = [`Game: ${game}`, `Game Captain: ${captain}`];
    if (notes) lines.push(`Notes: ${notes}`);

    if (weekSubhead) {
      weekSubhead.innerHTML = lines.map(l => `<div>${escapeHtml(l)}</div>`).join("");
    }
  }

  function getResultsForHoles(data) {
    return selectedHoles === "9" ? (data.results9 || []) : (data.results18 || []);
  }

  function renderWinners(results) {
    if (!winnerCards) return;
    winnerCards.innerHTML = "";

    const top = results
      .slice()
      .filter(r => {
        const rank = placeRank(r.place);
        return rank >= 1 && rank <= 3;
      })
      .sort((a, b) => placeRank(a.place) - placeRank(b.place));

    if (!top.length) {
      winnerCards.textContent = "No placements entered yet.";
      return;
    }

    for (const r of top) {
      const card = document.createElement("div");
      card.className = "winner-card";
      card.innerHTML = `
        <div class="winner-rank">${placeLabel(r.place)}</div>
        <div class="winner-name">${escapeHtml(r.name ?? "")}</div>
        <div class="winner-meta">
          <span class="pill">HCP: ${escapeHtml(r.handicap ?? "—")}</span>
          <span class="pill">Raw: ${escapeHtml(r.raw ?? "—")}</span>
          <span class="pill">Adj: ${escapeHtml(displayAdj(r.adjustment))}</span>
          <span class="pill">Net: ${escapeHtml(r.net ?? "—")}</span>
          <span class="pill">Payout: ${escapeHtml(dollars(r.payout))}</span>
        </div>
      `;
      winnerCards.appendChild(card);
    }
  }

  function renderTable(results) {
    if (!resultsTbody) return;
    resultsTbody.innerHTML = "";

    if (!results.length) {
      resultsTbody.innerHTML = `<tr><td colspan="7">No results entered.</td></tr>`;
      return;
    }

    const sorted = results.slice().sort((a, b) => {
      const pr = placeRank(a.place) - placeRank(b.place);
      if (pr !== 0) return pr;

      const an = toNumberOrNull(a.net);
      const bn = toNumberOrNull(b.net);
      if (an !== null && bn !== null && an !== bn) return an - bn;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    for (const r of sorted) {
      const exp = expectedNet(r);
      const net = toNumberOrNull(r.net);
      if (exp !== null && net !== null && exp !== net) {
        console.warn(`[Results] Net mismatch for ${r.name}: expected ${exp}, got ${net}`);
      }

      resultsTbody.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${escapeHtml(r.name ?? "")}</td>
          <td class="num">${escapeHtml(r.raw ?? "")}</td>
          <td class="num">${escapeHtml(r.handicap ?? "")}</td>
          <td class="num">${escapeHtml(r.adjustment ?? "")}</td>
          <td class="num">${escapeHtml(r.net ?? "")}</td>
          <td class="num">${escapeHtml(r.place ?? "")}</td>
          <td class="num">${escapeHtml(dollars(r.payout))}</td>
        </tr>
      `);
    }
  }

  async function renderSelectedWeek() {
    hideError();

    const meta = weeks.find(w => w.date === selectedDate);
    if (!meta) {
      showEmpty("No published results found.");
      enableDetailsButton(false);
      return;
    }

    renderHeader(meta);

    // Keep header visible; show loading message in panel
    setLoading(true, "Loading this week’s results…", { resetHeader: false, clearResults: true });

    let data;
    try {
      data = await loadWeek(meta.date);
    } catch (e) {
      console.error(e);
      setLoading(false);
      showError(`Couldn’t load results. (${e.message})`);
      enableDetailsButton(false);
      return;
    }

    setLoading(false);
    hideEmpty();

    const results = getResultsForHoles(data);
    renderWinners(results);
    renderTable(results);

    // Enable "View full results" only when there are rows
    enableDetailsButton(results.length > 0);
    setExpanded(false);
  }

  // ---------------- events ----------------
  function wireEvents() {
    segButtons.forEach(btn => {
      btn.addEventListener("click", async () => {
        if (isLoading) return;
        setSegmentActive(btn.dataset.holes);
        await renderSelectedWeek();
      });
    });

    weekSelect?.addEventListener("change", async () => {
      if (isLoading) return;
      selectedDate = weekSelect.value;
      await renderSelectedWeek();
    });

    toggleDetailsBtn?.addEventListener("click", () => {
      if (toggleDetailsBtn.disabled) return;

      const expanded = toggleDetailsBtn.getAttribute("aria-expanded") === "true";
      setExpanded(!expanded);

      // If we just expanded, scroll the panel into view nicely
      const nowExpanded = toggleDetailsBtn.getAttribute("aria-expanded") === "true";
      if (nowExpanded && detailsPanel) {
        detailsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // ---------------- init ----------------
  async function init() {
    try {
      if (!RESULTS_API || RESULTS_API.includes("PASTE_YOUR")) {
        showError("Results API URL is not set in js/results.js");
        return;
      }

      // Start loading
      setLoading(true, "Loading published weeks…", { resetHeader: true, clearResults: true });

      await loadPublishedWeeks();

      if (!weeks.length) {
        setLoading(false);
        showEmpty("No published results found.");
        return;
      }

      renderWeekDropdown();

      selectedDate = pickDefaultDate(weeks);
      if (selectedDate && weekSelect) weekSelect.value = selectedDate;

      setSegmentActive("18");
      wireEvents();

      await renderSelectedWeek();
    } catch (e) {
      console.error("Results init failed:", e);
      setLoading(false);
      showError(`Couldn’t load results. (${e.message})`);
    }
  }

  init();
})();
