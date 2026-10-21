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
    /** Vận tốc nhảy ban đầu */
    jumpVel: 13.5,
    gravity: 38,
    /** Nhân trọng lực khi đã nhả nút nhảy lúc còn đang bay lên (nhảy thấp mà vẫn mượt) */
    releaseGravity: 3.2,
    /** Gần đỉnh nhảy (|vy| nhỏ hơn apexBand) mà còn giữ nút: trọng lực nhẹ đi */
    apexBand: 2.5,
    apexGravity: 0.55,
    /** Lúc rơi */
    fallGravity: 1.12,
    maxFall: 18,
    /** Tốc độ trượt khi bám tường */
    wallSlide: 3,
    wallJumpVel: 11,
    /** Giữ nút nhảy khi bám tường: tự đạp tiếp khi vận tốc lên giảm xuống dưới mức này */
    autoClimbVy: 3,
    /** Lực đẩy ngang khi nhảy tường mà vẫn giữ hướng vào tường (leo tiếp) / bấm hướng ra ngoài */
    wallKick: 3.2,
    wallKickAway: 7.5,
    wallJumpLock: 0.1,
    /** Cách tường trong khoảng này vẫn nhảy tường được */
    wallGrace: 0.35,
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

  /** Leo tháp (Hollow Hotel): sương ma dâng từ dưới */
  climb: { speed: 0.75, delay: 3, startBelow: 7, catchUpGap: 11, catchUpMul: 2.2 },

  /** Bay tự cuộn (Warzone): tốc độ cuộn, tốc độ bay, nửa bề ngang khung hình gameplay */
  shmup: { scrollSpeed: 4, speed: 7, boost: 1.6, viewHalf: 13, crashDamage: 4 },

  /** Đồ rơi: chờ một nhịp rồi mới nhặt được, gần thì tự bay về phía người chơi */
  loot: { pickupDelay: 0.35, magnetRange: 2.6, magnetSpeed: 9 },

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
