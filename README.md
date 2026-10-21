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
- `game/src/game/store.ts`: trạng thái game (vị trí, District, biểu cảm, đang lái xe nào)
- `game/src/game/refs.ts`: handle vật lý của nhân vật và xe, đọc mỗi frame
- `game/src/game/config.ts`: thông số thế giới và bảng màu

## Asset và giấy phép

- Nhân vật: RobotExpressive của Tomás Laulhé (Quaternius), chỉnh sửa bởi Don McCurdy, CC0 1.0.
- Mọi thứ khác (nhà, biển hiệu, mưa) được sinh bằng code.

## Lộ trình

- [x] Giai đoạn 0: khu phố neon, nhân vật đi/chạy/nhảy, camera góc nhìn thứ 3, deploy web
- [x] Giai đoạn 1: lên xuống xe, lái xe, camera ngửa lên, cảm ứng trên điện thoại
- [ ] Giai đoạn 2: chiến đấu, kẻ địch OMNI-DYNE, $CRED off-chain, shop, truy nã
- [ ] Giai đoạn 3: tạo nhân vật, túi đồ, NPC, nhiệm vụ
- [ ] Giai đoạn 4: multiplayer
- [ ] Giai đoạn 5: token và NFT
- [ ] Giai đoạn 6: Root Protocol Hunt

## Ghi chú kỹ thuật

- Bước vật lý do `PhysicsStepper` trong `App.tsx` điều khiển: mỗi frame một bước, tối đa 1/30 giây.
  ecctrl cộng lực theo từng frame, nên bước cố định (nhiều bước/frame) làm xe yếu, còn bước theo frame
  không giới hạn làm vật lý nổ khi FPS thấp.
- Bánh xe chỉ được gắn sau khi thân xe đọc được trọng lực (`wheelsOn` trong `Vehicles.tsx`).
  Nếu không, frame đầu ecctrl chia cho 0 và sinh NaN làm Rapier panic.
- Thêm `?debug` vào URL để lộ `window.__game`, `window.__handles`, `window.__r3f` khi kiểm thử;
  `?nofx` tắt hậu kỳ, `?nocars` bỏ xe.
