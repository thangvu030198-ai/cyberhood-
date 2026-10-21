import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { axisOf } from "../traffic/road";
import { lightFor } from "../traffic/signals";
import { PED_GRAPH, ROAD, traffic } from "./trafficWorld";

// Chế độ debug giao thông (phím F3 hoặc ?debug=traffic): vẽ làn xe, đường cong rẽ, lối đi bộ,
// màu đèn ở vạch dừng, trạng thái từng xe (vì sao dừng) và từng người đi bộ.

const REASON_COLOR: Record<string, THREE.Color> = {
  "": new THREE.Color("#e8e8ff"),
  leader: new THREE.Color("#ff9a2a"),
  red: new THREE.Color("#ff2a2a"),
  yellow: new THREE.Color("#ffd23d"),
  yield: new THREE.Color("#b05cff"),
  "blocked-exit": new THREE.Color("#ff5cc8"),
  obstacle: new THREE.Color("#05d9e8"),
};
const PED_COLOR: Record<string, THREE.Color> = {
  walk: new THREE.Color("#ffffff"),
  wait: new THREE.Color("#ffd23d"),
  cross: new THREE.Color("#39ff88"),
  rest: new THREE.Color("#777777"),
  flee: new THREE.Color("#ff2a2a"),
};
const LIGHT_COLOR = { green: new THREE.Color("#39ff88"), yellow: new THREE.Color("#ffd23d"), red: new THREE.Color("#ff2a2a") };

export function useTrafficDebugToggle() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F3") {
        e.preventDefault();
        traffic.debug = !traffic.debug;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function TrafficDebug() {
  useTrafficDebugToggle();
  const group = useRef<THREE.Group>(null);
  const cars = useRef<THREE.InstancedMesh>(null);
  const peds = useRef<THREE.InstancedMesh>(null);
  const stops = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);

  const lines = useMemo(() => {
    const seg: number[] = [];
    const con: number[] = [];
    for (const p of ROAD.paths) {
      const out = p.kind === "segment" ? seg : con;
      for (let i = 0; i < p.pts.length - 2; i += 2) out.push(p.pts[i], 0.25, p.pts[i + 1], p.pts[i + 2], 0.25, p.pts[i + 3]);
    }
    const walk: number[] = [];
    const cross: number[] = [];
    for (const e of PED_GRAPH.edges) {
      const a = PED_GRAPH.nodes[e.a];
      const b = PED_GRAPH.nodes[e.b];
      (e.kind === "cross" ? cross : walk).push(a.x, 0.3, a.z, b.x, 0.3, b.z);
    }
    const geo = (arr: number[]) => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return { seg: geo(seg), con: geo(con), walk: geo(walk), cross: geo(cross) };
  }, []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.visible = traffic.debug;
    if (!traffic.debug) return;
    const vs = traffic.vehicles?.vehicles ?? [];
    const C = cars.current;
    if (C) {
      vs.forEach((v, i) => {
        C.setMatrixAt(i, m.makeTranslation(v.x, 3.2, v.z));
        C.setColorAt(i, REASON_COLOR[v.reason] ?? REASON_COLOR[""]);
      });
      C.count = vs.length;
      C.instanceMatrix.needsUpdate = true;
      if (C.instanceColor) C.instanceColor.needsUpdate = true;
    }
    const ps = traffic.peds?.peds ?? [];
    const P = peds.current;
    if (P) {
      ps.forEach((p, i) => {
        P.setMatrixAt(i, m.makeTranslation(p.x, 2.3, p.z));
        P.setColorAt(i, PED_COLOR[p.state]);
      });
      P.count = ps.length;
      P.instanceMatrix.needsUpdate = true;
      if (P.instanceColor) P.instanceColor.needsUpdate = true;
    }
    const S = stops.current;
    if (S) {
      ROAD.segments.forEach((seg, i) => {
        const x = seg.pts[seg.pts.length - 2];
        const z = seg.pts[seg.pts.length - 1];
        S.setMatrixAt(i, m.makeTranslation(x, 0.4, z));
        S.setColorAt(i, LIGHT_COLOR[lightFor(ROAD.junctions[seg.to], axisOf(seg.dir), traffic.time)]);
      });
      S.instanceMatrix.needsUpdate = true;
      if (S.instanceColor) S.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={lines.seg}>
        <lineBasicMaterial color="#05d9e8" toneMapped={false} />
      </lineSegments>
      <lineSegments geometry={lines.con}>
        <lineBasicMaterial color="#ff2a6d" toneMapped={false} transparent opacity={0.6} />
      </lineSegments>
      <lineSegments geometry={lines.walk}>
        <lineBasicMaterial color="#9a9a9a" toneMapped={false} />
      </lineSegments>
      <lineSegments geometry={lines.cross}>
        <lineBasicMaterial color="#39ff88" toneMapped={false} />
      </lineSegments>
      <instancedMesh ref={cars} args={[undefined, undefined, 64]} frustumCulled={false}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={peds} args={[undefined, undefined, 128]} frustumCulled={false}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={stops} args={[undefined, undefined, ROAD.segments.length]} frustumCulled={false}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Bảng số liệu debug (HTML), đếm xe theo lý do dừng và người đi bộ theo trạng thái */
export function trafficStats() {
  const reasons: Record<string, number> = {};
  for (const v of traffic.vehicles?.vehicles ?? []) reasons[v.reason || "chạy"] = (reasons[v.reason || "chạy"] ?? 0) + 1;
  const states: Record<string, number> = {};
  for (const p of traffic.peds?.peds ?? []) states[p.state] = (states[p.state] ?? 0) + 1;
  const speeds = (traffic.vehicles?.vehicles ?? []).map((v) => v.v);
  const avg = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  return { reasons, states, avgKmh: Math.round(avg * 3.6), t: traffic.time };
}
