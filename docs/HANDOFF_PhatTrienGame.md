# HANDOFF – TỔNG HỢP PHIÊN THIẾT KẾ GAME (dán nguyên file này vào phiên chat làm game)

## A. BỐI CẢNH DỰ ÁN
- Đã có sẵn: **web game hành động góc nhìn kiểu GTA** (thế giới mở, đi bộ, lái xe, bắn).
- Mục tiêu: biến thành **GameFi gắn Token Launchpad**, cảm hứng **Ready Player One** (săn 3 chìa → mở cổng → Easter Egg, biến hình Mech).
- Yêu cầu của chủ dự án (theo thứ tự đã chốt trong phiên):
  1. Dễ chơi, phiên ngắn, lặp lại gây cuốn.
  2. **Mỗi mùa có bộ map riêng**, vào chơi lấy thưởng; có **chế độ solo**.
  3. **Biến hình** thành Mech như trong phim.
  4. **Kinh tế token thật**: người chơi kiếm vật phẩm để **bán**, ngẫu nhiên săn được **đồ xịn để đấu giá / bán giá cao**.
  5. **Thế giới mở nhiều người chơi**, **tổ đội**, **bang phái**.

## B. CÁC QUYẾT ĐỊNH ĐÃ CHỐT (không thay đổi nếu chưa hỏi chủ dự án)
1. Game **rơi ĐỒ, không rơi token**; token luân chuyển chủ yếu giữa người chơi qua chợ/đấu giá.
2. Mech **ráp từ 4 linh kiện** (Lõi/Giáp/Vũ khí/Động cơ), có **độ bền** – sửa bằng token (chỗ tiêu token lớn nhất).
3. **5 độ hiếm** 60/30/8/1.8/0.2% + **1 Easter Egg độc nhất/mùa**; có pity; chênh sức mạnh tối đa **+35%** (PvP nén còn +20%).
4. Mùa 28 ngày: Neon City (Chìa Đồng) → Hollow Hotel (Ngọc Bích) → Warzone (Pha Lê) → Citadel Raid.
5. Hợp đồng 7 phút trong thế giới mở, có sự kiện phút 4 và điểm thoát; chết = mất 50% mảnh/đồ cấp thấp; **không bao giờ mất đồ Huyền thoại+ / đồ đang trang bị**.
6. Kênh 100 người/map; Vùng An toàn / PvE / PvP / Lãnh thổ; tổ đội 2–5 (đồ rơi riêng từng người); bang tới 100 người; công thành cuối tuần.
7. Launchpad: 4 tier cá nhân (Bronze/Silver/Gold/Diamond) + quỹ vé cho top 10 bang chia theo đóng góp; KYC; 1 ví = 1 tài khoản.
8. **Mọi logic quan trọng chạy ở server** (rơi đồ, điểm, sát thương, giao dịch). Client chỉ gửi input & hiển thị.
9. **Không bán rương ngẫu nhiên bằng tiền/token** (rủi ro cờ bạc). Công khai tỉ lệ rơi.
10. **Không dùng tên/hình có bản quyền** (OASIS, Sixers, Gundam, DeLorean…). Dùng tên tự đặt: NEXUS, IXO Corp, Legion, Titan Frame, Colossus, Velocity, Extra Coin, Chrono Cube, Nova Bomb.

## C. HƯỚNG DẪN CHO AI LÀM GAME
- Đọc **GDD (phần D)** để hiểu logic; dùng **config JSON (phần E)** làm nguồn số liệu duy nhất – không hardcode con số trong code.
- Làm theo **lộ trình mục 12** của GDD: MVP 0 (nền multiplayer) → MVP 1 (hợp đồng) → MVP 2 (biến hình) → MVP 3 (đồ) → Beta → Launch.
- Trước khi code, hãy **đọc code game GTA hiện có**, hỏi engine/stack nếu chưa rõ, và tích hợp vào kiến trúc sẵn có thay vì viết lại.
- Các con số trong config là **giá trị khởi điểm**, sẽ cân bằng lại theo dữ liệu beta → đặt chúng ở config/DB để chỉnh không cần deploy lại.
- Những điểm CẦN HỎI chủ dự án trước khi làm: engine & backend hiện tại, blockchain/chain nào cho token & NFT, tên game và tên token chính thức, thị trường mục tiêu (ảnh hưởng pháp lý/KYC).

## D. TÀI LIỆU THIẾT KẾ GAME (GDD v1.1)

## GAME DESIGN DOCUMENT – BẢN HOÀN CHỈNH
**Thể loại:** Web game hành động góc nhìn kiểu GTA · GameFi · gắn Token Launchpad
**Cảm hứng:** Ready Player One (săn chìa → mở cổng → tìm Easter Egg, biến hình Mech)
**Phiên bản:** 1.1 · 21/10/2026 (thêm thế giới mở nhiều người chơi, tổ đội, bang phái, PvP, công thành)

> ⚠️ **Tên gọi:** tất cả tên dưới đây (NEXUS, IXO Corp, Legion, Titan Frame…) là **tên tạm, tự đặt**. KHÔNG dùng tên/hình ảnh có bản quyền (OASIS, Sixers, Gundam, Iron Giant, DeLorean, Atari…). Dữ liệu gốc của phim để tham khảo nằm ở `ReadyPlayerOne_GameData.md`.
> Toàn bộ thông số cấu hình nằm ở `game_config.json` (khớp 100% với tài liệu này).

---

### 0. TÓM TẮT 1 TRANG

| Thành phần | Nội dung |
|---|---|
| **Fantasy** | Người chơi là "Hunter" trong thế giới ảo NEXUS, săn chìa qua 3 map mỗi mùa, biến hình thành Mech, săn đồ hiếm để bán / đấu giá. |
| **Vòng chơi chính** | Vào thế giới mở → nhận hợp đồng 7 phút (một mình hoặc tổ đội) → làm nhiệm vụ trên map → tích thanh biến hình → nhặt linh kiện + mảnh chìa → thoát map → nhận thưởng → nâng cấp/bán đồ → chơi lại |
| **Vòng chơi dài hạn** | Ngày (nhiệm vụ, chuỗi đăng nhập) → Tuần (mở map mới, gom chìa) → Mùa 4 tuần (Boss Raid, Easter Egg, suất Launchpad) |
| **Thế giới** | **Thế giới mở nhiều người chơi** (100 người/kênh), Vùng An toàn / PvE / PvP / Lãnh thổ |
| **Xã hội** | **Tổ đội 2–5 người** · **Bang phái** tới 100 người · Chiến tranh Lãnh thổ cuối tuần · World Boss |
| **Chế độ** | Hợp đồng trong thế giới mở (Solo / Tổ đội) · Solo Nhiệm vụ (bản riêng) · Solo Thử thách (xếp hạng) · PvP · Công thành · Raid |
| **Điểm nhấn** | Biến hình 3 dạng Mech · Đồ rơi ngẫu nhiên 5 độ hiếm + 1 món độc nhất/mùa |
| **Kinh tế** | Game **rơi ĐỒ, không rơi token**. Người chơi kiếm token bằng cách **bán đồ cho người chơi khác**. Token bị tiêu qua: sửa Mech, ghép đồ, phí chợ, đúc NFT, vé Raid. |
| **Launchpad** | Mỗi mùa = 1 dự án launch. Mở Cổng cuối + điểm mùa → vé whitelist / tier mua. |

---

### 1. BỐI CẢNH & PHE PHÁI

| Phe | Vai trò trong game | Cảm hứng từ phim |
|---|---|---|
| **Hunters** (người chơi) | Săn chìa, săn đồ | Gunters |
| **Squad 5 người** | Guild / đội | High Five |
| **IXO Corp** | Tập đoàn phản diện muốn chiếm NEXUS | IOI |
| **Legion** | Lính AI của IXO (mob thường, có súng EMP) | Sixers |
| **The Founder** | NPC đã mất, để lại cuộc thi Easter Egg; xuất hiện qua đoạn ký ức | Halliday |
| **The Archivist** | NPC hướng dẫn, mở lore, tặng item hiếm | The Curator / Ogden Morrow |
| **Director Vane** | Boss cuối mùa điều khiển Mech khổng lồ | Sorrento + Mechagodzilla |

**Class nhân vật gợi ý (chỉ ảnh hưởng nhẹ, ±10%):**
| Class | Mạnh | Mech hợp nhất |
|---|---|---|
| Racer | Tốc độ xe, drift tích thanh nhanh | Velocity |
| Engineer | Sửa Mech rẻ hơn 10%, ghép đồ +3% thành công | Colossus |
| Samurai | Cận chiến, máu cao | Titan Frame |
| Ninja | Né, tàng hình ngắn | Velocity |
| Hacker | Tắt khiên/camera nhanh hơn, giảm EMP | Titan Frame |

---

### 2. CẤU TRÚC MÙA (28 ngày)

| Tuần | Map mở | Chủ đề | Nhiệm vụ đặc trưng | Mục tiêu | Hệ số rơi đồ |
|---|---|---|---|---|---|
| 1 (ngày 0) | **Neon City** – Chìa Đồng | Thành phố đêm | Đua xe, cướp xe, giao hàng, rượt đuổi | 15 mảnh → Chìa Đồng | ×1.0 |
| 2 (ngày 7) | **Hollow Hotel** – Chìa Ngọc Bích | Khách sạn ma | Tìm đồ, sống sót, giải đố, né quái | 15 mảnh → Chìa Ngọc Bích | ×1.2 |
| 3 (ngày 14) | **Warzone** – Chìa Pha Lê | Hành tinh chiến tranh | Tấn công căn cứ Legion, phá khiên | 15 mảnh → Chìa Pha Lê | ×1.5 |
| 4 (ngày 21) | **Citadel Raid** | Lâu đài IXO | Phá khiên + đánh Boss Mech | Cần đủ 3 Chìa | ×2.0 |

**Quy tắc mùa**
- Map mở dần theo tuần nhưng **không đóng lại** → người vào muộn vẫn bắt kịp.
- Mùa sau **dùng lại map nền**, chỉ đổi: thời tiết, giờ trong ngày, vị trí marker, loại nhiệm vụ, boss, bộ đồ độc quyền mùa.
- Ai **đầu tiên** mở Cổng cuối → nhận **Easter Egg mùa** (1 món duy nhất, đấu giá được).
- Hết mùa: reset mảnh chìa, Chìa, Điểm mùa. **Giữ lại** level, đồ, Mech, token.

---

### 3. MỘT HỢP ĐỒNG (7 phút)

> Trong thế giới mở, đây là **Hợp đồng** nhận tại marker (một mình hoặc tổ đội). Ở Solo Nhiệm vụ, nó chạy trong bản riêng. Logic giống nhau.

```
[0:00] Spawn ngẫu nhiên trên map của mùa
       Bản đồ hiện 6 marker nhiệm vụ (chấm vàng như GTA)
[0:00–4:00] Chạy / lái xe tới marker → làm nhiệm vụ
       Mỗi nhiệm vụ: +100 điểm · +20% thanh biến hình · 1 lượt rơi đồ · 20% ra mảnh chìa
[4:00] SỰ KIỆN ngẫu nhiên (1 trong 3):
       - Thả hàng tiếp tế (đồ Sử thi trở lên, nhiều người tranh – ở Solo là Legion tranh)
       - Truy nã 5 sao (Legion đuổi, sống sót 60s → x2 điểm sự kiện)
       - Mini-boss Mech (bắt buộc biến hình mới đánh hiệu quả)
[4:00–7:00] Tiếp tục nhiệm vụ, tìm ĐIỂM THOÁT (hiện từ phút 5)
[Kết thúc] Thoát thành công → nhận 100% đồ + mảnh
           Chết / hết giờ chưa thoát → MẤT 50% mảnh chìa + 50% đồ nhặt trong trận (từ Hiếm trở xuống)
           (Đồ Huyền thoại/Thần thoại nhặt được KHÔNG bao giờ mất – tránh cảm giác ức chế)
```

**Công thức điểm & sao**
```
Điểm = Nhiệm vụ×100 + Hạ Legion×10 + Giây còn dư×2 + Điểm sự kiện (200–500)
Sao: 1★ ≥ 500 | 2★ ≥ 1200 | 3★ ≥ 2000
Hệ số thưởng: 1★ ×1.0 | 2★ ×1.5 | 3★ ×2.0
Chuỗi đăng nhập: +5%/ngày, tối đa +50% (10 ngày)
```

**Năng lượng:** tối đa 5, hồi 1/giờ. Solo Nhiệm vụ & Solo Thử thách tốn 1. Free Roam miễn phí.
Thêm năng lượng: nhiệm vụ ngày (+2), mời bạn (+1/bạn, tối đa 3/ngày), mua bằng token (giới hạn 5/ngày).

---

### 4. CHẾ ĐỘ CHƠI

| Chế độ | Mô tả | Năng lượng | Thưởng | Đồ cá nhân có tác dụng? |
|---|---|---|---|---|
| **Solo – Nhiệm vụ** (PvE) | Một mình đánh Legion, làm nhiệm vụ trên map mùa | 1 | Điểm mùa, mảnh chìa, đồ rơi, XP | ✅ Có |
| **Solo – Thử thách** | Cùng seed map cho tất cả, đua điểm/thời gian trong tuần | 1 | Xếp hạng tuần → token + vé whitelist cho top | ❌ **Đồ chuẩn hoá** (công bằng cho người không nạp) |
| **Free Roam** | Đi tự do, thử xe/Mech, khoe skin | 0 | Không rơi đồ, chỉ XP nhỏ | ✅ |
| **Citadel Raid** (tuần 4) | Phá khiên + Boss Mech | 1 + vé Raid | Tỉ lệ rơi ×2, Chìa → Cổng cuối | ✅ (yêu cầu Sức mạnh Mech ≥ 300) |
| **Hợp đồng Tổ đội** (2–5 người) | Nhận hợp đồng trong thế giới mở cùng tổ đội | 1/người | Như Solo Nhiệm vụ + bonus tổ đội | ✅ |
| **Vùng PvP** | Khu vực tự do bắn nhau, rơi đồ cao hơn | 0 (vào) / 1 (nhận hợp đồng) | Rơi ×1.5, nhặt đồ của người bị hạ | ✅ |
| **Chiến tranh Lãnh thổ** (cuối tuần) | Bang phái giành khu vực trên map | Vé công thành | Lãnh thổ, thuế, buff, xếp hạng bang | ✅ |
| **World Boss / Guild Raid** | 5–20 người đánh boss chung | 1 + vé Raid | Rơi ×2, điểm bang | ✅ |

---

### 4A. THẾ GIỚI MỞ NHIỀU NGƯỜI CHƠI

#### 4A.1 Cấu trúc thế giới
- Mỗi map của mùa là một **thế giới mở chạy liên tục** (persistent), chia thành **kênh (channel)**: tối đa **100 người/kênh**. Kênh đầy → tự mở kênh mới. Người chơi chuyển kênh tự do (hồi 60s), tổ đội & bang được ưu tiên vào cùng kênh.
- "Trận 7 phút" ở mục 3 trở thành **Hợp đồng**: nhận tại marker ngay trong thế giới mở, đồng hồ 7 phút chạy cho người/tổ đội nhận, người khác vẫn đi lại xung quanh.
- **Solo Nhiệm vụ** vẫn có, dưới dạng **bản riêng (instance)** cho ai muốn chơi một mình yên tĩnh.

#### 4A.2 Phân vùng trên mỗi map
| Vùng | PvP | Hoạt động | Hệ số rơi | Ghi chú |
|---|---|---|---|---|
| **Vùng An toàn** (Hub) | ❌ Tắt | Chợ, garage sửa Mech, sảnh bang, NPC Archivist, nhận hợp đồng | — | Khoe skin, gặp người |
| **Vùng PvE** | Chỉ khi cả 2 bật cờ PvP | Hợp đồng, Legion, sự kiện | ×1.0 | Mặc định cho người mới |
| **Vùng PvP** | ✅ Luôn bật | Hợp đồng khó, thả hàng tiếp tế, mỏ Pin năng lượng | ×1.5 | Cần level ≥ 10 |
| **Lãnh thổ** (3 khu/map) | ✅ khi công thành | Điểm chiếm, boss lãnh thổ | ×1.2 cho bang sở hữu | Mục 4C |

#### 4A.3 Sự kiện thế giới (cả kênh cùng tham gia)
| Sự kiện | Tần suất | Mô tả |
|---|---|---|
| **Thả hàng tiếp tế** | 15 phút/lần | Rơi ở vùng PvP, đồ Sử thi trở lên, ai đến trước lấy |
| **Xâm lược Legion** | 1 giờ/lần | Cả kênh phòng thủ 1 khu, thưởng theo đóng góp |
| **World Boss Mech** | 3 lần/ngày, giờ cố định | 5–20 người, bắt buộc biến hình, rơi ×2 |
| **Truy tìm manh mối Easter Egg** | Ngẫu nhiên | NPC Archivist xuất hiện ở vị trí bí mật, ai tìm thấy nhận mảnh chìa bonus |

---

### 4B. TỔ ĐỘI (2–5 người)

| Quy tắc | Chi tiết |
|---|---|
| Lập đội | Mời trực tiếp, hoặc **ghép đội tự động** theo map + level |
| Đồ rơi | **Đồ rơi riêng từng người** (mỗi người tự roll) → không tranh giành, không cướp đồ đồng đội |
| Tiến độ | Hoàn thành hợp đồng → cả đội nhận điểm & lượt rơi; mảnh chìa roll riêng |
| Bonus tổ đội | +5% điểm & tỉ lệ rơi / thành viên thêm (tối đa +20% với 5 người) |
| **Đồng bộ biến hình** | ≥ 3 thành viên biến hình trong vòng 10 giây → cả đội +20% sát thương, +5s thời gian Mech |
| **Hợp thể** (giai đoạn 3) | 5 người cùng biến hình cạnh nhau → ghép thành 1 Mech khổng lồ 30s (1 người lái, 4 người điều khiển vũ khí) |
| Hồi sinh | Đồng đội đỡ dậy trong 10s thay vì chết hẳn (1 lần/hợp đồng/người) |

---

### 4C. BANG PHÁI (GUILD)

#### 4C.1 Lập bang & cấp bậc
- **Điều kiện lập:** level ≥ 15, phí **100 token** (đốt).
- **Số thành viên theo cấp bang:** Cấp 1: 30 · Cấp 2: 50 · Cấp 3: 80 · Cấp 4–5: 100.
- **XP bang** đến từ hoạt động của thành viên: hoàn thành hợp đồng, Raid, đóng góp kho, công thành.

| Chức vụ | Số lượng | Quyền |
|---|---|---|
| Bang chủ | 1 | Toàn quyền, đăng ký công thành, chia thưởng, giải tán bang |
| Phó bang | 2 | Duyệt/đuổi thành viên, dùng kho bang, chỉ huy công thành |
| Trưởng lão | 5 | Duyệt thành viên, mở Guild Raid |
| Thành viên | — | Chat, nhận nhiệm vụ bang, đóng góp, rút đồ kho theo hạn mức |
| Tập sự | — | 3 ngày đầu, không rút kho, không nhận thưởng lãnh thổ |

Bang chủ offline > 14 ngày → Phó bang hoạt động nhiều nhất tự động lên thay.

#### 4C.2 Tính năng bang
| Tính năng | Mô tả |
|---|---|
| **Kho bang** | Thành viên gửi đồ/token; rút theo hạn mức chức vụ; mọi giao dịch có log |
| **Sảnh bang** | Không gian riêng trong Vùng An toàn, trang trí, nâng cấp bằng token (chỗ tiêu token) |
| **Cây kỹ năng bang** | Buff nhỏ cho mọi thành viên, **tổng tối đa**: +5% tỉ lệ rơi, -10% phí sửa Mech, +1 năng lượng tối đa, +5% XP |
| **Nhiệm vụ bang tuần** | Mục tiêu chung (VD: cả bang hoàn thành 500 hợp đồng) → rương bang |
| **Chat & điểm danh bang** | Kênh chat riêng, điểm danh ngày cộng XP bang |
| **Điểm đóng góp cá nhân** | Tính từ hoạt động cho bang → quyết định phần thưởng mỗi người nhận (chống ăn bám) |

#### 4C.3 Chiến tranh Lãnh thổ
- Mỗi map có **3 lãnh thổ** (VD Neon City: Cảng, Phố Neon, Khu Công nghiệp).
- **Đăng ký** thứ 5–6, phí **50 token**/lãnh thổ (đốt). **Công thành** thứ 7 hoặc Chủ nhật, 30 phút, tối đa 30 người/bang.
- **Luật chơi:** 3 điểm chiếm, giữ điểm để tích điểm; tháp phòng thủ của bang chủ nhà; biến hình được phép. Hết giờ, bang nhiều điểm nhất chiếm lãnh thổ 1 tuần.

| Quyền lợi bang sở hữu lãnh thổ | Giá trị |
|---|---|
| Thuế giao dịch | **1%** giá trị mọi giao dịch chợ diễn ra ở Hub của map đó (lấy từ phí chợ 5%, không cộng thêm cho người mua) |
| Buff rơi đồ | +20% trong lãnh thổ đó cho thành viên bang |
| Boss lãnh thổ | 1 boss riêng mỗi ngày, chỉ bang sở hữu đánh được |
| Danh tiếng | Tên & cờ bang hiện trên bản đồ cho toàn server |

**Chống độc quyền:** mỗi bang giữ tối đa **2 lãnh thổ/map**; liên minh tối đa 2 bang; bang giữ cùng 1 lãnh thổ ≥ 3 tuần liên tiếp thì tháp phòng thủ yếu đi 20%/tuần.

#### 4C.4 Xếp hạng bang mùa
Điểm bang = Điểm công thành + Guild Raid + Nhiệm vụ bang + Tổng điểm mùa thành viên (lấy 30 người cao nhất, tránh bang đông thắng chỉ vì số lượng).
Top bang nhận **Quỹ suất Launchpad bang** (mục 8) + skin/cờ độc quyền mùa.

---

### 4D. LUẬT PvP

| Quy tắc | Chi tiết |
|---|---|
| Bảo vệ người mới | Level < 10: không vào Vùng PvP, không bị tấn công |
| Bị hạ trong Vùng PvP (luật này **thay** luật mất đồ ở mục 3) | Rơi **30% đồ nhặt trong phiên** (Thường → Sử thi) xuống đất cho người khác nhặt. **Không bao giờ** rơi đồ đang trang bị, linh kiện Mech, đồ Huyền thoại+ |
| Mảnh chìa | Mất 50% số mảnh nhặt trong hợp đồng đang làm (như mục 3), mảnh không rơi cho người khác |
| Chênh lệch level | Hạ người kém mình ≥ 10 level: không nhặt được đồ, bị **Tên đỏ** |
| Tên đỏ (sát thủ) | Hạ ≥ 3 người kém level trong 1 giờ → tên đỏ 30 phút: bị Legion truy đuổi, ai hạ được nhận thưởng truy nã, vào Vùng An toàn bị chặn |
| Cân bằng | Trong PvP, chênh lệch sức mạnh Mech bị nén còn tối đa +20% |

---

### 4E. GHI CHÚ KỸ THUẬT MULTIPLAYER (WEB)

| Hạng mục | Đề xuất |
|---|---|
| Server | **Authoritative server** (Node.js + Colyseus, hoặc Nakama). Server quyết định vị trí, sát thương, rơi đồ; client chỉ gửi input |
| Đồng bộ | Tick 20 Hz, client prediction + interpolation, **AOI (vùng quan tâm)** chia lưới 100m → chỉ gửi dữ liệu người chơi ở gần |
| Kênh | 1 process/kênh, 100 người/kênh, tự mở/đóng theo tải |
| Dữ liệu | PostgreSQL (tài khoản, đồ, bang, chợ), Redis (trạng thái thời gian thực, xếp hạng, chat) |
| Ghép đội | Hàng đợi theo map + level ±5 |
| Chat | WebSocket riêng: Thế giới / Kênh / Tổ đội / Bang / Riêng tư; lọc từ ngữ |
| Chống gian lận | Kiểm tra tốc độ di chuyển, tầm bắn, tốc độ bắn ở server; log mọi rơi đồ & giao dịch |

---

### 5. HỆ THỐNG BIẾN HÌNH (MECH)

#### 5.1 Thanh biến hình (0 → 100%)
| Hành động | Tăng |
|---|---|
| Hạ 1 Legion | +5% |
| Hoàn thành nhiệm vụ | +20% |
| Drift / combo xe | +1%/giây |
| Nhặt Pin năng lượng | +15% |

Đầy 100% → bấm **[F]** để biến hình (cần có ít nhất 1 Mech đã ráp & còn độ bền).

#### 5.2 Ba dạng Mech
| Dạng | Thời gian | Máu | Tốc độ | Chiêu | Điểm yếu |
|---|---|---|---|---|---|
| **Titan Frame** (chiến đấu) | 20s | ×5 | ×0.6 | Pháo, giẫm xe | Không lái xe |
| **Colossus** (khổng lồ) | 15s | ×4 | ×0.5 | Dậm đất diện rộng, laser | To, dễ trúng đạn |
| **Velocity** (xe ↔ robot) | 25s | ×1.5 | ×2.0 | Đổi xe/robot tức thì | Máu thấp |

#### 5.3 State machine
```
NORMAL --(thanh = 100% && bấm F && Mech còn độ bền)--> TRANSFORMING (anim 1.5s, bất tử)
TRANSFORMING --> MECH_ACTIVE (đếm ngược; trúng EMP: -5s)
MECH_ACTIVE --(hết giờ || máu Mech = 0)--> REVERTING (anim 1s)
REVERTING --> NORMAL (thanh = 0, hồi chiêu 60s, Mech -1 độ bền)
```

#### 5.4 Cân bằng
- Legion có **súng EMP** → biến hình không phải bất tử.
- Boss Raid & mini-boss: **bắt buộc biến hình** mới gây sát thương hiệu quả → khoảnh khắc đỉnh của mùa.
- Hiệu ứng biến hình riêng theo độ hiếm Mech (Huyền thoại có cột sáng vàng, Thần thoại có hiệu ứng đỏ + âm thanh riêng) → giá trị khoe.

#### 5.5 Item đặc biệt (dùng 1 lần, rơi hiếm)
| Item | Tác dụng | Giới hạn |
|---|---|---|
| **Extra Coin** | +1 mạng trong trận | 1/trận |
| **Chrono Cube** | Quay về vị trí & máu của 10 giây trước | 1/trận |
| **Nova Bomb** | Xoá toàn bộ Legion trên màn hình | Chỉ ở Raid, 1/trận |
| **Pin năng lượng** | +15% thanh biến hình | 3/trận |

---

### 6. VẬT PHẨM

#### 6.1 Loại vật phẩm
| Loại | Ví dụ | Giao dịch? | Vai trò |
|---|---|---|---|
| **Linh kiện Mech** (4 khe: Lõi / Giáp / Vũ khí / Động cơ) | Lõi Plasma, Giáp Titan | ✅ | Nguồn thu chính của người chơi |
| **Mech hoàn chỉnh** | Ráp từ đủ 4 linh kiện | ✅ bán / đấu giá | Hàng giá trị cao |
| **Xe** | Xe đua, mô tô, xe tải | ✅ | Làm nhiệm vụ nhanh hơn |
| **Item dùng 1 lần** | Extra Coin, Chrono Cube, Pin | ✅ | Hàng tiêu hao, giao dịch thường xuyên |
| **Skin / Danh hiệu mùa** | "Egg Hunter S1" | ✅ (giới hạn số lượng) | Sưu tầm, khoe |
| **Mảnh chìa, Chìa, XP, Level, Điểm mùa** | — | ❌ gắn tài khoản | Chống mua tiến độ & bot |

#### 6.2 Độ hiếm & tỉ lệ rơi
| Độ hiếm | Tỉ lệ / lượt rơi | Hệ số chỉ số (ngẫu nhiên trong khoảng) | Độ bền Mech | Ghi chú |
|---|---|---|---|---|
| Thường (xám) | 60% | ×1.00 | 20 | Nguyên liệu ghép |
| Hiếm (xanh) | 30% | ×1.05 – 1.10 | 20 | |
| Sử thi (tím) | 8% | ×1.12 – 1.20 | 25 | Tối thiểu để vào Raid |
| Huyền thoại (vàng) | 1.8% | ×1.18 – 1.30 + hiệu ứng riêng | 30 | Hàng đắt trên chợ |
| Thần thoại (đỏ) | 0.2% | ×1.28 – 1.35 + skill đặc biệt | 40 | Chỉ bán qua đấu giá |
| **Easter Egg mùa** | 1 món / mùa | Độc nhất | ∞ | Đấu giá công khai |

**Điều chỉnh tỉ lệ:** × hệ số map (mục 2) · +10% nếu hoàn thành nhiệm vụ khi đang biến hình · thả hàng tiếp tế chỉ rơi Sử thi trở lên.
**Pity:** 60 lượt không ra Huyền thoại → lượt sau chắc chắn Huyền thoại. 500 lượt không ra Thần thoại → chắc chắn Thần thoại.
**Độc quyền mùa:** mỗi mùa có 1 bộ linh kiện/skin chỉ rơi trong mùa đó, hết mùa không bao giờ rơi lại.
**Thông báo toàn server** khi có người rơi Huyền thoại/Thần thoại (cột sáng + âm thanh + banner).

#### 6.3 Sức mạnh Mech
```
Sức mạnh Mech = Σ (Chỉ số gốc khe × Hệ số độ hiếm) của 4 linh kiện
Chênh lệch tối đa giữa Mech Thường và Thần thoại hoàn hảo: +35%  (chống pay-to-win)
```

#### 6.4 Ghép & nung chảy
| Thao tác | Công thức | Chi phí | Tỉ lệ thành công |
|---|---|---|---|
| Ghép | 5 Thường → 1 Hiếm | 2 token | 90% |
| Ghép | 5 Hiếm → 1 Sử thi | 8 token | 70% |
| Ghép | 5 Sử thi → 1 Huyền thoại | 30 token | 40% |
| Nung chảy | 1 Mech/linh kiện hết bền → 40% linh kiện cùng độ hiếm (làm tròn xuống, tối thiểu 1 cấp thấp hơn) | 0 | 100% |
| Thất bại ghép | Mất token + giữ lại 2/5 nguyên liệu | — | — |

#### 6.5 Độ bền
- Mỗi lần biến hình: Mech **-1 độ bền**.
- Hết độ bền: không biến hình được → **sửa bằng token** hoặc **nung chảy**.
- Phí sửa (token / 1 điểm độ bền): Thường 0.2 · Hiếm 0.3 · Sử thi 0.5 · Huyền thoại 1 · Thần thoại 2.
- Đây là **chỗ tiêu token lớn nhất**: chơi càng nhiều → tiêu càng nhiều.

---

### 7. CHỢ & ĐẤU GIÁ

| Tính năng | Logic |
|---|---|
| **Chợ giá cố định** | Người bán đặt giá bằng token. Phí 5%: 2% đốt + 2% quỹ thưởng mùa + 1% kho bang sở hữu lãnh thổ của Hub đó (không có bang sở hữu → 1% này vào quỹ mùa). |
| **Nhà đấu giá** | Chỉ cho Huyền thoại trở lên. Đấu giá tăng dần 24h, có giá sàn, bước giá tối thiểu 5%. Có người trả trong 5 phút cuối → +5 phút. Phí 5% như chợ. |
| **Đấu giá Easter Egg** | 1 lần/mùa, phát trực tiếp. Người tìm ra nhận 85%, 10% vào quỹ thưởng mùa sau, 5% đốt. |
| **Đúc NFT theo nhu cầu** | Đồ nằm off-chain trong game. Muốn rút ra ví / sàn ngoài → trả phí đúc (Hiếm 1 · Sử thi 3 · Huyền thoại 10 · Thần thoại 25 token). Thường không đúc được. |
| **Điều kiện bán** | Level ≥ 10, tài khoản ≥ 7 ngày, tối đa 20 lượt rao/ngày. |
| **Minh bạch** | Hiện giá bán gần nhất, giá sàn, lịch sử giao dịch từng món. RNG đồ Thần thoại dùng VRF on-chain để kiểm chứng được. |

**Lý do người chơi trả giá cao**
1. **Công dụng:** Mech tốt → Raid dễ hơn, nhiều sao hơn, rơi đồ nhiều hơn (có giới hạn +35%).
2. **Cửa vào nội dung:** Raid cần Sức mạnh Mech ≥ 300 / ít nhất 1 linh kiện Sử thi.
3. **Khoe:** hiệu ứng biến hình riêng, tên màu, xuất hiện bảng xếp hạng.
4. **Nguyên liệu ghép:** cần mua đồ thấp để ghép → đồ rẻ cũng có cầu.
5. **Launchpad:** Mech Huyền thoại+ cho thêm vé / nâng tier whitelist.
6. **Khan hiếm:** đồ độc quyền mùa không bao giờ rơi lại → giá tăng theo thời gian.

---

### 8. TÍCH HỢP LAUNCHPAD

```
Chơi → Điểm mùa (off-chain, không giao dịch)
     → Mở 3 Cổng (đủ 3 Chìa) → mở khoá quyền vào whitelist dự án của mùa
     → Tier xác định bởi Điểm mùa + bonus Mech
```

| Tier | Điều kiện | Quyền lợi |
|---|---|---|
| Bronze | Có Chìa Đồng + ≥ 5.000 điểm mùa | Vào xổ số whitelist |
| Silver | Có 2 Chìa + ≥ 15.000 điểm | 1 vé chắc chắn |
| Gold | Mở Cổng cuối + ≥ 30.000 điểm | 2 vé, mua sớm 1h |
| Diamond | Top 100 Solo Thử thách hoặc Gold + Mech Huyền thoại+ | 3 vé, mua sớm 2h |

Mỗi tài khoản/ví chỉ 1 tier/mùa. Đổi tier lấy suất mua cần KYC nhẹ (chống multi-account).

**Quỹ suất Launchpad bang** (cộng thêm, không thay thế tier cá nhân):
| Hạng bang mùa | Quỹ vé |
|---|---|
| Top 1 | 30 vé |
| Top 2–3 | 20 vé |
| Top 4–10 | 10 vé |

Vé quỹ bang chia cho thành viên theo **điểm đóng góp cá nhân** (mục 4C.2), chỉ cho thành viên đã ở bang ≥ 14 ngày và đã KYC. Bang chủ không tự chia tay được → tránh tranh chấp.

---

### 9. TOKEN & KINH TẾ

#### 9.1 Hai loại tiền
| | **Coin** (tiền mềm, off-chain) | **Token** (tiền cứng, on-chain) |
|---|---|---|
| Kiếm từ | Nhiệm vụ, trận đấu, nhiệm vụ ngày | Bán đồ cho người khác, thưởng top mùa, thưởng Raid (giới hạn/ngày) |
| Tiêu vào | Nâng cấp nhỏ, sửa xe, mở rương thường | Sửa Mech, ghép đồ, phí chợ, đúc NFT, năng lượng thêm, vé Raid, skin |
| Reset | Không | Không |

#### 9.2 Dòng token
```
NGUỒN PHÁT RA                               CHỖ TIÊU / ĐỐT
- Thưởng top Solo Thử thách (tuần)          - Sửa độ bền Mech        ← lớn nhất
- Thưởng Raid (giới hạn 20 token/ngày/người)- Ghép đồ
- Quỹ thưởng mùa (lấy từ phí chợ)           - Phí chợ & đấu giá 5% (một nửa đốt)
                                            - Phí đúc NFT
                                            - Năng lượng thêm, vé Raid
                                            - Skin, đổi tên, hiệu ứng
- Thuế lãnh thổ 1% (chuyển từ phí chợ,      - Lập bang 100, đăng ký công thành 50 (đốt)
  không phát thêm)                          - Nâng cấp sảnh bang, cây kỹ năng bang
```
**Nguyên tắc vàng:** game rơi **đồ**, không rơi token. Token chủ yếu luân chuyển **giữa người chơi với nhau**.

#### 9.3 Chỉ số cần theo dõi hằng ngày
| KPI | Mục tiêu |
|---|---|
| Tỉ lệ Tiêu / Phát token | ≥ 1.1 (tiêu nhiều hơn phát) |
| Giá sàn đồ Hiếm / Sử thi | Ổn định ± 20% trong tuần |
| Retention D1 / D7 / D30 | ≥ 40% / 20% / 10% |
| Thời gian chơi trung bình/ngày | ≥ 25 phút (~3–4 trận) |
| Tỉ lệ người chơi giao dịch ≥ 1 lần/tuần | ≥ 15% |
| Tài khoản bị gắn cờ bot | < 2% |
| Tỉ lệ người chơi trong bang | ≥ 50% |
| Tỉ lệ hợp đồng chơi theo tổ đội | ≥ 30% |
| Số bang tham gia công thành / tuần | ≥ 10 bang/map, không bang nào giữ > 40% lãnh thổ |

**Cần chỉnh khi:** tỉ lệ < 1.0 → tăng phí sửa / giảm thưởng Raid. Giá sàn đồ giảm > 30% → giảm tỉ lệ rơi Thường, tăng ưu đãi ghép.

#### 9.4 Ước lượng nhịp tiến độ
- ~6 nhiệm vụ/trận × 20% → **~1.2 mảnh chìa/trận**.
- 15 mảnh/Chìa → **~12–13 trận** ≈ 2.5 ngày nếu chơi 5 năng lượng/ngày → mỗi Chìa vừa khít trong 1 tuần kể cả người chơi ít.
- ~6 lượt rơi/trận → ~0.11 Huyền thoại/trận → **~1 Huyền thoại / 9 trận** (≈ 2 ngày), Thần thoại ~1 / 80 trận (≈ 2–3 tuần).

---

### 10. VÒNG CUỐN (RETENTION)

| Chu kỳ | Cơ chế |
|---|---|
| **Mỗi trận** | Rơi đồ ngẫu nhiên, cột sáng đồ hiếm, rủi ro mất đồ khi chưa thoát, biến hình |
| **Mỗi ngày** | 5 năng lượng, 3 nhiệm vụ ngày, rương miễn phí, chuỗi đăng nhập (mất chuỗi = mất bonus) |
| **Mỗi tuần** | Map mới mở, Chìa mới, xếp hạng Solo Thử thách reset |
| **Mỗi mùa** | Boss Raid, Easter Egg, đồ độc quyền, suất Launchpad |
| **Xã hội** | Gặp người trong thế giới mở, tổ đội + đồng bộ biến hình, bang phái (nhiệm vụ bang, kho bang, công thành cuối tuần), World Boss, mời bạn, thông báo đồ hiếm toàn server, đấu giá trực tiếp |

---

### 11. CHỐNG GIAN LẬN & PHÁP LÝ

| Rủi ro | Giải pháp |
|---|---|
| Quấy rối PvP | Bảo vệ người mới < level 10, Tên đỏ, không nhặt đồ người kém ≥ 10 level, PvP chỉ ở vùng chỉ định |
| Bang độc quyền | Tối đa 2 lãnh thổ/map, liên minh tối đa 2 bang, tháp yếu dần nếu giữ lâu, xếp hạng chỉ tính 30 người top |
| Lừa đảo trong bang | Kho bang có hạn mức + log, quỹ vé chia tự động theo đóng góp, Tập sự không rút kho |
| Bot farm | Logic trận xác thực ở server, captcha ẩn, phát hiện hành vi bất thường, điều kiện level/ngày để bán, giới hạn rao bán/ngày |
| Multi-account | 1 ví – 1 tài khoản, KYC nhẹ khi nhận suất launchpad, fingerprint thiết bị |
| Lạm phát đồ | Ghép, nung chảy, độ bền, đồ Thường không đúc NFT |
| Pay-to-win | Trần +35%, Solo Thử thách dùng đồ chuẩn hoá |
| Hack client | Rơi đồ, điểm, kết quả trận **tính ở server**, client chỉ hiển thị |
| **Cờ bạc** | **KHÔNG bán rương ngẫu nhiên bằng tiền/token.** Rương chỉ kiếm bằng chơi. Công khai mọi tỉ lệ rơi. |
| **Tài chính / chứng khoán** | Token & launchpad có thể chịu quy định tuỳ quốc gia → **tham vấn luật sư** trước khi ra mắt, chặn khu vực cấm |
| **Bản quyền** | Chỉ lấy cảm hứng; tên, hình, nhạc phải tự tạo |

---

### 12. LỘ TRÌNH TRIỂN KHAI

| Giai đoạn | Nội dung | Ưu tiên |
|---|---|---|
| **MVP 0 – Nền multiplayer** | Server authoritative, kênh 100 người, AOI, đồng bộ di chuyển/bắn/xe, chat thế giới, Vùng An toàn/PvE | ⭐⭐⭐ |
| **MVP 1 – Gameplay** | 1 map (Neon City), hợp đồng trong thế giới mở + Solo Nhiệm vụ bản riêng, marker nhiệm vụ, sự kiện phút 4, điểm thoát, điểm & sao, năng lượng | ⭐⭐⭐ |
| **MVP 2 – Biến hình** | Thanh biến hình, 1 dạng Mech (Titan Frame), state machine, EMP Legion | ⭐⭐⭐ |
| **MVP 3 – Đồ** | Bảng rơi 5 độ hiếm, linh kiện 4 khe, ráp Mech, độ bền, pity, kho đồ | ⭐⭐⭐ |
| **Beta – Mùa** | 3 map + Raid, mảnh chìa/Chìa/Cổng, nhiệm vụ ngày, chuỗi đăng nhập, Solo Thử thách + xếp hạng | ⭐⭐ |
| **Beta – Xã hội** | Tổ đội + ghép đội, đồng bộ biến hình, bang phái (lập bang, chức vụ, kho, chat, nhiệm vụ bang), World Boss | ⭐⭐ |
| **Beta – Kinh tế** | Kết nối ví, Coin/Token, chợ, ghép/nung chảy, sửa Mech | ⭐⭐ |
| **Launch** | Vùng PvP + luật PvP, đấu giá, đúc NFT, Easter Egg, Launchpad tier + quỹ vé bang, KYC, dashboard KPI | ⭐⭐ |
| **Giai đoạn 2** | Chiến tranh Lãnh thổ, cây kỹ năng bang, sảnh bang, 2 dạng Mech còn lại | ⭐ |
| **Giai đoạn 3** | Hợp thể 5 người, liên minh bang, voice chat | ⭐ |

---

### PHỤ LỤC – THAM CHIẾU READY PLAYER ONE → GAME

| Phim | Trong game |
|---|---|
| OASIS | NEXUS |
| 3 Chìa Đồng / Ngọc Bích / Pha Lê | 3 map mỗi mùa, mỗi map 1 Chìa |
| Đường đua New York (chạy ngược) | Neon City – nhiệm vụ đua có lối bí mật |
| The Overlook Hotel | Hollow Hotel |
| Planet Doom + Castle Anorak | Warzone + Citadel Raid |
| Orb of Osuvox (khiên) | Khiên Citadel – mục tiêu phá khiên |
| Cataclyst | Nova Bomb |
| Zemeckis Cube | Chrono Cube |
| Đồng xu của Halliday | Extra Coin |
| Daito → Gundam / Iron Giant / Mechagodzilla | Titan Frame / Colossus / Boss Mech |
| Easter Egg | Easter Egg mùa – món độc nhất, đấu giá |
| High Five | Squad 5 người |
| Sixers / IOI | Legion / IXO Corp |


## E. CONFIG – game_config.json

```json
{
  "season": {
    "id": "S1",
    "durationDays": 28,
    "launchProject": "PROJECT_X",
    "shardsPerKey": 15,
    "maps": [
      {
        "id": "neon_city",
        "key": "copper",
        "unlockDay": 0,
        "dropMultiplier": 1.0,
        "missions": [
          "race",
          "carjack",
          "delivery",
          "chase"
        ]
      },
      {
        "id": "hollow_hotel",
        "key": "jade",
        "unlockDay": 7,
        "dropMultiplier": 1.2,
        "missions": [
          "search",
          "survive",
          "puzzle",
          "evade"
        ]
      },
      {
        "id": "warzone",
        "key": "crystal",
        "unlockDay": 14,
        "dropMultiplier": 1.5,
        "missions": [
          "assault",
          "shield_break"
        ]
      },
      {
        "id": "citadel_raid",
        "key": null,
        "unlockDay": 21,
        "dropMultiplier": 2.0,
        "requiresKeys": 3,
        "minMechPower": 300,
        "boss": "director_vane_mech"
      }
    ],
    "resetOnEnd": [
      "shards",
      "keys",
      "seasonPoints"
    ],
    "keepOnEnd": [
      "level",
      "items",
      "mechs",
      "token"
    ]
  },
  "energy": {
    "max": 5,
    "regenPerHour": 1,
    "dailyQuestBonus": 2,
    "referralBonusPerFriend": 1,
    "referralDailyCap": 3,
    "tokenPurchaseDailyCap": 5
  },
  "match": {
    "durationSec": 420,
    "missionMarkers": 6,
    "eventAtSec": 240,
    "events": [
      "supply_drop",
      "wanted_5_star",
      "mini_boss_mech"
    ],
    "extractVisibleAtSec": 300,
    "deathLoss": {
      "shards": 0.5,
      "itemsUpToRarity": "rare",
      "itemsLossRate": 0.5
    },
    "score": {
      "mission": 100,
      "kill": 10,
      "secondLeft": 2,
      "eventMin": 200,
      "eventMax": 500
    },
    "stars": {
      "1": 500,
      "2": 1200,
      "3": 2000
    },
    "starMultiplier": {
      "1": 1.0,
      "2": 1.5,
      "3": 2.0
    },
    "loginStreak": {
      "perDay": 0.05,
      "max": 0.5
    },
    "shardChancePerMission": 0.2
  },
  "modes": {
    "solo_mission": {
      "energyCost": 1,
      "drops": true,
      "personalGear": true
    },
    "solo_challenge": {
      "energyCost": 1,
      "drops": false,
      "personalGear": false,
      "sameSeed": true,
      "leaderboard": "weekly"
    },
    "free_roam": {
      "energyCost": 0,
      "drops": false,
      "personalGear": true
    },
    "citadel_raid": {
      "energyCost": 1,
      "raidTicket": true,
      "drops": true,
      "personalGear": true
    },
    "party_contract": {
      "energyCost": 1,
      "drops": true,
      "personalGear": true
    },
    "territory_war": {
      "ticket": "siege_registration",
      "drops": false,
      "personalGear": true
    },
    "world_boss": {
      "energyCost": 1,
      "raidTicket": true,
      "drops": true,
      "personalGear": true
    }
  },
  "transform": {
    "meterMax": 100,
    "cooldownSec": 60,
    "transformAnimSec": 1.5,
    "revertAnimSec": 1.0,
    "empPenaltySec": 5,
    "durabilityCostPerUse": 1,
    "gain": {
      "kill": 5,
      "mission": 20,
      "driftPerSec": 1,
      "battery": 15
    },
    "forms": {
      "titan_frame": {
        "durationSec": 20,
        "hpMul": 5,
        "speedMul": 0.6,
        "canDrive": false,
        "skills": [
          "cannon",
          "stomp_vehicle"
        ]
      },
      "colossus": {
        "durationSec": 15,
        "hpMul": 4,
        "speedMul": 0.5,
        "canDrive": false,
        "skills": [
          "ground_slam_aoe",
          "laser"
        ]
      },
      "velocity": {
        "durationSec": 25,
        "hpMul": 1.5,
        "speedMul": 2.0,
        "canDrive": true,
        "skills": [
          "instant_car_robot_swap"
        ]
      }
    }
  },
  "consumables": {
    "extra_coin": {
      "effect": "extra_life",
      "perMatch": 1
    },
    "chrono_cube": {
      "effect": "rewind",
      "rewindSec": 10,
      "perMatch": 1
    },
    "nova_bomb": {
      "effect": "clear_screen_enemies",
      "perMatch": 1,
      "raidOnly": true
    },
    "battery": {
      "effect": "transform_meter",
      "amount": 15,
      "perMatch": 3
    }
  },
  "dropTable": {
    "rollsPerMission": 1,
    "rarity": {
      "common": 0.6,
      "rare": 0.3,
      "epic": 0.08,
      "legendary": 0.018,
      "mythic": 0.002
    },
    "transformBonus": 0.1,
    "supplyDropMinRarity": "epic",
    "pity": {
      "legendary": 60,
      "mythic": 500
    },
    "statRange": {
      "common": [
        1.0,
        1.0
      ],
      "rare": [
        1.05,
        1.1
      ],
      "epic": [
        1.12,
        1.2
      ],
      "legendary": [
        1.18,
        1.3
      ],
      "mythic": [
        1.28,
        1.35
      ]
    },
    "maxPowerGap": 0.35,
    "seasonExclusiveSet": true,
    "serverAnnounceMinRarity": "legendary",
    "mythicRng": "onchain_vrf"
  },
  "mech": {
    "slots": [
      "core",
      "armor",
      "weapon",
      "engine"
    ],
    "durability": {
      "common": 20,
      "rare": 20,
      "epic": 25,
      "legendary": 30,
      "mythic": 40
    },
    "repairTokenPerPoint": {
      "common": 0.2,
      "rare": 0.3,
      "epic": 0.5,
      "legendary": 1,
      "mythic": 2
    },
    "smeltReturn": 0.4
  },
  "craft": {
    "inputCount": 5,
    "recipes": {
      "common_to_rare": {
        "costToken": 2,
        "successRate": 0.9
      },
      "rare_to_epic": {
        "costToken": 8,
        "successRate": 0.7
      },
      "epic_to_legendary": {
        "costToken": 30,
        "successRate": 0.4
      }
    },
    "failKeepInputs": 2
  },
  "market": {
    "feeRate": 0.05,
    "feeSplit": {
      "burn": 0.4,
      "seasonPool": 0.4,
      "territoryGuild": 0.2
    },
    "minLevel": 10,
    "minAccountDays": 7,
    "dailyListLimit": 20
  },
  "auction": {
    "minRarity": "legendary",
    "durationH": 24,
    "minBidStep": 0.05,
    "antiSnipeMin": 5,
    "feeRate": 0.05,
    "easterEggSplit": {
      "finder": 0.85,
      "nextSeasonPool": 0.1,
      "burn": 0.05
    }
  },
  "nftMintFee": {
    "common": null,
    "rare": 1,
    "epic": 3,
    "legendary": 10,
    "mythic": 25
  },
  "economy": {
    "raidTokenDailyCapPerPlayer": 20,
    "targetSinkSourceRatio": 1.1
  },
  "launchpad": {
    "tiers": [
      {
        "id": "bronze",
        "keys": 1,
        "minSeasonPoints": 5000,
        "reward": "whitelist_lottery"
      },
      {
        "id": "silver",
        "keys": 2,
        "minSeasonPoints": 15000,
        "tickets": 1
      },
      {
        "id": "gold",
        "keys": 3,
        "finalGate": true,
        "minSeasonPoints": 30000,
        "tickets": 2,
        "earlyAccessH": 1
      },
      {
        "id": "diamond",
        "rule": "top100_solo_challenge OR (gold AND mech_rarity>=legendary)",
        "tickets": 3,
        "earlyAccessH": 2
      }
    ],
    "onePerWalletPerSeason": true,
    "kycRequired": true
  },
  "world": {
    "channelCap": 100,
    "channelSwitchCooldownSec": 60,
    "partyGuildSameChannelPriority": true,
    "zones": {
      "safe": {
        "pvp": false,
        "features": [
          "market",
          "garage",
          "guild_hall",
          "contracts",
          "archivist"
        ]
      },
      "pve": {
        "pvp": "mutual_flag",
        "dropMultiplier": 1.0
      },
      "pvp": {
        "pvp": true,
        "dropMultiplier": 1.5,
        "minLevel": 10
      },
      "territory": {
        "pvp": "during_siege",
        "ownerDropBonus": 0.2,
        "perMap": 3
      }
    },
    "events": {
      "supply_drop": {
        "everyMin": 15,
        "zone": "pvp",
        "minRarity": "epic"
      },
      "legion_invasion": {
        "everyMin": 60,
        "rewardBy": "contribution"
      },
      "world_boss": {
        "perDay": 3,
        "players": [
          5,
          20
        ],
        "dropMultiplier": 2.0,
        "transformRequired": true
      },
      "archivist_hunt": {
        "random": true,
        "reward": "bonus_shard"
      }
    }
  },
  "party": {
    "size": [
      2,
      5
    ],
    "autoMatch": {
      "by": [
        "map",
        "level"
      ],
      "levelRange": 5
    },
    "loot": "personal",
    "bonusPerExtraMember": 0.05,
    "bonusMax": 0.2,
    "syncTransform": {
      "minMembers": 3,
      "windowSec": 10,
      "damageBonus": 0.2,
      "extraSec": 5
    },
    "fusion": {
      "phase": 3,
      "members": 5,
      "durationSec": 30
    },
    "reviveWindowSec": 10,
    "revivesPerContract": 1
  },
  "guild": {
    "create": {
      "minLevel": 15,
      "costToken": 100,
      "burn": true
    },
    "memberCapByLevel": {
      "1": 30,
      "2": 50,
      "3": 80,
      "4": 100,
      "5": 100
    },
    "ranks": {
      "leader": 1,
      "vice": 2,
      "elder": 5,
      "member": null,
      "recruit": null
    },
    "recruitDays": 3,
    "leaderInactiveDaysTransfer": 14,
    "techTreeCaps": {
      "dropRate": 0.05,
      "repairDiscount": 0.1,
      "energyMax": 1,
      "xp": 0.05
    },
    "rankingTopMembersCounted": 30,
    "territoryWar": {
      "registerDays": [
        "thu",
        "fri"
      ],
      "siegeDays": [
        "sat",
        "sun"
      ],
      "durationMin": 30,
      "maxPlayersPerGuild": 30,
      "registerFeeToken": 50,
      "capturePoints": 3,
      "holdWeeks": 1,
      "maxTerritoriesPerMapPerGuild": 2,
      "maxAllianceSize": 2,
      "towerDecayAfterWeeks": 3,
      "towerDecayPerWeek": 0.2,
      "ownerRewards": {
        "marketTaxShare": 0.01,
        "dropBonus": 0.2,
        "dailyTerritoryBoss": 1
      }
    },
    "launchpadPool": {
      "top1": 30,
      "top2_3": 20,
      "top4_10": 10,
      "splitBy": "contribution",
      "minDaysInGuild": 14,
      "kycRequired": true
    }
  },
  "pvp": {
    "newbieProtectionLevel": 10,
    "deathDropRate": 0.3,
    "deathDropMaxRarity": "epic",
    "neverDrop": [
      "equipped",
      "mech_parts",
      "legendary",
      "mythic"
    ],
    "shardLoss": 0.5,
    "noLootLevelGap": 10,
    "redName": {
      "killsLowerLevelPerHour": 3,
      "durationMin": 30,
      "bounty": true,
      "safeZoneBlocked": true
    },
    "mechPowerGapCap": 0.2
  }
}
```

## F. FILE KÈM THEO
- `ReadyPlayerOne_GameData.xlsx` / `.md`: dữ liệu gốc của phim & sách (nhân vật, địa điểm, game tham chiếu, nhiệm vụ, vật phẩm, cameo) – chỉ để tham khảo cảm hứng.
