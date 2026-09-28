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
- **🎪 Sự kiện**: cứ 10 ngày có một lễ hội 5 ngày (Trung thu, Chợ Tết, Lễ hội trái cây, Tuần lễ Sống xanh). Kiếm xu lễ hội, làm nhiệm vụ, nhận mốc thưởng và đồ độc quyền. Thử thách bất ngờ trong ngày: đơn đặt hàng lớn, khách VIP food reviewer, giờ cao điểm.
- **💳 Nạp kim cương bằng chuyển khoản VietQR**: game tạo mã QR theo đơn, máy chủ nhỏ (thư mục `server/`, Cloudflare Worker + SePay) tự cộng kim cương khi tiền về. Có gói ưu đãi (Khởi nghiệp, Thẻ tháng, Tiểu thư), gói lớn và x2 lần nạp đầu. Xem `server/HUONG_DAN_NAP.md`.
- **Tính năng cần 💎 để mở**: tốc độ 2x/4x, nhập theo gợi ý, ô lưu 2 và 3, tự động phục vụ; một số thiết bị, quảng cáo, dịch vụ, chi nhánh cần thêm 💎; săn ứng viên 5 sao bằng 💎.
- 51 mặt hàng, nhân viên, đánh giá sao & phản hồi, nâng cấp tiệm, quảng cáo & PR, dịch vụ mở khóa, trộm & sự cố & kiểm tra & thuế, sao lưu 3 ô + mã sao lưu.

Mục tiêu: tổng tài sản **500 triệu**. Âm tiền 3 ngày liên tiếp là phá sản.

> Trò chơi hư cấu, lấy cảm hứng từ mô hình chuỗi cửa hàng thực phẩm tươi sống; các con số chỉ mang tính minh họa.

---

# 🌷 Hoa Viên Xanh – Trồng hoa thư giãn

Game thứ hai trong repo (thư mục `hoavien/`), lấy cảm hứng từ các game trồng hoa kiểu *Thế Giới Hoa Viên Của Tôi*.

**Chơi:** mở `hoavien/index.html` (hoặc `…/cholaxanh/hoavien/` trên GitHub Pages).

- **18 loài hoa** vẽ bằng SVG, có hoa Việt Nam: sen, mai, đào, hoa giấy, bằng lăng, cát tường, quỳnh… cùng hồng, tulip, oải hương, lan hồ điệp, cẩm tú cầu. Hồng xanh và quỳnh là hạt hiếm mua bằng 💎.
- **Chăm hoa**: gieo hạt → tưới 💧 ở mỗi giai đoạn (hạt, mầm, nụ) → nở → hái ✂️. Thỉnh thoảng có sâu 🐛 cần bắt. Nước tự hồi theo thời gian.
- **Hoa lớn cả khi đóng game**: quay lại sẽ thấy tóm tắt cây đã nở, mèo đã giúp gì, và hàng xóm có hái trộm không.
- **Mèo Mướp** 🐱: ở nhà tự tưới cây và bắt sâu (tốn sức), vuốt ve, cho ăn, đổi tên, cho đi du lịch 15 phút để mang quà về (xu, hạt, 💎, hạt hiếm).
- **Đơn hoa** 💐: khách đặt bó hoa theo chủ đề, giao để lấy xu và kinh nghiệm. Kho hoa bán lẻ.
- **Trang trí** vườn (ghế, đèn lồng, đài phun nước, thiên nga, kỳ lân…): tăng độ đẹp ✿ và tiền thưởng đơn hoa. **Chó giữ vườn** chống hái trộm.
- **Hàng xóm**: ghé vườn 6 người hàng xóm (thay đổi mỗi ngày) để hái trộm hoa (coi chừng chó!) hoặc tưới giúp. Bảng xếp hạng vườn đẹp, nhật ký vườn.
- **Sổ tay**: nhiệm vụ hằng ngày, điểm danh 7 ngày, sổ sưu tầm hoa với mốc thưởng.
- Nâng cấp bể nước, giếng, phân bón; mở rộng tới 15 ô đất. Quà tân thủ khi bắt đầu.
- **Âm thanh ASMR tổng hợp** (tiếng nước nhỏ giọt, lá xào xạc, mèo kêu) và nhạc nền gió & chim hót; bầu trời đổi ngày/đêm theo giờ thật.
- Lưu tự động trên trình duyệt.
