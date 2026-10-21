# Model tạo bằng Meshy

Tạo ngày 21/10/2026 bằng Meshy API (text-to-3d, `ai_model: latest`, preview → refine PBR; nhân vật gắn xương bằng `/openapi/v1/rigging`) trên tài khoản của chủ dự án. Mỗi model tốn 30 credit (preview 20 + refine 10); gắn xương đi kèm animation đi/chạy cơ bản.

- Số dư trước: 875 credit · sau: 415 credit (15 model + 1 model thử).
- File gốc (chưa nén) không đưa vào repo; bản trong game đã nén texture WebP bằng gltf-transform (`public/models/mx_*.glb`).
- **Điều khoản:** theo điều khoản của Meshy, model tạo bằng gói trả phí thuộc quyền sở hữu của người tạo, dùng thương mại được; model tạo bằng gói miễn phí theo giấy phép CC BY 4.0 (phải ghi công Meshy). Chủ dự án nên kiểm tra lại gói đang dùng trên meshy.ai trước khi phát hành.
- API key **không** được lưu trong repo. Chạy lại: xem script mẫu ở cuối file.

| Model | Dùng trong game | File | Preview task | Refine task | Prompt |
|---|---|---|---|---|---|
| archivist | NPC Archivist đi dạo ở Hub | `mx_archivist_walk.glb`, `mx_archivist_run.glb` | `01a15d91-9a33-7258-9bb4-fa1e102b2761` | `01a15d92-4abb-7258-a397-9ffd19dd9676` | full body old male hacker sage character, long dark hooded coat with glowing cyan LED circuit patterns, short white beard, augmented reality glasses with cyan glow, cyberpunk librarian, standing in T-pose, game character, original design, high detail |
| battery_cell | Pin năng lượng nhặt trong hợp đồng + kệ vật phẩm | `mx_battery_cell.glb` | `01a15d8f-f653-70ae-965c-c582840ebc50` | `01a15d90-a894-77d7-a292-6ef9ba8045f9` | futuristic cyberpunk energy battery cell, cylindrical canister with glowing cyan liquid core visible through glass windows, black metal caps with hazard stripes, neon cyan lights, game item, high detail |
| chrono_cube | Kệ vật phẩm | `mx_chrono_cube.glb` | `01a15d93-fa4e-7458-abea-7b95976af59d` | `01a15d95-8bb9-7303-9198-01fc54655dee` | mysterious time manipulation cube artifact, glowing blue holographic panels, clock dials and rotating rings inside transparent faces, metallic corners, sci-fi game item, high detail |
| colossus_mech | Mech Colossus trưng bày ở rìa đông | `mx_colossus_mech.glb` | `01a15d91-9a30-764c-acef-853310820b89` | `01a15d92-aed6-7268-a4f4-5128d2ac1526` | huge heavy humanoid mech robot, white and cobalt blue armor plates, massive fists and broad shoulders, glowing cyan energy core in chest, cyberpunk heroic giant robot, standing pose, original design, highly detailed game asset |
| director_vane_mech | Tượng mech trùm cuối ở rìa nam thành phố | `mx_director_vane_mech.glb` | `01a15d91-9a2d-70c7-aec9-414e883d5a4b` | `01a15d93-5447-70d2-a9a9-5a7120b4fd54` | giant menacing bipedal war mech boss, crimson red and black heavy armor, transparent glass cockpit dome in the chest, two large shoulder-mounted cannons, glowing orange neon vents and eyes, hydraulic legs, cyberpunk megacorporation villain machine, standing pose, original design, highly detailed game boss |
| easter_egg | Kệ vật phẩm | `mx_easter_egg.glb` | `01a15d95-0abc-7765-867e-785cf7a27955` | `01a15d96-503d-7664-bc68-35a1bf609883` | ornate metallic egg artifact covered in engraved glowing golden circuit patterns, jewel inlays, legendary treasure, sci-fi game collectible, high detail |
| extra_coin | Kệ vật phẩm | `mx_extra_coin.glb` | `01a15d93-f023-71e1-8d52-a29e1bf6b4b6` | `01a15d94-c279-72c0-aa19-440e032f5ec0` | thick shiny gold arcade token coin engraved with the word NEXUS and circuit patterns on its face, glowing edge, game collectible item, high detail |
| legion_trooper | Lính Legion đi bộ (địch), có xương + clip walking/running | `mx_legion_trooper_walk.glb`, `mx_legion_trooper_run.glb` | `01a15d91-9a3f-7732-bc8a-8f8e19fc41ff` | `01a15d92-d26e-7015-9cb3-1669860695e8` | full body sci-fi cyberpunk soldier android of an evil megacorporation, sleek glossy black armor plates over dark grey bodysuit, fully enclosed helmet with a single horizontal glowing red visor strip, red neon accent lines on chest and arms, holding a compact EMP rifle, standing in T-pose, game character, original design, high detail |
| nova_bomb | Kệ vật phẩm | `mx_nova_bomb.glb` | `01a15d95-0ab0-769b-b97e-f537db1cfdbf` | `01a15d95-f196-714a-8433-dbaf39cbcfe9` | spherical energy bomb, metal cage frame around a glowing violet plasma core, warning lights, sci-fi cyberpunk grenade item, high detail |
| part_armor | Linh kiện Giáp hiện khi rơi đồ | `mx_part_armor.glb` | `01a15d96-7043-7206-83c2-179e84342188` | `01a15d97-61b2-74e0-9c04-a00dd0c4476a` | heavy mech armor plate component, layered titanium panels with bolts and glowing cyan trim, sci-fi game equipment part, high detail |
| part_core | Linh kiện Lõi hiện khi rơi đồ | `mx_part_core.glb` | `01a15d95-7176-74e7-a157-9cc9f9cc43ad` | `01a15d96-7c83-7601-a863-3de059fa28c0` | mech robot power core component, cylindrical reactor with glowing pink plasma inside, metal frame and cables, sci-fi game equipment part, high detail |
| part_engine | Linh kiện Động cơ hiện khi rơi đồ | `mx_part_engine.glb` | `01a15d96-ff6f-73da-b8fa-640e29da6b07` | `01a15d98-2ef7-7285-a0f6-b6436288aa08` | mech ion thruster engine component, round nozzle with glowing orange exhaust ring, turbine fins and pipes, sci-fi game equipment part, high detail |
| part_weapon | Linh kiện Vũ khí hiện khi rơi đồ | `mx_part_weapon.glb` | `01a15d96-9aa7-7646-b42a-bbb59181d23a` | `01a15d97-41fa-72c3-bb9c-85ed55ef1bf6` | mech arm railgun cannon weapon component, long barrel with magnetic coils glowing blue, heavy mount, sci-fi game equipment part, high detail |
| supply_crate | Thùng tiếp tế (sự kiện phút 4) | `mx_supply_crate.glb` | `01a15d93-7a3d-7631-80a3-d6a4227cf5a5` | `01a15d94-3ee0-7061-961f-da5f8309d6e5` | military sci-fi supply drop crate, reinforced dark metal container with glowing purple neon edges, hazard markings, handles and locks, parachute straps, game loot item, high detail |
| velocity_car | Xe Velocity trên bệ xoay ở Hub | `mx_velocity_car.glb` | `01a15d93-54b5-760a-be89-6e23a9e9f30f` | `01a15d94-5e96-7192-b488-ce356afe2d93` | low sleek futuristic cyberpunk racing sports car, matte black body with magenta and cyan neon light strips, wide rear wing, glowing wheel rims, aggressive aerodynamic design, original design, no logos, highly detailed game vehicle |

## Chạy lại

```bash
export MESHY_API_KEY=...   # không commit
export NODE_USE_ENV_PROXY=1  # khi chạy trong môi trường có proxy
node tools/meshy.mjs batch.json 4   # batch.json: [{name, prompt, polycount, pose?, rig?, height?}]
```
