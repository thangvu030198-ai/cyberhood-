// Chọn ngôn ngữ: English (mặc định), English US / UK, 日本語, 한국어, 中文, Español; mục "Ngôn ngữ khác" chứa Tiếng Việt.
// Tên ngôn ngữ luôn hiện bằng chữ của chính nó (data-notr: không dịch).
import { useState } from "react";
import { LANGS, useLang, type Lang } from "../i18n/i18n";

const MAIN = LANGS.filter((l) => !l.other);
const OTHER = LANGS.filter((l) => l.other);

export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const inOther = OTHER.some((l) => l.id === lang);
  const [open, setOpen] = useState(inOther);
  if (compact)
    return (
      <label className="lang lang--compact">
        <span aria-hidden>🌐</span>
        <select data-notr value={lang} onChange={(e) => setLang(e.target.value as Lang)} onKeyDown={(e) => e.stopPropagation()}>
          {MAIN.map((l) => (
            <option key={l.id} value={l.id}>
              {l.native}
            </option>
          ))}
          <optgroup label="Other languages">
            {OTHER.map((l) => (
              <option key={l.id} value={l.id}>
                {l.native}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
    );
  const btn = (l: (typeof LANGS)[number]) => (
    <button key={l.id} type="button" data-notr className={`lang__btn${l.id === lang ? " is-on" : ""}`} aria-pressed={l.id === lang} onClick={() => setLang(l.id)}>
      {l.native}
    </button>
  );
  return (
    <div className="lang" role="group" aria-label="Language">
      {MAIN.map(btn)}
      <button type="button" className={`lang__btn lang__more${inOther ? " is-on" : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        Ngôn ngữ khác {open ? "▾" : "▸"}
      </button>
      {open && <div className="lang__other">{OTHER.map(btn)}</div>}
    </div>
  );
}
