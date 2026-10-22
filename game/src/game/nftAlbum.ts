// Album NFT "CYBERHOOD Genesis" chiếu trên bảng LED khổng lồ ở sảnh: nhân vật, vật phẩm, quái thú hiếm trong game.
// Ảnh render từ model 3D (nftbake.html?raw=512) rồi vẽ lại thành pixel art bằng PixelLab, ghép thành atlas nhúng trong nftAtlas.ts.

export const NFT_CELL = 128;
export const NFT_COLS = 6;

export type NftRarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
export type NftItem = {
  name: string;
  kind: "Hunter" | "Item" | "Beast";
  rarity: NftRarity;
  /** Giá niêm yết (ETH) */
  price: number;
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
  { name: "Shadow Ninja", kind: "Hunter", rarity: "Epic", price: 0.42, model: "mx_cls_ninja_walk" },
  { name: "Ronin Samurai", kind: "Hunter", rarity: "Epic", price: 0.45, model: "mx_cls_samurai_walk" },
  { name: "Neon Racer", kind: "Hunter", rarity: "Rare", price: 0.28, model: "mx_cls_racer_walk" },
  { name: "Ghost Hacker", kind: "Hunter", rarity: "Legendary", price: 1.2, model: "mx_cls_hacker_walk" },
  { name: "Iron Engineer", kind: "Hunter", rarity: "Rare", price: 0.31, model: "mx_cls_engineer_walk" },
  { name: "Vex the Fixer", kind: "Hunter", rarity: "Legendary", price: 1.65, model: "mx_npc_vex_walk" },
  { name: "Thunder Spear", kind: "Item", rarity: "Mythic", price: 4.2, model: "mx_gr_thunderspear", yaw: 0, roll: 0.785 },
  { name: "Leviathan Scale", kind: "Item", rarity: "Mythic", price: 3.8, model: "mx_gr_levscale" },
  { name: "Frost Fang Blade", kind: "Item", rarity: "Epic", price: 0.66, model: "mx_dr_w_frost", yaw: 1.57, roll: 0.785 },
  { name: "Oni Helm", kind: "Item", rarity: "Legendary", price: 1.05, model: "mx_gr_helm_oni" },
  { name: "Chrono Cube", kind: "Item", rarity: "Legendary", price: 1.33, model: "mx_chrono_cube" },
  { name: "Nova Bomb", kind: "Item", rarity: "Epic", price: 0.58, model: "mx_nova_bomb" },
  { name: "Cosmic Edge", kind: "Item", rarity: "Legendary", price: 1.48, model: "mx_dr_w_cosmic", yaw: 1.57, roll: 0.785 },
  { name: "Extra Coin", kind: "Item", rarity: "Rare", price: 0.12, model: "mx_extra_coin" },
  { name: "Electric Leviathan", kind: "Beast", rarity: "Mythic", price: 12.5, model: "mx_raid_all", node: "rd_lev_head" },
  { name: "Gold Dragon", kind: "Beast", rarity: "Mythic", price: 9.9, model: "mx_dr_golddragon" },
  { name: "Crimson Drake", kind: "Beast", rarity: "Legendary", price: 3.1, model: "mx_dr_dragon" },
  { name: "Reaper Mk-II", kind: "Beast", rarity: "Legendary", price: 2.4, model: "mx_mon_robot_reaper_walk" },
  { name: "Colossus Mech", kind: "Beast", rarity: "Epic", price: 1.9, model: "mx_colossus_mech", bright: 0.7 },
  { name: "Twin-Head Ogre", kind: "Beast", rarity: "Epic", price: 0.95, model: "mx_dr_twinhead_walk" },
  { name: "Alpha Werewolf", kind: "Beast", rarity: "Rare", price: 0.74, model: "mx_dr_werewolf_walk" },
  { name: "The Watcher", kind: "Beast", rarity: "Legendary", price: 2.75, model: "mx_dr_watcher" },
  { name: "Legion Officer", kind: "Hunter", rarity: "Rare", price: 0.36, model: "mx_legion_officer_walk" },
  { name: "Rook the Smith", kind: "Hunter", rarity: "Epic", price: 0.52, model: "mx_npc_rook_walk" },
];

export const RARITY_COLOR: Record<NftRarity, string> = {
  Common: "#9aa3b5",
  Rare: "#3fa9ff",
  Epic: "#b45cff",
  Legendary: "#ffb800",
  Mythic: "#ff2a6d",
};
