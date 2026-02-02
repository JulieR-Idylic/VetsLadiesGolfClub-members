(() => {
  const track = document.querySelector(".carousel-track");
  if (!track) return;

  const prev = document.querySelector('[data-carousel="prev"]');
  const next = document.querySelector('[data-carousel="next"]');

  function scrollByCard(dir){
    const card = track.querySelector(".carousel-item");
    const amount = card ? card.getBoundingClientRect().width + 16 : 300;
    track.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  prev?.addEventListener("click", () => scrollByCard(-1));
  next?.addEventListener("click", () => scrollByCard(1));
})();
