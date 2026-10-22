// Album NFT "CYBERHOOD Genesis" chiếu trên bảng LED khổng lồ ở sảnh: chỉ gồm vật phẩm (vũ khí, giáp, cổ vật).
// Ảnh render từ model 3D (itembake.html / nftbake.html?raw=512) rồi vẽ lại thành pixel art bằng PixelLab,
// ghép thành atlas nhúng trong nftAtlas.ts theo đúng thứ tự NFT_ITEMS.

export const NFT_CELL = 128;
export const NFT_COLS = 6;

export type NftRarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
export type NftItem = {
  name: string;
  kind: "Weapon" | "Armor" | "Relic";
  rarity: NftRarity;
  /** Giá niêm yết (ETH) */
  price: number;
};
export type CastItem = {
  name: string;
  rarity: NftRarity;
  model: string;
  node?: string;
  yaw?: number;
  anim?: number;
  /** Xoay nghiêng để vũ khí dài nằm chéo khung */
  roll?: number;
  /** Hệ số sáng khi nướng ảnh */
  bright?: number;
};

export const NFT_ITEMS: NftItem[] = [
  { name: "Thunder Spear", kind: "Weapon", rarity: "Mythic", price: 4.2 },
  { name: "Leviathan Scale", kind: "Armor", rarity: "Mythic", price: 3.8 },
  { name: "Frost Fang Blade", kind: "Weapon", rarity: "Epic", price: 0.66 },
  { name: "Oni Helm", kind: "Armor", rarity: "Legendary", price: 1.05 },
  { name: "Chrono Cube", kind: "Relic", rarity: "Legendary", price: 1.33 },
  { name: "Nova Bomb", kind: "Relic", rarity: "Epic", price: 0.58 },
  { name: "Cosmic Edge", kind: "Weapon", rarity: "Legendary", price: 1.48 },
  { name: "Extra Coin", kind: "Relic", rarity: "Rare", price: 0.12 },
  { name: "Blood Crystal", kind: "Relic", rarity: "Epic", price: 0.62 },
  { name: "Aegis Battery Plate", kind: "Armor", rarity: "Legendary", price: 1.4 },
  { name: "Arcane Skullblade", kind: "Weapon", rarity: "Epic", price: 0.72 },
  { name: "Chitin Gauntlets", kind: "Armor", rarity: "Rare", price: 0.24 },
  { name: "Crystal Starburst", kind: "Relic", rarity: "Rare", price: 0.3 },
  { name: "Cyber Pulse Gauntlets", kind: "Armor", rarity: "Epic", price: 0.68 },
  { name: "Dark Enigma Armor", kind: "Armor", rarity: "Legendary", price: 1.25 },
  { name: "Demonic Bow", kind: "Weapon", rarity: "Legendary", price: 1.6 },
  { name: "Void Crystal", kind: "Relic", rarity: "Mythic", price: 3.4 },
  { name: "Frostbound Scythe", kind: "Weapon", rarity: "Epic", price: 0.81 },
  { name: "Frostbound Warhammer", kind: "Weapon", rarity: "Legendary", price: 1.38 },
  { name: "Neon Supply Crate", kind: "Relic", rarity: "Common", price: 0.08 },
  { name: "Golden Raven Mask", kind: "Armor", rarity: "Epic", price: 0.55 },
  { name: "Iron Beak Helm", kind: "Armor", rarity: "Legendary", price: 1.12 },
  { name: "Solar Lion Medallion", kind: "Relic", rarity: "Legendary", price: 1.75 },
  { name: "Longreach War Axe", kind: "Weapon", rarity: "Rare", price: 0.34 },
  { name: "Molten Inferno Axe", kind: "Weapon", rarity: "Mythic", price: 3.9 },
  { name: "Nebula Rose", kind: "Relic", rarity: "Epic", price: 0.49 },
  { name: "Circuit Core Egg", kind: "Relic", rarity: "Mythic", price: 5.6 },
  { name: "Neon Sniper Elite", kind: "Weapon", rarity: "Epic", price: 0.88 },
  { name: "MPRS Sniper Rifle", kind: "Weapon", rarity: "Rare", price: 0.41 },
  { name: "Aether Revolver", kind: "Weapon", rarity: "Legendary", price: 1.22 },
  { name: "Thorned Scythe", kind: "Weapon", rarity: "Epic", price: 0.77 },
  { name: "Valor Shield", kind: "Armor", rarity: "Rare", price: 0.29 },
  { name: "Winged Crusader Armor", kind: "Armor", rarity: "Mythic", price: 2.9 },
];

/** Nhân vật và quái cho clip quảng cáo (atlas castAtlas.ts, nướng bằng nftbake.html). Không bán làm NFT. */
export const CAST: CastItem[] = [
  { name: "Shadow Ninja", rarity: "Epic", model: "mx_cls_ninja_walk" },
  { name: "Ronin Samurai", rarity: "Epic", model: "mx_cls_samurai_walk" },
  { name: "Neon Racer", rarity: "Rare", model: "mx_cls_racer_walk" },
  { name: "Ghost Hacker", rarity: "Legendary", model: "mx_cls_hacker_walk" },
  { name: "Iron Engineer", rarity: "Rare", model: "mx_cls_engineer_walk" },
  { name: "Vex the Fixer", rarity: "Legendary", model: "mx_npc_vex_walk" },
  { name: "Thunder Spear", rarity: "Mythic", model: "mx_gr_thunderspear", yaw: 0, roll: 0.785 },
  { name: "Leviathan Scale", rarity: "Mythic", model: "mx_gr_levscale" },
  { name: "Frost Fang Blade", rarity: "Epic", model: "mx_dr_w_frost", yaw: 1.57, roll: 0.785 },
  { name: "Oni Helm", rarity: "Legendary", model: "mx_gr_helm_oni" },
  { name: "Chrono Cube", rarity: "Legendary", model: "mx_chrono_cube" },
  { name: "Nova Bomb", rarity: "Epic", model: "mx_nova_bomb" },
  { name: "Cosmic Edge", rarity: "Legendary", model: "mx_dr_w_cosmic", yaw: 1.57, roll: 0.785 },
  { name: "Extra Coin", rarity: "Rare", model: "mx_extra_coin" },
  { name: "Electric Leviathan", rarity: "Mythic", model: "mx_raid_all", node: "rd_lev_head" },
  { name: "Gold Dragon", rarity: "Mythic", model: "mx_dr_golddragon" },
  { name: "Crimson Drake", rarity: "Legendary", model: "mx_dr_dragon" },
  { name: "Reaper Mk-II", rarity: "Legendary", model: "mx_mon_robot_reaper_walk" },
  { name: "Colossus Mech", rarity: "Epic", model: "mx_colossus_mech", bright: 0.7 },
  { name: "Twin-Head Ogre", rarity: "Epic", model: "mx_dr_twinhead_walk" },
  { name: "Alpha Werewolf", rarity: "Rare", model: "mx_dr_werewolf_walk" },
  { name: "The Watcher", rarity: "Legendary", model: "mx_dr_watcher" },
  { name: "Legion Officer", rarity: "Rare", model: "mx_legion_officer_walk" },
  { name: "Rook the Smith", rarity: "Epic", model: "mx_npc_rook_walk" },
];

export const RARITY_COLOR: Record<NftRarity, string> = {
  Common: "#9aa3b5",
  Rare: "#3fa9ff",
  Epic: "#b45cff",
  Legendary: "#ffb800",
  Mythic: "#ff2a6d",
};
