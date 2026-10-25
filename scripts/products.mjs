// Đọc nội dung issue → thêm/xoá sản phẩm trong data.json
// Chạy trên GitHub Actions (Node 20). Không cần thư viện ngoài.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const DATA = "data.json";
const body = process.env.ISSUE_BODY || "";
const mode = process.env.MODE || "add";
const data = JSON.parse(readFileSync(DATA, "utf8"));
data.products ||= [];

const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const UA_BOT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

/* ---------- Đọc form issue ---------- */
export function parseForm(text) {
  const out = {};
  const parts = text.split(/^###\s+/m).slice(1);
  for (const p of parts) {
    const [head, ...rest] = p.split("\n");
    let val = rest.join("\n").trim();
    if (val === "_No response_") val = "";
    out[head.trim()] = val;
  }
  return out;
}
const pick = (f, ...keys) => {
  for (const k of Object.keys(f)) if (keys.some((x) => k.toLowerCase().startsWith(x))) return f[k];
  return "";
};

/* ---------- Tìm shopid / itemid trong link ---------- */
export function findIds(str) {
  let s = str;
  for (let i = 0; i < 3; i++) { try { s = decodeURIComponent(s); } catch { break; } }
  const m =
    s.match(/-i\.(\d+)\.(\d+)/) ||
    s.match(/\/product\/(\d+)\/(\d+)/) ||
    s.match(/[?&]shopid=(\d+).*?[?&]itemid=(\d+)/i) ||
    s.match(/\bi\.(\d+)\.(\d+)/);
  return m ? { shop: m[1], item: m[2] } : null;
}
export function nameFromSlug(str) {
  let s = str;
  try { s = decodeURIComponent(decodeURIComponent(s)); } catch {}
  const m = s.match(/shopee\.vn\/([^/?#]+)-i\.\d+\.\d+/);
  return m ? m[1].replace(/-/g, " ").replace(/\s+/g, " ").trim() : "";
}
export function cleanName(n = "") {
  return n
    .replace(/\s*[|\-–]\s*Shopee\s*Vi[eệ]t\s*Nam\s*$/i, "")
    .replace(/^Shopee\s*Vi[eệ]t\s*Nam\s*[|\-–]?\s*/i, "")
    .replace(/\s*[|\-–]\s*TikTok(\s*Shop)?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- Mạng ---------- */
async function get(url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal, headers: { "user-agent": UA_BROWSER, "accept-language": "vi-VN,vi;q=0.9", ...(opts.headers || {}) } });
  } finally { clearTimeout(t); }
}

// Đi theo các bước chuyển hướng của link rút gọn, gom lại mọi URL đi qua
async function resolve(url) {
  const seen = [url];
  let cur = url;
  for (let i = 0; i < 10; i++) {
    let r;
    try { r = await get(cur, { redirect: "manual" }); } catch { break; }
    const loc = r.headers.get("location");
    if (loc && r.status >= 300 && r.status < 400) {
      cur = new URL(loc, cur).href; seen.push(cur); continue;
    }
    if (r.ok && (r.headers.get("content-type") || "").includes("html")) {
      const html = (await r.text()).slice(0, 300000);
      const found = html.match(/https?:[^"'\s<>]*shopee\.vn[^"'\s<>]*/g) || [];
      seen.push(...found.map((u) => u.replace(/\\\//g, "/").replace(/&amp;/g, "&")));
    }
    break;
  }
  return seen;
}

const img = (hash) => (!hash ? "" : hash.startsWith("http") ? hash : `https://down-vn.img.susercontent.com/file/${hash}`);

async function fromApi({ shop, item }) {
  const headers = { referer: `https://shopee.vn/product/${shop}/${item}`, "x-api-source": "pc", "x-requested-with": "XMLHttpRequest", accept: "application/json" };
  const tries = [
    [`https://shopee.vn/api/v4/pdp/get_pc?item_id=${item}&shop_id=${shop}`, (j) => j?.data?.item],
    [`https://shopee.vn/api/v4/item/get?itemid=${item}&shopid=${shop}`, (j) => j?.data],
  ];
  for (const [u, sel] of tries) {
    try {
      const r = await get(u, { headers });
      if (!r.ok) continue;
      const it = sel(await r.json());
      if (it && (it.title || it.name)) return { name: it.title || it.name, image: img(it.image || it.images?.[0]), brand: it.brand || "" };
    } catch {}
  }
  return null;
}

async function fromHtml(url) {
  for (const ua of [UA_BOT, UA_BROWSER]) {
    try {
      const r = await get(url, { headers: { "user-agent": ua } });
      if (!r.ok) continue;
      const h = await r.text();
      const meta = (p) => h.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, "i"))?.[1] ||
        h.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, "i"))?.[1] || "";
      let name = meta("og:title"), image = meta("og:image"), brand = "";
      const ld = h.match(/"@type"\s*:\s*"Product"[\s\S]{0,4000}/);
      if (ld) {
        name ||= ld[0].match(/"name"\s*:\s*"([^"]+)"/)?.[1] || "";
        image ||= ld[0].match(/"image"\s*:\s*"([^"]+)"/)?.[1] || "";
        brand = ld[0].match(/"brand"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/)?.[1] || "";
      }
      name ||= h.match(/"product_name"\s*:\s*"([^"]{4,300})"/)?.[1] || "";
      image ||= h.match(/"main_images?"[\s\S]{0,400}?"url_list"\s*:\s*\["([^"]+)"/)?.[1]?.replace(/\\u002F/g, "/") || "";
      if (!name) name = h.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
      name = cleanName(name.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
      if (name && !/^(shopee|tiktok|make your day)/i.test(name)) return { name, image: image.replace(/&amp;/g, "&"), brand };
    } catch {}
  }
  return null;
}

// Đoán thương hiệu: ưu tiên thương hiệu đã có trên web mà xuất hiện trong tên
function guessBrand(name, apiBrand) {
  const known = [...new Set(data.products.map((p) => p.brand).filter((b) => b && b !== "Khác"))];
  const flat = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const low = flat(name);
  const hit = known.sort((a, b) => b.length - a.length).find((b) => flat(b).length > 1 && low.includes(flat(b)));
  if (hit) return hit;
  if (apiBrand && !/^(no ?brand|none|khác|other|0)$/i.test(apiBrand.trim())) return apiBrand.trim();
  return "Khác";
}

async function lookup(link) {
  const urls = await resolve(link);
  let ids = null, slugName = "";
  for (const u of urls) { ids ||= findIds(u); slugName ||= nameFromSlug(u); }
  let info = ids ? await fromApi(ids) : null;
  if (!info) {
    const target = ids ? `https://shopee.vn/product/${ids.shop}/${ids.item}` : urls.at(-1);
    info = await fromHtml(target);
    if (!info && urls.at(-1) !== target) info = await fromHtml(urls.at(-1));
  }
  return { name: cleanName(info?.name || slugName), image: info?.image || "", brand: info?.brand || "", ids };
}

export const isTikTok = (u = "") => /tiktok/i.test(u);

/* ---------- Đổi link Shopee thường → link affiliate ----------
   Ưu tiên 1: Shopee Affiliate Open API (cần AppID + Secret đặt trong GitHub Secrets)
   Ưu tiên 2: mã Affiliate ID trong data.json → link dạng an_redir
   Link đã là link rút gọn (s.shopee.vn, shope.ee) thì giữ nguyên. */
const AFF = data.affiliate || {};
export const isShortAff = (u = "") => /^https?:\/\/(s\.shopee\.vn|shope\.ee|shp\.ee)\//i.test(u);
const stripTracking = (u) => {
  try {
    const x = new URL(u);
    [...x.searchParams.keys()].forEach((k) => { if (/^(sp_atk|xptdk|uls_trackid|utm_|af_|mmp_|smtt|is_from|gads|share)/i.test(k)) x.searchParams.delete(k); });
    return x.href;
  } catch { return u; }
};
async function toAffiliate(url) {
  if (isShortAff(url)) return { url, how: "giữ nguyên (đã là link aff)" };
  const clean = stripTracking(url);
  const appId = process.env.SHOPEE_APP_ID, secret = process.env.SHOPEE_SECRET;
  if (appId && secret) {
    try {
      const sub = (AFF.subId || "web").replace(/[^a-zA-Z0-9]/g, "");
      const payload = JSON.stringify({ query: `mutation{generateShortLink(input:{originUrl:${JSON.stringify(clean)},subIds:[${JSON.stringify(sub)}]}){shortLink}}` });
      const ts = Math.floor(Date.now() / 1000);
      const sig = createHash("sha256").update(`${appId}${ts}${payload}${secret}`).digest("hex");
      const r = await fetch("https://open-api.affiliate.shopee.vn/graphql", {
        method: "POST", body: payload,
        headers: { "content-type": "application/json", authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${sig}` },
      });
      const j = await r.json();
      const link = j?.data?.generateShortLink?.shortLink;
      if (link) return { url: link, how: "Open API ✅" };
      console.error("Open API:", JSON.stringify(j));
    } catch (e) { console.error("Open API lỗi", e); }
  }
  if (AFF.shopeeId) {
    const sub = encodeURIComponent(AFF.subId || "web");
    return { url: `https://s.shopee.vn/an_redir?origin_link=${encodeURIComponent(clean)}&affiliate_id=${encodeURIComponent(AFF.shopeeId)}&sub_id=${sub}`, how: "mã Affiliate ID" };
  }
  return { url, how: "⚠️ chưa cài mã aff — giữ link gốc" };
}

async function lookupTikTok(link) {
  const urls = await resolve(link);
  const last = urls.at(-1);
  const pid = urls.map((u) => u.match(/product\/(\d{6,})/)?.[1]).find(Boolean);
  let info = await fromHtml(last);
  if (!info && pid) info = await fromHtml(`https://www.tiktok.com/view/product/${pid}`);
  return { name: info?.name || "", image: info?.image || "", brand: info?.brand || "", ids: pid ? { tt: pid } : null };
}

/* ---------- Chạy ---------- */
const f = parseForm(body);
const getLinks = (txt = "") => [...new Set((txt.match(/https?:\/\/[^\s<>()"']+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))];
const linksOfP = (p) => [p.shopee, p.shopeeSrc, p.tiktok, p.url].filter(Boolean);
const report = [];
const row = (st, p) => `| ${st} | ${p.name} | ${p.brand} | ${p.shopee ? "✅" : "—"} | ${p.tiktok ? "✅" : "—"} | ${p.image ? `<img src="${p.image}" width="60">` : "chưa có"} |`;

if (mode === "remove") {
  const lines = pick(f, "link").split("\n").map((l) => l.trim()).filter(Boolean);
  const before = data.products.length;
  const removed = [];
  data.products = data.products.filter((p) => {
    const hit = lines.some((l) => (/^https?:/.test(l) ? linksOfP(p).includes(l) : (p.name || "").toLowerCase().includes(l.toLowerCase())));
    if (hit) removed.push(p.name);
    return !hit;
  });
  report.push(removed.length
    ? `🗑️ Đã xoá **${before - data.products.length}** sản phẩm:\n\n${removed.map((n) => `- ${n}`).join("\n")}`
    : "Không tìm thấy sản phẩm nào khớp để xoá.");
} else {
  // Gom link theo nền tảng (tự nhận diện, kể cả khi dán nhầm ô)
  const all = [...getLinks(pick(f, "link shopee")), ...getLinks(pick(f, "link tiktok"))];
  const sp = all.filter((u) => !isTikTok(u)), tt = all.filter(isTikTok);
  const brandIn = pick(f, "thương hiệu", "thuong hieu");
  const note = pick(f, "ghi chú", "ghi chu");
  const hot = /\[x\]/i.test(pick(f, "nổi bật", "noi bat"));
  const nameIn = pick(f, "tên", "ten");
  const imageIn = (pick(f, "link hình", "link hinh").match(/https?:\/\/\S+/) || [""])[0];

  // Mỗi nhóm = 1 sản phẩm. 1 Shopee + 1 TikTok → gộp chung.
  const groups = sp.length <= 1 && tt.length <= 1
    ? (sp.length || tt.length ? [{ shopee: sp[0] || "", tiktok: tt[0] || "" }] : [])
    : [...sp.map((u) => ({ shopee: u, tiktok: "" })), ...tt.map((u) => ({ shopee: "", tiktok: u }))];
  const single = groups.length === 1;

  report.push("| | Sản phẩm | Thương hiệu | Shopee | TikTok | Hình |", "|---|---|---|---|---|---|");
  for (const g of groups) {
    const mine = [g.shopee, g.tiktok].filter(Boolean);
    const dup = data.products.find((p) => linksOfP(p).some((u) => mine.includes(u)));
    if (dup) {
      // Đã có → gắn thêm link nền tảng còn thiếu + cập nhật ô có điền
      if (dup.url && !dup.shopee && !dup.tiktok) { dup[isTikTok(dup.url) ? "tiktok" : "shopee"] = dup.url; delete dup.url; }
      let changed = false;
      if (g.tiktok && dup.tiktok !== g.tiktok) { dup.tiktok = g.tiktok; changed = true; }
      if (g.shopee && dup.shopee !== g.shopee && dup.shopeeSrc !== g.shopee) {
        const a = await toAffiliate(g.shopee);
        dup.shopee = a.url; if (a.url !== g.shopee) dup.shopeeSrc = g.shopee; changed = true;
      }
      if (single && nameIn) dup.name = nameIn, changed = true;
      if (single && imageIn) dup.image = imageIn, changed = true;
      if (brandIn) dup.brand = brandIn, changed = true;
      if (note) dup.note = note, changed = true;
      if (hot) dup.hot = true, changed = true;
      report.push(row(changed ? "✏️ Cập nhật" : "⚠️ Đã có", dup));
      continue;
    }
    let affNote = "";
    if (g.shopee) {
      const a = await toAffiliate(g.shopee);
      g.shopeeSrc = a.url !== g.shopee ? g.shopee : "";
      g.shopeeAff = a.url; affNote = a.how;
    }
    let info = { name: "", image: "", brand: "", ids: null };
    try { if (g.shopee) info = await lookup(g.shopee); } catch (e) { console.error(e); }
    if (g.tiktok && (!info.name || !info.image)) {
      try {
        const t = await lookupTikTok(g.tiktok);
        info = { name: info.name || t.name, image: info.image || t.image, brand: info.brand || t.brand, ids: info.ids || t.ids };
      } catch (e) { console.error(e); }
    }
    const name = (single && nameIn) || info.name || "Sản phẩm";
    const p = {
      id: info.ids?.shop ? `${info.ids.shop}-${info.ids.item}` : info.ids?.tt ? `tt-${info.ids.tt}` : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      shopee: g.shopeeAff || "", ...(g.shopeeSrc ? { shopeeSrc: g.shopeeSrc } : {}), tiktok: g.tiktok, name,
      image: (single && imageIn) || info.image,
      brand: brandIn || guessBrand(name, info.brand),
      price: "", note, hot, addedAt: Date.now(),
    };
    data.products.unshift(p);
    report.push(row(info.name || (single && nameIn) ? "✅" : "🟡", p));
    if (affNote) report.push(`| | ↳ Link Shopee: ${affNote} | | | | |`);
  }
  if (!groups.length) report.length = 0, report.push("Không thấy link nào trong issue.");
  if (report.some((l) => l.startsWith("| 🟡")) || report.some((l) => l.endsWith("chưa có |"))) {
    report.push("", "🟡 / *chưa có* = nền tảng chặn nên chưa lấy được tên hoặc hình. Tạo issue mới, dán lại đúng link đó và điền ô **Tên tự đặt** / **Link hình** là xong.");
  }
}

writeFileSync(DATA, JSON.stringify(data, null, 2) + "\n");
writeFileSync("result.md", report.join("\n") + "\n\nWeb sẽ cập nhật sau khoảng 1 phút ✨");
console.log(report.join("\n"));
