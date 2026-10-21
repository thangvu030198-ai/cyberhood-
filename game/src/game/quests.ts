import * as THREE from "three";
import { playSfx } from "./assets";
import { handles } from "./refs";
import { releaseLock } from "./pointer";
import { useGame, type Dialogue, type Interactable } from "./store";
import { ITEMS, NPCS, SHARD_SPOTS, VAULT_DOOR, VAULT_ORIGIN, nextQuest, questById, type NpcId, type Step } from "./story";

// Bộ máy nhiệm vụ: đọc dữ liệu trong story.ts, nhận sự kiện từ gameplay (nói chuyện, hạ drone,
// nhặt đồ, tới nơi, vào vault, chạm terminal) và đẩy tiến độ.

export function currentStep(): Step | null {
  const { quest } = useGame.getState();
  const q = questById(quest.active);
  return q ? (q.steps[quest.step] ?? null) : null;
}

function advance() {
  const s = useGame.getState();
  const q = questById(s.quest.active);
  if (!q) return;
  const step = s.quest.step + 1;
  if (step < q.steps.length) {
    s.setQuest({ ...s.quest, step, progress: 0 });
    s.showToast(`Mục tiêu mới: ${q.steps[step].text}`);
    return;
  }
  // Hoàn thành nhiệm vụ: trao thưởng, lấy lại vật phẩm nhiệm vụ
  for (const [id, n] of Object.entries(q.consume ?? {})) s.removeItem(id as keyof typeof ITEMS, n ?? 0);
  for (const [id, n] of Object.entries(q.reward.items ?? {})) s.addItem(id as keyof typeof ITEMS, n ?? 0);
  s.addCred(q.reward.cred);
  s.setQuest({ active: null, step: 0, progress: 0, done: [...s.quest.done, q.id] });
  const next = nextQuest([...s.quest.done, q.id]);
  s.showToast(
    `Hoàn thành "${q.title}" · +${q.reward.cred} CRED` + (next ? ` · Việc mới từ ${NPCS[next.giver].name}` : ""),
  );
  playSfx("enemyDestroy", 0.4);
}

/** Cộng tiến độ cho bước dạng đếm (hạ drone, thu thập) */
export function questProgress(kind: "kill" | "collect", amount = 1) {
  const step = currentStep();
  if (!step || step.kind !== kind) return;
  const s = useGame.getState();
  const progress = s.quest.progress + amount;
  if (progress >= step.count) advance();
  else s.setQuest({ ...s.quest, progress });
}

export function questEnteredVault() {
  if (currentStep()?.kind === "enterVault") advance();
}

/** NPC này có việc cho người chơi không: "!" nhận việc mới, "?" đang chờ báo cáo */
export function npcMarker(npc: NpcId): "!" | "?" | null {
  const s = useGame.getState();
  const step = currentStep();
  if (step && step.kind === "talk" && step.npc === npc) return "?";
  if (!s.quest.active) {
    const next = nextQuest(s.quest.done);
    if (next && next.giver === npc) return "!";
  }
  return null;
}

function openDialogue(d: Dialogue) {
  releaseLock();
  useGame.getState().setDialogue(d);
  useGame.getState().setAiming(false);
}

export function talkTo(npc: NpcId) {
  const s = useGame.getState();
  const step = currentStep();
  const extra: Dialogue["choices"] = npc === "vex" ? [{ label: "Xem hàng", action: "shop" }] : [];

  if (step && step.kind === "talk" && step.npc === npc) {
    openDialogue({ npc, text: step.line, choices: [{ label: "Tiếp tục", action: "advance" }, ...extra] });
    return;
  }
  if (!s.quest.active) {
    const next = nextQuest(s.quest.done);
    if (next && next.giver === npc) {
      openDialogue({
        npc,
        text: next.pitch,
        choices: [
          { label: `Nhận việc: ${next.title}`, action: "accept", questId: next.id },
          ...extra,
          { label: "Để sau", action: "close" },
        ],
      });
      return;
    }
  }
  const lines = NPCS[npc].idle;
  openDialogue({
    npc,
    text: lines[Math.floor(Math.random() * lines.length)],
    choices: [...extra, { label: "Tạm biệt", action: "close" }],
  });
}

export function chooseDialogue(index: number) {
  const s = useGame.getState();
  const d = s.dialogue;
  const choice = d?.choices[index];
  if (!d || !choice) return;
  s.setDialogue(null);
  if (choice.action === "shop") s.setShopOpen(true);
  if (choice.action === "advance") advance();
  if (choice.action === "accept" && choice.questId) {
    const q = questById(choice.questId);
    if (!q) return;
    s.setQuest({ ...s.quest, active: q.id, step: 0, progress: 0 });
    s.showToast(`Nhận việc "${q.title}": ${q.steps[0].text}`);
  }
}

/** Dịch chuyển giữa thành phố và vault */
function teleport(location: "city" | "vault") {
  const s = useGame.getState();
  const body = handles.player?.body;
  if (!body || s.mode !== "foot") return;
  const [x, y, z] =
    location === "vault"
      ? [VAULT_ORIGIN[0] + VAULT_SPAWN[0], VAULT_ORIGIN[1] + VAULT_SPAWN[1], VAULT_ORIGIN[2] + VAULT_SPAWN[2]]
      : [VAULT_DOOR[0] + 2.5, 1.3, VAULT_DOOR[2]];
  body.setTranslation({ x, y, z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  s.setLocation(location);
  if (location === "vault") questEnteredVault();
}

/** Điểm xuất hiện trong vault, tính từ VAULT_ORIGIN (Vault.tsx đặt model khớp với các điểm này) */
export const VAULT_SPAWN: [number, number, number] = [0, 1.3, -5];
/** Cửa ra ở đầu hành lang */
export const VAULT_EXIT: [number, number, number] = [0, 0, 0.2];
/** Terminal của GHOST_0 ở cuối hành lang */
export const VAULT_TERMINAL: [number, number, number] = [0, 0, -23.5];

export function interact(target: Interactable) {
  const s = useGame.getState();
  if (target.kind === "npc") {
    talkTo(target.id);
    return;
  }
  if (target.kind === "door") {
    const unlocked = s.quest.done.includes("ghost-signal");
    if (!unlocked) {
      s.showToast("Cửa bị khoá bằng mã. Cần ai đó giải mã toạ độ trước.");
      return;
    }
    teleport("vault");
    return;
  }
  if (target.kind === "exit") {
    teleport("city");
    return;
  }
  if (target.kind === "terminal") {
    const step = currentStep();
    if (step && step.kind === "terminal") {
      openDialogue({ npc: "ghost", text: step.line, choices: [{ label: "Nhận mảnh mã", action: "advance" }] });
    } else talkTo("ghost");
  }
}

// ---------------------------------------------------------------------------
// Mục tiêu hiện tại: vị trí để vẽ cột sáng chỉ đường và marker trên minimap

const _target = new THREE.Vector3();

export function npcWorldPos(npc: NpcId, out: THREE.Vector3) {
  const n = NPCS[npc];
  if (n.inVault) return out.set(VAULT_ORIGIN[0] + VAULT_TERMINAL[0], VAULT_ORIGIN[1], VAULT_ORIGIN[2] + VAULT_TERMINAL[2]);
  return out.set(n.pos[0], n.pos[1], n.pos[2]);
}

/** Các mảnh dữ liệu chưa nhặt (chỉ xuất hiện khi đang làm bước thu thập) */
export function activeShards(): number[] {
  const step = currentStep();
  if (!step || step.kind !== "collect") return [];
  const got = useGame.getState().quest.progress;
  return SHARD_SPOTS.map((_, i) => i).filter((i) => i >= got);
}

export function objectiveTarget(): THREE.Vector3 | null {
  const s = useGame.getState();
  const step = currentStep();
  if (!step) {
    if (s.location === "vault") return null;
    const next = nextQuest(s.quest.done);
    return next ? npcWorldPos(next.giver, _target) : null;
  }
  switch (step.kind) {
    case "talk":
      return npcWorldPos(step.npc, _target);
    case "collect": {
      const [i] = activeShards();
      if (i === undefined) return null;
      const p = SHARD_SPOTS[i];
      return _target.set(p[0], 0, p[2]);
    }
    case "reach":
      return _target.set(step.target[0], 0, step.target[2]);
    case "enterVault":
      return _target.set(VAULT_DOOR[0], 0, VAULT_DOOR[2]);
    case "terminal":
      return _target.set(VAULT_ORIGIN[0] + VAULT_TERMINAL[0], VAULT_ORIGIN[1], VAULT_ORIGIN[2] + VAULT_TERMINAL[2]);
    case "kill":
      return null;
  }
}

/** Kiểm tra bước "tới nơi" mỗi frame */
export function checkReach(x: number, z: number) {
  const step = currentStep();
  if (step?.kind !== "reach") return;
  if (Math.hypot(x - step.target[0], z - step.target[2]) < step.radius) advance();
}
