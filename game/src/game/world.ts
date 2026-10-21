import * as THREE from "three";
import { BUILDINGS } from "./City";
import { CITY } from "./config";

// Truy vấn hình học nhanh trên hộp bao của toà nhà, không cần Rapier hay raycast mesh.

const MARGIN = 0.6;

/** Khoảng cách tới toà nhà đầu tiên tia chạm, hoặc Infinity. `dir` phải chuẩn hoá. */
export function rayBuildings(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) {
  let best = maxDist;
  let hit = false;
  for (const b of BUILDINGS) {
    const t = rayBox(
      origin,
      dir,
      b.x - b.w / 2,
      0,
      b.z - b.d / 2,
      b.x + b.w / 2,
      b.h + CITY.SIDEWALK_HEIGHT,
      b.z + b.d / 2,
    );
    if (t !== null && t < best) {
      best = t;
      hit = true;
    }
  }
  return hit ? best : Infinity;
}

/** Tia chạm mặt đất (y = 0) ở khoảng cách bao nhiêu */
export function rayGround(origin: THREE.Vector3, dir: THREE.Vector3) {
  return dir.y < -1e-4 ? -origin.y / dir.y : Infinity;
}

/** Hai điểm có nhìn thấy nhau không (không bị toà nhà che) */
export function lineOfSight(a: THREE.Vector3, b: THREE.Vector3) {
  _dir.subVectors(b, a);
  const dist = _dir.length();
  _dir.divideScalar(dist || 1);
  return rayBuildings(a, _dir, dist) === Infinity;
}

/** Đẩy một điểm bay ra khỏi toà nhà theo trục ngắn nhất */
export function pushOutOfBuildings(p: THREE.Vector3) {
  for (const b of BUILDINGS) {
    const minX = b.x - b.w / 2 - MARGIN;
    const maxX = b.x + b.w / 2 + MARGIN;
    const minZ = b.z - b.d / 2 - MARGIN;
    const maxZ = b.z + b.d / 2 + MARGIN;
    if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ || p.y > b.h + MARGIN) continue;
    const dx1 = p.x - minX;
    const dx2 = maxX - p.x;
    const dz1 = p.z - minZ;
    const dz2 = maxZ - p.z;
    const m = Math.min(dx1, dx2, dz1, dz2);
    if (m === dx1) p.x = minX;
    else if (m === dx2) p.x = maxX;
    else if (m === dz1) p.z = minZ;
    else p.z = maxZ;
  }
}

const _dir = new THREE.Vector3();

function rayBox(
  o: THREE.Vector3,
  d: THREE.Vector3,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): number | null {
  let tmin = 0;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [o.x, d.x, minX, maxX],
    [o.y, d.y, minY, maxY],
    [o.z, d.z, minZ, maxZ],
  ];
  for (const [oc, dc, lo, hi] of axes) {
    if (Math.abs(dc) < 1e-8) {
      if (oc < lo || oc > hi) return null;
      continue;
    }
    let t1 = (lo - oc) / dc;
    let t2 = (hi - oc) / dc;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Tia so với hình cầu: khoảng cách chạm hoặc null */
export function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number) {
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}
