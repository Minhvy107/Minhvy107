# 🍃 Chợ Lá Xanh – Mô phỏng kinh doanh tạp hóa

Trò chơi trình duyệt: mở tiệm tạp hóa – thực phẩm tươi sống, phục vụ từng khách hàng và phát triển thành chuỗi cửa hàng.

**Chơi:** mở `index.html` bằng trình duyệt (không cần cài đặt).

## Tính năng
- **Giao diện pastel dễ thương**: màn hình mở đầu là quầy tiệm có mái hiên sọc hồng, đèn lồng, mèo ngủ; nút *Chơi tiếp* hiện tên tiệm, ngày và tiền của bản lưu.
- **Bán hàng tại quầy**: khách chibi đứng trước quầy, nói món cần mua trong bong bóng lời thoại, có **thanh kiên nhẫn**. Chọn nhóm hàng, bấm vào **khay hàng** (có số lượng tồn) để lấy đúng món vào **Giỏ hàng**, rồi **Nhận tiền** (tiền mặt có tiền thối hoặc QR). Lấy nhầm thì bấm món trong giỏ để trả lại, hết hàng thì *Báo hết*.
- Khách đang đợi phía sau hiện thành vòng tròn trên cùng; **thu ngân** thuê thêm tự phục vụ họ. Có thể bật *tự động phục vụ* quầy của bạn.
- Khách **khen/chê từng sản phẩm** (tươi ngon, rẻ, héo, mắc) ngay tại quầy và trong đánh giá.
- **👗 Tủ đồ & 💎 kim cương**: mua kiểu tóc (búi messy, sóng dài, afro, song bím, bob mái, wolf cut, búi nửa đầu, vương miện tết, rẽ ngôi, đầu đinh), màu tóc, mũ, trang phục, phụ kiện cho chủ tiệm, màu mái hiên, phụ kiện cho mèo, đồng phục nhân viên. **Bộ sưu tập Dễ thương**: 5 kiểu tóc (hai bím cao, bob bồng bềnh, buộc lệch, búi tai mèo, tóc nấm), áo len tai gấu, váy yếm nơ, cardigan dâu tây, váy cổ ren, mũ thỏ bông, mũ dâu tây, gà con trên đầu, kính trái tim, nơ cổ, hình dán má, kẹp kẹo mút và 2 đồng phục nhân viên. Kim cương kiếm bằng cách chơi (nhiệm vụ hằng ngày, mốc thành tích, thử thách, lễ hội); khách thanh toán chỉ cộng tiền.
- **💇 Kiểu tóc nhân viên**: trong tab Nhân viên, mỗi người có thể đổi kiểu tóc và màu tóc riêng, dùng những kiểu tiệm đã mua trong Tủ đồ.
- **🔊 Âm thanh tương tác** (tạo bằng Web Audio, không cần file): "tách" khi bấm, tiếng nhặt đồ, ting ting khi thu tiền, chuông khách tới, báo sai, nhạc nhận quà. Bật/tắt trong menu ☰.
- **🎵 Nhạc nền** tự sáng tác bằng Web Audio (C–Am–F–G, lặp vô hạn) và **📲 loa báo chuyển khoản**: khách trả bằng chuyển khoản thì có tiếng "ting ting", banner báo tiền về và giọng đọc "Đã nhận được … đồng" (nếu máy có giọng tiếng Việt). Bật/tắt riêng từng thứ trong menu ☰.
- **📈 Thống kê người chơi** ẩn danh (mỗi thiết bị 1 lần/ngày): xem tại `https://cholaxanh-nap.tnhn1311.workers.dev/stats`.
- **🏆 Bảng xếp hạng** Tuần / Tháng / Mọi thời đại (giờ Việt Nam): chỉ tiệm kinh doanh từ 14 ngày, xếp theo tổng vốn; top 10 tuần (150/100/70/30💎) và tháng (500/300/200/80💎) nhận thưởng khi vào game.
- **📱 Cài như app (PWA)**: thêm biểu tượng vào màn hình chính, chạy toàn màn hình, mở được khi mạng yếu (`manifest.webmanifest`, `sw.js`, `icon-*.png`).
- **⚙️ Tự động cập nhật máy chủ**: GitHub Actions `.github/workflows/deploy-worker.yml` đưa `server/` lên Cloudflare khi có thay đổi (cần secret `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`).
- **💡 Cố vấn kinh doanh**: mỗi tối phân tích vì sao lời/lỗ (hàng hỏng, giá cao/thấp/lỗ vốn, hết hàng, khách chờ, lương, dịch vụ, xui rủi, lãi vay) và gợi ý sửa, kèm nút đi tới đúng tab.
- **🏦 Vay vốn trả góp** (chọn 10–100 tr, kỳ hạn 3/6/12 tháng; 1 tháng = 10 ngày game; lãi 1,5%/tháng dư nợ giảm dần; góp đều mỗi tháng; xem hợp đồng + lịch trả nợ và tick đồng ý mới giải ngân; tất toán sớm không phí) và **💱 đổi kim cương lấy tiền** (10💎→1tr, 50💎→5,5tr, 100💎→12tr): menu ☰ hoặc tab Báo cáo.
- **📲 Mã lưu ngắn 8 ký tự** để chuyển game sang máy khác (lưu trên máy chủ 30 ngày; cần cập nhật `server/worker.js` lên Cloudflare).
- **🔒 Đóng cửa sớm / 😴 Nghỉ một ngày**: đóng cửa bất cứ lúc nào (khách đang chờ vẫn được phục vụ; đóng trước 12:00 trừ 2 uy tín, trước 17:00 trừ 1) hoặc nghỉ bán cả ngày (trừ 3 uy tín, vẫn trả chi phí).
- **🌙 Season Pass – Mùa Trăng Rằm** (01/10 → 31/10, giờ VN; tab 🌙 Mùa): 30 cấp, 2 dòng quà miễn phí / cao cấp (40.000đ qua VietQR). Đặt trước trước 01/10 nhận ngay giao diện Trăng Rằm. Quà độc quyền: Búi Hằng Nga, Áo Hằng Nga (+ đồng phục NV), Thỏ Ngọc (thú cưng ở quầy), Mái hiên Trăng, đèn lồng cá chép, đèn kéo quân, màu tóc Ánh trăng bạc, khung tên "Chị Hằng" trên bảng xếp hạng. Giao diện Trăng Rằm riêng hoàn toàn (chợ đêm bên hồ sen, đình mái cong, trong tiệm sơn son), bật/tắt ở menu ☰ hoặc Tủ đồ → 🖼️ Giao diện; người có Pass giữ vĩnh viễn. Xem thử: thêm `?theme=moon` vào link.
- **✨ Đợt 1 chống chán**: 💬 tình huống có lựa chọn (hệ quả vài ngày sau), 🤝 mặc cả ở quầy, 🎁 quà đăng nhập 7 ngày, 🎡 vòng quay may mắn, 🏅 10 danh hiệu hiện trên bảng xếp hạng, 📢 bảng "Có gì mới" tự bật khi game cập nhật.
- **🎪 Hội chợ Lá Xanh**: 🦀 bầu cua, 🎫 vé số (xổ 19:00 giờ thật, số trúng do máy chủ bí mật tạo), 🃏 xì dách luật Việt, 💰 Ai là triệu phú (miễn phí 1 lượt/ngày). Cược bằng tiền trong game, không dùng 💎, không đổi thưởng; mỗi ván ≤ 5% vốn, không chơi khi đang nợ vay, thua 20% vốn/ngày thì nghỉ.
- **🎮 Chơi chung (thời gian thực, Cloudflare Durable Objects)**: sảnh phòng (vào nhanh, phòng công khai/riêng bằng mã 4 ký tự); 🦀 bầu cua chung bát, 🃏 xì dách cùng bàn (cược với nhà cái, không ai ăn tiền của ai); 💰 triệu phú đối kháng; 🐺 ma sói, 🎴 Bài Một Lá (kiểu UNO), 💣 Mèo Nổ với chat tự do đã lọc từ tục/link/SĐT, thiếu người máy chơi thay.
- **📜 Đời sống khu phố**: cốt truyện "Tiệm của bà ngoại" 10 chương; 8 khách quen có chuyện đời & quà; sổ sưu tập khách (Thần Tài, ca sĩ, khách lúc khuya…); thời tiết dự báo 3 ngày; chợ đầu mối mỗi sáng (giá hời, hàng loại 2, mặc cả); mèo của tiệm bắt chuột; quầy nước mía (mini-game); tiệm đối thủ Phát Đạt Mart; đơn hàng online; nâng cấp tiệm Tạp hóa → Tiện lợi → Mini mart → Siêu thị.
- **🏘️ Bạn bè & 🤝 Hội**: ghé tiệm bạn bằng mã tiệm (thả tim, sổ lưu bút đã lọc, tặng quà mỗi ngày cả hai +5💎); hội chủ tiệm 20 người với mục tiêu bán hàng tuần (thưởng 20/50/150💎) và chat chung.
- **🎪 Sự kiện**: cứ 10 ngày **thật** (giờ VN) có một lễ hội 5 ngày, lần lượt: Trung thu, Chợ Tết, Lễ hội trái cây, Tuần lễ Sống xanh, Halloween, Tri ân Nhà giáo, Giáng Sinh. Kiếm xu lễ hội, làm nhiệm vụ, nhận mốc thưởng và đồ độc quyền. Thử thách bất ngờ trong ngày: đơn đặt hàng lớn, khách VIP food reviewer, giờ cao điểm.
- **💳 Nạp kim cương bằng chuyển khoản VietQR**: game tạo mã QR theo đơn, máy chủ nhỏ (thư mục `server/`, Cloudflare Worker + SePay) tự cộng kim cương khi tiền về. Có gói ưu đãi (Khởi nghiệp, Thẻ tháng, Tiểu thư), gói lớn và x2 lần nạp đầu. Xem `server/HUONG_DAN_NAP.md`.
- **Tính năng cần 💎 để mở**: tốc độ 2x/4x, nhập theo gợi ý, ô lưu 2 và 3, tự động phục vụ; một số thiết bị, quảng cáo, dịch vụ, chi nhánh cần thêm 💎; săn ứng viên 5 sao bằng 💎.
- 51 mặt hàng, nhân viên, đánh giá sao & phản hồi, nâng cấp tiệm, quảng cáo & PR, dịch vụ mở khóa, trộm & sự cố & kiểm tra & thuế, sao lưu 3 ô + mã sao lưu.

## ⚔️ Game mới: Kiếm & Khiên – Nữ Kỵ Sĩ Idle
Mở `kiem-khien/index.html`. Game idle RPG: nữ kỵ sĩ tự chiến đấu qua các ải (10 đợt/ải, đợt 10 là Boss có giới hạn 30 giây, thua thì luyện lại rồi bấm *Đánh Boss*).
- **Nâng cấp** bằng vàng: tấn công, sinh lực, hồi máu, chí mạng, sát thương chí mạng, tốc đánh (x1 / x10 / tối đa).
- **Trang bị** kiếm, khiên, giáp, nhẫn với 6 độ hiếm (Thường → Thần Thoại), cường hóa bằng đá 🔮, hợp nhất 3 món → 1 món hiếm hơn, phân giải. Màu kiếm/khiên trên nhân vật đổi theo độ hiếm.
- **4 kỹ năng** tự động: Chém Xoáy, Khiên Thánh, Kiếm Quang, Thiên Kiếm Vũ.
- **Ngọc** (Hỏa, Băng, Lôi, Huyết, Phong) khảm vào tối đa 3 ô, ghép 3 → 1 để tạo build.
- **Thăng cấp** 5 bậc (Tân Binh → Nữ Chiến Thần): chỉ số ×1.6 và đổi ngoại hình (giáp, áo choàng, vương miện, hào quang, đôi cánh). **6 bộ trang phục** mua bằng 💎.
- **Hầm ngục**: Ma Vương (2 vé/ngày, mạnh dần) và Boss Thế Giới Hydra (3 vé/ngày, máu vô hạn, thưởng theo sát thương).
- Triệu hồi trang bị/ngọc bằng 💎, quà hằng ngày, thưởng offline tối đa 8 giờ, tốc độ x1/x2/x3, tự lưu trên máy.

Mục tiêu: tổng tài sản **500 triệu**. Âm tiền 3 ngày liên tiếp là phá sản.

> Trò chơi hư cấu, lấy cảm hứng từ mô hình chuỗi cửa hàng thực phẩm tươi sống; các con số chỉ mang tính minh họa.
