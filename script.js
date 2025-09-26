// -------------------------------
// Storleksparametrar
// -------------------------------
const BREAKPOINT_PX = 900;          // under detta fullbredd i landscape
const DESKTOP_VW_FRACTION = 0.5;    // 50% av viewportbredd i landscape desktop
const HARD_MAX_W = 1200;            // hård maxbredd i px

// -------------------------------
async function loadSlides() {
  const res = await fetch("assets/images/manifest.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Kunde inte läsa assets/images/manifest.json");
  const data = await res.json();
  const list = Array.isArray(data.images) ? data.images : [];

  const wrap = document.querySelector(".slideshow");
  list.forEach((src, idx) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Bild ${idx + 1}`;
    img.className = "slide";
    if (idx === 0) img.classList.add("active");
    img.addEventListener("load", () => { if (idx === 0) fitActive(); });
    wrap.appendChild(img);
  });

  return Array.from(document.querySelectorAll(".slideshow .slide"));
}

let slides = [];
let i = 0;

// px-värde för marginal (hero padding)
function getFramePx() {
  const hero = document.querySelector(".hero");
  if (!hero) return 0;
  const cs = getComputedStyle(hero);
  return parseFloat(cs.paddingLeft) || 0;
}

// iOS: använd synliga viewportens höjd när den finns
function getViewportHeight() {
  return (window.visualViewport && window.visualViewport.height)
    ? window.visualViewport.height
    : window.innerHeight;
}

// Sätt boxens storlek så att den matchar aktiv bild och layoutläge
function fitActive() {
  const heroFrame = document.querySelector(".hero-frame");
  const slideshow = document.querySelector(".slideshow");
  if (!heroFrame || !slideshow || !slides.length) return;

  const active = slides[i];
  if (!active.naturalWidth || !active.naturalHeight) return;

  const pad = getFramePx();
  const vw = window.innerWidth;
  const vh = getViewportHeight();
  const isPortrait = vh > vw;

  // ----- maxbredd / maxhöjd beroende på orientation -----
  let maxW, maxH;

  if (isPortrait) {
    // PORTRAIT: bildspelet i nedre halvan (50% av synlig viewport)
    maxW = vw - pad * 2;                               // full bredd minus marginaler
    maxH = Math.max(1, (vh / 2) - pad * 1.5);          // halva höjden – lite luft
  } else {
    // LANDSCAPE: desktop = procent av viewport, smalt = fullbredd
    const desktopMaxW = vw * DESKTOP_VW_FRACTION;
    const fullWidthW  = vw - pad * 2;
    maxW = Math.min(
      (vw <= BREAKPOINT_PX ? fullWidthW : desktopMaxW),
      fullWidthW,
      HARD_MAX_W
    );
    maxH = Math.min(vh - pad * 2, vh * 0.85);
  }

  // ----- skala efter bildens proportioner -----
  const iw = active.naturalWidth;
  const ih = active.naturalHeight;
  const scale = Math.min(maxW / iw, maxH / ih);
  const targetW = Math.max(1, Math.floor(iw * scale));
  const targetH = Math.max(1, Math.floor(ih * scale));

  // Sätt exakt storlek på box och slideshow
  heroFrame.style.width = `${targetW}px`;
  heroFrame.style.height = `${targetH}px`;
  slideshow.style.width = `${targetW}px`;
  slideshow.style.height = `${targetH}px`;
}

// Byt bild (0.2 s) och refita
function showNext() {
  if (!slides.length) return;
  slides[i].classList.remove("active");
  i = (i + 1) % slides.length;
  slides[i].classList.add("active");
  if (slides[i].complete) fitActive();
  else slides[i].addEventListener("load", fitActive, { once: true });
}

// Init slideshow
loadSlides()
  .then(loaded => {
    slides = loaded;
    if (slides.length) {
      if (slides[0].complete) fitActive();
      setInterval(showNext, 200);
      window.addEventListener("resize", fitActive);
      window.addEventListener("orientationchange", fitActive);
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", fitActive);
        window.visualViewport.addEventListener("scroll", fitActive);
      }
    }
  })
  .catch(console.error);

// -------------------------------
// Markdown → DOM
// -------------------------------
function parseSimpleMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let current = null;
  let paraBuf = [];
  let listBuf = null;

  const flushPara = () => {
    if (!paraBuf.length) return;
    const text = paraBuf.join(" ").trim();
    if (!current) current = { heading: "", blocks: [] };
    current.blocks.push({ type: "p", text });
    paraBuf = [];
  };
  const flushList = () => {
    if (!listBuf) return;
    if (!current) current = { heading: "", blocks: [] };
    current.blocks.push({ type: listBuf.type, items: listBuf.items });
    listBuf = null;
  };
  const flushSection = () => {
    flushPara(); flushList();
    if (current && (current.heading || current.blocks.length)) sections.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) { flushSection(); current = { heading: h2[1].trim(), blocks: [] }; continue; }

    const ul = line.match(/^-\s+(.*)$/);
    if (ul) { flushPara(); if (!listBuf || listBuf.type!=="ul"){flushList(); listBuf={type:"ul",items:[]};} listBuf.items.push(ul[1]); continue; }

    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) { flushPara(); if (!listBuf || listBuf.type!=="ol"){flushList(); listBuf={type:"ol",items:[]};} listBuf.items.push(ol[1]); continue; }

    if (line === "") { flushPara(); flushList(); continue; }
    paraBuf.push(line);
  }
  flushSection();

  const frag = document.createDocumentFragment();
  sections.forEach(sec => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "section";
    if (sec.heading) {
      const h = document.createElement("h2");
      h.textContent = sec.heading;
      sectionEl.appendChild(h);
    }
    sec.blocks.forEach(b => {
      if (b.type === "p") {
        const p = document.createElement("p");
        p.textContent = b.text;
        sectionEl.appendChild(p);
      } else if (b.type === "ul" || b.type === "ol") {
        const list = document.createElement(b.type);
        list.style.margin = "0.5rem 0 1.5rem 1.5rem";
        b.items.forEach(itemText => {
          const li = document.createElement("li");
          li.textContent = itemText;
          list.appendChild(li);
        });
        sectionEl.appendChild(list);
      }
    });
    frag.appendChild(sectionEl);
  });

  return frag;
}

// Ladda content.md och lägg in kolumnbrytning efter “Services”
async function loadContent() {
  try {
    const res = await fetch("content.md", { cache: "no-store" });
    if (!res.ok) throw new Error("Kunde inte läsa content.md");
    const md = await res.text();
    const frag = parseSimpleMarkdown(md);

    const container = document.getElementById("content");
    container.innerHTML = "";
    container.appendChild(frag);

    // → Tvinga kolumnbrytning efter sektionen "Services"
    const sections = container.querySelectorAll(".section");
    sections.forEach(sec => {
      const h = sec.querySelector("h2");
      if (h && /^services$/i.test(h.textContent.trim())) {
        sec.classList.add("break-after");
      }
    });

  } catch (e) {
    console.error(e);
  }
}
loadContent();

// År i footer
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
