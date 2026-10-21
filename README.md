# Cyberhood

Game nhập vai thế giới mở góc nhìn thứ 3, phong cách cyberpunk, chạy trên trình duyệt.

## Chạy thử

```bash
cd game
npm install
npm run dev      # http://localhost:5173
npm run build    # bản production trong game/dist
```

## Công nghệ

- React Three Fiber, three.js: render 3D
- Rapier (`@react-three/rapier`): vật lý
- ecctrl: điều khiển nhân vật góc nhìn thứ 3, camera, joystick cảm ứng
- @react-three/postprocessing: bloom neon

## Cấu trúc

- `game/src/game/City.tsx`: thành phố sinh theo seed (toà nhà, viền neon, biển hiệu, đèn đường, va chạm)
- `game/src/game/Atmosphere.tsx`: bầu trời, mưa, xe bay, ánh sáng, sương
- `game/src/game/Player.tsx`: nhân vật, animation, input, lên/xuống xe
- `game/src/game/Vehicles.tsx`: xe (thân xe, bánh, đèn), danh sách xe đậu, lật xe
- `game/src/game/CameraRig.tsx`: camera góc nhìn thứ 3, tự bám đuôi xe, phím F/R
- `game/src/game/store.ts`: trạng thái game (vị trí, xe, máu, CRED, truy nã, nâng cấp, lưu tiến trình)
- `game/src/game/assets.ts`: nạp model và âm thanh nhúng trong bundle
- `game/src/game/Enemies.tsx`: drone OMNI-DYNE (tuần tra, truy đuổi, bắn), sát thương, hồi sinh
- `game/src/game/Weapons.tsx`: súng gắn tay robot, bắn/ngắm, trợ ngắm, tự ngắm trên điện thoại
- `game/src/game/Effects.tsx`: vệt laser, vụ nổ, chip CRED rơi ra và nhặt
- `game/src/game/Shop.tsx`: quầy chợ đen Neon Bazaar và người bán
- `game/src/game/GameRules.tsx`: hồi máu, hạ sao truy nã, flatline và hồi sinh
- `game/src/game/world.ts`: truy vấn hình học nhanh (tia/hộp toà nhà, tầm nhìn)
- `game/src/game/story.ts`: **nội dung cốt truyện dạng dữ liệu** (NPC, vật phẩm, nhiệm vụ, địa điểm). Viết thêm nhiệm vụ ở đây
- `game/src/game/quests.ts`: bộ máy nhiệm vụ (nhận việc, tiến độ, thưởng, hội thoại, dịch chuyển vault, mục tiêu)
- `game/src/game/Npcs.tsx`: NPC, mảnh dữ liệu, cột sáng chỉ đường, quét tương tác phím E
- `game/src/game/Vault.tsx`: Server Vault (model hành lang, va chạm, terminal, hologram GHOST_0) và cửa vào
- `game/src/game/Visuals.tsx`: môi trường phản chiếu neon, quảng cáo hologram, máy bán hàng, hơi nước
- `game/src/game/pointer.ts`: khoá chuột kiểu game PC
- `game/src/game/Kit.tsx`: dựng phố bằng bộ model Polygonal Mind (mặt tiền, biển neon, đèn đường, máy bán hàng, tàu bay), tất cả dùng instancing
- `game/src/ui/`: HUD, minimap, chợ đen, tạo nhân vật, hội thoại, túi đồ, tracker nhiệm vụ
- `game/src/game/refs.ts`: handle vật lý của nhân vật và xe, đọc mỗi frame
- `game/src/game/config.ts`: thông số thế giới và bảng màu

## Asset và giấy phép

Chi tiết trong `game/src/assets/LICENSES.md`. Tóm tắt:

- Người chơi: Soldier (Mixamo). NPC và hologram: Xbot (Mixamo).
- Xe: "Car Concept" của Eric Chadwick / Darmstadt Graphics Group, **CC-BY 4.0** (đã bỏ logo Khronos).
- Drone, súng, âm thanh: Kenney Starter Kit FPS, CC0.
- Server Vault: "Space Ship Hallway" của yeeyeeman, **CC-BY 4.0, bắt buộc ghi công** (đã ghi trong màn tạo nhân vật và túi đồ).
  File đã được nén lượng tử hoá (KHR_mesh_quantization) bằng gltf-transform.
- Nóc nhà (module mái, pin mặt trời, bãi đáp, tuabin): KayKit Space Base Bits, CC0.
- Mặt tiền phố Nhật, ban công, biển neon, đèn đường, máy bán hàng, tàu bay, monorail, chậu cây, cổng vault: Polygonal Mind, CC0
  (github.com/ToxSam/cc0-models-Polygonal-Mind). 50 model gộp vào `pm-kit.glb`, nén từ 330 MB còn 2,1 MB.
- Khối nhà, xe, mưa, hologram: sinh bằng code.

### Cách thêm model mới vào kit

1. Tải các file `.glb` (CC0 hoặc CC-BY) vào một thư mục.
2. Gộp và nén: `gltf-transform merge *.glb m.glb && gltf-transform prune m.glb p.glb && gltf-transform resize p.glb r.glb --width 1024 --height 1024 && gltf-transform webp r.glb w.glb && gltf-transform quantize w.glb pm-kit.glb`
3. Dùng trong code: `<KitInstances name="TênModel" matrices={...} />` (xem `Kit.tsx`).
4. Ghi nguồn và giấy phép vào `game/src/assets/LICENSES.md`.

## Lộ trình

- [x] Giai đoạn 0: khu phố neon, nhân vật đi/chạy/nhảy, camera góc nhìn thứ 3, deploy web
- [x] Giai đoạn 1: lên xuống xe, lái xe, camera ngửa lên, cảm ứng trên điện thoại
- [x] Giai đoạn 2: chiến đấu, drone OMNI-DYNE, $CRED off-chain, chợ đen, truy nã, minimap
- [x] Giai đoạn 3: Netrunner ID, túi đồ, NPC có hội thoại, 5 nhiệm vụ cốt truyện, Server Vault; nâng cấp hình ảnh
- [ ] Giai đoạn 4: multiplayer
- [ ] Giai đoạn 5: token và NFT
- [ ] Giai đoạn 6: Root Protocol Hunt

## Ghi chú kỹ thuật

- Model lớn nằm ở `game/public/models/` và được tải khi chạy (`fetchGlb` trong `assets.ts`), để file JS
  dưới giới hạn và màn hình tải hiện được tiến độ thật. Model nhỏ (Kenney) nhúng thẳng trong bundle.
- Toà nhà được gộp thành vài lưới theo vật liệu; thân xe, bánh xe, drone cũng gộp lưới theo vật liệu
  để giảm lệnh vẽ. Nhóm instancing đông được chia theo 4 góc phần tư để camera loại phần khuất.
- Môi trường phản chiếu neon được nướng bằng `PMREMGenerator` từ một cảnh riêng (không dùng
  `Environment` của drei: các tấm sáng của nó bị lọt vào cảnh chính).

- Bước vật lý do `PhysicsStepper` trong `App.tsx` điều khiển: mỗi frame một bước, tối đa 1/30 giây.
  ecctrl cộng lực theo từng frame, nên bước cố định (nhiều bước/frame) làm xe yếu, còn bước theo frame
  không giới hạn làm vật lý nổ khi FPS thấp.
- Bánh xe chỉ được gắn sau khi thân xe đọc được trọng lực (`wheelsOn` trong `Vehicles.tsx`).
  Nếu không, frame đầu ecctrl chia cho 0 và sinh NaN làm Rapier panic.
- Thêm `?debug` vào URL để lộ `window.__game`, `window.__handles`, `window.__r3f` khi kiểm thử;
  `?nofx` tắt hậu kỳ, `?nocars` bỏ xe.
- Tiến trình (CRED, nâng cấp, số lần hạ gục) lưu trong `localStorage` của trình duyệt, key `cyberhood.save.v1`.
  Đây là bản off-chain; giai đoạn 5 sẽ chuyển CRED lên blockchain với server ký phiếu thưởng.
