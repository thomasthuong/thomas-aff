/* ===== Beauty Universe — tự đọc data.json, nhóm theo thương hiệu ===== */
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

  const PALETTE = [
    ["#ff4fd8", "#8b5cff"], ["#3ee8ff", "#5b6cff"], ["#ffb36b", "#ff4f8b"], ["#7cff9b", "#16b5ff"],
    ["#c98bff", "#ff6bd5"], ["#5bf0d0", "#8b5cff"], ["#ffd84f", "#ff6b6b"], ["#6bb8ff", "#b44fff"],
  ];
  const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h ^ (h >>> 15)) >>> 0; };
  const colorOf = (brand) => PALETTE[hash(brand) % PALETTE.length];
  const initial = (s) => (s.trim()[0] || "✦").toUpperCase();

  let data = { profile: {}, products: [], brandOrder: [] };
  let active = "all";
  let plat = "all";

  /* ---------- Starfield ---------- */
  const cv = $("#space"), ctx = cv.getContext("2d");
  let stars = [], W, H, mx = 0, my = 0;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function resize() {
    const d = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    const n = Math.round((W * H) / 3200);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, z: Math.random() * 1 + 0.2,
      t: Math.random() * Math.PI * 2, c: Math.random() < 0.15 ? (Math.random() < 0.5 ? "255,120,230" : "120,230,255") : "255,255,255",
    }));
  }
  let shoot = null;
  function frame(time) {
    ctx.clearRect(0, 0, W, H);
    const sy = scrollY * 0.15;
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(time / 700 + s.t);
      const x = (s.x + mx * s.z * 14) % W, y = (((s.y - sy * s.z + my * s.z * 14) % H) + H) % H;
      ctx.fillStyle = `rgba(${s.c},${tw * s.z * 0.9})`;
      ctx.beginPath(); ctx.arc(x, y, s.z * 1.3, 0, 6.283); ctx.fill();
    }
    if (!shoot && Math.random() < 0.004) shoot = { x: Math.random() * W, y: Math.random() * H * 0.5, l: 0 };
    if (shoot) {
      shoot.l += 14;
      const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.l, shoot.y - shoot.l * 0.4);
      g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(139,92,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(shoot.x + shoot.l * 0.6, shoot.y + shoot.l * 0.24); ctx.lineTo(shoot.x - shoot.l * 0.4, shoot.y - shoot.l * 0.16); ctx.stroke();
      if (shoot.l > 260) shoot = null;
    }
    if (!still) requestAnimationFrame(frame);
  }
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  resize(); requestAnimationFrame(frame);

  /* ---------- Render ---------- */
  const thumb = (p) => {
    const [a, b] = colorOf(p.brand || "Khác");
    const ph = `<div class="ph" style="background:radial-gradient(circle at 30% 25%,${a},${b} 70%,#14062e)">${esc(initial(p.brand || p.name || ""))}</div>`;
    return p.image
      ? `${ph}<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
      : ph;
  };
  // Lấy link theo nền tảng (hỗ trợ cả dữ liệu cũ chỉ có "url")
  const isTT = (u = "") => /tiktok/i.test(u);
  const linksOf = (p) => ({
    shopee: p.shopee || (p.url && !isTT(p.url) ? p.url : ""),
    tiktok: p.tiktok || (p.url && isTT(p.url) ? p.url : ""),
  });
  const ICON_SP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>';
  const ICON_TT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/></svg>';
  const card = (p, i) => {
    const L = linksOf(p), both = L.shopee && L.tiktok;
    const btn = (k) => {
      const u = L[k]; if (!u) return "";
      const label = k === "shopee" ? (both ? "Shopee" : "Mua trên Shopee") : (both ? "TikTok" : "Mua trên TikTok");
      return `<a class="buy ${k}" href="${esc(u)}" target="_blank" rel="noopener sponsored">${k === "shopee" ? ICON_SP : ICON_TT}${label}</a>`;
    };
    const main = L.shopee || L.tiktok || "#";
    return `
    <div class="card" style="animation-delay:${Math.min(i, 12) * 45}ms">
      <a class="thumb" href="${esc(main)}" target="_blank" rel="noopener sponsored">${thumb(p)}${p.hot ? '<span class="badge">🔥 HOT</span>' : ""}</a>
      <div class="body">
        <span class="brand">${esc(p.brand || "Khác")}</span>
        <a class="name" href="${esc(main)}" target="_blank" rel="noopener sponsored">${esc(p.name || "Sản phẩm")}</a>
        ${p.note ? `<span class="note">💬 ${esc(p.note)}</span>` : ""}
        ${p.price ? `<span class="price">${esc(p.price)}</span>` : ""}
        <div class="buys ${both ? "two" : ""}">${btn("shopee")}${btn("tiktok")}</div>
      </div>
    </div>`;
  };

  const groupHtml = (title, items, opts = {}) => {
    const [a, b] = colorOf(title);
    const planet = opts.icon
      ? `<div class="planet" style="background:linear-gradient(135deg,#ff4fd8,#8b5cff);--glow:rgba(255,79,216,.6)">${opts.icon}</div>`
      : `<div class="planet" style="background:radial-gradient(circle at 30% 25%,${a},${b});--glow:${a}88">${esc(initial(title))}</div>`;
    return `<div class="group" id="${opts.id || ""}">
      <div class="group-head">${planet}<h2>${esc(title)}</h2><span class="count">${items.length} món</span><span class="line"></span></div>
      <div class="grid">${items.map(card).join("")}</div></div>`;
  };

  function brandsSorted() {
    const map = new Map();
    for (const p of data.products) {
      const b = (p.brand || "Khác").trim();
      if (!map.has(b)) map.set(b, []);
      map.get(b).push(p);
    }
    const order = data.brandOrder || [];
    return [...map.entries()].sort(([a, x], [b, y]) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
      if (a === "Khác") return 1; if (b === "Khác") return -1;
      return y.length - x.length || a.localeCompare(b, "vi");
    }).map(([b, items]) => [b, items.sort((p, q) => (q.hot - p.hot) || (q.addedAt || 0) - (p.addedAt || 0))]);
  }

  function render() {
    const q = norm($("#q").value.trim());
    const match = (p) => (plat === "all" || linksOf(p)[plat]) && (!q || norm(`${p.name} ${p.brand} ${p.note}`).includes(q));
    const groups = brandsSorted();

    const cnt = (k) => data.products.filter((p) => linksOf(p)[k]).length;
    $("#plat").innerHTML = [["all", "Tất cả nơi mua"], ["shopee", "Shopee"], ["tiktok", "TikTok Shop"]]
      .map(([k, t]) => `<button class="seg ${k} ${plat === k ? "on" : ""}" data-p="${k}">${k === "shopee" ? ICON_SP : k === "tiktok" ? ICON_TT : ""}${t}${k !== "all" ? ` <small>${cnt(k)}</small>` : ""}</button>`).join("");
    $("#chips").innerHTML =
      `<button class="chip ${active === "all" ? "on" : ""}" data-b="all">✦ Tất cả <small>${data.products.length}</small></button>` +
      groups.map(([b, it]) => `<button class="chip ${active === b ? "on" : ""}" data-b="${esc(b)}">${esc(b)} <small>${it.length}</small></button>`).join("");

    const hot = data.products.filter((p) => p.hot && match(p));
    $("#hot").innerHTML = active === "all" && hot.length ? groupHtml("Đang hot", hot, { icon: "🔥", id: "hot-sec" }) : "";

    let shown = 0;
    $("#groups").innerHTML = groups
      .filter(([b]) => active === "all" || active === b)
      .map(([b, items]) => {
        const it = items.filter(match); shown += it.length;
        return it.length ? groupHtml(b, it) : "";
      }).join("");
    $("#empty").hidden = shown > 0;
  }

  function renderProfile() {
    const pr = data.profile || {};
    document.title = `${pr.name || "Thomas"} — Beauty Universe`;
    $("#name").textContent = pr.name || "Thomas";
    $("#handle").textContent = pr.handle || "";
    $("#bio").textContent = pr.bio || "";
    $("#avatar").innerHTML = pr.avatar ? `<img src="${esc(pr.avatar)}" alt="${esc(pr.name)}">` : esc(initial(pr.name || "T"));
    $("#socials").innerHTML = (pr.socials || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join("");
    const brands = new Set(data.products.map((p) => p.brand || "Khác")).size;
    $("#stats").innerHTML = `<div class="stat"><b>${data.products.length}</b><span>sản phẩm</span></div><div class="stat"><b>${brands}</b><span>thương hiệu</span></div>`;
  }

  $("#chips").addEventListener("click", (e) => {
    const c = e.target.closest(".chip"); if (!c) return;
    active = c.dataset.b; render();
    $(".controls").scrollIntoView({ behavior: "smooth" });
  });
  $("#q").addEventListener("input", render);
  $("#plat").addEventListener("click", (e) => {
    const b = e.target.closest(".seg"); if (!b) return;
    plat = b.dataset.p; render();
  });
  const tt = $("#toTop");
  const ctr = $(".controls");
  addEventListener("scroll", () => { tt.classList.toggle("show", scrollY > 600); ctr.classList.toggle("stuck", ctr.getBoundingClientRect().top <= 0); }, { passive: true });
  tt.onclick = () => scrollTo({ top: 0, behavior: "smooth" });

  /* tilt 3D nhẹ khi rê chuột */
  document.addEventListener("pointermove", (e) => {
    const c = e.target.closest?.(".card"); if (!c || e.pointerType !== "mouse") return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-6px)`;
  });
  document.addEventListener("pointerout", (e) => { const c = e.target.closest?.(".card"); if (c && !c.contains(e.relatedTarget)) c.style.transform = ""; });

  fetch("data.json?v=" + Date.now())
    .then((r) => r.json())
    .then((d) => { data = d; data.products ||= []; renderProfile(); render(); })
    .catch(() => { $("#empty").hidden = false; $("#empty").textContent = "Không tải được data.json"; });
})();
