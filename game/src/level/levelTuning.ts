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

  /**
   * Cận chiến (nút L / C): chuỗi 3 nhát. Sát thương mỗi nhát (súng tay thường: 1), hồi chiêu sau mỗi nhát,
   * nhịp combo (bấm tiếp trong khoảng này thì ra nhát sau), lao tới khi chém, lực đánh bật, thời gian địch khựng.
   * Cầm kiếm thì nhân thêm bladeMul.
   */
  melee: {
    dmg: [2.4, 2.4, 4.5] as [number, number, number],
    cd: [0.2, 0.2, 0.42] as [number, number, number],
    window: 0.6,
    reach: 1.05,
    r: 1.2,
    finR: 1.55,
    life: 0.16,
    lunge: [3, 3, 7] as [number, number, number],
    knock: [3, 3, 10] as [number, number, number],
    stagger: 0.32,
    bladeMul: 1.45,
  },

  /** Biến thể quái (platformer.ts · Trait): thời gian báo trước, tầm, sát thương */
  traits: {
    /** Lính khiên: chịu mấy nhát chém thì vỡ khiên, tốc độ áp sát, tầm và thời gian gồng đập khiên */
    shield: { hits: 2, walk: 1.3, bashRange: 1.8, bashTele: 0.55, bashDmg: 4, bashKnock: 9, fireEvery: 3.4 },
    /** Lính bắn tỉa: tầm nhìn, thời gian ngắm (tia đỏ), lúc khoá điểm ngắm, tốc độ và sát thương đạn, nghỉ */
    sniper: { hp: 3, sight: 17, aim: 1.15, lock: 0.85, speed: 34, dmg: 5, rest: 2.4 },
    /** Lính lựu đạn: nhịp ném, thời gian bay, trọng lực lựu đạn, chờ nổ sau khi rơi, bán kính, sát thương */
    grenadier: { every: 2.9, flight: 0.95, grav: 26, fuse: 0.95, r: 1.9, dmg: 4, range: 12 },
    /** Zombie tự nổ: máu, tốc độ chạy, tầm kích nổ, thời gian nháy, bán kính, sát thương */
    exploder: { hp: 3, run: 3.4, trigger: 1.7, fuse: 0.75, r: 2.4, dmg: 5 },
    /** Zombie phun axit: giữ khoảng cách, thời gian gồng, nhịp phun, thời gian bay, vũng axit rộng / tồn tại / sát thương */
    spitter: { keep: 5, tele: 0.55, every: 2.6, flight: 0.85, grav: 24, puddle: 1.8, puddleTime: 2.6, dmg: 2 },
    /** Drone thả bom: bay cao trên đầu bao nhiêu, nhịp thả, trọng lực bom, bán kính nổ, sát thương */
    bomber: { above: 5.5, every: 1.9, grav: 20, r: 1.5, dmg: 4, follow: 3.2 },
    /** Drone laser: khoảng cách giữ, thời gian nạp (tia cảnh báo), độ dài / độ dày tia, thời gian bắn, sát thương, nghỉ */
    laser: { keep: 6.5, tele: 0.95, length: 15, width: 0.55, dur: 0.35, dmg: 4, rest: 2.6 },
  },

  /**
   * Chiêu riêng của từng trùm (ngoài mẹo phá thủ): nhịp ra chiêu, thời gian báo trước, sát thương.
   * Giai đoạn 2 (máu dưới nửa): chiêu ra dày hơn (phase2Mul) và có chiêu mới.
   */
  bossKit: {
    phase2Mul: 0.7,
    /** Robot Reaper: mưa tên lửa (cột báo trước), mảnh vỡ khi đâm tường */
    rain: { every: 5.5, cols: 4, gap: 2.9, warn: 1.05, dur: 0.35, dmg: 4, height: 7 },
    /** La Madre: bàn tay ma trồi lên chỗ người chơi đứng (đuổi theo từng nhịp), cầu lệ đuổi người */
    hands: { n: 3, every: 0.55, warn: 0.75, dur: 0.45, w: 1.6, h: 2.6, dmg: 4, orbEvery: 3.2, orbHome: 1.6, orbSpeed: 4.2 },
    /** Rồng vàng: mưa pha lê (cột từ trên trời), tường đạn có một khe hở để bay lọt */
    crystal: { every: 5, cols: 5, warn: 1.1, dur: 0.45, dmg: 3, w: 1.6 },
    wall: { every: 6.5, gap: 3.4, speed: 7, dmg: 2, step: 0.9 },
    /** Director Vane: tia laser quét sát sàn (nhảy qua), sàn điện xen kẽ (giai đoạn 2) */
    beam: { every: 6, warn: 1.15, dur: 0.5, h: 1.5, dmg: 5 },
    floor: { every: 7, warn: 1.3, dur: 1.6, segs: 4, dmg: 3 },
    /** Goblin Hàm Sắt: đá rơi (vòng báo trước), lốc xoáy lao tới, giai đoạn 2 để lại vòng lửa sau cú đập */
    rocks: { every: 4.5, n: 4, spread: 3.2, r: 1.25, warn: 1.1, dur: 0.3, dmg: 4 },
    spin: { tele: 0.6, time: 0.85, speed: 12, dmg: 4 },
    fire: { n: 3, r: 1.5, dur: 3, dmg: 2 },
    /** Kẻ Canh Giữ: xoắn ốc đạn lúc nhắm mắt, tia mắt khi mở mắt, xúc tu trồi lên (giai đoạn 2) */
    spiral: { every: 0.16, arms: 2, turn: 2.1, speed: 6.5, dmg: 2 },
    eyeBeam: { tele: 0.8, length: 18, width: 0.9, dur: 0.5, dmg: 4 },
    tentacle: { n: 3, every: 0.5, r: 1.2, warn: 0.85, dur: 0.5, dmg: 4 },
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
  /**
   * Đồ rơi: chờ bao lâu mới nhặt được, tầm hút (đồng xu hút xa hơn), tốc độ hút, nằm bao lâu thì tự bay về,
   * số đồng xu mỗi lần hạ địch [ít nhất, nhiều nhất] và khi hạ trùm, độ nảy, tỉ lệ rơi viên máu (+ thêm khi máu thấp),
   * thời gian mưa đồ sau khi hạ trùm trước khi qua màn
   */
  loot: { pickupDelay: 0.35, coinDelay: 0.7, magnetRange: 2.6, coinMagnet: 4, magnetSpeed: 9, autoCollect: 4, coins: [2, 5] as [number, number], bossCoins: 28, bounce: 0.45, bounceMin: 2.5, healthChance: 0.2, healthLowBonus: 0.35, bossOutro: 2.6 },

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
