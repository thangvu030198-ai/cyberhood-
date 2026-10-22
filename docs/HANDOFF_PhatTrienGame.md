# HANDOFF – TỔNG HỢP PHIÊN THIẾT KẾ GAME (dán nguyên file này vào phiên chat làm game)

## A. BỐI CẢNH DỰ ÁN
- Đã có sẵn: **web game góc nhìn kiểu GTA** (đi bộ, lái xe, bắn).
- **Đã chuyển hướng:** màn chơi chính là **2D màn ngang (side-scrolling, kiểu action-platformer Mega Man X)**; **chỉ khu phố trung tâm (Hub) giữ 3D góc GTA**. Ảnh tham chiếu chủ dự án gửi: nhân vật giáp robot bắn súng tay, nền sa mạc xác tàu vũ trụ, thanh máu dọc bên trái.
- Mục tiêu: biến thành **GameFi gắn Token Launchpad**, cảm hứng **Ready Player One** (săn 3 chìa → mở cổng → Easter Egg, biến hình Mech).
- Yêu cầu của chủ dự án (theo thứ tự đã chốt trong phiên):
  1. Dễ chơi, phiên ngắn, lặp lại gây cuốn.
  2. **Mỗi mùa có bộ map riêng**, vào chơi lấy thưởng; có **chế độ solo**.
  3. **Biến hình** thành Mech như trong phim.
  4. **Kinh tế token thật**: người chơi kiếm vật phẩm để **bán**, ngẫu nhiên săn được **đồ xịn để đấu giá / bán giá cao**.
  5. **Nhiều người chơi**, **tổ đội**, **bang phái**.
  6. **Màn chơi 2D màn ngang**, chỉ Hub khu phố là 3D góc GTA.

## B. CÁC QUYẾT ĐỊNH ĐÃ CHỐT (không thay đổi nếu chưa hỏi chủ dự án)
1. Game **rơi ĐỒ, không rơi token**; token luân chuyển chủ yếu giữa người chơi qua chợ/đấu giá.
2. Mech **ráp từ 4 linh kiện** (Lõi/Giáp/Vũ khí/Động cơ), có **độ bền** – sửa bằng token (chỗ tiêu token lớn nhất).
3. **5 độ hiếm** 60/30/8/1.8/0.2% + **1 Easter Egg độc nhất/mùa**; có pity; chênh sức mạnh tối đa **+35%** (PvP nén còn +20%).
4. Mùa 28 ngày: Neon City (Chìa Đồng) → Hollow Hotel (Ngọc Bích) → Warzone (Pha Lê) → Citadel Raid.
5. Hợp đồng = 1 lượt màn 2D 7 phút (3 đoạn, 6 mục tiêu, checkpoint, 3 mạng), sự kiện phút 4, Cổng thoát cuối màn; chết = mất 50% mảnh/đồ cấp thấp; **không bao giờ mất đồ Huyền thoại+ / đồ đang trang bị**.
6. **Hub 3D góc GTA** 100 người/kênh, không PvP (chợ, garage, sảnh bang, Cổng dịch chuyển) + **màn 2D instance**; tổ đội co-op 2D 2–4 (đồ rơi riêng từng người); bang tới 100 người; PvP chỉ trong màn 2D (Tranh chấp 4v4, Đấu trường, Công thành 20 vs 20); 3 quận của Hub là 3 Lãnh thổ.
7. Launchpad: 4 tier cá nhân (Bronze/Silver/Gold/Diamond) + quỹ vé cho top 10 bang chia theo đóng góp; KYC; 1 ví = 1 tài khoản.
8. **Mọi logic quan trọng chạy ở server** (rơi đồ, điểm, sát thương, giao dịch). Client chỉ gửi input & hiển thị.
9. **Không bán rương ngẫu nhiên bằng tiền/token** (rủi ro cờ bạc). Công khai tỉ lệ rơi.
10. **Không dùng tên/hình có bản quyền** (OASIS, Sixers, Gundam, DeLorean…). Dùng tên tự đặt: CYBERHOOD, IXO Corp, Legion, Titan Frame, Colossus, Velocity, Extra Coin, Chrono Cube, Nova Bomb.
11. **Blockchain: Robinhood Chain** (Ethereum L2, Arbitrum Orbit, EVM, gas trả bằng ETH) – xem phần C2.
12. **Tên game & token: CYBERHOOD** (token ký hiệu $CYBERHOOD).
13. **Biểu tượng chủ đạo là MŨI TÊN** (cyberpunk + cung thủ mũ trùm): logo, token, chìa khoá, độ hiếm, icon UI – xem mục 0B và thư mục `CYBERHOOD_Brand/`.
14. **Cơ chế thưởng người chơi (mục 9B):** 40% doanh thu nền tảng chia tuần theo hoạt động (căn bậc hai + trần), 30% suất Launchpad + airdrop dự án, Mech miễn phí, cho thuê Mech 70/25/5, nghề nghiệp, giới thiệu 10%/180 ngày, Mùa 0 airdrop. Thưởng theo HOẠT ĐỘNG, không theo nắm giữ token.
15. **Logo chính thức:** hướng 'Mũi tên xuyên chữ H' (Orbitron Black), có bản 3D nổi khối – thư mục `CYBERHOOD_Brand/logo_v2/` và `logo_3d/`.
16. **Săn tiền thưởng qua Cổng + Lính đánh thuê NPC + Vùng Săn map rộng** (mục 4F–4H): 5 loại Cổng (Đồng/Ngọc Bích/Pha Lê/Đỏ-PvP/Vàng-toàn server), truy vết 3 manh mối, tiêu diệt hoặc bắt sống ×1.5, Hạng Thợ săn F→S, NPC lấp chỗ trống trong đội 4 + 1 Drone/xe, NPC yếu hơn người thật (55–80%).
17. **Cổng Công Thành 3D** (mục 4I): dùng lại engine Hub góc GTA, bản đồ tuyết Thành Băng IXO, 100 vs 100 (mỗi phe 70% NPC + 30% người thật), 5 giai đoạn (xung phong → phá 3 máy phát khiên → phá cổng → sân trong → giữ Lõi Thành 60s), phe thủ có Boss Mech + 1 Bom Nova; dùng cho Đại chiến hằng ngày và chiến tranh lãnh thổ cuối tuần.

## C. HƯỚNG DẪN CHO AI LÀM GAME
- Đọc **GDD (phần D)** để hiểu logic; dùng **config JSON (phần E)** làm nguồn số liệu duy nhất – không hardcode con số trong code.
- Làm theo **lộ trình mục 12** của GDD: MVP 0 (nền multiplayer) → MVP 1 (hợp đồng) → MVP 2 (biến hình) → MVP 3 (đồ) → Beta → Launch.
- Trước khi code, hãy **đọc code game GTA hiện có**, hỏi engine/stack nếu chưa rõ, và tích hợp vào kiến trúc sẵn có thay vì viết lại.
- Các con số trong config là **giá trị khởi điểm**, sẽ cân bằng lại theo dữ liệu beta → đặt chúng ở config/DB để chỉnh không cần deploy lại.
- Những điểm CẦN HỎI chủ dự án trước khi làm: engine & backend hiện tại, thị trường mục tiêu (ảnh hưởng pháp lý/KYC).

## C2. TRIỂN KHAI TRÊN ROBINHOOD CHAIN

### Thông tin chain (đối chiếu lại tài liệu chính thức trước khi deploy)
| Mục | Giá trị |
|---|---|
| Loại | Ethereum Layer 2, xây trên **Arbitrum Orbit (Nitro)**, tương thích **EVM** |
| Mainnet | Ra mắt 01/07/2026 (testnet công khai từ 10/02/2026) |
| Chain ID | **4663** (mainnet – cần xác nhận lại trên docs chính thức) |
| Gas | Trả bằng **ETH**. Robinhood Chain **không có token riêng** – mọi token mang tên "Robinhood Chain token" là giả |
| Công cụ | Foundry, Hardhat, Alchemy RPC dùng được như Arbitrum One |
| Hạ tầng đối tác | Uniswap (AMM riêng trên chain), Alchemy (node), BitGo (lưu ký), Chainlink (oracle) |
| Ví | Robinhood Wallet + ví EVM thông thường (MetaMask, Rabby…) |
| Lưu ý | Sequencer do Robinhood vận hành (tập trung). Chain hướng tới tài sản token hoá → cần kiểm tra chính sách niêm yết/khu vực cho GameFi & launchpad |

### Smart contract cần viết (Solidity, OpenZeppelin)
| Contract | Chuẩn | Chức năng |
|---|---|---|
| `CyberhoodToken` | ERC-20 | Token **$CYBERHOOD** của game. Cung cố định hoặc phát theo lịch; có hàm `burn` |
| `GameItems` | **ERC-1155** | Linh kiện, Mech, xe, item, skin. **Mint theo nhu cầu**: server ký phiếu (EIP-712 voucher) → người chơi tự gọi `mint` + trả phí đúc. Easter Egg là ID có supply = 1 |
| `Marketplace` | — | Rao bán giá cố định bằng CyberhoodToken; phí 5% chia: 40% đốt / 40% quỹ mùa / 20% bang sở hữu lãnh thổ (theo config) |
| `AuctionHouse` | — | Đấu giá tăng dần 24h, bước giá 5%, chống trả giá phút chót +5 phút, chỉ nhận đồ Huyền thoại+ |
| `Launchpad` | — | Bán token dự án mỗi mùa; whitelist bằng **Merkle root** theo tier (Bronze/Silver/Gold/Diamond + quỹ vé bang); mua sớm theo tier; nhận thanh toán ETH/USDC |
| `Treasury` | — | Giữ quỹ mùa, quỹ bang (multisig), chia thưởng top mùa |
| RNG Thần thoại | — | Dùng **Chainlink VRF nếu đã hỗ trợ trên Robinhood Chain**; nếu chưa → commit-reveal (server công bố hash seed trước, tiết lộ sau) |

### Luồng on-chain / off-chain
```
OFF-CHAIN (server game)                 ON-CHAIN (Robinhood Chain)
- Trận đấu, rơi đồ, điểm, mảnh chìa     - CyberhoodToken (ERC-20)
- Kho đồ chưa đúc, Coin                 - GameItems (ERC-1155) khi người chơi đúc
- Bang, tổ đội, lãnh thổ                - Marketplace / AuctionHouse
- Tính tier launchpad → Merkle root  →  - Launchpad (verify Merkle proof)
- Ký voucher đúc NFT (EIP-712)       →  - GameItems.mint(voucher)
- Indexer đọc event chain            ←  - Event: Transfer, Sale, Bid, Burn
```

### Lưu ý triển khai
1. Deploy & test đầy đủ trên **testnet Robinhood Chain** trước; audit contract trước mainnet.
2. Đồ đang nằm trong game là off-chain; khi đúc NFT thì **khoá bản off-chain** (tránh nhân đôi); khi nạp NFT vào game thì **burn hoặc khoá trong contract escrow**.
3. Hợp đồng nâng cấp được (UUPS proxy) + multisig + timelock cho quyền admin.
4. Gas trả bằng ETH → cân nhắc **paymaster / tài trợ gas** cho người chơi mới (Account Abstraction) để không phải mua ETH trước.
5. Thanh khoản CyberhoodToken: tạo pool trên **Uniswap** của Robinhood Chain; khoá LP.
6. Pháp lý: launchpad bán token cho người dùng có thể bị coi là chào bán chứng khoán tuỳ quốc gia → **tham vấn luật sư**, chặn khu vực cấm, KYC.

## D. TÀI LIỆU THIẾT KẾ GAME (GDD v1.7)

## GAME DESIGN DOCUMENT – BẢN HOÀN CHỈNH
**Thể loại:** Web game **hành động 2D màn ngang** (side-scrolling, chạy – nhảy – dash – bắn, phong cách action-platformer cổ điển) + **Khu phố trung tâm 3D góc nhìn kiểu GTA** · GameFi · Token Launchpad trên **Robinhood Chain**
**Cảm hứng:** Ready Player One (săn chìa → mở cổng → tìm Easter Egg, biến hình Mech)
**Phiên bản:** 1.7 · 22/10/2026 (thêm Cổng Công Thành 3D – mục 4I: 70% NPC + 30% người thật mỗi phe, góc nhìn GTA dùng lại engine Hub)

> ⚠️ **Tên gọi & bản quyền:** **Tên chính thức của game và token: CYBERHOOD** (ký hiệu token: **$CYBERHOOD**). Các tên khác (IXO Corp, Legion, Titan Frame…) là tên tự đặt. KHÔNG dùng tên/hình ảnh có bản quyền (OASIS, Sixers, Gundam, Iron Giant, DeLorean, Atari…). Phong cách 2D lấy cảm hứng từ dòng action-platformer cổ điển (kiểu Mega Man X) **nhưng KHÔNG dùng sprite, nhân vật, HUD, âm thanh, logo hay màn chơi gốc của Capcom** – toàn bộ art & âm thanh phải tự vẽ / tự làm. Dữ liệu gốc của phim để tham khảo nằm ở `ReadyPlayerOne_GameData.md`.
> Toàn bộ thông số cấu hình nằm ở `game_config.json` (khớp với tài liệu này).

---

### 0. TÓM TẮT 1 TRANG

| Thành phần | Nội dung |
|---|---|
| **Fantasy** | Người chơi là "Hunter" trong thế giới ảo CYBERHOOD: tụ tập ở khu phố 3D, bước qua cổng dịch chuyển vào các màn 2D để săn chìa, biến hình thành Mech, săn đồ hiếm để bán / đấu giá. |
| **Hai lớp không gian** | **Hub 3D góc GTA** (khu phố trung tâm, 100 người/kênh, không PvP: chợ, garage, sảnh bang, cổng dịch chuyển) + **Màn chơi 2D màn ngang** (instance 1–4 người cho PvE, nhiều hơn cho PvP/World Boss) + **Công thành 3D** (dùng engine Hub, 100 vs 100: 70% NPC + 30% người thật) |
| **Vòng chơi chính** | Hub 3D → nhận hợp đồng ở Cổng → vào màn 2D 7 phút (một mình hoặc tổ đội) → chạy/nhảy/bắn qua các đoạn màn → hoàn thành mục tiêu → tích thanh biến hình → nhặt linh kiện + mảnh chìa → tới Cổng thoát cuối màn → về Hub nhận thưởng → nâng cấp/bán đồ → chơi lại |
| **Vòng chơi dài hạn** | Ngày (nhiệm vụ, chuỗi đăng nhập) → Tuần (mở khu màn mới, gom chìa) → Mùa 4 tuần (Boss Raid, Easter Egg, suất Launchpad) |
| **Xã hội** | **Tổ đội 2–4 người** (co-op 2D) · **Bang phái** tới 100 người · **Công thành 3D 100 vs 100** (hằng ngày + chiến tranh lãnh thổ cuối tuần) · World Boss 2D |
| **Chế độ** | Hợp đồng PvE (Solo / Tổ đội) · **Săn tiền thưởng qua Cổng trên map rộng, thuê NPC đi cùng** · Solo Thử thách (xếp hạng) · Màn Tranh chấp PvP · Đấu trường · Công thành · Raid / World Boss |
| **Điểm nhấn** | Điều khiển 2D mượt (dash, leo tường, bắn nạp lực) · Biến hình 3 dạng Mech · Chip vũ khí từ boss · Đồ rơi ngẫu nhiên 5 độ hiếm + 1 món độc nhất/mùa |
| **Thưởng người chơi** | **40% doanh thu nền tảng** chia hằng tuần cho người chơi theo hoạt động · 30% suất Launchpad + airdrop từ dự án · Mech miễn phí · cho thuê Mech · nghề nghiệp (mục 9B) |
| **Kinh tế** | Game **rơi ĐỒ, không rơi token**. Người chơi kiếm token bằng cách **bán đồ cho người chơi khác**. Token bị tiêu qua: sửa Mech, ghép đồ, phí chợ, đúc NFT, vé Raid. |
| **Launchpad** | Mỗi mùa = 1 dự án launch. Mở Cổng cuối + điểm mùa → vé whitelist / tier mua. |

---

### 0B. NHẬN DIỆN THƯƠNG HIỆU – BIỂU TƯỢNG MŨI TÊN

**Ý tưởng:** thành phố **cyberpunk** neon + **người cung thủ mũ trùm** (gợi tên Robinhood Chain) → **mũi tên là biểu tượng chủ đạo**. Bộ file gốc (SVG + PNG) nằm trong thư mục `CYBERHOOD_Brand/`.

| Thành phần | File | Mô tả |
|---|---|---|
| Biểu tượng chính | `emblem.svg` | Mũ trùm viền gradient cyan→magenta, kính visor hồng, **mũi tên vàng xuyên chéo**, lông đuôi tên dạng mạch điện |
| Logo ngang | `logo.svg` | Biểu tượng + chữ CYBER (cyan) HOOD (magenta), nghiêng 8°, **mũi tên vàng gạch chân**, khẩu hiệu "Ngắm chuẩn · Làm chủ thành phố" |
| Token $CYBERHOOD | `token.svg` | Đồng xu neon, lục giác mạch điện, **mũi tên vàng hướng lên** |
| Icon ứng dụng | `app_icon.svg` | Biểu tượng chính trong ô bo góc 512×512 |
| 3 Chìa khoá | `keys.svg` | **Chìa hình mũi tên** (lông đuôi + thân có răng chìa + đầu tên): Đồng `#C87533`, Ngọc Bích `#00C08B`, Pha Lê `#B9F2FF` |
| Độ hiếm | `rarity.svg` | **Số mũi tên = độ hiếm**: › Thường · ›› Hiếm · ››› Sử thi · ›››› Huyền thoại · ››››› Thần thoại; Easter Egg = quả trứng có mũi tên xuyên qua |
| Icon giao diện | `ui_icons.svg` | 12 icon nét neon, đều chứa mũi tên: Cổng dịch chuyển, Mục tiêu (hồng tâm), Chợ, Đấu giá, Garage, Bang phái (khiên + 2 mũi tên chéo), Năng lượng, Biến hình, Lãnh thổ (cờ trên cán tên), Launchpad, Thoát màn, Mảnh chìa |
| Bảng tổng hợp | `brand_sheet.png` | Toàn bộ nhận diện trên một trang |

**Bảng màu**

| Tên | Mã | Dùng cho |
|---|---|---|
| Đêm thành phố | `#0A0A18` | Nền chính |
| Neon Cyan | `#00E5FF` | Chữ CYBER, nét icon, UI chính |
| Neon Magenta | `#FF2BD6` | Chữ HOOD, điểm nhấn, mũi tên trong icon |
| Mũi tên Vàng | `#FFD400` | **Mũi tên chủ đạo**, Huyền thoại, nút hành động quan trọng |
| Tím Điện | `#7B2CFF` | Nền phụ, hiệu ứng |
| Trắng Hologram | `#EAF6FF` | Chữ thường |

**Quy tắc dùng trong game**
- **Mọi biểu tượng quan trọng có mũi tên:** marker mục tiêu, hướng dẫn đường đi (waypoint), Cổng thoát, chìa khoá, độ hiếm, nút biến hình, con trỏ chuột.
- Mũi tên vàng = hành động chính / phần thưởng; cyan = thông tin; magenta = nguy hiểm/đối kháng.
- **Gợi ý gameplay đi kèm:** Chip vũ khí "Cung Neon" (bắn tên xuyên nhiều kẻ địch), hiệu ứng rơi đồ Huyền thoại+ là **mũi tên ánh sáng cắm xuống đất**.
- **Tránh nhầm với Robinhood:** KHÔNG dùng màu xanh lá đặc trưng và hình **lông vũ** của logo Robinhood; giữ tông cyan/magenta/vàng neon.
- Phông chữ trong file mẫu là Liberation Sans (tạm). Bản chính thức nên chọn phông chữ có bản quyền thương mại phong cách tech/cyber (VD: Orbitron, Rajdhani – Open Font License) và chuyển chữ logo thành path.

---

### 1. BỐI CẢNH & PHE PHÁI

| Phe | Vai trò trong game | Cảm hứng từ phim |
|---|---|---|
| **Hunters** (người chơi) | Săn chìa, săn đồ | Gunters |
| **Tổ đội / Bang** | Đội co-op, guild | High Five |
| **IXO Corp** | Tập đoàn phản diện muốn chiếm CYBERHOOD | IOI |
| **Legion** | Lính AI của IXO (mob thường, có súng EMP) | Sixers |
| **The Founder** | NPC đã mất, để lại cuộc thi Easter Egg; xuất hiện qua đoạn ký ức | Halliday |
| **The Archivist** | NPC hướng dẫn ở Hub, mở lore, tặng item hiếm | The Curator / Ogden Morrow |
| **Director Vane** | Boss cuối mùa điều khiển Mech khổng lồ | Sorrento + Mechagodzilla |

**Class nhân vật gợi ý (chỉ ảnh hưởng nhẹ, ±10%):**

| Class | Mạnh trong màn 2D | Mech hợp nhất |
|---|---|---|
| Runner | Dash xa hơn, air-dash 2 lần, tích thanh nhanh khi không bị trúng đòn | Velocity |
| Engineer | Sửa Mech rẻ hơn 10%, ghép đồ +3% thành công, đặt tháp súng nhỏ | Colossus |
| Samurai | Kiếm cận chiến combo 3 đòn, máu cao | Titan Frame |
| Ninja | Leo tường nhanh, né (i-frame) dài hơn | Velocity |
| Hacker | Phá khiên/tháp nhanh hơn, giảm thời gian bị EMP | Titan Frame |

---

### 2. CẤU TRÚC MÙA (28 ngày)

Mỗi tuần mở một **khu màn 2D** (truy cập bằng Cổng dịch chuyển ở Hub 3D). Mỗi khu gồm **3 màn thường + 1 màn Boss khu**. Màn được **ghép từ các đoạn (chunk) làm tay, sắp xếp ngẫu nhiên** mỗi lần chơi → chơi lại không nhàm.

| Tuần | Khu mở | Bối cảnh 2D | Lối chơi đặc trưng | Mục tiêu | Hệ số rơi đồ |
|---|---|---|---|---|---|
| 1 (ngày 0) | **Neon City** – Chìa Đồng | Đô thị đêm: mái nhà, tàu điện, cao tốc | Đoạn tốc độ tự cuộn (Ride Chaser), **đường bí mật khi chạy ngược sang trái lúc xuất phát** | 15 mảnh → Chìa Đồng | ×1.0 |
| 2 (ngày 7) | **Hollow Hotel** – Chìa Ngọc Bích | Khách sạn ma: thang máy, hành lang, phòng khiêu vũ | Màn tối (đèn pin), cửa ẩn, giải đố công tắc, quái bất tử phải né | 15 mảnh → Chìa Ngọc Bích | ×1.2 |
| 3 (ngày 14) | **Warzone** – Chìa Pha Lê | Sa mạc xác tàu vũ trụ, căn cứ Legion | Bắn liên tục, tháp súng, phá khiên, đoạn leo xác tàu | 15 mảnh → Chìa Pha Lê | ×1.5 |
| 4 (ngày 21) | **Citadel Raid** | Lâu đài IXO | Boss rush + Boss Mech khổng lồ nhiều giai đoạn | Cần đủ 3 Chìa | ×2.0 |

**Quy tắc mùa**
- Khu mở dần theo tuần nhưng **không đóng lại** → người vào muộn vẫn bắt kịp.
- Mùa sau **dùng lại khu nền**, chỉ đổi: bảng màu/tileset nền, thứ tự & loại chunk, bộ quái, boss, bộ đồ độc quyền mùa.
- Ai **đầu tiên** mở Cổng cuối → nhận **Easter Egg mùa** (1 món duy nhất, đấu giá được).
- Hết mùa: reset mảnh chìa, Chìa, Điểm mùa. **Giữ lại** level, đồ, Mech, token.

---

### 2B. ĐIỀU KHIỂN & CHIẾN ĐẤU 2D

| Thao tác | Bàn phím | Tay cầm | Cảm ứng (mobile) | Ghi chú |
|---|---|---|---|---|
| Di chuyển | ← → | Cần trái | Joystick ảo | |
| Nhảy | Z / Space | A | Nút Nhảy | Giữ lâu nhảy cao hơn |
| Dash | Shift | RB | Nút Dash | Dash trên không (air-dash) 1 lần/lần nhảy |
| Leo / bật tường | Nhảy khi áp tường | — | — | Trượt tường chậm, bật ra đối diện |
| Bắn | X | X | Nút Bắn | **Giữ để nạp**: cấp 1 (0.5s), cấp 2 (1.5s) – sát thương ×1 / ×3 / ×6 |
| Cận chiến | C | Y | Nút Kiếm | Combo 3 đòn (Samurai mạnh nhất) |
| Vũ khí đặc biệt | A / S đổi, D bắn | LB + X | Nút Chip | Dùng **Chip vũ khí** (mục 6), tốn thanh năng lượng vũ khí |
| Biến hình | F | LT + RT | Nút Mech | Khi thanh biến hình đầy |
| Item | 1–4 | D-pad | Ô item | Extra Coin, Chrono Cube, Pin… |

**Luật chiến đấu**
- Thanh máu dọc bên trái màn hình; trúng đòn → bị đẩy lùi + bất tử 1s.
- Mỗi hợp đồng có **3 mạng**. Rơi hố / gai / hết máu → mất 1 mạng, hồi ở checkpoint gần nhất. Hết mạng = "chết" (áp dụng luật mất đồ mục 3). Extra Coin = +1 mạng.
- **Checkpoint** sau mỗi đoạn màn (3 checkpoint/màn).
- Độ phân giải nội bộ gợi ý **480×270** (16:9), phóng to theo số nguyên → pixel art sắc nét.

---

### 3. MỘT HỢP ĐỒNG (7 phút – một lượt chơi màn 2D)

> Nhận tại **Cổng dịch chuyển** trong Hub 3D (một mình hoặc tổ đội ≤ 4). Mỗi hợp đồng là một **instance màn 2D** riêng. Solo Nhiệm vụ và Hợp đồng tổ đội dùng chung logic.

```
[0:00] Vào màn 2D (3 đoạn + cổng thoát; màn Boss khu: 2 đoạn + phòng boss)
       6 MỤC TIÊU rải trong màn: hạ nhóm Legion, giải cứu con tin, phá máy phát khiên,
       lấy ổ dữ liệu, tìm đường bí mật, mở rương ẩn
[0:00–4:00] Đoạn 1 → Đoạn 2: chạy, nhảy, dash, leo tường, bắn
       Mỗi mục tiêu: +100 điểm · +20% thanh biến hình · 1 lượt rơi đồ · 20% ra mảnh chìa
[4:00] SỰ KIỆN ngẫu nhiên (1 trong 3):
       - Tàu thả hàng tiếp tế (đồ Sử thi trở lên; ở Solo/PvE: Legion cố cướp, phải giữ 30s)
       - Đoạn rượt đuổi tự cuộn (màn hình chạy, kẻ thù đuổi phía sau; sống sót → x2 điểm sự kiện)
       - Mini-boss Mech (bắt buộc biến hình mới đánh hiệu quả)
[4:00–7:00] Đoạn 3 → CỔNG THOÁT ở cuối màn (hoặc phòng Boss khu)
[Kết thúc] Tới Cổng thoát / hạ Boss → nhận 100% đồ + mảnh
           Hết mạng / hết giờ → MẤT 30% mảnh chìa + 30% đồ nhặt trong màn (từ Hiếm trở xuống); có Thẻ Bảo hiểm thì không mất
           (Đồ Huyền thoại/Thần thoại nhặt được KHÔNG bao giờ mất – tránh cảm giác ức chế)
```

**Công thức điểm & sao**
```
Điểm = Mục tiêu×100 + Hạ Legion×10 + Giây còn dư×2 + Điểm sự kiện (200–500)
Sao: 1★ ≥ 500 | 2★ ≥ 1200 | 3★ ≥ 2000
Hệ số thưởng: 1★ ×1.0 | 2★ ×1.5 | 3★ ×2.0
Chuỗi đăng nhập: +5%/ngày, tối đa +50% (10 ngày)
```

**Năng lượng:** tối đa 5, hồi 1/giờ. Mỗi hợp đồng PvE / Solo Thử thách tốn 1. Đi dạo Hub miễn phí.
Thêm năng lượng: nhiệm vụ ngày (+2), mời bạn (+1/bạn, tối đa 3/ngày), mua bằng token (giới hạn 5/ngày).

---

### 4. CHẾ ĐỘ CHƠI

| Chế độ | Không gian | Số người | Năng lượng | Thưởng | Đồ cá nhân có tác dụng? |
|---|---|---|---|---|---|
| **Hub khu phố** | 3D góc GTA | 100/kênh | 0 | Không rơi đồ; giao lưu, chợ, bang | — |
| **Hợp đồng PvE** (Solo hoặc Tổ đội) | Màn 2D | 1–4 | 1/người | Điểm mùa, mảnh chìa, đồ rơi, XP (+ bonus tổ đội) | ✅ Có |
| **Solo – Thử thách** | Màn 2D cùng seed | 1 | 1 | Xếp hạng tuần (speedrun/điểm) → token + vé whitelist cho top | ❌ **Đồ chuẩn hoá** (công bằng cho người không nạp) |
| **Màn Tranh chấp** (PvP) | Màn 2D | 2 tổ đội × 4 = 8 | 1 | Rơi ×1.5, nhặt đồ của người bị hạ | ✅ (nén chênh lệch) |
| **Đấu trường** | Arena 2D | 1v1 / 2v2 / 4v4 | 0 | Hạng mùa, danh hiệu, top nhận token | ✅ (nén chênh lệch) |
| **Citadel Raid** (tuần 4) | Màn 2D boss rush | 1–4 | 1 + vé Raid | Tỉ lệ rơi ×2, Chìa → Cổng cuối | ✅ (yêu cầu Sức mạnh Mech ≥ 300) |
| **World Boss** | Arena 2D lớn | 4–12 | 1 + vé Raid | Rơi ×2, điểm bang | ✅ |
| **Săn tiền thưởng** | Vùng Săn 2D map rộng | 1–4 (+NPC), Cổng Đỏ 2 đội, Cổng Vàng 8–20 | 1 (Cổng Vàng 0) | Thưởng lệnh × hệ số Cổng, Điểm Truy nã, Thẻ lính đánh thuê | ✅ |
| **Công thành 3D** (hằng ngày + cuối tuần) | **3D góc GTA** – bản đồ tuyết | 100 vs 100 (mỗi phe 30 người + 70 NPC) | 1 / Vé công thành | Đồ Băng Chiến, Điểm Hunter; cuối tuần: lãnh thổ ở Hub | ✅ |

---

### 4A. THẾ GIỚI: HUB 3D + MÀN 2D

#### 4A.1 Hub khu phố 3D (góc nhìn kiểu GTA)
- Là **không gian chung chạy liên tục**, chia **kênh tối đa 100 người**. Kênh đầy → tự mở kênh mới. Đổi kênh hồi 60s; tổ đội & bang được ưu tiên vào cùng kênh.
- **Không PvP.** Đi bộ, lái xe Hub (chỉ để di chuyển & khoe), gặp người, chat, emote.
- **Các điểm trong Hub:**

| Địa điểm | Chức năng |
|---|---|
| **Cổng dịch chuyển** (1 cổng/khu màn) | Nhận hợp đồng, chọn Solo/Tổ đội, ghép đội tự động, vào màn 2D |
| **Chợ & Nhà đấu giá** | Mua bán, đấu giá trực tiếp (màn hình lớn giữa quảng trường) |
| **Garage** | Ráp/sửa Mech, ghép & nung chảy đồ, thử Mech |
| **Sảnh bang** | Không gian riêng của bang |
| **Bảng xếp hạng & Bảng Lãnh thổ** | Hiện bang đang giữ 3 quận của Hub, top người chơi |
| **Đấu trường / Cổng PvP** | Vào Màn Tranh chấp, Đấu trường, Công thành |
| **NPC Archivist** | Lore, nhiệm vụ ngày, manh mối Easter Egg |

- **3 quận của Hub = 3 Lãnh thổ** (Cảng, Phố Neon, Khu Công nghiệp): cờ & màu bang sở hữu hiện ngay trên đường phố 3D.

#### 4A.2 Sự kiện trong Hub
| Sự kiện | Tần suất | Mô tả |
|---|---|---|
| **Chợ phiên chớp nhoáng** | 2 giờ/lần | Đấu giá nhanh 10 phút đồ Sử thi+ do người chơi ký gửi |
| **Báo động Legion** | 1 giờ/lần | Cổng đặc biệt mở 10 phút: màn 2D phòng thủ chung (tối đa 12 người), thưởng theo đóng góp |
| **World Boss** | 3 lần/ngày, giờ cố định | Boss xuất hiện trên bầu trời Hub → cổng World Boss mở |
| **Truy tìm Archivist** | Ngẫu nhiên | Archivist xuất hiện ở góc bí mật của Hub, ai tìm thấy nhận mảnh chìa bonus |

#### 4A.3 Màn 2D
| Loại màn | Số người | PvP | Hệ số rơi | Điều kiện |
|---|---|---|---|---|
| Hợp đồng PvE | 1–4 | ❌ | theo khu (×1.0 → ×2.0) | — |
| Màn Tranh chấp | 2 đội × 4 | ✅ | ×1.5 | Level ≥ 10 |
| World Boss / Báo động | 4–12 | ❌ | ×2.0 / theo đóng góp | — |
| Công thành (3D, mục 4I) | 100 vs 100 (30% người thật) | ✅ | — | Xếp hàng hằng ngày / bang đã đăng ký |
| Đấu trường | 2–8 | ✅ | — (thưởng xếp hạng) | Level ≥ 10 |

---

### 4B. TỔ ĐỘI (2–4 người, co-op 2D)

| Quy tắc | Chi tiết |
|---|---|
| Lập đội | Mời trong Hub, hoặc **ghép đội tự động** tại Cổng theo khu + level |
| Camera | Camera chung bám theo nhóm; ai tụt quá xa màn hình → dịch chuyển về cạnh đồng đội (giống co-op 2D cổ điển) |
| Đồ rơi | **Đồ rơi riêng từng người** (mỗi người tự roll, chỉ mình thấy) → không tranh giành |
| Tiến độ | Hoàn thành mục tiêu → cả đội nhận điểm & lượt rơi; mảnh chìa roll riêng |
| Bonus tổ đội | +5% điểm & tỉ lệ rơi / thành viên thêm (tối đa +15% với 4 người) |
| Độ khó | Máu quái & số lượng Legion tăng theo số người (×1.0 / ×1.6 / ×2.1 / ×2.5) |
| **Đồng bộ biến hình** | ≥ 3 thành viên biến hình trong vòng 10 giây → cả đội +20% sát thương, +5s thời gian Mech |
| **Hợp thể** (giai đoạn 3) | 4 người cùng biến hình → ghép thành 1 Mech khổng lồ 30s (1 người lái, 3 người điều khiển vũ khí) |
| Hồi sinh | Đồng đội đứng cạnh 3s để đỡ dậy thay vì mất mạng (1 lần/hợp đồng/người) |

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
| **Sảnh bang** | Không gian riêng trong Hub 3D, trang trí, nâng cấp bằng token (chỗ tiêu token) |
| **Cây kỹ năng bang** | Buff nhỏ cho mọi thành viên, **tổng tối đa**: +5% tỉ lệ rơi, -10% phí sửa Mech, +1 năng lượng tối đa, +5% XP |
| **Nhiệm vụ bang tuần** | Mục tiêu chung (VD: cả bang hoàn thành 500 hợp đồng) → rương bang |
| **Chat & điểm danh bang** | Kênh chat riêng, điểm danh ngày cộng XP bang |
| **Điểm đóng góp cá nhân** | Tính từ hoạt động cho bang → quyết định phần thưởng mỗi người nhận (chống ăn bám) |

#### 4C.3 Chiến tranh Lãnh thổ
- **3 Lãnh thổ = 3 quận của Hub 3D** (Cảng, Phố Neon, Khu Công nghiệp).
- **Đăng ký** thứ 5–6, phí **50 token**/lãnh thổ (đốt). **Công thành** thứ 7 hoặc Chủ nhật, 25 phút, tối đa **30 người/bang** + 70 NPC mỗi phe.
- **Trận công thành dùng Cổng Công Thành 3D (mục 4I)**: bang tấn công là Phe Hunter, bang đang giữ lãnh thổ là phe thủ thành. Thắng → giữ/chiếm lãnh thổ 1 tuần.
- Khi có nhiều bang đăng ký cùng lãnh thổ: đấu loại (bracket) – 2 bang điểm bang mùa cao nhất vào trận chính, các bang còn lại đấu vòng loại thứ 7, trận chính Chủ nhật.

| Quyền lợi bang sở hữu lãnh thổ | Giá trị |
|---|---|
| Thuế giao dịch | **1%** giá trị mọi giao dịch chợ diễn ra ở quận đó của Hub (lấy từ phí chợ 5%, không cộng thêm cho người mua) |
| Buff rơi đồ | +20% cho thành viên bang khi vào màn qua **Cổng đặt trong quận** đó |
| Boss lãnh thổ | 1 boss 2D riêng mỗi ngày, chỉ bang sở hữu đánh được |
| Danh tiếng | Cờ, màu, tượng bang dựng ngay trên đường phố 3D của quận |

**Chống độc quyền:** mỗi bang giữ tối đa **2 lãnh thổ**; liên minh tối đa 2 bang; bang giữ cùng 1 lãnh thổ ≥ 3 tuần liên tiếp thì tháp phòng thủ yếu đi 20%/tuần.

#### 4C.4 Xếp hạng bang mùa
Điểm bang = Điểm công thành + Guild Raid + Nhiệm vụ bang + Tổng điểm mùa thành viên (lấy 30 người cao nhất, tránh bang đông thắng chỉ vì số lượng).
Top bang nhận **Quỹ suất Launchpad bang** (mục 8) + skin/cờ độc quyền mùa.

---

### 4D. LUẬT PvP

| Quy tắc | Chi tiết |
|---|---|
| Nơi có PvP | **Màn 2D PvP** (Màn Tranh chấp, Đấu trường) và **Cổng Công Thành 3D**. Sảnh Hub 3D và màn PvE **không có PvP** |
| Bảo vệ người mới | Level < 10: không vào màn PvP |
| Bị hạ trong Màn Tranh chấp (luật này **thay** luật mất đồ ở mục 3) | Mỗi lần mất mạng rơi **30% đồ nhặt trong màn** (Thường → Sử thi) xuống đất cho người khác nhặt. **Không bao giờ** rơi đồ đang trang bị, linh kiện Mech, đồ Huyền thoại+ |
| Mảnh chìa | Hết mạng: mất 30% số mảnh nhặt trong màn (như mục 3), mảnh không rơi cho người khác |
| Ghép trận | Màn Tranh chấp & Đấu trường ghép theo **Sức mạnh tổng ±15%** và level ±5 → hạn chế bắt nạt người yếu |
| Đấu trường | Không rơi đồ; tính điểm hạng (Elo); thưởng cuối mùa theo hạng |
| Cân bằng | Trong PvP, chênh lệch sức mạnh (Mech + giáp) bị nén còn tối đa +20%; chip vũ khí giảm 30% sát thương lên người chơi |
| Chống phá | Bỏ trận giữa chừng → khoá PvP 15 phút, lặp lại tăng dần |

---

### 4E. GHI CHÚ KỸ THUẬT (WEB)

| Hạng mục | Đề xuất |
|---|---|
| **Hub 3D** | Giữ engine 3D góc GTA đã có (Three.js / Babylon.js…). Server room 100 người (Colyseus hoặc Nakama), tick 20 Hz, **AOI** lưới 50 m, chỉ đồng bộ di chuyển, emote, xe, chat |
| **Màn 2D** | Engine 2D trên web (gợi ý **Phaser 3** hoặc PixiJS + vật lý platformer tự viết). Vật lý **fixed timestep 60 Hz**, tilemap (Tiled), sprite pixel art |
| **Chuyển cảnh** | Bước vào Cổng → server tạo room màn 2D → client tải lười (lazy-load) gói asset của khu → vào màn; hết màn → quay lại đúng vị trí Cổng ở Hub |
| **Mạng màn PvE (1–4)** | Mỗi client mô phỏng nhân vật của mình (client prediction), gửi input + vị trí 30 Hz; **server xác thực**: tốc độ/vị trí hợp lệ, sát thương, máu quái, mục tiêu, **rơi đồ luôn do server roll** |
| **Mạng màn PvP (≤ 40)** | **Server authoritative** hoàn toàn, tick 30 Hz, lag compensation cho đạn, interpolation cho người khác |
| **Tạo màn** | Thư viện chunk làm tay (mỗi khu ~30 chunk); server chọn seed → ghép màn; Solo Thử thách dùng chung seed tuần |
| **Dữ liệu** | PostgreSQL (tài khoản, đồ, bang, chợ), Redis (trạng thái realtime, xếp hạng, chat) |
| **Ghép đội** | Hàng đợi theo khu + level ±5 (PvE); Sức mạnh ±15% (PvP) |
| **Chat** | WebSocket riêng: Thế giới / Kênh Hub / Tổ đội / Bang / Riêng tư; lọc từ ngữ |
| **Chống gian lận** | Kiểm tra tốc độ di chuyển, độ cao nhảy, tầm & tốc độ bắn ở server; replay input của hợp đồng có đồ Huyền thoại+ để kiểm tra lại; log mọi rơi đồ & giao dịch |
| **Thiết bị** | Bàn phím, tay cầm (Gamepad API), cảm ứng mobile; mục tiêu 60 FPS trên điện thoại tầm trung |

---

### 4F. SĂN TIỀN THƯỞNG QUA CỔNG (BOUNTY HUNT)

Săn tiền thưởng là **vòng chơi thứ hai** song song với Hợp đồng: dài hơn (10–30 phút), diễn ra trên **map rộng**, có mục tiêu cụ thể, thưởng cao hơn và là chỗ dùng **lính đánh thuê NPC** (mục 4G).

#### 4F.1 Bảng Truy nã (ở Hub 3D)
| Loại lệnh truy nã | Ai đăng | Số lượng | Thưởng |
|---|---|---|---|
| **Lệnh hằng ngày** | Hệ thống | 3 lệnh miễn phí/ngày (làm mới 0h) | Coin, đồ, Điểm Truy nã |
| **Lệnh Tinh anh** | Hệ thống | 2 lệnh/tuần | Đồ Sử thi+, Chip vũ khí, Thẻ lính đánh thuê |
| **Lệnh của người chơi / bang** | Người chơi, bang | Không giới hạn (phí đăng 5%) | Token hoặc đồ **ký quỹ trong hợp đồng thông minh**, trả tự động khi hoàn thành |
| **Truy nã toàn server** | Hệ thống | 1 lần/tuần (tối thứ 6) | Quỹ thưởng lớn chia theo đóng góp |

Lệnh của người chơi chỉ nhắm **mục tiêu NPC / nhiệm vụ / vật phẩm** (VD: "mang về 10 Lõi Plasma", "hạ Đầu sỏ Legion ở Cổng Pha Lê trong 15 phút", "hộ tống xe hàng qua Cổng Đỏ"). **Không cho treo thưởng lên đầu người chơi khác** → tránh quấy rối.

#### 4F.2 Các Cổng săn
| Cổng | Yêu cầu | Đội | Mục tiêu điển hình | Thời gian | Hệ số thưởng | PvP |
|---|---|---|---|---|---|---|
| **Cổng Đồng** | Hạng F+ | 1–4 | Chỉ huy Legion, kẻ trộm dữ liệu chạy trốn | 10 phút | ×1.0 | ❌ |
| **Cổng Ngọc Bích** | Hạng D+, Sức mạnh ≥ 300 | 2–4 | Tinh anh nhiều giai đoạn, có tay sai | 15 phút | ×1.6 | ❌ |
| **Cổng Pha Lê** | Hạng B+, Sức mạnh ≥ 600 | 3–4 | Mech Tinh anh, bẫy, 2–3 mục tiêu cùng lúc | 20 phút | ×2.5 | ❌ |
| **Cổng Đỏ** (nguy hiểm) | Hạng C+, level ≥ 20 | 2 đội × 4 | Mục tiêu lang thang – **đội khác có thể cướp mục tiêu** | 20 phút | ×3.0 | ✅ |
| **Cổng Vàng** (toàn server) | Mọi hạng | 8–20 người/map | Trùm truy nã tuần, nhiều giai đoạn | 30 phút | Quỹ tuần | ❌ |

Mỗi lần vào Cổng săn tốn **1 năng lượng** (Cổng Vàng miễn phí).

#### 4F.3 Một chuyến săn
```
1. NHẬN LỆNH ở Bảng Truy nã → chọn Cổng → lập đội / ghép đội / THUÊ NPC (mục 4G)
2. VÀO VÙNG SĂN (map rộng – mục 4H). Mục tiêu đang di chuyển trên map.
3. TRUY VẾT: la bàn MŨI TÊN chỉ hướng + khoảng cách ước lượng
   - Thu thập 3 manh mối (dấu chân điện tử, tin báo của NPC chỉ điểm, dữ liệu camera)
     → mỗi manh mối thu hẹp vùng tìm kiếm; đủ 3 → hiện vị trí chính xác
   - NPC Trinh sát rút ngắn thời gian truy vết
4. ĐỐI ĐẦU: mục tiêu có tay sai + 2–3 giai đoạn; máu < 30% sẽ BỎ CHẠY về lối thoát
5. CHỌN CÁCH KẾT THÚC:
   - TIÊU DIỆT: thưởng chuẩn
   - BẮT SỐNG: hạ máu < 20% → dùng Lưới EMP → hộ tống mục tiêu về điểm rút quân
     (mục tiêu có thể vùng thoát, tay sai chặn đường) → THƯỞNG ×1.5 + Thẻ lính đánh thuê hiếm
6. RÚT QUÂN tại Cổng thoát → nhận thưởng. Hết giờ hoặc cả đội gục → thất bại, mất 30% đồ nhặt (như mục 3)
```

#### 4F.4 Thưởng & Hạng Thợ săn
- **Thưởng** = Thưởng gốc của lệnh × hệ số Cổng × (1.5 nếu bắt sống) × (1 + 5%/người chơi thật thêm, tối đa +15%).
- Mỗi chuyến cho **Điểm Truy nã** → **Hạng Thợ săn**: F → E → D → C → B → A → S (S chỉ top 1% server mỗi mùa).
- Hạng mở khoá: Cổng cao hơn, **số NPC được thuê**, quyền **đăng lệnh của người chơi** (từ hạng D), danh hiệu và skin.
- Điểm Truy nã cũng được tính vào **Điểm Hunter** của Quỹ Thưởng Người Chơi (mục 9B): chuyến săn thành công = 20–60 điểm tuỳ Cổng.

---

### 4G. LÍNH ĐÁNH THUÊ NPC (THUÊ NPC ĐI CÙNG)

**Mục đích:** người chơi một mình hoặc đội thiếu người vẫn đi săn được ở map rộng; NPC lấp vị trí trống và bổ sung vai trò còn thiếu.

#### 4G.1 Thuê ở đâu, bao nhiêu
- **Trạm Lính Đánh Thuê** ở Hub 3D hoặc ngay tại Cổng trước khi vào.
- **Đội tối đa 4 vị trí**; NPC lấp vị trí trống (solo thuê tối đa 3, đôi thuê tối đa 2…). Ở **Vùng Săn (map rộng)** được thêm **1 vị trí Hỗ trợ** (drone hoặc xe) ngoài 4 vị trí.
- Số NPC thuê cùng lúc theo Hạng Thợ săn: F–E: 1 · D–C: 2 · B trở lên: 3.

| Hạng NPC | Phí thuê / chuyến | Sức mạnh so với người chơi cùng level |
|---|---|---|
| Lính thường | Coin (miễn phí 1 lần/ngày) | 55% |
| Lính tinh nhuệ | Coin nhiều hơn | 65% |
| Anh hùng (từ Thẻ lính đánh thuê) | Không tốn phí thuê, tốn phí hồi phục | 70–80% |

NPC **luôn yếu hơn người chơi thật** để khuyến khích chơi cùng người thật; **chỉ người chơi thật mới tính bonus tổ đội**.

#### 4G.2 Các vai trò NPC
| Vai trò | Kỹ năng chính | Chiêu đặc biệt (1 nút) |
|---|---|---|
| **Vệ binh** (Tank) | Khiên năng lượng, kéo quái về mình | Dựng khiên chắn đạn 6 giây cho cả đội |
| **Cung thủ Neon** | Bắn tên xuyên nhiều kẻ địch, tầm xa | Mưa tên neon diện rộng |
| **Kỹ sư y tế** | Hồi máu, sửa giáp Mech (giảm hao độ bền) | Hồi sinh 1 đồng đội ngay lập tức |
| **Trinh sát** | Dò mục tiêu, phát hiện rương ẩn & bẫy | Quét radar: hiện mục tiêu + manh mối trong 10 giây |
| **Phá khiên** (Hacker) | Tắt tháp súng, phá khiên nhanh | Gây nhiễu: quái đứng yên 4 giây |
| **Lái xe** (chỉ ở map rộng) | Chở cả đội qua đoạn dài | Gọi xe tới vị trí đội trong 5 giây |
| **Drone hỗ trợ** (vị trí Hỗ trợ) | Bay theo, bắn yểm trợ, nhặt đồ rơi xa | Thả Pin năng lượng +10% thanh biến hình |

#### 4G.3 Điều khiển NPC (đơn giản)
- **Bánh xe lệnh** (giữ phím Q / nút trên mobile): **Theo tôi · Giữ vị trí · Tấn công mục tiêu tôi ngắm · Thu quân**.
- Mỗi NPC có **1 nút chiêu đặc biệt** (phím 5–7), hồi chiêu 30–60 giây.
- AI tự: né đạn, đứng sau Vệ binh, ưu tiên hồi máu người sắp gục, tự nhặt manh mối.
- Người chơi thật **rớt mạng** → NPC tạm thay nhân vật đó (do AI điều khiển) để đội không bị thiếu người.

#### 4G.4 Thẻ lính đánh thuê (vật phẩm giao dịch được)
- NPC Anh hùng có tên, ngoại hình, 5 độ hiếm như vật phẩm (Thường → Thần thoại); rơi từ **Lệnh Tinh anh, bắt sống mục tiêu, Cổng Pha Lê/Vàng**.
- NPC lên cấp theo số chuyến đi cùng, học thêm 1 kỹ năng phụ ở cấp 10/20/30; **độ thân thiết** tăng → +5% chỉ số mỗi bậc (tối đa 3 bậc).
- NPC **bị hạ** trong chuyến → về Hub, cần **hồi phục** (chờ 2 giờ hoặc trả Coin/token) → chỗ tiêu tài nguyên.
- Thẻ **bán / đấu giá / cho thuê** được như Mech (chia 70/25/5) → thêm hàng hoá cho chợ.

---

### 4H. VÙNG SĂN – MAP RỘNG

| Thuộc tính | Chi tiết |
|---|---|
| Kích thước | Rộng **20–30 màn hình** theo chiều ngang, 3 tầng: **mặt đất · mái nhà/cao tốc · đường ngầm** |
| Người chơi | 1–2 đội (tối đa 8 người + NPC) ; Cổng Vàng: 8–20 người |
| Thời lượng | 10–30 phút theo Cổng |
| Di chuyển | Trạm dịch chuyển (mở khi đứng gần 3 giây), Ride Chaser, NPC Lái xe, thang/ống nối giữa các tầng |
| Nội dung | Mục tiêu truy nã di chuyển, manh mối, rương ẩn, mỏ Pin năng lượng, sự kiện ngẫu nhiên (đoàn xe Legion, tháp phát tín hiệu) |
| Hỗ trợ đội | **Đánh dấu bằng mũi tên** (ping) hiện cho cả đội, bản đồ thu nhỏ chung, hồi sinh tại Trạm dịch chuyển gần nhất (mất 10 giây) |
| Bản đồ theo mùa | Mỗi khu (Neon City, Hollow Hotel, Warzone) có 1 Vùng Săn riêng; Cổng Vàng dùng map Citadel mở rộng |

**Gợi ý đội hình**
| Đội | Đội hình gợi ý |
|---|---|
| Solo | Người chơi + Vệ binh + Kỹ sư y tế + Trinh sát |
| 2 người | 2 người chơi + Kỹ sư y tế + Trinh sát |
| 4 người (Cổng Pha Lê) | 4 người chơi + Drone hỗ trợ; Hacker phá khiên nếu đội thiếu |

---

### 4I. CỔNG CÔNG THÀNH 3D – ĐẠI CHIẾN TUYẾT TRẮNG

**Ý tưởng:** tái hiện trận đánh chiếm lâu đài trên cánh đồng tuyết như cảnh cao trào của phim – hàng trăm chiến binh xung phong, khiên năng lượng bao quanh thành, Mech khổng lồ đối đầu. Khác với các Cổng khác (màn 2D), **Công thành dùng lại toàn bộ engine 3D góc nhìn GTA của Hub**: cùng nhân vật, camera, di chuyển, súng, xe – chỉ thay bản đồ và thêm quân NPC.

Ảnh concept: `CYBERHOOD_Brand/concept_cong_thanh_3d.png` (quân Hunter xanh xung phong, Mech dẫn đầu, khiên năng lượng nối 3 máy phát, phe IXO hồng giữ chân tường).

![](/home/user/CYBERHOOD_Brand/concept_cong_thanh_3d.png)

#### 4I.1 Tóm tắt
| Thuộc tính | Chi tiết |
|---|---|
| Góc nhìn | **3D góc GTA (từ trên chéo xuống)** – dùng lại controller, camera, vũ khí, xe của Hub |
| Bản đồ | **"Thành Băng IXO"**: cánh đồng tuyết rộng → hào băng → tường thành có khiên năng lượng → sân trong → Lõi Thành trên đỉnh |
| Hai phe | **Phe Hunter (tấn công)** vs **Phe IXO (thủ thành – phe ác)** |
| Tỉ lệ quân mỗi phe | **70% NPC + 30% người chơi thật** |
| Quy mô chuẩn | **100 vs 100** (mỗi phe 30 người thật + 70 NPC) – tổng 60 người thật + 140 NPC |
| Quy mô khác | Nhỏ 50 vs 50 (15 người/phe) · Sự kiện lớn 200 vs 200 (60 người/phe) |
| Thời lượng | 25 phút |
| Hồi sinh | Theo đợt mỗi 20 giây tại trại quân; mỗi phe có **Vé quân** (số lần hồi sinh chung) |
| Biến hình | ✅ Được biến hình Mech (bản 3D) – Mech đối đầu Mech khổng lồ |
| Năng lượng | 1 (sự kiện hằng ngày) · Vé công thành (chiến tranh lãnh thổ) |

#### 4I.2 Hai cách vào Cổng Công Thành
| Loại trận | Khi nào | Phe Hunter (tấn công) | Phe IXO (thủ thành) | Kết quả |
|---|---|---|---|---|
| **Đại chiến hằng ngày** | 2 khung giờ/ngày (VD 12h30 & 20h30) | Người chơi xếp hàng chọn phe Hunter | Người chơi xếp hàng **đóng vai phe ác IXO** (nhận thưởng như nhau + skin phe ác) | Thưởng đồ, Điểm Hunter |
| **Chiến tranh Lãnh thổ** (cuối tuần) | Thứ 7 / Chủ nhật | Bang đi chiếm + NPC quân đoàn | **Bang đang giữ lãnh thổ** thủ thành + NPC đồn trú | Bang thắng giữ/chiếm quận ở Hub 1 tuần (thay cho trận 2D 20 vs 20 ở mục 4C.3) |

Hệ thống tự **cân phe**: phe ít người thật hơn được bù thêm NPC tinh nhuệ và +10% thưởng ("thưởng phe yếu") → luôn có người chịu chơi phe thủ.

#### 4I.3 Diễn biến trận (5 giai đoạn)
```
GĐ1 – XUNG PHONG (0:00–5:00)
  Phe Hunter xuất phát từ trại trên cánh đồng tuyết, NPC quân đoàn ào lên.
  Phe IXO bắn pháo từ tường thành, thả Legion và quái máy ra chặn.
  → Khoảnh khắc "hàng trăm người lao vào thành" như trong phim.

GĐ2 – PHÁ KHIÊN (5:00–12:00)
  Thành được bọc KHIÊN NĂNG LƯỢNG do 3 Máy phát khiên giữ (Trái – Giữa – Phải).
  Phe Hunter phải chiếm/phá cả 3 (Hacker & NPC Phá khiên phá nhanh hơn).
  Phe IXO giữ máy phát, sửa máy phát bằng Kỹ sư.

GĐ3 – PHÁ CỔNG THÀNH (khi khiên sập)
  Cổng thành có máu lớn: dùng Mech Titan Frame húc, xe bọc thép, chất nổ.
  Phe IXO đổ dầu/laser từ trên tường, mở cửa phụ phản công.

GĐ4 – SÂN TRONG
  Đánh giáp lá cà, leo tường, chiếm 2 tháp canh để mở đường lên Lõi Thành.

GĐ5 – LÕI THÀNH & BOSS
  Phe IXO: 1 người chơi MVP của phe được LÁI BOSS MECH khổng lồ.
  Phe Hunter: giữ vùng Lõi Thành 60 giây (đứng trong vòng) để chiếm thành.
  Phe IXO có 1 lần dùng NOVA BOMB (quả bom xoá sổ toàn bộ quân trong bán kính lớn)
   – ai có Extra Coin thì sống sót (gợi nhớ cảnh trong phim).
```

**Điều kiện thắng**
- **Phe Hunter thắng:** chiếm Lõi Thành 60 giây, **hoặc** Phe IXO hết Vé quân.
- **Phe IXO thắng:** hết 25 phút mà thành chưa thất thủ, **hoặc** Phe Hunter hết Vé quân.

#### 4I.4 NPC trong Công thành (70%)
| Loại NPC | Phe Hunter | Phe IXO | Vai trò |
|---|---|---|---|
| Bộ binh | Hunter tình nguyện | Lính Legion | Đông nhất, đi theo đường hành quân, bắn thường |
| Khiên | Vệ binh | Lính khiên IXO | Chắn đạn, đẩy tuyến |
| Tầm xa | Cung thủ Neon | Xạ thủ tường thành | Bắn từ xa / trên cao |
| Hỗ trợ | Kỹ sư y tế | Kỹ sư sửa máy phát | Hồi máu / sửa khiên & cổng |
| Đặc biệt | Phá khiên, xe bọc thép | Pháo tường thành, chó máy | Phá mục tiêu / phòng thủ |

- **Mỗi người chơi thật chỉ huy một tiểu đội ~2 NPC** (70/30 ≈ 2,3 NPC mỗi người) bằng **bánh xe lệnh** như mục 4G: Theo tôi · Giữ vị trí · Tấn công mục tiêu · Thu quân.
- NPC còn lại đi theo **luồng hành quân** tự động về mục tiêu của giai đoạn.
- Người chơi mang **Thẻ lính Anh hùng** (mục 4G.4) vào làm **đội trưởng NPC** của tiểu đội mình.
- NPC yếu hơn người chơi thật (55–65%) → người chơi thật là "nòng cốt" quyết định trận đấu.

#### 4I.5 Vai trò của người chơi (chọn trước trận, đổi được khi hồi sinh)
| Vai trò | Việc chính |
|---|---|
| **Xung kích** | Dẫn NPC lên tuyến đầu, chiếm điểm |
| **Phá khiên** | Ưu tiên Máy phát khiên, cổng thành |
| **Xạ thủ** | Bắn từ xa, diệt pháo tường thành |
| **Kỹ sư** | Hồi máu, sửa xe/Mech, (phe IXO) sửa khiên & cổng |
| **Phi công Mech** | Giữ thanh biến hình cho khoảnh khắc phá cổng / đấu Boss Mech |

#### 4I.6 Thưởng
| Thưởng | Chi tiết |
|---|---|
| Thắng / thua | Phe thắng ×1.5 · phe thua vẫn nhận 60% (khuyến khích tham gia) · phe yếu người +10% |
| Đóng góp | Theo điểm: hạ địch, chiếm/giữ điểm, phá khiên, hồi máu, sửa chữa – chia hạng S/A/B/C |
| Rơi đồ | Rương Công thành (Sử thi+), **bộ đồ "Băng Chiến" độc quyền** chỉ rơi từ Công thành |
| MVP mỗi phe | Danh hiệu, skin, Thẻ lính Anh hùng |
| Điểm Hunter | 30–80 điểm/trận cho Quỹ Thưởng Người Chơi (mục 9B) |
| Lãnh thổ (cuối tuần) | Như bảng quyền lợi ở mục 4C.3 |

#### 4I.7 Dùng lại tài nguyên Hub & ghi chú kỹ thuật
| Hạng mục | Cách làm |
|---|---|
| Nhân vật, camera, súng, xe | **Dùng nguyên của Hub 3D** (chung code) |
| Bản đồ | Dựng từ bộ tile của Hub + **shader tuyết** (phủ trắng, tuyết rơi, hơi thở bốc khói) + lâu đài, tường thành, hào băng |
| NPC | Dùng chung rig nhân vật, animation đơn giản hơn; **vẽ hàng loạt (GPU instancing)**; AI chạy ở server theo **flow field** (bản đồ hướng đi chung) để rẻ CPU |
| Mạng | Server authoritative, tick 20 Hz; NPC ở xa cập nhật 5 Hz (LOD mạng); AOI 60 m |
| Hiệu năng mục tiêu | 200 đơn vị trên màn hình, 60 FPS PC tầm trung, 30 FPS điện thoại tầm trung (giảm NPC hiển thị trên mobile) |
| Rớt mạng | Nhân vật của người rớt mạng chuyển sang AI điều khiển |
| Chống treo máy | Không đóng góp 3 phút → mất thưởng, bị đá khỏi trận |

---

#### 4I.8 Bản dựng trong game (v45 – bản chơi đơn, chạy offline)
| Hạng mục | Đã làm |
|---|---|
| Lối vào | **Cổng Công Thành** băng ở khu an toàn (đại lộ phía nam điểm xuất phát, đối xứng Cổng nhiệm vụ): 2 tháp băng, mặt cổng xoáy tuyết, bảng neon. Nhấn **E** → sảnh chờ chọn **phe Hunter / phe IXO**, quy mô **50 vs 50 / 100 vs 100**, mua **Extra Coin** (150 CRED) |
| Engine | Dùng nguyên engine Hub (nhân vật, camera, súng, biến hình Mech **T**); bản đồ tuyết đặt cùng thế giới vật lý, thành phố ẩn đi khi vào trận |
| Bản đồ "Thành Băng IXO" | Cánh đồng tuyết + đồi + vòng núi tuyết, rừng thông, đá băng; **hào băng 3 cầu**; **3 Máy phát khiên** nối tia vào chóp lâu đài; **khiên năng lượng** hình vòm (lưới lục giác, gợn sáng khi trúng đạn, vỡ tan khi sập); tường thành băng 14 đoạn + tháp; **cổng thép** (đổ sập khi vỡ); 4 **pháo tường thành**; sân trong có **2 tháp canh** (vòng chiếm điểm) và **Lõi Thành**; trại quân Hunter (lều, xe bọc thép, cờ); tuyết rơi |
| Quân | 100/100 quân vẽ hàng loạt bằng GPU (khung hoạt ảnh nướng sẵn); **phe Hunter = lính công nghệ + lớp Hunter + NPC thành phố** (Heavy, Racer, Engineer, Cảnh sát, Hiệp sĩ khiên, Hacker, Y tá, Samurai); **phe IXO = quái vật** (zombie lính / cyborg / brute / hazmat, Mutant, Goblin, Golem khiên, Alien, Robot Reaper, Người sói). 30% mỗi phe là "người thật" (offline: tay súng tinh nhuệ có tên, sức mạnh 100%), 70% NPC 55–65% |
| Lối chơi | Đủ 5 giai đoạn; tiểu đội 2 NPC + **bánh xe lệnh** (phím 1–4 / giữ Z: Theo tôi · Giữ vị trí · Tấn công mục tiêu · Thu quân); hồi sinh theo đợt 20 s, **Vé quân** mỗi phe; Boss Mech (dậm đất, tia laser có vùng báo trước); **Bom Nova** một lần khi Lõi bị giữ 30 s, Extra Coin cứu người chơi |
| Thưởng | Hạng S/A/B/C theo đóng góp; CRED theo hạng ×1,5 thắng / 60% thua, +10% phe yếu; 30–80 Điểm Hunter; Rương Công thành (đồ Sử thi+). Bộ "Băng Chiến" đang dựng model |
| Thời lượng | Bản chơi đơn rút gọn 12 phút (trận 25 phút giữ cho bản mạng có người thật) |
| Mã nguồn | `game/src/siege/` (siegeSim.ts có test, SiegeWorld, crowd, siegeFx, SiegeHud, SiegeGatePortal) |

#### 4I.9 Giao tranh nâng cấp (v46–v47)
| Hạng mục | Đã làm |
|---|---|
| Model quân | Làm lại 18 model quân giữ nguyên UV/texture (8–18k tam giác/model) – hết lỗi vỡ texture |
| Tanker khổng lồ | Mỗi phe 4 tank (1/25 quân): **robot chiến đấu đỏ cao 7,5 m** (phe Hunter) và **Golem đá / Quái hai đầu cao 8 m** (phe IXO); máu 1.300, đòn chém lan 3,5 m, phá công trình ×5 |
| Cận chiến + bắn xa | Mọi quân đều đánh tay đôi khi < 2,4 m (đẩy lùi), bắn khi xa; nhóm quân thủ xuất kích ra đồng tuyết đánh giáp lá cà |
| Thế đánh của nhân vật (phím **X**) | **Xạ thủ** (máu ×1) · **Cận chiến** (máu ×2,2, nhận 80% sát thương, chuột trái chém quạt 75) · **Tanker** (máu ×4,5, nhận 55% sát thương, khoác giáp Mech, dậm quanh thân 95, sóng xung kích khiêu khích quái) |
| Kỹ năng | **Q** Lựu đạn plasma (150, hồi 6 s) · **E** Chùm 8 tên lửa đuổi (110/quả, ưu tiên tank, hồi 12 s) · **R** Pháo kích quỹ đạo (520, vùng 12 m, hồi 30 s) · **F** Sóng xung kích (95 + đẩy lùi, hồi 9 s) |
| Cảm giác đánh | Tia lửa, **số sát thương bay lên** (vàng khi chí mạng), vệt chém, chớp trắng khi trúng, chuỗi hạ "ĐA SÁT ×n", bảng tin hạ địch |
| Đồ rơi | Quân địch bị bạn hạ (hoặc chết trong 40 m quanh bạn) rơi CRED (85%), Stim (8%), Chìa rương (3%), trang bị Hiếm (2,5%, 25% là đồ Băng Chiến); tướng có tên ×2,5; phá công trình nổ mưa đồ; đồ tự hút về trong 14 m; tổng kết đồ nhặt ở bảng kết quả |

#### 4I.10 Hiệu ứng chiêu thức bằng model 3D (Meshy)
9 model hiệu ứng tạo bằng Meshy, gộp một file `mx_vfx_all.glb` (~5 MB), vẽ instanced, texture dùng làm ánh sáng tự phát + vỏ sáng cộng màu:

| Chủ thể | Chiêu → model |
|---|---|
| Nhân vật chính (màn đánh quái) | Bắn nạp nửa → **tên lửa**; nạp đầy → **chưởng rồng băng xanh** tự đuổi; kiếm nạp → **sóng kiếm trăng khuyết**; dậm đất → **vòng chấn động** |
| Nhân vật chính (Công thành) | Q → **lựu đạn plasma** bay vòng cung; E → **tên lửa** (8 quả, vệt khói); R → **thiên thạch** rơi chéo xuống vùng nổ; F → **vòng sóng xung kích** |
| Trùm (mọi màn) | Cầu lệ / xoắn ốc / đạn lớn → **cầu đầu lâu lửa tím**; mảnh vỡ / loạt đạn nhỏ → **mảnh tinh thể máu**; tên lửa trùm → **tên lửa**; vùng nổ tròn → **cụm gai băng trồi lên**; đập / tiếp đất → **vòng chấn động** |
| Boss Mech & pháo thành (Công thành) | Dậm đất → **gai băng + vòng chấn động**; pháo tường thành → **thiên thạch băng** rơi xuống vùng đỏ |
| Quái thường | Giữ hiệu ứng quả cầu sáng cũ (nhẹ, dễ đọc) |

### 4J. CƯỜNG HOÁ +1→+10 & PHÂN RÃ ĐỒ RÁC

**Cường hoá (Lò rèn – NPC "Bác Thép" ở sảnh):** mỗi món trang bị đập từ +0 lên tối đa **+10**.
| Cấp đang có | +0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Tỉ lệ lên cấp | 100% | 95% | 90% | 80% | 70% | 60% | 50% | 40% | 30% | 20% |
- Phí CRED tăng theo cấp: `40 × (cấp + 1)^1,6`. Từ **+5** trở lên cần thêm 1 linh kiện.
- Thất bại dưới +5: giữ nguyên cấp. **Thất bại từ +5: tụt 1 cấp** (không vỡ đồ).
- Mỗi cấp cộng thêm **8%** chỉ số gốc của món (vũ khí: sát thương; giáp: máu; phụ kiện: chỉ số riêng) → +10 = +80%.

**Phân rã đồ rác (nút "Phân rã" trong Túi đồ / Tủ đồ):** đổi món thừa lấy CRED.
| Độ hiếm | Thường | Hiếm | Sử thi | Huyền thoại | Thần thoại |
|---|---|---|---|---|---|
| CRED nhận | 20 | 50 | 120 | 300 | 800 |
- Món đã cường hoá: +10% mỗi cấp (một món +6 Sử thi → 192 CRED).
- Không phân rã được món đang mặc nếu chỉ còn một cái; có nhiều bản trùng thì phân rã bản trùng trước (không mất cấp cường hoá của bản đang dùng).
- Mục đích: đồ rơi trùng / đồ thấp không đầy túi, tạo nguồn CRED cho lò rèn (vòng lặp nhặt → phân rã → đập đồ).

### 5. HỆ THỐNG BIẾN HÌNH (MECH)

#### 5.1 Thanh biến hình (0 → 100%)
| Hành động | Tăng |
|---|---|
| Hạ 1 Legion | +5% |
| Hoàn thành mục tiêu | +20% |
| Chuỗi không bị trúng đòn | +1%/giây |
| Nhặt Pin năng lượng | +15% |

Đầy 100% → bấm **[F]** để biến hình (cần có ít nhất 1 Mech đã ráp & còn độ bền). Biến hình chỉ dùng trong **màn 2D** (Hub 3D chỉ để trưng bày / thử Mech ở Garage).

#### 5.2 Ba dạng Mech (trong màn 2D)
| Dạng | Thời gian | Máu | Tốc độ | Chiêu | Điểm yếu |
|---|---|---|---|---|---|
| **Titan Frame** (bộ giáp lái) | 20s | ×5 | ×0.6 | Đấm phá tường/khối đá, dậm đất, **miễn nhiễm gai**, nhảy cao | Không dash, không leo tường |
| **Colossus** (khổng lồ) | 15s | ×4 | ×0.5 | Chiếm ~1/3 chiều cao màn hình: dậm đất tạo sóng chấn, tia laser ngang cả màn | To, dễ trúng đạn, không qua được lối hẹp |
| **Velocity** (xe ↔ robot) | 25s | ×1.5 | ×2.0 | Dạng xe: lao qua đoạn tự cuộn, nhảy dốc, húc quái; đổi sang robot tức thì để bắn | Máu thấp |

Mỗi màn có **"đường riêng cho Mech"** (tường phá được, sàn gai, khe chỉ Velocity nhảy qua) dẫn tới rương ẩn → khuyến khích biến hình đúng lúc.

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
| **Giáp nhân vật** (4 khe: Mũ / Thân / Tay / Chân) | Mũ Radar, Chân Air-Dash | ✅ | Đủ bộ 4 món cùng set → kích hoạt **set bonus** (VD: air-dash 2 lần, nạp đạn nhanh 20%) |
| **Chip vũ khí** | Chip Sóng Băng, Chip Lốc Xoáy | ✅ | Rơi từ **Boss khu** (5%/lần hạ, Boss Raid 10%); vũ khí đặc biệt dùng thanh năng lượng riêng |
| **Xe** | Xe Hub (đi lại & khoe trong Hub 3D), Ride Chaser (đoạn tốc độ trong màn 2D) | ✅ | Ride Chaser tốt → đoạn tự cuộn dễ hơn, thêm điểm |
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

#### 6.3 Sức mạnh Mech & Nhân vật
```
Sức mạnh Mech = Σ (Chỉ số gốc khe × Hệ số độ hiếm) của 4 linh kiện
Sức mạnh Nhân vật = Σ (Chỉ số gốc khe × Hệ số độ hiếm) của 4 món giáp (+ set bonus)
Sức mạnh tổng = Sức mạnh Nhân vật + Sức mạnh Mech  (dùng để ghép trận PvP)
Chênh lệch tối đa giữa bộ đồ Thường và Thần thoại hoàn hảo: +35%  (chống pay-to-win; PvP nén còn +20%)
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
| | **Coin** (tiền mềm, off-chain) | **Token $CYBERHOOD** (tiền cứng, on-chain) |
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
| Tỉ lệ hợp đồng chơi theo tổ đội (co-op 2D) | ≥ 30% |
| Thời gian trung bình ở Hub / phiên | ≥ 5 phút (đo mức độ giao lưu) |
| Số bang tham gia công thành / tuần | ≥ 10 bang/map, không bang nào giữ > 40% lãnh thổ |

**Cần chỉnh khi:** tỉ lệ < 1.0 → tăng phí sửa / giảm thưởng Raid. Giá sàn đồ giảm > 30% → giảm tỉ lệ rơi Thường, tăng ưu đãi ghép.

#### 9.4 Ước lượng nhịp tiến độ
- ~6 nhiệm vụ/trận × 20% → **~1.2 mảnh chìa/trận**.
- 15 mảnh/Chìa → **~12–13 trận** ≈ 2.5 ngày nếu chơi 5 năng lượng/ngày → mỗi Chìa vừa khít trong 1 tuần kể cả người chơi ít.
- ~6 lượt rơi/trận → ~0.11 Huyền thoại/trận → **~1 Huyền thoại / 9 trận** (≈ 2 ngày), Thần thoại ~1 / 80 trận (≈ 2–3 tuần).

---

### 9B. CƠ CHẾ CÓ LỢI CHO NGƯỜI CHƠI (v2 – "Người chơi là chủ")

**Mục tiêu:** người chơi (kể cả không nạp) có nhiều đường nhận thưởng có giá trị thật, để thu hút đông người và giữ chân lâu.
**Nguyên tắc sống còn:** phần thưởng phải đến từ **doanh thu thật của nền tảng** (Launchpad, phí chợ, tài trợ quảng cáo, bán trang phục), **không** đến từ việc in token vô hạn. Game kiểu "in token trả thưởng" luôn sập sau vài tháng, và người vào sau sẽ mất tiền.

#### 9B.1 Quỹ Thưởng Người Chơi (chia doanh thu)
**40% doanh thu ròng của nền tảng** chảy vào Quỹ Thưởng Người Chơi, ví công khai on-chain, chia **mỗi tuần**.

| Nguồn doanh thu | Phần vào Quỹ Người Chơi |
|---|---|
| Phí niêm yết + % vốn huy động của dự án trên Launchpad | 50% |
| Phí chợ & đấu giá (5%) | 40% của phí (2% giá trị giao dịch) |
| Tài trợ: biển quảng cáo trong Hub 3D, màn chơi mang thương hiệu, sự kiện | 40% |
| Bán trang phục, đổi tên, hiệu ứng | 30% |
| Vé Raid, năng lượng thêm | 30% |

**Chia quỹ hằng tuần**
| Phần | Tỉ lệ | Ai nhận |
|---|---|---|
| **Quỹ Hoạt động** | 50% | **Mọi người chơi** theo Điểm Hunter tuần |
| Quỹ Thử thách | 20% | Top 500 Solo Thử thách tuần (đồ chuẩn hoá – thuần kỹ năng) |
| Quỹ Đối kháng | 15% | Đấu trường, Màn Tranh chấp, Công thành |
| Quỹ Bang | 15% | Top 50 bang, chia tự động theo đóng góp |

**Công bằng cho người chơi nhỏ:** phần Quỹ Hoạt động chia theo **căn bậc hai** của Điểm Hunter (người chơi chăm gấp 4 lần nhận gấp 2, không phải gấp 4) và **có trần mỗi tài khoản** → người chơi bình thường nhận nhiều hơn, bot và cá voi lợi ít hơn.

**Điểm Hunter tuần** = hợp đồng 3★ (30) · 2★ (15) · 1★ (5) + hạ Boss khu (40) + World Boss (25) + sự kiện Hub (10) + nhiệm vụ ngày (10/ngày) + đóng góp bang. Trần: 2.000 điểm/tuần/tài khoản.

#### 9B.2 Launchpad – quyền lợi lớn nhất
- **30% lượng bán công khai** của mỗi dự án **dành riêng cho người chơi CYBERHOOD** (qua 4 hạng + quỹ bang).
- **Điều kiện niêm yết:** mỗi dự án phải **airdrop 1–3% tổng cung** cho người chơi có Chìa trong mùa (chia theo số Chìa & Điểm mùa).
- **Vé xổ số miễn phí** cho mọi người chơi hoạt động ≥ 5 ngày trong mùa – không cần Chìa.
- **Hoàn tiền nếu dự án lỗi kỹ thuật/huỷ bán:** hoàn 100% số tiền góp.

#### 9B.3 Chơi miễn phí vẫn có thu nhập
| Cơ chế | Chi tiết |
|---|---|
| **Mech khởi đầu miễn phí** | Mỗi tài khoản nhận 1 Mech Thường gắn tài khoản (không bán được) → vào game là săn đồ ngay, **không cần mua NFT đầu vào** |
| **Đồ rơi bán được ngay** | Linh kiện, giáp, chip rơi ra đều giao dịch được (sau khi xác minh tài khoản) |
| **Rương tuần chắc chắn** | Chơi đủ 5 ngày/tuần → rương có **ít nhất 1 món Sử thi** bán được |
| **Giảm rủi ro** | Hết mạng chỉ mất **30%** (thay vì 50%) mảnh & đồ cấp thấp; **Thẻ Bảo hiểm** (rơi từ nhiệm vụ ngày) giữ 100% đồ 1 lượt |
| **Phí mạng được tài trợ** | 20 giao dịch on-chain đầu tiên miễn phí gas |

#### 9B.4 Cho thuê Mech (Chủ sở hữu ↔ Người chơi)
- Chủ sở hữu Mech/giáp xịn **cho thuê theo ngày/tuần** qua hợp đồng thông minh; người thuê chơi và săn đồ.
- Chia mặc định: **người chơi 70% · chủ 25% · nền tảng 5%** (giá trị đồ rơi & thưởng quỹ). Tự thoả thuận trong khoảng 50–85% cho người chơi.
- Người không có vốn vẫn dùng được đồ mạnh; người có đồ kiếm thêm khi không chơi.

#### 9B.5 Nghề nghiệp & cửa hàng người chơi
| Nghề | Kiếm từ |
|---|---|
| **Thợ máy** (mở Garage riêng ở Hub) | Phí dịch vụ sửa/ráp Mech cho người khác (tự đặt giá trong biên độ) |
| **Thợ chế tạo** | Ghép đồ cao cấp để bán; tỉ lệ thành công +5% khi lên cấp nghề |
| **Thợ săn tiền thưởng** | Nhận lệnh trên **Bảng Truy nã** (hệ thống + người chơi/bang treo thưởng), đi săn qua các Cổng – xem mục 4F |
| **Thương nhân** | Mua – bán chênh lệch trên chợ, ký gửi tại Chợ phiên |

#### 9B.6 Giới thiệu & Nhà sáng tạo nội dung
- Người giới thiệu nhận **10% phần doanh thu nền tảng** sinh ra từ người được giới thiệu trong **180 ngày** (lấy từ phần của nền tảng, **không trừ** của người mới).
- Người mới được giới thiệu: **+1 năng lượng tối đa** và rương chào mừng trong 14 ngày.
- Streamer/Creator đạt mốc người xem: mã giới thiệu riêng, skin độc quyền, chia doanh thu 15%.

#### 9B.7 Người chơi sớm (Mùa 0 – trước khi phát hành token)
- Chơi bản thử nghiệm tích **Điểm Mùa 0** → quy đổi thành **airdrop $CYBERHOOD** khi phát hành.
- Danh hiệu "Founder Hunter" + skin vĩnh viễn, hệ số Điểm Hunter **×1.2 trong Mùa 1**.

#### 9B.8 Đề xuất phân bổ token (bản nháp – cần chuyên gia tokenomics duyệt)
| Hạng mục | Tỉ lệ | Mở khoá |
|---|---|---|
| **Cộng đồng & người chơi** | **40%** | Airdrop Mùa 0: 8% (mở 50% ngay, 50% trong 6 tháng) · Quỹ thưởng mùa: 22% (giảm dần trong 4 năm) · Hệ sinh thái/Launchpad: 10% |
| Đội ngũ | 15% | Khoá 12 tháng, mở dần 36 tháng |
| Nhà đầu tư | 15% | Khoá 6–12 tháng, mở dần 24 tháng |
| Thanh khoản | 10% | Khoá LP |
| Kho bạc | 15% | Theo biểu quyết/multisig |
| Marketing | 5% | Mở dần 24 tháng |

Quỹ thưởng mùa 22% **giảm dần mỗi mùa**; về lâu dài thưởng chủ yếu đến từ **Quỹ chia doanh thu (9B.1)**, nên kinh tế không phụ thuộc vào việc in thêm token.

#### 9B.9 Vòng tăng trưởng
```
Nhiều người chơi → dự án muốn lên Launchpad + nhãn hàng muốn quảng cáo trong Hub
      → doanh thu nền tảng tăng → Quỹ Thưởng Người Chơi tăng
      → thưởng hấp dẫn hơn → nhiều người chơi hơn
```

#### 9B.10 Rủi ro & ranh giới pháp lý
- **Không hứa lợi nhuận.** Tài liệu công khai chỉ nói "nhận thưởng theo hoạt động", không nói "đầu tư", "lãi", "thu nhập thụ động".
- **Thưởng theo HOẠT ĐỘNG chơi, không theo việc NẮM GIỮ token.** Chia doanh thu cho người giữ token (kiểu cổ tức/staking) dễ bị coi là chứng khoán.
- Bot & nhiều tài khoản: căn bậc hai + trần + xác minh tài khoản để rút thưởng.
- **Bắt buộc tham vấn luật sư** cho Quỹ chia doanh thu, cho thuê Mech và Launchpad trước khi ra mắt.

---

### 10. VÒNG CUỐN (RETENTION)

| Chu kỳ | Cơ chế |
|---|---|
| **Mỗi trận** | Rơi đồ ngẫu nhiên, cột sáng đồ hiếm, rủi ro mất đồ khi chưa thoát, biến hình |
| **Mỗi ngày** | 5 năng lượng, 3 nhiệm vụ ngày, rương miễn phí, chuỗi đăng nhập (mất chuỗi = mất bonus) |
| **Mỗi tuần** | Map mới mở, Chìa mới, xếp hạng Solo Thử thách reset |
| **Mỗi mùa** | Boss Raid, Easter Egg, đồ độc quyền, suất Launchpad |
| **Xã hội** | Gặp người trong Hub 3D, tổ đội + đồng bộ biến hình, bang phái (nhiệm vụ bang, kho bang, công thành cuối tuần), World Boss, mời bạn, thông báo đồ hiếm toàn server, đấu giá trực tiếp |

---

### 11. CHỐNG GIAN LẬN & PHÁP LÝ

| Rủi ro | Giải pháp |
|---|---|
| Quấy rối PvP | PvP chỉ trong màn 2D PvP, người mới < level 10 không vào, ghép trận theo Sức mạnh ±15%, phạt bỏ trận |
| Bang độc quyền | Tối đa 2 lãnh thổ/map, liên minh tối đa 2 bang, tháp yếu dần nếu giữ lâu, xếp hạng chỉ tính 30 người top |
| Lừa đảo trong bang | Kho bang có hạn mức + log, quỹ vé chia tự động theo đóng góp, Tập sự không rút kho |
| Bot farm | Logic trận xác thực ở server, captcha ẩn, phát hiện hành vi bất thường, điều kiện level/ngày để bán, giới hạn rao bán/ngày |
| Multi-account | 1 ví – 1 tài khoản, KYC nhẹ khi nhận suất launchpad, fingerprint thiết bị |
| Lạm phát đồ | Ghép, nung chảy, độ bền, đồ Thường không đúc NFT |
| Pay-to-win | Trần +35%, Solo Thử thách dùng đồ chuẩn hoá |
| Hack client | Rơi đồ, điểm, kết quả trận **tính ở server**; màn PvE xác thực vị trí/tốc độ/sát thương; replay input khi rơi đồ Huyền thoại+ |
| **Cờ bạc** | **KHÔNG bán rương ngẫu nhiên bằng tiền/token.** Rương chỉ kiếm bằng chơi. Công khai mọi tỉ lệ rơi. |
| **Tài chính / chứng khoán** | Token & launchpad có thể chịu quy định tuỳ quốc gia → **tham vấn luật sư** trước khi ra mắt, chặn khu vực cấm |
| **Bản quyền** | Chỉ lấy cảm hứng (Ready Player One, action-platformer kiểu Mega Man X); tên, sprite, HUD, nhạc, màn chơi phải tự tạo |

---

### 12. LỘ TRÌNH TRIỂN KHAI

| Giai đoạn | Nội dung | Ưu tiên |
|---|---|---|
| **MVP 0 – Hub 3D + Cổng** | Dùng engine GTA sẵn có làm Hub khu phố: server room 100 người, AOI, đồng bộ di chuyển/xe/chat; Cổng dịch chuyển chuyển cảnh sang màn 2D và quay về | ⭐⭐⭐ |
| **MVP 1 – Màn 2D đầu tiên** | Điều khiển 2D (chạy, nhảy, dash, leo tường, bắn nạp lực, kiếm), khu Neon City (3 màn + Boss khu) ghép từ chunk, 6 mục tiêu, checkpoint, 3 mạng, sự kiện phút 4, Cổng thoát, điểm & sao, năng lượng – chơi Solo | ⭐⭐⭐ |
| **MVP 2 – Biến hình** | Thanh biến hình, 1 dạng Mech (Titan Frame) trong 2D, đường riêng cho Mech, state machine, EMP Legion | ⭐⭐⭐ |
| **MVP 3 – Đồ** | Bảng rơi 5 độ hiếm, linh kiện Mech 4 khe, giáp nhân vật 4 khe + set bonus, chip vũ khí từ boss, độ bền, pity, kho đồ | ⭐⭐⭐ |
| **Beta – Mùa** | 3 khu màn 2D + Raid, mảnh chìa/Chìa/Cổng, nhiệm vụ ngày, chuỗi đăng nhập, Solo Thử thách + xếp hạng | ⭐⭐ |
| **Beta – Săn tiền thưởng** | Bảng Truy nã, Cổng Đồng/Ngọc Bích/Pha Lê, 1 Vùng Săn map rộng (Neon City), Lính đánh thuê NPC (Vệ binh, Kỹ sư y tế, Trinh sát), bánh xe lệnh, Hạng Thợ săn | ⭐⭐ |
| **Beta – Xã hội** | Co-op 2D tổ đội 2–4 + ghép đội tại Cổng, đồng bộ biến hình, bang phái (lập bang, chức vụ, kho, chat, nhiệm vụ bang), World Boss | ⭐⭐ |
| **Beta – Kinh tế** | Kết nối ví, Coin/Token, chợ, ghép/nung chảy, sửa Mech | ⭐⭐ |
| **Launch** | Màn Tranh chấp + Đấu trường + luật PvP, đấu giá, đúc NFT, Easter Egg, Launchpad tier + quỹ vé bang, KYC, dashboard KPI | ⭐⭐ |
| **Giai đoạn 2** | Cổng Đỏ (PvP), Cổng Vàng toàn server, lệnh truy nã của người chơi (ký quỹ), Thẻ lính đánh thuê giao dịch, Cổng Công Thành 3D (bản đồ tuyết, 100 vs 100, 70% NPC) + Lãnh thổ quận Hub, cây kỹ năng bang, sảnh bang, 2 dạng Mech còn lại | ⭐ |
| **Giai đoạn 3** | Hợp thể 4 người, liên minh bang, voice chat | ⭐ |

---

### PHỤ LỤC – THAM CHIẾU READY PLAYER ONE → GAME

| Phim | Trong game |
|---|---|
| OASIS | CYBERHOOD |
| OASIS – nơi mọi người tụ tập | Hub khu phố 3D góc GTA |
| 3 Chìa Đồng / Ngọc Bích / Pha Lê | 3 khu màn 2D mỗi mùa, mỗi khu 1 Chìa |
| Đường đua New York (chạy ngược) | Neon City – chạy ngược sang trái lúc xuất phát mở đường bí mật |
| The Overlook Hotel | Hollow Hotel |
| Planet Doom + Castle Anorak | Warzone + Citadel Raid |
| Orb of Osuvox (khiên) | Khiên Citadel – mục tiêu phá khiên |
| Cataclyst | Nova Bomb |
| Zemeckis Cube | Chrono Cube |
| Đồng xu của Halliday | Extra Coin |
| Daito → Gundam / Iron Giant / Mechagodzilla | Titan Frame / Colossus / Boss Mech |
| Easter Egg | Easter Egg mùa – món độc nhất, đấu giá |
| High Five | Tổ đội co-op / Bang |
| Sixers / IOI | Legion / IXO Corp |



## E. CONFIG – game_config.json

```json
{
  "branding": {
    "gameName": "CYBERHOOD",
    "tokenName": "CYBERHOOD",
    "tokenSymbol": "CYBERHOOD",
    "motif": "arrow",
    "slogan": "Ngắm chuẩn · Làm chủ thành phố",
    "palette": {
      "night": "#0A0A18",
      "neonCyan": "#00E5FF",
      "neonMagenta": "#FF2BD6",
      "arrowGold": "#FFD400",
      "electricViolet": "#7B2CFF",
      "holoWhite": "#EAF6FF"
    },
    "keyColors": {
      "copper": "#C87533",
      "jade": "#00C08B",
      "crystal": "#B9F2FF"
    },
    "rarityArrows": {
      "common": 1,
      "rare": 2,
      "epic": 3,
      "legendary": 4,
      "mythic": 5
    },
    "rarityColors": {
      "common": "#9AA0A6",
      "rare": "#3DA5FF",
      "epic": "#A855F7",
      "legendary": "#FFD400",
      "mythic": "#FF3B3B"
    },
    "avoid": [
      "robinhood_green",
      "feather_shape"
    ],
    "assetsDir": "CYBERHOOD_Brand/"
  },
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
        ],
        "secret": "run_left_at_start"
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
    ],
    "stagesPerArea": {
      "normal": 3,
      "boss": 1
    },
    "chunksPerArea": 30
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
    "eventAtSec": 240,
    "events": [
      "supply_ship_hold_30s",
      "autoscroll_chase",
      "mini_boss_mech"
    ],
    "deathLoss": {
      "shards": 0.3,
      "itemsUpToRarity": "rare",
      "itemsLossRate": 0.3,
      "insuranceCardNegates": true
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
    "shardChancePerMission": 0.2,
    "objectives": [
      "clear_legion_group",
      "rescue_hostage",
      "destroy_shield_generator",
      "grab_data_drive",
      "find_secret_path",
      "open_hidden_chest"
    ],
    "objectivesPerStage": 6,
    "extract": "exit_gate_end_of_stage"
  },
  "modes": {
    "hub": {
      "space": "3d",
      "cap": 100,
      "energyCost": 0,
      "drops": false
    },
    "pve_contract": {
      "space": "2d",
      "players": [
        1,
        4
      ],
      "energyCost": 1,
      "drops": true,
      "personalGear": true
    },
    "solo_challenge": {
      "space": "2d",
      "players": [
        1,
        1
      ],
      "energyCost": 1,
      "drops": false,
      "personalGear": false,
      "sameSeed": true,
      "leaderboard": "weekly"
    },
    "contested_stage": {
      "space": "2d",
      "teams": 2,
      "teamSize": 4,
      "energyCost": 1,
      "drops": true,
      "dropMultiplier": 1.5,
      "minLevel": 10,
      "pvp": true
    },
    "arena": {
      "space": "2d",
      "formats": [
        "1v1",
        "2v2",
        "4v4"
      ],
      "energyCost": 0,
      "drops": false,
      "rating": "elo",
      "minLevel": 10,
      "pvp": true
    },
    "citadel_raid": {
      "space": "2d",
      "players": [
        1,
        4
      ],
      "energyCost": 1,
      "raidTicket": true,
      "drops": true,
      "minMechPower": 300
    },
    "world_boss": {
      "space": "2d",
      "players": [
        4,
        12
      ],
      "energyCost": 1,
      "raidTicket": true,
      "drops": true,
      "dropMultiplier": 2.0
    },
    "territory_war": {
      "space": "3d",
      "mode": "siege3d",
      "ticket": "siege_registration"
    },
    "siege_daily": {
      "space": "3d",
      "mode": "siege3d",
      "energyCost": 1
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
      "noHitPerSec": 1,
      "battery": 15
    },
    "forms": {
      "titan_frame": {
        "durationSec": 20,
        "hpMul": 5,
        "speedMul": 0.6,
        "canDrive": false,
        "skills": [
          "punch_break_wall",
          "stomp",
          "spike_immune",
          "high_jump"
        ],
        "canDash": false
      },
      "colossus": {
        "durationSec": 15,
        "hpMul": 4,
        "speedMul": 0.5,
        "canDrive": false,
        "skills": [
          "ground_shockwave",
          "screen_laser"
        ]
      },
      "velocity": {
        "durationSec": 25,
        "hpMul": 1.5,
        "speedMul": 2.0,
        "canDrive": true,
        "skills": [
          "vehicle_mode_autoscroll",
          "ramp_jump",
          "ram",
          "instant_robot_swap"
        ]
      }
    },
    "onlyIn2D": true
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
    "mythicRng": "chainlink_vrf_if_available_else_commit_reveal"
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
    "hub": {
      "channelCap": 100,
      "channelSwitchCooldownSec": 60,
      "partyGuildSameChannelPriority": true,
      "pvp": false,
      "aoiGridM": 50,
      "places": [
        "portals",
        "market",
        "auction_screen",
        "garage",
        "guild_hall",
        "leaderboards",
        "territory_board",
        "pvp_gate",
        "archivist"
      ],
      "districts": [
        "port",
        "neon_street",
        "industrial"
      ]
    },
    "hubEvents": {
      "flash_auction": {
        "everyMin": 120,
        "durationMin": 10,
        "minRarity": "epic"
      },
      "legion_alarm": {
        "everyMin": 60,
        "portalOpenMin": 10,
        "maxPlayers": 12,
        "rewardBy": "contribution"
      },
      "world_boss": {
        "perDay": 3
      },
      "archivist_hunt": {
        "random": true,
        "reward": "bonus_shard"
      }
    },
    "net": {
      "hubTickHz": 20,
      "pveSyncHz": 30,
      "pveModel": "client_predict_server_validate",
      "pvpTickHz": 30,
      "pvpModel": "server_authoritative_lag_comp",
      "lootRoll": "server"
    }
  },
  "party": {
    "size": [
      2,
      4
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
    "bonusMax": 0.15,
    "syncTransform": {
      "minMembers": 3,
      "windowSec": 10,
      "damageBonus": 0.2,
      "extraSec": 5
    },
    "fusion": {
      "phase": 3,
      "members": 4,
      "durationSec": 30
    },
    "revivesPerContract": 1,
    "difficultyScale": [
      1.0,
      1.6,
      2.1,
      2.5
    ],
    "sharedCamera": true,
    "teleportToGroup": true,
    "reviveHoldSec": 3
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
      "maxAllianceSize": 2,
      "towerDecayAfterWeeks": 3,
      "towerDecayPerWeek": 0.2,
      "ownerRewards": {
        "marketTaxShare": 0.01,
        "dropBonus": 0.2,
        "dailyTerritoryBoss": 1
      },
      "mapWidthScreens": 6,
      "territories": "hub_districts",
      "bracketWhenMultiple": true,
      "maxTerritoriesPerGuild": 2,
      "mode": "siege3d"
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
    "where": [
      "contested_stage",
      "arena",
      "territory_war"
    ],
    "newbieProtectionLevel": 10,
    "deathDropRate": 0.3,
    "deathDropMaxRarity": "epic",
    "neverDrop": [
      "equipped",
      "mech_parts",
      "legendary",
      "mythic"
    ],
    "shardLossOnNoLives": 0.3,
    "matchmaking": {
      "powerRange": 0.15,
      "levelRange": 5
    },
    "powerGapCap": 0.2,
    "weaponChipDamageVsPlayers": 0.7,
    "leavePenaltyMin": 15
  },
  "chain": {
    "network": "Robinhood Chain",
    "type": "Ethereum L2 (Arbitrum Orbit)",
    "chainId": 4663,
    "chainIdVerified": false,
    "gasToken": "ETH",
    "contracts": {
      "token": "ERC20",
      "items": "ERC1155",
      "marketplace": true,
      "auction": true,
      "launchpad": "merkle_whitelist",
      "treasury": "multisig",
      "tokenContract": "CyberhoodToken"
    },
    "mint": "eip712_voucher_on_demand",
    "mythicRng": "chainlink_vrf_if_available_else_commit_reveal",
    "upgradeable": "uups_timelock_multisig",
    "gasSponsorNewPlayers": true
  },
  "presentation": {
    "hub": {
      "view": "3d_gta_topdown",
      "pvp": false
    },
    "stages": {
      "view": "2d_side_scrolling",
      "internalResolution": [
        480,
        270
      ],
      "integerScaling": true,
      "physicsHz": 60
    }
  },
  "controls2d": {
    "lives": 3,
    "checkpointsPerStage": 3,
    "hitInvulnSec": 1.0,
    "airDashPerJump": 1,
    "chargeShot": {
      "levelsSec": [
        0.5,
        1.5
      ],
      "damageMul": [
        1,
        3,
        6
      ]
    },
    "meleeCombo": 3,
    "weaponChipSlots": 2
  },
  "items": {
    "characterArmor": {
      "slots": [
        "helmet",
        "body",
        "arms",
        "legs"
      ],
      "setBonus": true,
      "tradeable": true
    },
    "weaponChips": {
      "source": "area_boss",
      "dropChance": 0.05,
      "raidDropChance": 0.1,
      "tradeable": true,
      "usesWeaponEnergy": true
    },
    "vehicles": {
      "hub": "cosmetic_travel",
      "rideChaser": "2d_autoscroll_sections"
    }
  },
  "playerRewards": {
    "revenueSharePool": {
      "shareOfNetRevenue": 0.4,
      "payout": "weekly",
      "onchainTreasury": true,
      "sources": {
        "launchpad": 0.5,
        "marketFees": 0.4,
        "sponsorship": 0.4,
        "cosmetics": 0.3,
        "raidTicketsEnergy": 0.3
      },
      "split": {
        "activity": 0.5,
        "soloChallengeTop500": 0.2,
        "pvp": 0.15,
        "guildTop50": 0.15
      },
      "activityWeighting": "sqrt",
      "hunterPointsWeeklyCap": 2000,
      "hunterPoints": {
        "contract3star": 30,
        "contract2star": 15,
        "contract1star": 5,
        "areaBoss": 40,
        "worldBoss": 25,
        "hubEvent": 10,
        "dailyQuest": 10
      }
    },
    "launchpad": {
      "publicSaleReservedForPlayers": 0.3,
      "projectAirdropToKeyHolders": [
        0.01,
        0.03
      ],
      "freeLotteryMinActiveDays": 5,
      "refundOnCancel": true
    },
    "freeToPlay": {
      "starterMechSoulbound": true,
      "weeklyChestMinRarity": "epic",
      "weeklyChestActiveDays": 5,
      "gasSponsoredTx": 20,
      "insuranceCardFromDaily": true
    },
    "rental": {
      "enabled": true,
      "defaultSplit": {
        "player": 0.7,
        "owner": 0.25,
        "platform": 0.05
      },
      "playerShareRange": [
        0.5,
        0.85
      ]
    },
    "professions": [
      "mechanic_shop",
      "crafter",
      "bounty_hunter",
      "trader"
    ],
    "referral": {
      "platformRevenueShare": 0.1,
      "days": 180,
      "newPlayerBonusDays": 14,
      "creatorShare": 0.15
    },
    "season0": {
      "pointsToAirdrop": true,
      "founderMultiplierSeason1": 1.2
    },
    "tokenAllocationDraft": {
      "community": 0.4,
      "team": 0.15,
      "investors": 0.15,
      "liquidity": 0.1,
      "treasury": 0.15,
      "marketing": 0.05
    },
    "rewardsByActivityNotHolding": true
  },
  "bounty": {
    "board": {
      "dailyFree": 3,
      "eliteWeekly": 2,
      "playerPostFee": 0.05,
      "playerPostEscrow": true,
      "playerPostMinRank": "D",
      "noBountiesOnPlayers": true,
      "serverWideWeekly": "fri_20h"
    },
    "portals": {
      "copper": {
        "minRank": "F",
        "minPower": 0,
        "party": [
          1,
          4
        ],
        "timeMin": 10,
        "rewardMul": 1.0,
        "pvp": false,
        "energy": 1,
        "hunterPoints": 20
      },
      "jade": {
        "minRank": "D",
        "minPower": 300,
        "party": [
          2,
          4
        ],
        "timeMin": 15,
        "rewardMul": 1.6,
        "pvp": false,
        "energy": 1,
        "hunterPoints": 35
      },
      "crystal": {
        "minRank": "B",
        "minPower": 600,
        "party": [
          3,
          4
        ],
        "timeMin": 20,
        "rewardMul": 2.5,
        "pvp": false,
        "energy": 1,
        "hunterPoints": 60
      },
      "red": {
        "minRank": "C",
        "minLevel": 20,
        "teams": 2,
        "teamSize": 4,
        "timeMin": 20,
        "rewardMul": 3.0,
        "pvp": true,
        "targetStealable": true,
        "energy": 1,
        "hunterPoints": 50
      },
      "gold": {
        "minRank": "F",
        "players": [
          8,
          20
        ],
        "timeMin": 30,
        "reward": "weekly_pool",
        "pvp": false,
        "energy": 0,
        "hunterPoints": 40
      }
    },
    "hunt": {
      "cluesForExactLocation": 3,
      "targetFleeHpPct": 0.3,
      "captureHpPct": 0.2,
      "captureItem": "emp_net",
      "captureRewardMul": 1.5,
      "failLoss": 0.3,
      "realPlayerBonusPer": 0.05,
      "realPlayerBonusMax": 0.15
    },
    "ranks": [
      "F",
      "E",
      "D",
      "C",
      "B",
      "A",
      "S"
    ],
    "rankSTopPct": 0.01
  },
  "mercenaries": {
    "partySlots": 4,
    "wideMapSupportSlot": 1,
    "maxHiredByRank": {
      "F": 1,
      "E": 1,
      "D": 2,
      "C": 2,
      "B": 3,
      "A": 3,
      "S": 3
    },
    "tiers": {
      "regular": {
        "fee": "coin",
        "freePerDay": 1,
        "powerPct": 0.55
      },
      "elite": {
        "fee": "coin_high",
        "powerPct": 0.65
      },
      "hero": {
        "fee": "none",
        "recovery": "2h_or_coin_token",
        "powerPct": [
          0.7,
          0.8
        ]
      }
    },
    "roles": [
      "guardian",
      "neon_archer",
      "medic_engineer",
      "scout",
      "shield_breaker",
      "driver",
      "support_drone"
    ],
    "commands": [
      "follow",
      "hold",
      "attack_target",
      "regroup"
    ],
    "specialCooldownSec": [
      30,
      60
    ],
    "countsForPartyBonus": false,
    "replacesDisconnectedPlayer": true,
    "heroCards": {
      "rarities": 5,
      "tradeable": true,
      "rentable": true,
      "skillUnlockLevels": [
        10,
        20,
        30
      ],
      "loyaltyTiers": 3,
      "loyaltyBonusPerTier": 0.05,
      "sources": [
        "elite_bounty",
        "capture",
        "crystal_portal",
        "gold_portal"
      ]
    }
  },
  "wideMaps": {
    "widthScreens": [
      20,
      30
    ],
    "layers": [
      "ground",
      "rooftop_highway",
      "underground"
    ],
    "maxPlayers": 8,
    "goldPortalPlayers": [
      8,
      20
    ],
    "travel": [
      "teleport_beacons",
      "ride_chaser",
      "driver_npc",
      "ladders_pipes"
    ],
    "respawnAtBeaconSec": 10,
    "teamPings": "arrow",
    "perArea": {
      "neon_city": 1,
      "hollow_hotel": 1,
      "warzone": 1
    },
    "goldPortalMap": "citadel_extended"
  },
  "siege3d": {
    "view": "3d_gta_reuse_hub_engine",
    "map": "ixo_ice_citadel",
    "sides": {
      "attack": "hunters",
      "defend": "ixo_villains"
    },
    "npcRatio": 0.7,
    "humanRatio": 0.3,
    "sizes": {
      "small": {
        "perSide": 50,
        "humans": 15
      },
      "standard": {
        "perSide": 100,
        "humans": 30
      },
      "event": {
        "perSide": 200,
        "humans": 60
      }
    },
    "durationMin": 25,
    "respawnWaveSec": 20,
    "sideTickets": true,
    "transformAllowed": true,
    "phases": [
      "charge",
      "shield_generators_3",
      "gate_break",
      "courtyard_towers_2",
      "core_hold_60s"
    ],
    "defenderBossMechPilot": "defender_mvp",
    "defenderNovaBombUses": 1,
    "extraCoinSurvivesNova": true,
    "schedule": {
      "daily": [
        "12:30",
        "20:30"
      ],
      "territoryWar": [
        "sat",
        "sun"
      ]
    },
    "territoryWar": {
      "maxHumansPerGuild": 30,
      "npcPerSide": 70
    },
    "autoBalance": {
      "fillWithEliteNpc": true,
      "underdogRewardBonus": 0.1
    },
    "npcPerHumanSquad": 2,
    "npcPowerPct": [
      0.55,
      0.65
    ],
    "heroCardAsSquadLeader": true,
    "rewards": {
      "winMul": 1.5,
      "loseMul": 0.6,
      "exclusiveSet": "ice_war",
      "hunterPoints": [
        30,
        80
      ],
      "mvpPerSide": true
    },
    "tech": {
      "tickHz": 20,
      "farNpcHz": 5,
      "aoiM": 60,
      "npcAi": "server_flow_field",
      "render": "gpu_instancing",
      "targetFpsPc": 60,
      "targetFpsMobile": 30
    },
    "afkKickMin": 3
  }
}
```

## F. FILE KÈM THEO
- `CYBERHOOD_Brand/logo_v2/`: logo chính (phẳng) – ngang, neon, nền sáng, một màu, xếp dọc, icon app, token, mockup, hướng dẫn.
- `CYBERHOOD_Brand/logo_3d/`: logo 3D nổi khối (neon & chrome, có bản nền trong suốt).
- `ReadyPlayerOne_GameData.xlsx` / `.md`: dữ liệu gốc phim & sách – chỉ tham khảo.
