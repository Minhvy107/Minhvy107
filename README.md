# 🍃 Chợ Lá Xanh – Mô phỏng kinh doanh tạp hóa

Trò chơi trình duyệt: mở tiệm tạp hóa – thực phẩm tươi sống, phục vụ từng khách hàng và phát triển thành chuỗi cửa hàng.

**Chơi:** mở `index.html` bằng trình duyệt (không cần cài đặt).

## Tính năng
- **Giao diện pastel dễ thương**: màn hình mở đầu là quầy tiệm có mái hiên sọc hồng, đèn lồng, mèo ngủ; nút *Chơi tiếp* hiện tên tiệm, ngày và tiền của bản lưu.
- **Bán hàng tại quầy**: khách chibi đứng trước quầy, nói món cần mua trong bong bóng lời thoại, có **thanh kiên nhẫn**. Chọn nhóm hàng, bấm vào **khay hàng** (có số lượng tồn) để lấy đúng món vào **Giỏ hàng**, rồi **Nhận tiền** (tiền mặt có tiền thối hoặc QR). Lấy nhầm thì bấm món trong giỏ để trả lại, hết hàng thì *Báo hết*.
- Khách đang đợi phía sau hiện thành vòng tròn trên cùng; **thu ngân** thuê thêm tự phục vụ họ. Có thể bật *tự động phục vụ* quầy của bạn.
- Khách **khen/chê từng sản phẩm** (tươi ngon, rẻ, héo, mắc) ngay tại quầy và trong đánh giá.
- **👗 Tủ đồ & 💎 kim cương**: mua kiểu tóc (búi messy, sóng dài, afro, song bím, bob mái, wolf cut, búi nửa đầu, vương miện tết, rẽ ngôi, đầu đinh), màu tóc, mũ, trang phục, phụ kiện cho chủ tiệm, màu mái hiên, phụ kiện cho mèo, đồng phục nhân viên. Kim cương kiếm bằng cách chơi (nhiệm vụ hằng ngày, mốc thành tích, thử thách, lễ hội); khách thanh toán chỉ cộng tiền.
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
- **🎪 Sự kiện**: cứ 10 ngày có một lễ hội 5 ngày (Trung thu, Chợ Tết, Lễ hội trái cây, Tuần lễ Sống xanh, Halloween, Tri ân Nhà giáo, Giáng Sinh). Kiếm xu lễ hội, làm nhiệm vụ, nhận mốc thưởng và đồ độc quyền. Thử thách bất ngờ trong ngày: đơn đặt hàng lớn, khách VIP food reviewer, giờ cao điểm.
- **💳 Nạp kim cương bằng chuyển khoản VietQR**: game tạo mã QR theo đơn, máy chủ nhỏ (thư mục `server/`, Cloudflare Worker + SePay) tự cộng kim cương khi tiền về. Có gói ưu đãi (Khởi nghiệp, Thẻ tháng, Tiểu thư), gói lớn và x2 lần nạp đầu. Xem `server/HUONG_DAN_NAP.md`.
- **Tính năng cần 💎 để mở**: tốc độ 2x/4x, nhập theo gợi ý, ô lưu 2 và 3, tự động phục vụ; một số thiết bị, quảng cáo, dịch vụ, chi nhánh cần thêm 💎; săn ứng viên 5 sao bằng 💎.
- 51 mặt hàng, nhân viên, đánh giá sao & phản hồi, nâng cấp tiệm, quảng cáo & PR, dịch vụ mở khóa, trộm & sự cố & kiểm tra & thuế, sao lưu 3 ô + mã sao lưu.

Mục tiêu: tổng tài sản **500 triệu**. Âm tiền 3 ngày liên tiếp là phá sản.

> Trò chơi hư cấu, lấy cảm hứng từ mô hình chuỗi cửa hàng thực phẩm tươi sống; các con số chỉ mang tính minh họa.
