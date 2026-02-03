(() => {
  const track = document.querySelector(".carousel-track");
  if (!track) return;

  const items = track.querySelectorAll(".carousel-item");
  if (items.length < 2) return;

  const intervalMs = 4000; // 4 seconds
  let autoTimer = null;
  let index = 0;

  function getItemWidth() {
    return items[0].getBoundingClientRect().width +
           parseFloat(getComputedStyle(track).columnGap || 16);
  }

  function scrollToIndex(i) {
    const width = getItemWidth();
    track.scrollTo({
      left: i * width,
      behavior: "smooth"
    });
  }

  function next() {
    index = (index + 1) % items.length;
    scrollToIndex(index);
  }

  function prev() {
    index = (index - 1 + items.length) % items.length;
    scrollToIndex(index);
  }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(next, intervalMs);
  }

  function stopAuto() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
  }

  /* Pause on interaction */
  track.addEventListener("mouseenter", stopAuto);
  track.addEventListener("mouseleave", startAuto);
  track.addEventListener("focusin", stopAuto);
  track.addEventListener("focusout", startAuto);
  track.addEventListener("wheel", stopAuto, { passive: true });
  track.addEventListener("touchstart", stopAuto, { passive: true });

  /* Buttons */
  document.addEventListener("click", e => {
    const btn = e.target.closest("[data-carousel]");
    if (!btn) return;

    stopAuto();

    if (btn.dataset.carousel === "next") next();
    if (btn.dataset.carousel === "prev") prev();

    startAuto();
  });

  /* Start */
  startAuto();
})();
