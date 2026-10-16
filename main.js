// Movimiento de la página: títulos por palabra, apariciones al bajar,
// barra que se esconde y vuelve, indicador de sección y menú del teléfono.

window.ffReady = true;

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// 1. Partir cada título en palabras con máscara
document.querySelectorAll("[data-words]").forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute("aria-label", el.textContent.trim());
  el.innerHTML = words
    .map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
    .join(" ");
});

// 2. Escalonado dentro de cada grupo (60 ms entre hermanos)
const stagger = (selector) => {
  const groups = new Map();
  document.querySelectorAll(selector).forEach((el) => {
    const siblings = groups.get(el.parentElement) ?? [];
    el.style.setProperty("--delay", `${siblings.length * 0.06 + 0.1}s`);
    siblings.push(el);
    groups.set(el.parentElement, siblings);
  });
};
stagger("[data-reveal]");
stagger("[data-row]");

// 3. Disparar una sola vez al entrar en pantalla
// Lo de la portada no espera al scroll: entra cuando termina la entrada del logo
const all = [...document.querySelectorAll("[data-words], [data-reveal], [data-draw], [data-unveil], [data-row]")];
const heroItems = all.filter((el) => el.closest(".hero"));
const targets = all.filter((el) => !el.closest(".hero"));
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
  );
  targets.forEach((el) => io.observe(el));
} else {
  targets.forEach((el) => el.classList.add("is-in"));
}

// 4. Barra: transparente arriba, sólida al bajar, se esconde al bajar y vuelve al subir
const bar = document.querySelector("[data-bar]");
const heroLogo = document.querySelector(".hero__logo");
let lastY = window.scrollY;
let ticking = false;
const updateBar = () => {
  const y = window.scrollY;
  const goingDown = y > lastY;
  bar.classList.toggle("is-solid", y > 8);
  bar.classList.toggle("is-past", heroLogo.getBoundingClientRect().bottom < 0);
  if (menuOpen || y < window.innerHeight * 0.6) bar.classList.remove("is-hidden");
  else if (Math.abs(y - lastY) > 4) bar.classList.toggle("is-hidden", goingDown);
  lastY = y;
  ticking = false;
};
window.addEventListener("scroll", () => {
  if (!ticking) { requestAnimationFrame(updateBar); ticking = true; }
}, { passive: true });

// 5. Indicador de sección: la línea naranja viaja al enlace activo
const navLinks = [...document.querySelectorAll("[data-nav]")];
const indicator = document.querySelector("[data-indicator]");
const moveIndicator = (link) => {
  navLinks.forEach((a) => a.removeAttribute("aria-current"));
  if (!link) { indicator.style.opacity = "0"; return; }
  link.setAttribute("aria-current", "true");
  const navBox = indicator.parentElement.getBoundingClientRect();
  const box = link.getBoundingClientRect();
  // letter-spacing deja un espacio al final de la palabra; se descuenta
  const trail = parseFloat(getComputedStyle(link).letterSpacing) || 0;
  indicator.style.transform = `translateX(${box.left - navBox.left}px) scaleX(${box.width - trail})`;
  indicator.style.opacity = "1";
};
const sections = navLinks.map((a) => document.querySelector(a.getAttribute("href")));
if ("IntersectionObserver" in window) {
  const visible = new Map();
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => visible.set(e.target, e.isIntersecting));
      const current = sections.find((s) => visible.get(s));
      moveIndicator(current ? navLinks[sections.indexOf(current)] : null);
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => spy.observe(s));
}
window.addEventListener("resize", () => moveIndicator(navLinks.find((a) => a.hasAttribute("aria-current"))));

// 6. Menú del teléfono
const menuBtn = document.querySelector("[data-menu-btn]");
const menu = document.querySelector("[data-menu]");
let menuOpen = false;
const setMenu = (open) => {
  menuOpen = open;
  menuBtn.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("is-locked", open);
  bar.classList.toggle("is-menu", open);
  // Con el menú abierto, el resto de la página no recibe foco ni clics
  document.querySelectorAll("main, footer, .skip").forEach((el) => { el.inert = open; });
  if (open) {
    menu.hidden = false;
    bar.classList.remove("is-hidden");
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("is-open")));
    menu.querySelector("a").focus({ preventScroll: true });
  } else {
    menu.classList.remove("is-open");
    const done = () => { if (!menuOpen) menu.hidden = true; };
    reduce ? done() : menu.addEventListener("transitionend", done, { once: true });
  }
};
menuBtn.addEventListener("click", () => setMenu(!menuOpen));
menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => {
  if (!menuOpen) return;
  if (e.key === "Escape") { setMenu(false); menuBtn.focus(); return; }
  // Tab da la vuelta entre el botón y los enlaces del menú
  if (e.key === "Tab") {
    const items = [menuBtn, ...menu.querySelectorAll("a")];
    const i = items.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  }
});

updateBar();

// 7. Entrada: el logo solo, al centro de la pantalla; luego viaja a su
// lugar y entra la información. Cualquier gesto la adelanta al final.
const root = document.documentElement;
const logo = document.querySelector(".hero__logo");
const logoImg = logo.querySelector("img");
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

const revealHero = () => {
  root.classList.remove("intro");
  heroItems.forEach((el, i) => {
    el.style.setProperty("--delay", `${0.25 + i * 0.09}s`);
    el.classList.add("is-in");
  });
};

const playIntro = () => {
  const r = logo.getBoundingClientRect();
  const size = Math.min(window.innerWidth * 0.82, window.innerHeight * 0.78, 620);
  const scale = size / r.width;
  const dx = window.innerWidth / 2 - (r.left + r.width / 2);
  const dy = window.innerHeight / 2 - (r.top + r.height / 2);
  const centered = `translate(${dx}px, ${dy}px) scale(${scale})`;

  logoImg.style.animation = "none";
  // Tiempo 1: el logo se abre en círculo desde el zorro, al centro.
  // El círculo lo hace un velo gris encima: el logo queda pintado completo desde
  // el primer cuadro y Google lo cuenta como lo principal de la página (LCP).
  const open = logoImg.animate(
    [
      { opacity: 0.01, transform: "scale(.94)" },
      { opacity: 1, transform: "scale(1)" },
    ],
    { duration: 2000, easing: EASE_OUT, fill: "both" }
  );
  let veilAnim = null;
  if (window.CSS && CSS.registerProperty) {
    try { CSS.registerProperty({ name: "--hole", syntax: "<length>", inherits: false, initialValue: "0px" }); } catch (_) {}
    const veil = document.createElement("span");
    veil.className = "logo-veil";
    veil.setAttribute("aria-hidden", "true");
    logo.append(veil);
    const far = Math.hypot(r.width * 0.55, r.height * 0.6) + 2;
    veilAnim = veil.animate([{ "--hole": "0px" }, { "--hole": `${far}px` }], { duration: 2000, easing: EASE_OUT, fill: "both" });
    veilAnim.finished.then(() => veil.remove()).catch(() => veil.remove());
  }
  // Tiempo 2: viaja a su lugar en la portada
  const travel = logo.animate(
    [{ transform: centered }, { transform: "none" }],
    { duration: 1400, delay: 2400, easing: EASE_IN_OUT, fill: "both" }
  );
  // Tiempo 3: entra la información, un poco antes de que el logo aterrice
  const textTimer = setTimeout(revealHero, 3300);

  const finish = () => {
    open.finish();
    veilAnim?.finish();
    travel.finish();
    clearTimeout(textTimer);
    revealHero();
    removeSkips();
  };
  const skips = ["wheel", "touchstart", "keydown", "pointerdown"];
  const removeSkips = () => skips.forEach((t) => window.removeEventListener(t, finish));
  skips.forEach((t) => window.addEventListener(t, finish, { once: true, passive: true }));
  travel.finished.then(() => { travel.cancel(); removeSkips(); }).catch(() => {});
};

if (root.classList.contains("intro") && window.scrollY < 40) {
  playIntro();
} else {
  revealHero();
}
