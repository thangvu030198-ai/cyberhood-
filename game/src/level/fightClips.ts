import type { AnimationClip } from "three";
import { extraModel } from "../game/assets";

// Clip võ thuật / kiếm Meshy dùng chung (xương cùng tên nên nhân vật nào cũng mượn được).
// `peak`: giây trong clip mà tay/chân ra đòn nhanh nhất (đo từ tốc độ xoay xương) — dùng để canh lúc trúng đòn.

export const FIGHT_CLIPS = {
  slashR: { peak: 0.57 },
  slashL: { peak: 1.33 },
  sword3: { peak: 2.23 },
  upslash: { peak: 1.83 },
  jumpslash: { peak: 2.3 },
  chargeslash: { peak: 1.17 },
  groundslam: { peak: 1.7 },
  chargecast: { peak: 0.7 },
  fidle: { peak: 0 },
  fwalk: { peak: 0 },
  fback: { peak: 0 },
  jabL: { peak: 0.4 },
  jabR: { peak: 0.53 },
  hookL: { peak: 0.33 },
  upperR: { peak: 0.63 },
  pcombo: { peak: 1.3 },
  elbow: { peak: 1.17 },
  knee: { peak: 0.8 },
  roundhouse: { peak: 1.47 },
  spartan: { peak: 1.03 },
  sweep: { peak: 0.83 },
  flykick: { peak: 2.97 },
  risekick: { peak: 0.67 },
  backflipkick: { peak: 3.2 },
  jumppunch: { peak: 1.7 },
  block: { peak: 0 },
  dodge: { peak: 0.37 },
  facehit: { peak: 0.57 },
  hitr: { peak: 0.47 },
  knockdown: { peak: 0.83 },
  getup: { peak: 0 },
  taunt: { peak: 0 },
  victory: { peak: 0 },
} as const;

export type FightClip = keyof typeof FIGHT_CLIPS;

/** Mọi clip nằm chung một file (mx_fa_all.glb, mỗi clip đặt tên theo khoá ở trên) */
const cache = new Map<FightClip, Promise<{ animations: AnimationClip[] }>>();
export function fightAnim(c: FightClip) {
  let p = cache.get(c);
  if (!p) {
    // File gộp có nhiều khung xương trùng tên: bộ nạp GLTF đổi tên thành "Hips_3"… nên bỏ hậu tố số để clip
    // bám vào xương của nhân vật bất kỳ
    p = extraModel("mx_fa_all").then((g) => ({
      animations: g.animations
        .filter((a) => a.name === c)
        .map((a) => {
          const k = a.clone();
          for (const t of k.tracks) t.name = t.name.replace(/_\d+(?=\.)/, "");
          return k;
        }),
    }));
    cache.set(c, p);
  }
  return p;
}
