(() => {
  const listEl = document.getElementById("announcements-list");
  const emptyEl = document.getElementById("announcements-empty");
  const errorEl = document.getElementById("announcements-error");

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

    const h3 = document.createElement("h3");
    h3.textContent = a.title || "Announcement";
    h3.style.marginTop = "0";

    const p = document.createElement("p");
    p.textContent = a.message || "";

    article.appendChild(h3);
    if (a.message) article.appendChild(p);
    return article;
  }

  async function run(){
    if (!listEl) return;

    try{
      const res = await fetch("/data/announcements.json", { cache: "no-store" });
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
      [...pinned, ...normal].forEach(a => listEl.appendChild(buildCard(a)));

      if (emptyEl) emptyEl.hidden = active.length !== 0;
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
