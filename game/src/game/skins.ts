/** Ngoại hình nhân vật người chơi. Soldier là model Mixamo gốc; các lớp còn lại là nhân vật rig bằng Meshy */
export type HunterSkin = "soldier" | "racer" | "engineer" | "samurai" | "ninja" | "hacker";

export const SKINS: { id: HunterSkin; name: string; blurb: string }[] = [
  { id: "soldier", name: "Soldier", blurb: "Giáp chiến thuật, đổi màu theo Netrunner ID" },
  { id: "racer", name: "Racer", blurb: "Tay đua đường phố, áo khoác sọc neon" },
  { id: "engineer", name: "Engineer", blurb: "Kỹ sư mech, găng tay thuỷ lực" },
  { id: "samurai", name: "Samurai", blurb: "Giáp samurai sợi carbon" },
  { id: "ninja", name: "Ninja", blurb: "Sát thủ tàng hình, mặt nạ quang học" },
  { id: "hacker", name: "Hacker", blurb: "Netrunner hoodie, kính dữ liệu" },
];
