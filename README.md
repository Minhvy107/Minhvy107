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
- **🔒 Đóng cửa sớm / 😴 Nghỉ một ngày**: đóng cửa bất cứ lúc nào (khách đang chờ vẫn được phục vụ; đóng trước 12:00 trừ 2 uy tín, trước 17:00 trừ 1) hoặc nghỉ bán cả ngày (trừ 3 uy tín, vẫn trả chi phí).
- **🎪 Sự kiện**: cứ 10 ngày có một lễ hội 5 ngày (Trung thu, Chợ Tết, Lễ hội trái cây, Tuần lễ Sống xanh). Kiếm xu lễ hội, làm nhiệm vụ, nhận mốc thưởng và đồ độc quyền. Thử thách bất ngờ trong ngày: đơn đặt hàng lớn, khách VIP food reviewer, giờ cao điểm.
- **💳 Nạp kim cương bằng chuyển khoản VietQR**: game tạo mã QR theo đơn, máy chủ nhỏ (thư mục `server/`, Cloudflare Worker + SePay) tự cộng kim cương khi tiền về. Có gói ưu đãi (Khởi nghiệp, Thẻ tháng, Tiểu thư), gói lớn và x2 lần nạp đầu. Xem `server/HUONG_DAN_NAP.md`.
- **Tính năng cần 💎 để mở**: tốc độ 2x/4x, nhập theo gợi ý, ô lưu 2 và 3, tự động phục vụ; một số thiết bị, quảng cáo, dịch vụ, chi nhánh cần thêm 💎; săn ứng viên 5 sao bằng 💎.
- 51 mặt hàng, nhân viên, đánh giá sao & phản hồi, nâng cấp tiệm, quảng cáo & PR, dịch vụ mở khóa, trộm & sự cố & kiểm tra & thuế, sao lưu 3 ô + mã sao lưu.

Mục tiêu: tổng tài sản **500 triệu**. Âm tiền 3 ngày liên tiếp là phá sản.

> Trò chơi hư cấu, lấy cảm hứng từ mô hình chuỗi cửa hàng thực phẩm tươi sống; các con số chỉ mang tính minh họa.
