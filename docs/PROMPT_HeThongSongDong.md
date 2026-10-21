# Prompt: làm lại hệ thống người đi bộ và giao thông

Dán nguyên phần dưới cho AI code (Claude Code hoặc tương tự) khi làm việc trong repo này.

---

Bạn đang làm việc trong repo Cyberhood: game thế giới mở góc nhìn thứ 3 kiểu GTA, chạy trên trình duyệt (React Three Fiber, three.js, Rapier, ecctrl, zustand). Thành phố là lưới 4x4 block (`CITY` trong `game/src/game/config.ts`: block 40m, đường 16m, vỉa hè cao 0.15m, gốc toạ độ là một ngã tư). Người đi bộ và xe chạy nằm trong `game/src/game/Life.tsx` (`Crowd`, `MeshyWalker`, `Robots`, `Traffic`, `TrafficGroup`). Animation Meshy được xử lý trong `meshyAnim.ts` (`inPlace`, `once`).

## Vấn đề hiện tại (đã đọc code)

Người đi bộ:
1. Ai cũng chỉ đi vòng quanh đúng một block mãi mãi (`ringPoint`), không sang đường, không có điểm đến.
2. Tới góc block thì quay ngoắt 90 độ trong 1 frame (`SIDE_YAW[side]`), không có đường cong.
3. Tốc độ di chuyển (1.05 đến 1.5 m/s, ngẫu nhiên) không khớp nhịp bước của clip Walk, nên chân trượt trên mặt đất.
4. Khi bị người chơi chắn thì `mixer.update` bị bỏ qua: nhân vật đông cứng giữa bước thay vì chuyển sang đứng thở.
5. Clip Walk của Soldier (Mixamo) được ép lên avatar VRM có tỉ lệ khác nên dáng đi lệch, tay chân kỳ.
6. Không né nhau, xuyên qua nhau.

Giao thông:
1. Mỗi xe chạy thẳng một trục X hoặc Z, không bao giờ rẽ ở ngã tư.
2. Xe trục X và xe trục Z cắt nhau ở ngã tư và đi xuyên qua nhau, không có đèn hay luật ưu tiên.
3. Xe chỉ nhường người chơi, không nhường xe phía trước, nên chồng lên nhau.
4. Dừng và chạy tức thì (vận tốc nhảy từ 0 lên 13 m/s), không gia tốc, không phanh.
5. Ra khỏi rìa thành phố thì dịch chuyển tức thời sang rìa bên kia, nhìn thấy được.
6. Bánh xe không quay, thân xe không nghiêng.

## Mục tiêu

Thành phố trông "vào khuôn": người đi đúng vỉa hè, dáng đi tự nhiên, sang đường ở vạch, xe chạy đúng làn, rẽ ở ngã tư, dừng đèn đỏ, giữ khoảng cách, tăng giảm tốc mượt. Không tụt FPS (giữ instancing cho xe, giữ cắt animation theo khoảng cách).

## Việc cần làm

### 1. Đồ thị đường (file mới `game/src/game/roadGraph.ts`, không phụ thuộc React)

- Sinh từ `CITY`, `CITY_PITCH`, `CITY_HALF`, `BLOCK_CENTERS`. Hàm thuần, có thể test.
- **Đồ thị xe**: nút là các ngã tư (5x5), cạnh là đoạn đường giữa hai ngã tư. Mỗi đoạn có 2 làn (một làn mỗi chiều, đi bên phải, tâm làn cách tim đường khoảng 2.6m, đọc từ hằng số chứ không viết cứng). Trong mỗi ngã tư sinh sẵn các đường nối làn: đi thẳng, rẽ phải (bán kính nhỏ), rẽ trái (bán kính lớn, đi qua giữa ngã tư). Đường nối là đường cong Bezier bậc 2 hoặc cung tròn, lấy mẫu sẵn thành polyline có độ dài tích luỹ để tra vị trí theo quãng đường `s`.
- **Đồ thị người đi bộ**: nút là 4 góc vỉa hè của mỗi block, cạnh là đoạn vỉa hè dọc block và đoạn vạch qua đường nối góc block này sang góc block bên cạnh. Góc vỉa hè bo tròn (bán kính 1.5 đến 2m), không có góc vuông.
- API gợi ý: `lanePoint(laneId, s, outPos, outTangent)`, `nextLanes(laneId)`, `crosswalkFor(nodeId)`, `randomRoute(rand, startNode, length)`.
- Viết test vitest: các làn liền mạch (điểm cuối làn A trùng điểm đầu đường nối, sai số dưới 1cm), tiếp tuyến liên tục, không làn nào nằm trên vỉa hè hoặc trong collider toà nhà.

### 2. Đèn giao thông (`game/src/game/traffic/signals.ts`)

- Mỗi ngã tư một máy trạng thái 2 pha: X xanh, X vàng, cả hai đỏ (0.8s), Z xanh, Z vàng, cả hai đỏ. Xanh 9s, vàng 2.5s. Lệch pha giữa các ngã tư theo khoảng cách để tạo "làn sóng xanh".
- Đèn cho người đi bộ dùng chung pha: người được qua vạch khi xe cùng hướng song song đang xanh.
- Dựng đèn thật trên phố (cột và 3 bóng, phát sáng, instancing), màu đổi theo pha. Ngã tư ở rìa thành phố có thể bỏ đèn.

### 3. Xe AI (thay `Traffic` và `TrafficGroup`)

- Mỗi xe có: `laneId`, `s`, `v`, `vMax` (8 đến 13 m/s, rẽ thì giảm theo độ cong, rẽ trái khoảng 5 m/s), `route` (dãy làn kế tiếp, chọn ngẫu nhiên có trọng số: thẳng 60%, phải 25%, trái 15%; không quay đầu).
- Điều khiển tốc độ theo mô hình IDM (Intelligent Driver Model) hoặc tương đương: tăng tốc tối đa khoảng 2.5 m/s², phanh êm khoảng 4 m/s², phanh gấp tối đa 8 m/s², khoảng cách an toàn tối thiểu 2.5m cộng thời gian bám 1.2s.
- Vật cản phía trước (lấy cái gần nhất): xe trước cùng làn hoặc trên làn sắp vào, vạch dừng khi đèn đỏ hoặc vàng mà không kịp qua, người đi bộ đang trên vạch phía trước, người chơi hoặc xe người chơi nằm trong hành lang trước mũi xe.
- Chỉ vào ngã tư khi làn ra còn chỗ (tránh kẹt giữa ngã tư). Rẽ trái phải nhường xe đi thẳng ngược chiều.
- Hướng xe lấy từ tiếp tuyến làn, làm mượt bằng slerp, không đặt yaw cứng theo trục.
- Quay bánh theo `v`, thân xe nghiêng nhẹ theo gia tốc ngang và dọc (chỉ phần hiển thị). Đèn phanh sáng khi giảm tốc.
- Không dịch chuyển tức thời ở rìa thành phố: xe đi hết mạng đường thì rẽ hoặc quay vòng theo đồ thị. Nếu cần sinh lại thì chỉ sinh và huỷ ở chỗ ngoài tầm nhìn camera và cách người chơi trên 60m.
- Giữ instancing theo model như hiện tại. Mỗi frame chỉ cập nhật ma trận; xe xa trên 120m thì mô phỏng 5 lần mỗi giây.
- Va chạm: xe AI mang collider kinematic (Rapier `kinematicPosition`) để người chơi và xe người chơi đâm được. Khi bị đâm mạnh thì dừng 2s, bấm còi (nếu có âm thanh), rồi chạy tiếp.

### 4. Người đi bộ AI (thay `Crowd`, `MeshyWalker`, `Robots` dùng chung một bộ não)

- Mỗi người có lộ trình trên đồ thị người đi bộ: đi dọc vỉa hè, tới góc thì có thể rẽ, hoặc chờ đèn rồi qua vạch sang block khác. Thỉnh thoảng (khoảng 10%) dừng lại đứng chờ, nghe điện thoại hoặc vẫy tay 3 đến 8s ở điểm hợp lệ (không chắn lối, tránh `KEEP_CLEAR`).
- Lệch ngang ngẫu nhiên trong bề rộng vỉa hè (mỗi người một offset cố định ±1.2m) để không đi thành hàng một.
- Vận tốc mượt: tăng giảm tốc khoảng 1.5 m/s². Hướng quay mượt (tối đa khoảng 270 độ mỗi giây, slerp về hướng tiếp tuyến), không bao giờ quay ngoắt.
- Né tránh: steering đơn giản kiểu separation cộng avoidance (hoặc RVO rút gọn) với người xung quanh trong bán kính 2m, dùng lưới không gian (spatial hash ô 4m) để không phải O(n²). Né người chơi bằng cách bước lệch sang bên, chỉ dừng khi thật sự không lách được.
- Phản ứng: người chơi rút súng hoặc bắn gần trong 15m thì chạy (clip Run) theo hướng ra xa; bị xe người chơi lao tới thì nhảy tránh hoặc chạy.
- Sang đường chỉ khi đèn người đi bộ xanh. Nếu đèn chuyển khi đang giữa đường thì đi nhanh hơn cho hết, không quay lại.

### 5. Animation và dáng đi (phần quan trọng nhất cho cảm giác "liền mạch")

- Mỗi nhân vật có bộ clip tối thiểu: Idle, Walk, Run (thêm Talk, Wave nếu có). Chuyển clip luôn dùng `crossFadeTo` 0.2 đến 0.3s, không bao giờ `stop()` rồi `play()` cứng.
- **Khớp nhịp bước với vận tốc** để hết trượt chân: đo một lần tốc độ "gốc" của mỗi clip (quãng đường bàn chân hoặc Hips đi được trong một chu kỳ chia cho thời lượng clip, hoặc đặt thủ công trong một bảng cấu hình như `WALK_REF = 1.4 m/s`, `RUN_REF = 3.8 m/s`), rồi `action.timeScale = v / refSpeed`, kẹp trong khoảng 0.7 đến 1.3. Ngoài khoảng đó thì blend giữa Walk và Run theo trọng số thay vì kéo timeScale.
- Blend Idle, Walk, Run theo vận tốc (blend 1 chiều): đặt trọng số cho 3 action cùng lúc, chạy đồng bộ pha Walk và Run (`syncWith`) để chân không lệch nhịp khi chuyển.
- Khi đứng (bị chặn, chờ đèn): vận tốc giảm dần về 0, trọng số chuyển về Idle. Mixer vẫn cập nhật bình thường, tuyệt đối không bỏ `mixer.update` khi đứng yên.
- Avatar VRM 100Avatars: kiểm tra lại retarget từ clip Mixamo của Soldier. Bỏ track position của mọi xương trừ Hips (giống `inPlace`), chuẩn hoá chiều cao Hips theo tỉ lệ chiều cao nhân vật để không lơ lửng hoặc lún. Avatar nào vẫn méo sau retarget thì loại khỏi danh sách đi bộ, chỉ để đứng.
- Clip Meshy: tiếp tục dùng `inPlace`. Kiểm tra clip đi có vòng lặp liền (khung đầu và khung cuối khớp), nếu không thì cắt bớt khung cuối.
- Lệch pha ngẫu nhiên điểm bắt đầu clip giữa các người để không bước đồng loạt.
- Chân bám đất: đặt `root.position.y` theo mặt đất thật (vỉa hè 0.15m, mặt đường 0) và chuyển cao độ mượt khi bước xuống vạch qua đường.
- Cắt theo khoảng cách (LOD animation): dưới 25m cập nhật mỗi frame, 25 đến 50m cập nhật 15 lần mỗi giây (cộng dồn dt), 50 đến 80m chỉ di chuyển không animate, trên 80m ẩn. Đặt các ngưỡng thành hằng số.

### 6. Cấu trúc code

- Tách phần mô phỏng (đồ thị, đèn, IDM, steering) ra khỏi phần React và three, đặt trong `game/src/game/traffic/` với hàm thuần nhận `dt` và trạng thái, có test vitest. Component trong `Life.tsx` chỉ đọc trạng thái và đặt ma trận hoặc transform.
- Mọi con số (tốc độ, gia tốc, thời gian đèn, bán kính né, ngưỡng LOD, mật độ) gom vào một object cấu hình (ví dụ `LIFE` trong `config.ts`), có thể chỉnh bằng leva khi bật chế độ debug.
- Thêm chế độ debug (phím hoặc leva): vẽ làn, đường nối ngã tư, trạng thái đèn, vector vận tốc và mục tiêu của mỗi agent.
- Giữ nguyên `KEEP_CLEAR`, logic Hub, NPC nhiệm vụ, xe đậu và `quality: "high" | "low"` (low: giảm số người và xe, tắt né tránh chi tiết).
- Không đổi hành vi người chơi, camera, nhiệm vụ.

## Tiêu chí nghiệm thu

- Đứng ở một ngã tư 2 phút: không xe nào xuyên xe nào, không xe nào vượt đèn đỏ, xe rẽ theo đường cong, có hàng xe chờ đèn và chạy lần lượt khi xanh.
- Đi bộ cạnh người đi đường: chân không trượt, không ai quay ngoắt ở góc phố, không ai đông cứng giữa bước, không ai đi xuyên nhau.
- Người đi bộ sang đường ở vạch khi đèn xanh, xe dừng trước vạch.
- Không thấy xe hay người dịch chuyển tức thời trong tầm nhìn.
- FPS bản build ở chất lượng high không giảm quá 10% so với trước. Đo bằng `npm run build && npm run preview`.
- `npm run lint`, `npm test`, `npm run build` đều sạch.

Làm theo thứ tự: 1 (đồ thị và test), 3 (xe), 2 (đèn), 5 (animation), 4 (người đi bộ), 6 (debug). Sau mỗi bước chạy game kiểm tra rồi commit riêng.
