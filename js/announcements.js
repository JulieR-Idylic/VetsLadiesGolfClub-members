(() => {
  const listEl = document.getElementById("announcements-list");
  const emptyEl = document.getElementById("announcements-empty");
  const errorEl = document.getElementById("announcements-error");

  const prevBtn = document.querySelector('[data-announce="prev"]');
  const nextBtn = document.querySelector('[data-announce="next"]');

  function parseISODate(iso){
    if (!iso || typeof iso !== "string") return null;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function todayAtMidnight(){
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function buildCard(a){
    const article = document.createElement("article");
    article.className = "card";

    if (a.pinned) article.classList.add("pinned");

    if (a.pinned){
      const badge = document.createElement("div");
      badge.className = "pin-badge";
      badge.textContent = "Pinned";
      article.appendChild(badge);
    }

    const h3 = document.createElement("h3");
    h3.textContent = a.title || "Announcement";
    h3.style.marginTop = "0";

    const p = document.createElement("p");
    p.textContent = a.message || "";

    article.appendChild(h3);
    if (a.message) article.appendChild(p);
    return article;
  }

  function scrollByOneCard(direction){
    if (!listEl) return;
    const firstCard = listEl.querySelector(".card");
    if (!firstCard) return;

    const gap = parseFloat(getComputedStyle(listEl).gap || 16);
    const step = firstCard.getBoundingClientRect().width + gap;

    listEl.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  function updateArrowVisibility(){
    if (!prevBtn || !nextBtn || !listEl) return;
    // If content doesn’t overflow, hide arrows
    const canScroll = listEl.scrollWidth > listEl.clientWidth + 2;
    prevBtn.style.display = canScroll ? "" : "none";
    nextBtn.style.display = canScroll ? "" : "none";
  }

  async function run(){
    if (!listEl) return;

    try{
      const res = await fetch("data/announcements.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data.announcements) ? data.announcements : [];

      const today = todayAtMidnight();
      const active = items.filter(a => {
        const exp = parseISODate(a.expiresOn);
        return !exp || today <= exp;
      });

      const pinned = active.filter(a => !!a.pinned);
      const normal = active.filter(a => !a.pinned);

      listEl.innerHTML = "";
      if (errorEl) errorEl.hidden = true;

      [...pinned, ...normal].forEach(a => listEl.appendChild(buildCard(a)));

      if (emptyEl) emptyEl.hidden = active.length !== 0;

      // Hook up arrows
      if (prevBtn) prevBtn.onclick = () => scrollByOneCard(-1);
      if (nextBtn) nextBtn.onclick = () => scrollByOneCard(1);

      // Update arrow visibility after render
      requestAnimationFrame(updateArrowVisibility);
      window.addEventListener("resize", updateArrowVisibility);
    } catch(e){
      console.error(e);
      if (errorEl){
        errorEl.hidden = false;
        errorEl.textContent = "Sorry — announcements could not be loaded.";
      }
    }
  }

  run();
})();
