/**
 * Bước vật lý cho Rapier + ecctrl.
 * ecctrl tính lực lò xo hệ treo / lực đẩy theo world.timestep của bước TRƯỚC, rồi Rapier mới bước frame này.
 * Nếu độ dài frame dao động (FPS lên xuống), lực tính theo bước cũ nhưng áp cho bước mới khác dài
 * → hệ treo nhận dư/thiếu xung lực → xe nảy tưng tưng. Chia nhiều bước con cũng hỏng (lực chỉ áp một lần).
 * Cách làm: mỗi frame đúng một bước, độ dài bước được làm trơn theo thời gian frame (đổi chậm),
 * có trần để lò xo ổn định. Tổng thời gian mô phỏng vẫn bám sát thời gian thật.
 */
export const MAX_STEP = 1 / 30;
/** Hệ số làm trơn độ dài bước (0..1, nhỏ = trơn hơn) */
export const STEP_SMOOTHING = 0.08;

let smoothed = 1 / 60;
/** Phần thời gian bị bù chậm do làm trơn, trả dần để không lệch đồng hồ */
let debt = 0;

export function stepPhysics(step: (dt: number) => void, delta: number) {
  const dt = Math.min(Math.max(delta, 0), 0.25);
  debt += dt;
  const target = Math.min(MAX_STEP, Math.max(1 / 240, debt));
  smoothed += (target - smoothed) * STEP_SMOOTHING;
  const h = Math.min(smoothed, MAX_STEP);
  debt = Math.max(-MAX_STEP, Math.min(MAX_STEP * 4, debt - h));
  step(h);
}
