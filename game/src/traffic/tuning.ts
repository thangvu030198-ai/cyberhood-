// Mọi con số của giao thông, người đi bộ, animation di chuyển, đỗ xe và mũi tên nhiệm vụ.
// Chỉnh ở đây thay vì rải trong code. Đơn vị: mét, giây, m/s, m/s², radian.

export const TUNING = {
  /** Lưới đường: phải khớp với CITY trong game/config.ts (GRID 4, BLOCK 40, STREET 16) */
  road: {
    grid: 4,
    block: 40,
    street: 16,
    /** Tâm làn xe chạy, tính từ tim đường (đi bên phải) */
    laneOffset: 2.6,
    /** Tâm dải đỗ xe sát lề, tính từ tim đường */
    parkOffset: 6.3,
    /** Nửa bề rộng ngã tư (bằng nửa bề rộng đường) */
    junctionHalf: 8,
    /** Vạch sang đường: bắt đầu ngay ngoài ngã tư, rộng 3m */
    crosswalkInner: 9.1,
    crosswalkOuter: 12.1,
    /** Vạch dừng cho xe, ngay trước vạch sang đường */
    stopLine: 13,
    /** Bán kính bo góc vỉa hè */
    curbRadius: 4,
    /** Khoảng cách giữa các điểm lấy mẫu trên đường cong rẽ */
    sampleStep: 0.5,
  },

  /** Đèn giao thông: hai pha (trục Z, trục X), mỗi pha xanh → vàng → đỏ hết */
  signals: {
    green: 13,
    yellow: 3,
    allRed: 2,
    /** Người đi bộ được sang đường trong `walk` giây đầu của pha xanh song song, sau đó nhấp nháy */
    walk: 9,
    /** Lệch pha giữa hai ngã tư liền kề để tạo "làn sóng xanh" */
    offsetPerBlock: 4,
  },

  vehicles: {
    count: { high: 16, low: 8 },
    /** Mô hình bám xe IDM */
    desiredSpeed: 11,
    maxAccel: 2.2,
    comfortDecel: 3.2,
    maxDecel: 9,
    /** Độ giật tối đa (m/s³): tăng tốc / nhả phanh đổi dần; phanh gấp được phép đổi nhanh hơn */
    jerk: 4,
    jerkBrake: 14,
    minGap: 2.6,
    headway: 1.3,
    /** Tốc độ tối đa trong đường cong rẽ */
    turnSpeedRight: 4.5,
    turnSpeedLeft: 6,
    /** Xác suất chọn hướng ở ngã tư */
    turnWeights: { straight: 0.5, right: 0.25, left: 0.25 },
    /** Tầm nhìn tìm xe phía trước / vật cản */
    lookahead: 45,
    /** Bề rộng hành lang làn: vật cản lệch ngang ít hơn mức này thì tính là chắn đường */
    laneHalfWidth: 1.7,
    /** Gia tốc nhỏ hơn mức này thì bật đèn phanh */
    brakeLightDecel: -0.6,
    /** Xe rẽ trái chờ nếu xe đi thẳng ngược chiều còn cách vạch dừng ít hơn mức này */
    leftYieldDistance: 28,
    wheelRadius: 0.36,
    /** Đèn vàng: chỉ dừng nếu còn đủ quãng phanh êm */
    yellowStopMargin: 1.1,
  },

  peds: {
    /** Số người đi bộ theo loại hình (avatar 100Avatars, dân thường Meshy, robot) */
    mix: {
      high: { crowd: 14, civ: 17, robot: 5 },
      low: { crowd: 8, civ: 6, robot: 2 },
    },
    /** Tâm đường đi trên vỉa hè, tính từ tâm khối nhà */
    walkRing: 17.4,
    /** Bề rộng dải đi bộ: lệch ngang tối đa so với tim lối đi (dải 16.5–18.3 tính từ tâm khối) */
    laneHalfWidth: 0.9,
    walkSpeed: [1.15, 1.55] as [number, number],
    runSpeed: 4.6,
    /** Bán kính "thân" để né nhau */
    radius: 0.38,
    /** Né người chơi: bắt đầu tránh khi cách người chơi bao nhiêu mét */
    playerAvoid: 2.2,
    /** Nghe tiếng súng trong bán kính này thì bỏ chạy */
    panicRadius: 38,
    panicTime: [7, 11] as [number, number],
    /** Ở đầu vạch sang đường: chỉ bước xuống nếu đèn đi bộ còn ít nhất ngần này giây */
    minWalkLeft: 3.5,
    /** Thỉnh thoảng dừng chân đứng chờ */
    restChance: 0.12,
    restTime: [2.5, 6] as [number, number],
  },

  /** Animation di chuyển: pha trộn đứng / đi / chạy theo tốc độ thật */
  locomotion: {
    /** Tốc độ "tự nhiên" của clip khi timeScale = 1, dùng khi clip không có root motion để đo */
    walkClipSpeed: 1.4,
    runClipSpeed: 4.2,
    /** Dưới mức này coi như đứng yên */
    idleBelow: 0.15,
    /** Giới hạn co giãn tốc độ clip để không trông như phim tua */
    minTimeScale: 0.55,
    maxTimeScale: 1.7,
    /** Hằng số làm mượt trọng số clip (càng lớn càng nhanh) */
    weightDamp: 10,
    /** Thời gian chuyển clip một lần (vẫy tay, đánh, ngã) */
    overlayFade: 0.2,
    /** Người chơi chạy nhanh hơn người thật: tốc độ tự nhiên của clip Soldier và ngưỡng dáng đi/chạy */
    player: { walkClipSpeed: 2.4, runClipSpeed: 6.0, gaitWalk: 3.9, gaitRun: 7.8 },
  },

  parking: {
    bayLength: 6,
    /** Không kẻ ô đỗ gần tâm ngã tư hơn mức này */
    clearOfJunction: 15,
    /** Xe người chơi bỏ lại trên làn: sau bao lâu thì tự vào ô đỗ gần nhất */
    autoParkDelay: 6,
    /** ... và chỉ khi người chơi đã đi xa ít nhất ngần này */
    autoParkPlayerDistance: 10,
    /** Thời gian xe trượt vào ô */
    autoParkTime: 2.2,
  },

  /** Điều khiển nhân vật (ecctrl): tốc độ, độ nhạy tăng tốc/dừng, điều khiển trên không */
  player: {
    walkSpeed: 4.2,
    runSpeed: 8.5,
    /** Độ nhạy tăng tốc / phanh (0..1): phần chênh lệch vận tốc được bù mỗi frame. Lớn = nhanh nhạy
     * (ecctrl gọi là accDeltaTime / decDeltaTime, mặc định 0.2) */
    accelGain: 0.55,
    decelGain: 0.6,
    jumpVel: 6,
    /** Điều khiển hướng khi đang trên không (0..1, nhân với độ nhạy tăng tốc) */
    airControl: 0.45,
    fallingGravityScale: 2.4,
  },

  /** Xe người chơi lái (ecctrl vehicle) */
  playerCar: {
    /** Độ cứng lò xo và giảm chấn hệ treo mỗi bánh */
    springK: 170,
    dampingC: 28,
  },

  objective: {
    /** Mũi tên lơ lửng cách người chơi, cao ngang ngực */
    arrowDistance: 1.7,
    arrowHeight: 1.25,
    /** Gần mục tiêu hơn mức này thì ẩn mũi tên */
    hideWithin: 5,
  },
};

export type Tuning = typeof TUNING;
