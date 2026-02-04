(() => {
  // ---------- Elements ----------
  const weekSelect = document.getElementById("weekSelect");
  const weekHeading = document.getElementById("weekHeading");
  const weekSubhead = document.getElementById("weekSubhead");
  const winnerCards = document.getElementById("winnerCards");
  const resultsTbody = document.getElementById("resultsTbody");
  const toggleDetailsBtn = document.getElementById("toggleDetails");
  const detailsPanel = document.getElementById("detailsPanel");
  const fullSheetLink = document.getElementById("fullSheetLink");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");

  const segButtons = Array.from(document.querySelectorAll(".seg-btn"));

  // Optional: header nav toggle (only if your header uses these)
  const navToggle = document.querySelector(".nav-toggle");
  const navMenu = document.getElementById("navMenu");

  // ---------- State ----------
  let selectedHoles = "18";
  let selectedDate = null;

  let publishedWeeksIndex = [];   // from results/index.json (published only)
  let scheduleByDate = new Map(); // date -> schedule record
  let loadedWeekResults = null;   // current week file contents

  // ---------- Helpers ----------
  function fmtDate(iso) {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function safeText(s) {
    return String(s ?? "");
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (ch) => (
      ch === "&" ? "&amp;" :
      ch === "<" ? "&lt;" :
      ch === ">" ? "&gt;" :
      ch === "\"" ? "&quot;" : "&#39;"
    ));
  }

  function dollars(n) {
    if (n === null || n === undefined || n === "") return "—";
    const val = Number(n);
    if (!Number.isFinite(val)) return escapeHtml(String(n));
    return `$${val.toFixed(2)}`;
  }


  function toNumberOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function adjOrZero(v) {
    const n = toNumberOrNull(v);
    return n === null ? 0 : n;
  }

  // net = raw - handicap - adjustment (adjustment defaults to 0 if blank)
  function expectedNet(row) {
    const raw = toNumberOrNull(row.raw);
    const hcp = toNumberOrNull(row.handicap);
    if (raw === null || hcp === null) return null;
    return raw - hcp - adjOrZero(row.adjustment);
  }

  function placeRank(place) {
    // Numeric rank for sorting; "T1" -> 1
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
    const s = String(place ?? "").trim().toUpperCase();
    const tied = s.startsWith("T");
    return tied ? `T-${r}${ordinalSuffix(r)} Place` : `${r}${ordinalSuffix(r)} Place`;
  }

  function displayAdj(v) {
    return (v === null || v === undefined || v === "") ? "—" : String(v);
  }

  function setSegmentActive(holes) {
    selectedHoles = holes;
    segButtons.forEach(btn => {
      const isActive = btn.dataset.holes === holes;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function setExpanded(expanded) {
    toggleDetailsBtn.setAttribute("aria-expanded", String(expanded));
    detailsPanel.classList.toggle("is-collapsed", !expanded);
    toggleDetailsBtn.textContent = expanded ? "Hide full results" : "View full results";
  }

  function hideStates() {
    emptyState?.classList.add("is-hidden");
    errorState?.classList.add("is-hidden");
  }

  function showEmpty(message) {
    if (!emptyState) return;
    emptyState.textContent = message;
    emptyState.classList.remove("is-hidden");
    errorState?.classList.add("is-hidden");
  }

  function showError(message) {
    if (!errorState) return;
    errorState.textContent = message || "Couldn’t load results. Please try again later.";
    errorState.classList.remove("is-hidden");
    emptyState?.classList.add("is-hidden");
  }

  function pickDefaultDate(weeks) {
    const today = getTodayISO();
    const onOrBefore = weeks.find(w => w.date <= today);
    return (onOrBefore || weeks[0] || null)?.date ?? null;
  }

  // ---------- Data Loading (with safe fallback paths) ----------
  async function fetchJson(pathOrPaths) {
    const paths = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths];
    let lastErr = null;

    for (const path of paths) {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
        return await res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("fetchJson failed");
  }

  async function loadSchedule() {
    const schedule = await fetchJson([
      "data/results/schedule.json",
      "../data/results/schedule.json"
    ]);
    const weeks = Array.isArray(schedule.weeks) ? schedule.weeks : [];
    scheduleByDate = new Map(weeks.map(w => [w.date, w]));
  }

  async function loadResultsIndex() {
    const idx = await fetchJson([
      "data/results/index.json",
      "../data/results/index.json"
    ]);
    const weeks = Array.isArray(idx.weeks) ? idx.weeks : [];
    publishedWeeksIndex = weeks
      .filter(w => w && w.published)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  }

  async function loadWeekFile(fileName) {
    return fetchJson([
      `data/results/${fileName}`,
      `../data/results/${fileName}`
    ]);
  }

  // ---------- Rendering ----------
  function renderWeekDropdown() {
    if (!weekSelect) return;
    weekSelect.innerHTML = "";

    for (const w of publishedWeeksIndex) {
      const sched = scheduleByDate.get(w.date);
      const game = sched?.gamePlanned ? ` — ${sched.gamePlanned}` : "";

      const opt = document.createElement("option");
      opt.value = w.date;
      opt.textContent = `${fmtDate(w.date)}${game}`;
      weekSelect.appendChild(opt);
    }
  }

  function findIndexWeek(date) {
    return publishedWeeksIndex.find(w => w.date === date) || null;
  }

  function getResultsForHoles(weekResults, holes) {
    if (!weekResults) return [];
    return holes === "9" ? (weekResults.results9 || []) : (weekResults.results18 || []);
  }

  function renderHeader(indexWeek) {
    const sched = scheduleByDate.get(indexWeek.date);

    const game = (sched?.gamePlanned ?? "").trim() || "—";
    const captain = (sched?.gameCaptain ?? "").trim() || "—";
    const notesRaw = (sched?.notes ?? "").trim();

    if (weekHeading) weekHeading.textContent = fmtDate(indexWeek.date);

    const lines = [
      `Game: ${game}`,
      `Game Captain: ${captain}`
    ];
    if (notesRaw) lines.push(`Notes: ${notesRaw}`);

    if (weekSubhead) {
      weekSubhead.innerHTML = lines.map(l => `<div>${escapeHtml(l)}</div>`).join("");
    }

    const url = indexWeek.fullSheetUrl || "";
    if (fullSheetLink) {
      if (url) {
        fullSheetLink.href = url;
        fullSheetLink.classList.remove("is-hidden");
      } else {
        fullSheetLink.classList.add("is-hidden");
      }
    }
  }

  function renderWinners(results) {
    if (!winnerCards) return;
    winnerCards.innerHTML = "";

    // Show ALL entries in places 1–3, including ties
    const top = results
      .slice()
      .filter(r => {
        const rank = placeRank(r.place);
        return rank >= 1 && rank <= 3;
      })
      .sort((a, b) => placeRank(a.place) - placeRank(b.place));

    if (top.length === 0) {
      const div = document.createElement("div");
      div.className = "empty-state";
      div.textContent = "No placements entered yet for this week.";
      winnerCards.appendChild(div);
      return;
    }

    for (const row of top) {
      const card = document.createElement("div");
      card.className = "winner-card";

      const rank = document.createElement("div");
      rank.className = "winner-rank";
      rank.textContent = placeLabel(row.place);

      const name = document.createElement("div");
      name.className = "winner-name";
      name.textContent = safeText(row.name);

      const meta = document.createElement("div");
      meta.className = "winner-meta";

      meta.innerHTML = `
        <span class="pill">HCP: ${escapeHtml(safeText(row.handicap ?? "—"))}</span>
        <span class="pill">Raw: ${escapeHtml(safeText(row.raw ?? "—"))}</span>
        <span class="pill">Adj: ${escapeHtml(displayAdj(row.adjustment))}</span>
        <span class="pill">Net: ${escapeHtml(safeText(row.net ?? "—"))}</span>
        <span class="pill">Payout: ${escapeHtml(dollars(row.payout))}</span>
      `;


      card.appendChild(rank);
      card.appendChild(name);
      card.appendChild(meta);
      winnerCards.appendChild(card);
    }
  }

  function renderTable(results) {
    if (!resultsTbody) return;
    resultsTbody.innerHTML = "";

    if (!results || results.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7">No results entered.</td>`;
      resultsTbody.appendChild(tr);
      return;
    }

    // Sort by place rank, then net, then name
    const sorted = results.slice().sort((a, b) => {
      const pr = placeRank(a.place) - placeRank(b.place);
      if (pr !== 0) return pr;

      const an = toNumberOrNull(a.net);
      const bn = toNumberOrNull(b.net);
      if (an !== null && bn !== null && an !== bn) return an - bn;

      return safeText(a.name).localeCompare(safeText(b.name));
    });

    // Sanity check net math (does not affect display)
    for (const r of sorted) {
      const exp = expectedNet(r);
      const net = toNumberOrNull(r.net);
      if (exp !== null && net !== null && exp !== net) {
        console.warn(`[Results] Net mismatch for ${r.name}: net=${net}, expected=${exp}`);
      }
    }

    for (const r of sorted) {
      const adjCell = (r.adjustment === "" || r.adjustment === null || r.adjustment === undefined)
        ? ""
        : safeText(r.adjustment);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(safeText(r.name))}</td>
        <td class="num">${escapeHtml(safeText(r.handicap ?? ""))}</td>
        <td class="num">${escapeHtml(safeText(r.raw ?? ""))}</td>
        <td class="num">${escapeHtml(adjCell)}</td>
        <td class="num">${escapeHtml(safeText(r.net ?? ""))}</td>
        <td class="num">${escapeHtml(safeText(r.place ?? ""))}</td>
        <td class="num">${escapeHtml(dollars(r.payout))}</td>
      `;

      resultsTbody.appendChild(tr);
    }
  }

  async function renderSelectedWeek() {
    hideStates();

    const indexWeek = findIndexWeek(selectedDate);
    if (!indexWeek) {
      showEmpty("No published results found.");
      if (weekHeading) weekHeading.textContent = "—";
      if (weekSubhead) weekSubhead.innerHTML = "";
      if (winnerCards) winnerCards.innerHTML = "";
      if (resultsTbody) resultsTbody.innerHTML = "";
      return;
    }

    renderHeader(indexWeek);

    try {
      loadedWeekResults = await loadWeekFile(indexWeek.file);
    } catch (e) {
      console.error(e);
      showError(`Couldn’t load results: ${e.message}`);
      if (winnerCards) winnerCards.innerHTML = "";
      if (resultsTbody) resultsTbody.innerHTML = "";
      return;
    }

    const results = getResultsForHoles(loadedWeekResults, selectedHoles);
    renderWinners(results);
    renderTable(results);

    setExpanded(false);
  }

  // ---------- Events ----------
  function wireEvents() {
    segButtons.forEach(btn => {
      btn.addEventListener("click", async () => {
        setSegmentActive(btn.dataset.holes);
        await renderSelectedWeek();
      });
    });

    if (weekSelect) {
      weekSelect.addEventListener("change", async () => {
        selectedDate = weekSelect.value;
        await renderSelectedWeek();
      });
    }

    if (toggleDetailsBtn) {
      toggleDetailsBtn.addEventListener("click", () => {
        const expanded = toggleDetailsBtn.getAttribute("aria-expanded") === "true";
        setExpanded(!expanded);
      });
    }

    // Minimal nav toggle (only if your header uses these ids/classes)
    if (navToggle && navMenu) {
      navToggle.addEventListener("click", () => {
        const expanded = navToggle.getAttribute("aria-expanded") === "true";
        navToggle.setAttribute("aria-expanded", String(!expanded));
        navMenu.classList.toggle("is-open", !expanded);
      });
    }
  }

  // ---------- Init ----------
  async function init() {
    try {
      await Promise.all([loadSchedule(), loadResultsIndex()]);

      if (!publishedWeeksIndex.length) {
        showEmpty("No published results found.");
        return;
      }

      renderWeekDropdown();

      selectedDate = pickDefaultDate(publishedWeeksIndex);
      if (selectedDate && weekSelect) weekSelect.value = selectedDate;

      setSegmentActive("18");
      wireEvents();
      await renderSelectedWeek();
    } catch (e) {
      console.error("Results init failed:", e);
      showError(`Couldn’t load results: ${e.message}`);
    }
  }

  init();
})();
