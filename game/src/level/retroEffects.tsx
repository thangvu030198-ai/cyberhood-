// Hiệu ứng hậu kỳ màu retro (giữ nguyên hình 3D, chỉ chỉnh màu):
// - RetroGrade: tách tông kiểu thập niên 90 / synthwave: bóng tối ngả tím, vùng sáng ngả cam ấm, màu đậm hơn
// - GameBoyPalette: bảng 4 màu xanh lá của Game Boy (dành cho chế độ Thử thách tuần sau này)

import { useMemo } from "react";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform } from "three";

const GAMEBOY_FRAG = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float l = dot(inputColor.rgb, vec3(0.299, 0.587, 0.114));
  // Dither 2x2 để chuyển giữa các bậc màu mượt như màn LCD
  vec2 p = floor(gl_FragCoord.xy / 3.0);
  float d = mod(p.x + p.y * 2.0, 4.0) / 4.0 - 0.375;
  l = clamp(l + d * 0.12, 0.0, 1.0);
  vec3 c0 = vec3(0.059, 0.220, 0.059);
  vec3 c1 = vec3(0.188, 0.384, 0.188);
  vec3 c2 = vec3(0.545, 0.675, 0.059);
  vec3 c3 = vec3(0.608, 0.737, 0.059);
  vec3 c = l < 0.22 ? c0 : l < 0.45 ? c1 : l < 0.7 ? c2 : c3;
  outputColor = vec4(c, inputColor.a);
}`;

class GameBoyEffect extends Effect {
  constructor() {
    super("GameBoyEffect", GAMEBOY_FRAG, { blendFunction: BlendFunction.NORMAL });
  }
}

export function GameBoyPalette() {
  const effect = useMemo(() => new GameBoyEffect(), []);
  return <primitive object={effect} dispose={null} />;
}

const RETRO_FRAG = /* glsl */ `
uniform float strength;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // Tăng bão hoà
  c = mix(vec3(l), c, 1.0 + 0.35 * strength);
  // Tách tông: bóng tối tím, vùng sáng cam ấm
  vec3 shadow = vec3(0.32, 0.12, 0.45);
  vec3 highlight = vec3(1.0, 0.72, 0.42);
  vec3 tone = mix(shadow, highlight, smoothstep(0.1, 0.85, l));
  c = mix(c, c * (0.6 + tone * 0.8), 0.45 * strength);
  // Tương phản kiểu đường cong S, nâng đáy đen một chút như phim cũ
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.35 * strength);
  c = c * 0.94 + vec3(0.035, 0.02, 0.05);
  outputColor = vec4(c, inputColor.a);
}`;

class RetroGradeEffect extends Effect {
  constructor(strength: number) {
    super("RetroGradeEffect", RETRO_FRAG, { blendFunction: BlendFunction.NORMAL, uniforms: new Map([["strength", new Uniform(strength)]]) });
  }
}

export function RetroGrade({ strength = 1 }: { strength?: number }) {
  const effect = useMemo(() => new RetroGradeEffect(strength), [strength]);
  return <primitive object={effect} dispose={null} />;
}

/**
 * Màu kiểu anime hành động (tham khảo SlashZero): đen sâu (không nâng đáy đen), bão hoà cao, đường cong S mạnh,
 * bóng đổ ngả xanh lam lạnh và vùng sáng ấm để nhân vật / hiệu ứng nổi khỏi nền.
 */
const PUNCH_FRAG = /* glsl */ `
uniform float strength;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Bão hoà: vùng tối giữ nguyên, vùng giữa đậm hơn
  c = mix(vec3(l), c, 1.0 + 0.32 * strength);
  // Tách tông lạnh / ấm
  vec3 cool = vec3(0.86, 0.95, 1.12);
  vec3 warm = vec3(1.08, 1.0, 0.9);
  c *= mix(vec3(1.0), mix(cool, warm, smoothstep(0.15, 0.75, l)), strength);
  // Nén đen rồi kéo tương phản đường cong S
  c = max(c - 0.025 * strength, 0.0) / (1.0 - 0.025 * strength);
  vec3 s = clamp(c, 0.0, 1.0);
  c = mix(c, s * s * (3.0 - 2.0 * s), 0.42 * strength);
  outputColor = vec4(c, inputColor.a);
}`;

class PunchGradeEffect extends Effect {
  constructor(strength: number) {
    super("PunchGradeEffect", PUNCH_FRAG, { blendFunction: BlendFunction.NORMAL, uniforms: new Map([["strength", new Uniform(strength)]]) });
  }
}

export function PunchGrade({ strength = 1 }: { strength?: number }) {
  const effect = useMemo(() => new PunchGradeEffect(strength), [strength]);
  return <primitive object={effect} dispose={null} />;
}
