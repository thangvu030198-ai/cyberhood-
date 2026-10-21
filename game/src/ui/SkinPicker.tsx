import { SKINS, type HunterSkin } from "../game/skins";

/** Lưới chọn lớp nhân vật: ảnh xem trước của nhân vật Meshy, Soldier là ô màu theo Netrunner ID */
export function SkinPicker({ value, onChange, tint }: { value: HunterSkin; onChange: (s: HunterSkin) => void; tint?: string }) {
  return (
    <fieldset className="skins">
      <legend>Nhân vật</legend>
      {SKINS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`skin${s.id === value ? " skin--on" : ""}`}
          aria-pressed={s.id === value}
          title={s.blurb}
          onClick={() => onChange(s.id)}
        >
          {s.id === "soldier" ? (
            <span className="skin__img skin__img--solid" style={{ background: tint }} />
          ) : (
            <img className="skin__img" src={`ui/skin_${s.id}.jpg`} alt="" />
          )}
          <span className="skin__name">{s.name}</span>
        </button>
      ))}
    </fieldset>
  );
}
