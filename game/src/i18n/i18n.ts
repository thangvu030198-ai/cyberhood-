// Đa ngôn ngữ: English (mặc định), English US / UK, 日本語, 한국어, 中文, Español; "Ngôn ngữ khác": Tiếng Việt
// (ngôn ngữ gốc của mã nguồn). Từ điển (dict.ts) ánh xạ câu tiếng Việt → [en, ja, ko, zh, es]; tiếng Anh UK lấy từ
// bản tiếng Anh rồi đổi chính tả (colour, armour…).
// Câu có giá trị động dùng mẫu {0} {1}: "Lệnh tiểu đội: {0}" khớp "Lệnh tiểu đội: Theo tôi" rồi dịch tiếp phần {0}.
// Giao diện HTML được dịch tự động bằng MutationObserver (mount.ts) nên không phải bọc từng chuỗi.

import { create } from "zustand";
import { DICT } from "./dict";

export type Lang = "en" | "en-US" | "en-GB" | "ja" | "ko" | "zh" | "es" | "vi";
/** Danh sách chính; `other` = nằm trong mục "Ngôn ngữ khác" */
export const LANGS: { id: Lang; native: string; other?: boolean }[] = [
  { id: "en", native: "English" },
  { id: "en-US", native: "English (US)" },
  { id: "en-GB", native: "English (UK)" },
  { id: "ja", native: "日本語" },
  { id: "ko", native: "한국어" },
  { id: "zh", native: "中文" },
  { id: "es", native: "Español" },
  { id: "vi", native: "Tiếng Việt", other: true },
];
/** Cột trong từ điển của từng ngôn ngữ */
const COL: Record<Exclude<Lang, "vi">, number> = { en: 0, "en-US": 0, "en-GB": 0, ja: 1, ko: 2, zh: 3, es: 4 };

const KEY = "cyberhood.lang.v1";
function savedLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v && LANGS.some((l) => l.id === v)) return v as Lang;
  } catch {
    /* bộ nhớ trình duyệt bị chặn: dùng mặc định */
  }
  return "en";
}

export const useLang = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: savedLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* bỏ qua */
    }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));

// Chính tả Anh – Anh
const UK: [RegExp, string][] = [
  [/\b([Cc])olor/g, "$1olour"],
  [/\b([Aa])rmor/g, "$1rmour"],
  [/\b([Cc])enter/g, "$1entre"],
  [/\b([Hh])onor/g, "$1onour"],
  [/\b([Ff])avorite/g, "$1avourite"],
  [/\b([Dd])efense/g, "$1efence"],
  [/\b([Rr])ealiz/g, "$1ealis"],
  [/\b([Oo])rganiz/g, "$1rganis"],
  [/\b([Gg])ray/g, "$1rey"],
  [/\b([Mm])eter/g, "$1etre"],
  [/\bCOLOR/g, "COLOUR"],
  [/\bARMOR/g, "ARMOUR"],
  [/\bDEFENSE/g, "DEFENCE"],
  [/\bCENTER/g, "CENTRE"],
];
const toUK = (s: string) => UK.reduce((a, [re, to]) => a.replace(re, to), s);

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// Từ điển chính xác + danh sách mẫu có chỗ trống (dài trước, để mẫu cụ thể thắng mẫu chung)
const exact = new Map<string, string[]>();
/** Tra theo chữ in hoa (code gọi toUpperCase() trên câu tiếng Việt): kết quả cũng in hoa */
const upper = new Map<string, string[]>();
type Pat = { re: RegExp; idx: number[]; out: string[] };
const pats: Pat[] = [];
for (const [vi, out] of Object.entries(DICT)) {
  const k = norm(vi);
  if (!/\{\d+\}/.test(k)) {
    exact.set(k, out);
    upper.set(k.toUpperCase(), out);
    continue;
  }
  const idx: number[] = [];
  const src = k
    .split(/(\{\d+\})/)
    .map((part) => {
      const m = /^\{(\d+)\}$/.exec(part);
      if (m) {
        idx.push(Number(m[1]));
        return "(.+?)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  pats.push({ re: new RegExp(`^${src}$`, "s"), idx, out });
}
pats.sort((a, b) => b.re.source.replace(/\(\.\+\?\)/g, "").length - a.re.source.replace(/\(\.\+\?\)/g, "").length);

const cache = new Map<Lang, Map<string, string>>();
const HAS_WORD = /[A-Za-zÀ-ỹ぀-ヿ一-鿿]/;

/** Dịch một chuỗi tiếng Việt sang ngôn ngữ `lang` (mặc định: ngôn ngữ đang chọn). Không có trong từ điển thì giữ nguyên. */
export function tr(text: string, lang: Lang = useLang.getState().lang): string {
  if (lang === "vi" || !text || !HAS_WORD.test(text)) return text;
  let c = cache.get(lang);
  if (!c) cache.set(lang, (c = new Map()));
  const hit = c.get(text);
  if (hit !== undefined) return hit;
  let out = translate(text, lang, 0);
  if (lang === "en-GB") out = toUK(out);
  if (c.size > 6000) c.clear();
  c.set(text, out);
  return out;
}

function translate(text: string, lang: Exclude<Lang, "vi">, depth: number): string {
  const k = norm(text);
  if (!k) return text;
  const li = COL[lang];
  // Giữ khoảng trắng đầu/cuối của nút chữ (React tách "Hạng " + giá trị thành nhiều nút)
  const lw = /^\s*/.exec(text)![0];
  const tw = text.length > lw.length ? /\s*$/.exec(text)![0] : "";
  const wrap = (s: string) => lw + s.trim() + tw;
  const ex = exact.get(k);
  if (ex) return wrap(ex[li] || ex[0]);
  const up = k === k.toUpperCase() ? upper.get(k) : undefined;
  if (up) return wrap((up[li] || up[0]).toUpperCase());
  if (depth > 3) return text;
  for (const p of pats) {
    const m = p.re.exec(k);
    if (!m) continue;
    let s = p.out[li] || p.out[0];
    p.idx.forEach((n, i) => {
      s = s.split(`{${n}}`).join(translate(m[i + 1], lang, depth + 1));
    });
    return wrap(s);
  }
  // Mảnh chữ có dấu chấm giữa ở đầu/cuối: "bay ·", "· giữ", "· Phố, biển neon: … · CC0"
  const dot = /^(·\s*)?(.+?)(\s*·)?$/.exec(k);
  if (dot && (dot[1] || dot[3])) {
    const mid = translate(dot[2], lang, depth + 1);
    if (mid !== dot[2]) return wrap((dot[1] ?? "") + mid.trim() + (dot[3] ?? ""));
  }
  // Chuỗi ghép bằng dấu " · " hoặc xuống dòng: dịch từng phần
  if (k.includes(" · ")) return wrap(k.split(" · ").map((p) => translate(p, lang, depth + 1)).join(" · "));
  return text;
}

/** Chữ trên biển hiệu / bảng trong thế giới 3D: luôn tiếng Anh (biển neon có thêm tiếng Nhật ở chỗ khác) */
export const sign = (text: string) => tr(text, "en");

/** Ngôn ngữ dùng chữ CJK (cần font Noto) */
export const isCjk = (l: Lang) => l === "ja" || l === "ko" || l === "zh";
