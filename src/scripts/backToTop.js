let activeButton = null;
let cleanup = () => {};

function initBackToTop() {
  const root = document.documentElement;
  const container = document.querySelector("#btt-btn-container");
  const button = document.querySelector("[data-button='back-to-top']");
  const indicator = document.querySelector("#progress-indicator");
  if (button === activeButton) return;
  cleanup();
  if (!root || !container || !button || !indicator) return;

  activeButton = button;
  let active = true;
  let ticking = false;
  let lastVisible = null;

  function handleScroll() {
    const total = root.scrollHeight - root.clientHeight;
    const ratio = total > 0 ? root.scrollTop / total : 0;
    const percent = Math.floor(ratio * 100);
    indicator.style.setProperty(
      "background-image",
      `conic-gradient(var(--accent), var(--accent) ${percent}%, transparent ${percent}%)`
    );
    const visible = ratio > 0.3;
    if (visible !== lastVisible) {
      container.classList.toggle("opacity-100", visible);
      container.classList.toggle("translate-y-0", visible);
      container.classList.toggle("opacity-0", !visible);
      container.classList.toggle("translate-y-14", !visible);
      lastVisible = visible;
    }
  }

  function onClick() {
    document.body.scrollTop = 0;
    root.scrollTop = 0;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      if (active) handleScroll();
      ticking = false;
    });
  }

  button.addEventListener("click", onClick);
  document.addEventListener("scroll", onScroll);
  handleScroll();
  cleanup = () => {
    active = false;
    button.removeEventListener("click", onClick);
    document.removeEventListener("scroll", onScroll);
    activeButton = null;
    cleanup = () => {};
  };
}

initBackToTop();
document.addEventListener("astro:page-load", initBackToTop);
document.addEventListener("astro:before-swap", () => cleanup());
