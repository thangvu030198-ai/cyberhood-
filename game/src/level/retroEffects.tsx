// Hiệu ứng hậu kỳ cho góc nhìn retro: bảng 4 màu xanh lá của Game Boy (DMG-01).

import { useMemo } from "react";
import { BlendFunction, Effect } from "postprocessing";

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
