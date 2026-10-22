// Dịch giao diện HTML tự động: theo dõi mọi nút chữ và thuộc tính title / placeholder / aria-label trong trang,
// nhớ chữ gốc tiếng Việt của từng nút, thay bằng bản dịch. Đổi ngôn ngữ thì dịch lại toàn bộ từ chữ gốc.
// React chỉ so sánh với props cũ (không đọc DOM) nên việc thay nodeValue không làm hỏng việc cập nhật.

import { sign, tr, useLang } from "./i18n";

const ATTRS = ["title", "placeholder", "aria-label"];
/** Chữ gốc (tiếng Việt) của từng nút và chữ mình vừa ghi vào (để phân biệt với cập nhật mới của React) */
const orig = new WeakMap<Node, string>();
const wrote = new WeakMap<Node, string>();
const attrOrig = new WeakMap<Element, Record<string, string>>();
const attrWrote = new WeakMap<Element, Record<string, string>>();

const skip = (el: Element | null) => !!el && (el.closest("script,style,textarea,[data-notr]") !== null || (el as HTMLElement).isContentEditable);

function doText(n: Text) {
  if (skip(n.parentElement)) return;
  const cur = n.nodeValue ?? "";
  if (wrote.get(n) !== cur) orig.set(n, cur);
  const src = orig.get(n) ?? cur;
  const out = tr(src);
  wrote.set(n, out);
  if (out !== cur) n.nodeValue = out;
}

function doAttrs(el: Element) {
  if (skip(el)) return;
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null) continue;
    const o = attrOrig.get(el) ?? {};
    const w = attrWrote.get(el) ?? {};
    if (w[a] !== cur) o[a] = cur;
    const out = tr(o[a] ?? cur);
    w[a] = out;
    attrOrig.set(el, o);
    attrWrote.set(el, w);
    if (out !== cur) el.setAttribute(a, out);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (skip(el)) return;
  doAttrs(el);
  const it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doAttrs(n as Element);
  }
}

let started = false;
export function mountI18n(root: HTMLElement = document.body) {
  if (started) return;
  started = true;
  patchCanvasText();
  document.documentElement.lang = useLang.getState().lang;
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") doText(m.target as Text);
      else if (m.type === "attributes") doAttrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  });
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  walk(root);
  // Đổi ngôn ngữ: dịch lại mọi thứ từ chữ gốc
  useLang.subscribe(() => walk(root));
}

/**
 * Chữ vẽ lên canvas (biển hiệu, bảng LED, bảng tên NPC trong thế giới 3D) luôn là tiếng Anh: chặn fillText / strokeText
 * và đổi câu tiếng Việt sang bản tiếng Anh trong từ điển. Canvas nào muốn theo ngôn ngữ giao diện thì tự dịch trước
 * bằng tr() và đặt cờ keepText trên context.
 */
export function patchCanvasText() {
  const P = CanvasRenderingContext2D.prototype as CanvasRenderingContext2D & { __signed?: boolean };
  if (P.__signed) return;
  P.__signed = true;
  for (const k of ["fillText", "strokeText"] as const) {
    const orig = P[k];
    P[k] = function (this: CanvasRenderingContext2D & { keepText?: boolean }, text: string, x: number, y: number, maxWidth?: number) {
      const t = this.keepText ? text : sign(String(text));
      return maxWidth === undefined ? orig.call(this, t, x, y) : orig.call(this, t, x, y, maxWidth);
    } as typeof orig;
  }
}
