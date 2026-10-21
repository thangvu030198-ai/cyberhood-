import { GAME, type FormId } from "./config";

// Thanh biến hình và máy trạng thái Mech (GDD mục 5.1, 5.3).
// NORMAL → TRANSFORMING (bất tử) → MECH_ACTIVE (đếm ngược, EMP trừ giờ) → REVERTING → NORMAL (hồi chiêu)

export type TransformPhase = "normal" | "transforming" | "active" | "reverting";

export type TransformState = {
  meter: number;
  phase: TransformPhase;
  form: FormId;
  /** Giây còn lại của pha hiện tại */
  timer: number;
  cooldown: number;
  mechHp: number;
  mechMaxHp: number;
  /** Giây cộng thêm cho lần biến hình này (đồng bộ biến hình tổ đội) */
  bonusSec: number;
};

export const freshTransform = (form: FormId = "titan_frame"): TransformState => ({
  meter: 0,
  phase: "normal",
  form,
  timer: 0,
  cooldown: 0,
  mechHp: 0,
  mechMaxHp: 0,
  bonusSec: 0,
});

export type MeterSource = keyof typeof GAME.transform.gain;

export function gainMeter(s: TransformState, source: MeterSource, amount = 1) {
  if (s.phase !== "normal") return;
  s.meter = Math.min(GAME.transform.meterMax, s.meter + GAME.transform.gain[source] * amount);
}

export function canTransform(s: TransformState, mechDurability: number) {
  return s.phase === "normal" && s.cooldown <= 0 && s.meter >= GAME.transform.meterMax && mechDurability > 0;
}

/** Bắt đầu biến hình; trả về false nếu chưa đủ điều kiện */
export function startTransform(s: TransformState, mechDurability: number, playerMaxHp: number, durationBonusSec = 0) {
  if (!canTransform(s, mechDurability)) return false;
  const form = GAME.transform.forms[s.form];
  s.phase = "transforming";
  s.timer = GAME.transform.transformAnimSec;
  s.mechMaxHp = playerMaxHp * form.hpMul;
  s.mechHp = s.mechMaxHp;
  s.bonusSec = durationBonusSec;
  return true;
}

/** Trúng súng EMP của Legion: mất 5 giây thời gian Mech */
export function hitByEmp(s: TransformState) {
  if (s.phase === "active") s.timer = Math.max(0, s.timer - GAME.transform.empPenaltySec);
}

/** Mech chịu sát thương; giai đoạn biến hình là bất tử */
export function damageMech(s: TransformState, dmg: number) {
  if (s.phase !== "active") return;
  s.mechHp = Math.max(0, s.mechHp - dmg);
  if (s.mechHp === 0) s.timer = 0;
}

export type TransformEvent = "activated" | "reverting" | "reverted" | null;

/** Tiến thời gian; trả về sự kiện chuyển pha (nếu có) để client chạy hiệu ứng và trừ độ bền */
export function tickTransform(s: TransformState, dt: number): TransformEvent {
  if (s.phase === "normal") {
    s.cooldown = Math.max(0, s.cooldown - dt);
    return null;
  }
  s.timer -= dt;
  if (s.timer > 0) return null;
  switch (s.phase) {
    case "transforming":
      s.phase = "active";
      s.timer = GAME.transform.forms[s.form].durationSec + s.bonusSec;
      return "activated";
    case "active":
      s.phase = "reverting";
      s.timer = GAME.transform.revertAnimSec;
      return "reverting";
    case "reverting":
      s.phase = "normal";
      s.timer = 0;
      s.meter = 0;
      s.cooldown = GAME.transform.cooldownSec;
      s.mechHp = 0;
      return "reverted";
  }
}

export function formStats(form: FormId) {
  return GAME.transform.forms[form];
}
