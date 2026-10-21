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
    jumpVel: 18,
    gravity: 46,
    /** Nhân trọng lực khi đã nhả nút nhảy lúc còn đang bay lên (nhảy thấp mà vẫn mượt) */
    releaseGravity: 3.8,
    /** Gần đỉnh nhảy (|vy| nhỏ hơn apexBand) mà còn giữ nút: trọng lực nhẹ đi */
    apexBand: 2.5,
    apexGravity: 0.55,
    /** Lúc rơi */
    fallGravity: 1.12,
    maxFall: 20,
    /** Tốc độ trượt khi bám tường */
    wallSlide: 3,
    wallJumpVel: 12.2,
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
    /** Nhảy cụng mép trần lệch tối đa ngần này (ô) thì tự lách qua */
    cornerCorrect: 0.32,
    /** Nhảy kép: lực bằng phần này của cú nhảy thường */
    airJumpMul: 0.85,
    /** Đập đất: tốc độ rơi, bán kính và sát thương sóng chấn động */
    slamSpeed: 24,
    slamRadius: 2.8,
    slamDamage: 4,
  },

  /** Mẹo đánh trùm (platformer.ts · BossStyle) */
  boss: {
    /** Choáng / lộ điểm yếu bao lâu, nhận sát thương nhân bao nhiêu */
    stunTime: 2.4,
    stunMul: 1.5,
    /** Gồng trước khi lao / đập chuỳ / há miệng */
    windup: 0.9,
    chargeSpeed: 15,
    /** Goblin Hàm Sắt: người chơi trong tầm này thì nó giơ chuỳ đập đất */
    slamRange: 7,
    /** La Madre: ẩn hình bao lâu, hiện hình bao lâu */
    vanishTime: 2.2,
    appearTime: 2.4,
    /** Rồng: nghỉ (vảy cứng) bao lâu, phun lửa bao lâu */
    dragonRest: 2.4,
    breathTime: 2.8,
    /** Director Vane: bắn tên lửa mỗi bao lâu, hạ bao nhiêu quả thì vỡ khiên */
    missileEvery: 2.6,
    /** Bắn hạ tên lửa dễ hơn: cộng thêm vào bán kính trúng (tên lửa to, đạn chỉ cần sượt qua) */
    missileSlack: 0.4,
    /** Tốc độ bay ngang của tên lửa trùm (m/s) */
    missileSpeed: 4.5,
    overlordBreak: 3,
    /** Kẻ Canh Giữ: nhắm mắt / mở mắt bao lâu, sát thương khi mắt mở */
    eyeClosed: 3.6,
    eyeOpen: 2.6,
    eyeMul: 2,
    /** Lính trùm gọi ra tối đa cùng lúc */
    maxMinions: 4,
  },

  /** Điểm: mỗi địch / trùm, nhân theo chuỗi combo (tối đa), chuỗi đứt nếu quá lâu không hạ được ai */
  score: { kill: 100, boss: 2000, comboWindow: 3, comboCap: 8, rankBonus: { S: 1, A: 0.5, B: 0.2, C: 0 } as Record<"S" | "A" | "B" | "C", number> },

  /** Độ khó: máu và sát thương của địch, hệ số phần thưởng (CRED, đồ rơi) */
  difficulty: {
    easy: { hp: 0.7, dmg: 0.6, reward: 0.8 },
    normal: { hp: 1, dmg: 1, reward: 1 },
    hard: { hp: 1.4, dmg: 1.35, reward: 1.35 },
    nightmare: { hp: 1.7, dmg: 1.45, reward: 1.9 },
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

  /** Vũ khí trang bị (gear.ts): tốc độ, cỡ, tầm của từng kiểu bắn */
  gear: {
    auto: { speed: 26, r: 0.16, life: 0.9 },
    spread: { speed: 20, r: 0.17, life: 0.32, arc: 0.7 },
    rail: { speed: 42, r: 0.14, life: 0.8 },
    /** Cung: tốc độ tên [chưa kéo, kéo đầy], sát thương cộng thêm khi kéo đầy, kéo tối thiểu */
    bow: { speed: [16, 32] as [number, number], bonus: 8, minPower: 0.15 },
    /** Kiếm: nhát chém cách thân bao xa, bán kính, thời gian tồn tại; sóng kiếm bay bao lâu;
     * màn bay: tia kiếm nhỏ kèm mỗi nhát (phần sát thương sóng, thời gian bay) */
    blade: { reach: 1, r: 1.1, sweepR: 1.3, life: 0.14, waveLife: 0.9, beamMul: 0.3, beamLife: 1.2 },
    /** Lưỡi băng: địch chậm còn bao nhiêu phần, trong bao lâu */
    frostSlow: 0.45,
    frostTime: 2,
  },

  /** Leo tháp (Hollow Hotel): sương ma dâng từ dưới */
  climb: { speed: 0.75, delay: 3, startBelow: 7, catchUpGap: 11, catchUpMul: 2.2 },

  /** Bay tự cuộn (Warzone): tốc độ cuộn, tốc độ bay, nửa bề ngang khung hình gameplay */
  shmup: { scrollSpeed: 4, speed: 7, boost: 1.6, viewHalf: 13, crashDamage: 4 },

  /** Đi 8 hướng (nhìn từ trên / nhìn chéo): tốc độ, lướt, cỡ thân, tầm giữ khoảng cách của lính */
  topdown: { speed: 6, dashMul: 2, dashTime: 0.22, body: 0.8, trooperRange: 8, cornerAssist: 0.4 },

  /** Đồ rơi: chờ một nhịp rồi mới nhặt được, gần thì tự bay về phía người chơi */
  loot: { pickupDelay: 0.35, magnetRange: 2.6, magnetSpeed: 9 },

  enemy: {
    /** Địch chỉ hoạt động khi cách người chơi ít hơn mức này */
    wakeRange: 16,
    contactDamage: 3,
    /** Kỹ năng quái: zombie vồ, lính nhảy né đạn, drone bổ nhào */
    skill: { lungeRange: 3.2, lungeEvery: 2.6, lungeTime: 0.45, lungeVy: 7.5, lungeSpeed: 6.5, dodgeEvery: 2.2, dodgeRange: 4, dodgeVy: 10, diveEvery: 5.5, diveRange: 9, diveTime: 1.4 },
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
