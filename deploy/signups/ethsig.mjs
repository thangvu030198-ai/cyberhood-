// Verify an Ethereum personal_sign signature without dependencies: keccak-256 + secp256k1 public-key recovery.
// Small and slow-ish (BigInt), fine for sign-up traffic. Tested against ethers v6 in deploy/signups/test.mjs.

/* ---------------- keccak-256 ---------------- */
const M64 = (1n << 64n) - 1n;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
// ROT[x][y]
const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
const rotl = (v, n) => (n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & M64);

function keccakF(A) {
  const C = new Array(5), D = new Array(5), B = new Array(25);
  for (let r = 0; r < 24; r++) {
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
    for (let i = 0; i < 25; i++) A[i] ^= D[i % 5];
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] = B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & M64 & B[((x + 2) % 5) + 5 * y]);
    A[0] ^= RC[r];
  }
}

export function keccak256(bytes) {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
  padded.set(bytes);
  padded[bytes.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;
  const A = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]);
      A[i] ^= lane;
    }
    keccakF(A);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) for (let b = 0; b < 8; b++) out[i * 8 + b] = Number((A[i] >> BigInt(8 * b)) & 0xffn);
  return out;
}

/* ---------------- secp256k1 recovery ---------------- */
const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = [0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n, 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n];
const mod = (a, m = P) => ((a % m) + m) % m;
function powmod(b, e, m) { let r = 1n; b = mod(b, m); while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; }
const inv = (a, m = P) => powmod(a, m - 2n, m);

// Jacobian points [X, Y, Z]; Z = 0 is infinity
function jDouble([X, Y, Z]) {
  if (Z === 0n || Y === 0n) return [0n, 1n, 0n];
  const S = mod(4n * X * Y * Y), Mv = mod(3n * X * X);
  const X3 = mod(Mv * Mv - 2n * S), Y3 = mod(Mv * (S - X3) - 8n * Y * Y * Y * Y), Z3 = mod(2n * Y * Z);
  return [X3, Y3, Z3];
}
function jAdd(p, q) {
  if (p[2] === 0n) return q;
  if (q[2] === 0n) return p;
  const [X1, Y1, Z1] = p, [X2, Y2, Z2] = q;
  const Z1Z1 = mod(Z1 * Z1), Z2Z2 = mod(Z2 * Z2);
  const U1 = mod(X1 * Z2Z2), U2 = mod(X2 * Z1Z1), S1 = mod(Y1 * Z2 * Z2Z2), S2 = mod(Y2 * Z1 * Z1Z1);
  if (U1 === U2) return S1 === S2 ? jDouble(p) : [0n, 1n, 0n];
  const H = mod(U2 - U1), R = mod(S2 - S1), HH = mod(H * H), HHH = mod(H * HH), V = mod(U1 * HH);
  const X3 = mod(R * R - HHH - 2n * V), Y3 = mod(R * (V - X3) - S1 * HHH), Z3 = mod(Z1 * Z2 * H);
  return [X3, Y3, Z3];
}
function jMul(pt, k) {
  let r = [0n, 1n, 0n], a = [pt[0], pt[1], 1n];
  while (k > 0n) { if (k & 1n) r = jAdd(r, a); a = jDouble(a); k >>= 1n; }
  return r;
}
function toAffine([X, Y, Z]) { if (Z === 0n) return null; const zi = inv(Z), zi2 = mod(zi * zi); return [mod(X * zi2), mod(Y * zi2 * zi)]; }

const hexToBytes = (h) => Uint8Array.from(h.replace(/^0x/, '').match(/../g) || [], (x) => parseInt(x, 16));
const bytesToBig = (b) => b.reduce((a, x) => (a << 8n) | BigInt(x), 0n);
const bigTo32 = (n) => { const out = new Uint8Array(32); for (let i = 31; i >= 0; i--) { out[i] = Number(n & 0xffn); n >>= 8n; } return out; };
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Hash a personal_sign message the way wallets do (EIP-191) */
export function hashMessage(message) {
  const msg = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msg.length}`);
  const all = new Uint8Array(prefix.length + msg.length);
  all.set(prefix); all.set(msg, prefix.length);
  return keccak256(all);
}

/** Address that signed `message` with `signature` (0x + 65 bytes), or null */
export function recoverAddress(message, signature) {
  const sig = hexToBytes(signature);
  if (sig.length !== 65) return null;
  const r = bytesToBig(sig.slice(0, 32)), s = bytesToBig(sig.slice(32, 64));
  let v = sig[64]; if (v >= 27) v -= 27;
  if (v > 1 || r <= 0n || r >= N || s <= 0n || s >= N) return null;
  const x = r, y2 = mod(x * x * x + 7n);
  let y = powmod(y2, (P + 1n) / 4n, P);
  if (mod(y * y) !== y2) return null;
  if (Number(y & 1n) !== v) y = P - y;
  const e = mod(bytesToBig(hashMessage(message)), N);
  const rinv = inv(r, N);
  const Q = toAffine(jAdd(jMul([x, y], mod(s * rinv, N)), jMul(G, mod(-e * rinv, N))));
  if (!Q) return null;
  const pub = new Uint8Array(64); pub.set(bigTo32(Q[0])); pub.set(bigTo32(Q[1]), 32);
  return '0x' + hex(keccak256(pub).slice(12));
}

export const sameAddress = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
