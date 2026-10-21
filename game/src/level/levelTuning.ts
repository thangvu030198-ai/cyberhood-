// Mọi con số của màn đi ngang (platformer). 1 ô = 1 mét, giây, m/s.
// Chế độ "dễ chơi dễ hoàn thành": máu nhiều, địch yếu, nhảy cao.

export const LEVEL_TUNING = {
  /** Bước mô phỏng cố định */
  step: 1 / 60,
  /** Chữ READY trước khi điều khiển được */
  introTime: 1.6,
  /** Chết xong bao lâu thì hồi sinh ở checkpoint */
  respawnDelay: 1.6,

  player: {
    w: 0.8,
    h: 1.8,
    maxHp: 28,
    runSpeed: 6,
    dashSpeed: 12,
    dashTime: 0.35,
    /** Vận tốc nhảy ban đầu; nhả nút sớm thì cắt về jumpCut */
    jumpVel: 13.5,
    jumpCut: 5,
    gravity: 38,
    maxFall: 18,
    /** Tốc độ trượt khi bám tường */
    wallSlide: 3,
    wallJumpVel: 12.5,
    /** Lực đẩy ngang khi nhảy tường */
    wallKick: 7,
    wallJumpLock: 0.15,
    coyote: 0.08,
    jumpBuffer: 0.1,
    invuln: 1.2,
    knockTime: 0.3,
    knockSpeed: 4,
    spikeDamage: 6,
    healthPickup: 8,
  },

  shot: {
    /** Tối đa ngần này viên đạn thường trên màn hình */
    maxSmall: 3,
    life: 1.2,
    /** Giữ nút bắn bao lâu thì nạp mức 1 / mức 2 */
    chargeMid: 0.45,
    chargeFull: 1.3,
    small: { speed: 22, r: 0.22, dmg: 1 },
    mid: { speed: 22, r: 0.4, dmg: 3 },
    full: { speed: 24, r: 0.65, dmg: 6 },
  },

  enemy: {
    /** Địch chỉ hoạt động khi cách người chơi ít hơn mức này */
    wakeRange: 16,
    contactDamage: 3,
    trooper: { w: 0.9, h: 1.9, hp: 4, sight: 11, fireEvery: 2.2, shotSpeed: 9, shotDamage: 2, patrol: 3, walk: 1.4 },
    drone: { w: 1.1, h: 0.9, hp: 2, sway: 2.5, sight: 12, fireEvery: 2.8, shotSpeed: 7, shotDamage: 2 },
    zombie: { w: 0.9, h: 1.8, hp: 5, sight: 9, chase: 2.4, walk: 0.8 },
    boss: {
      w: 2.4,
      h: 3.4,
      hp: 40,
      /** Dưới nửa máu thì đánh nhanh hơn */
      rageSpeedup: 1.35,
      jumpVel: 15,
      jumpSpeed: 7,
      walk: 2.2,
      shotSpeed: 10,
      shotDamage: 3,
      waveSpeed: 9,
      waveDamage: 4,
      contactDamage: 4,
    },
  },
};
