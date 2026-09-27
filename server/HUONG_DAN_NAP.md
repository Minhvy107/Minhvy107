# Hướng dẫn bật cổng nạp chuyển khoản QR

Game tạo mã **VietQR** chứa sẵn số tài khoản, số tiền và nội dung (mã đơn `CLX…`).
Khi tiền về tài khoản, **SePay** báo cho máy chủ nhỏ trong thư mục này (Cloudflare Worker).
Game hỏi máy chủ 5 giây một lần và tự cộng kim cương. Mỗi đơn chỉ được nhận một lần.

Cả SePay và Cloudflare Worker đều có gói miễn phí. Không cần tài khoản merchant.

## 1. SePay: theo dõi tài khoản ngân hàng
1. Đăng ký tại https://sepay.vn và liên kết tài khoản ngân hàng nhận tiền.
2. Vào **Cấu hình → API Token** (hoặc phần Webhook) để lấy khóa API. **Giữ bí mật khóa này.**

## 2. Cloudflare Worker: máy chủ nạp
Cần cài Node.js. Mở terminal trong thư mục `server/`, rồi chạy:
```bash
npx wrangler login
npx wrangler kv namespace create ORDERS     # dán id nhận được vào wrangler.toml
npx wrangler secret put SEPAY_API_KEY       # dán khóa API SePay khi được hỏi
npx wrangler deploy                         # nhận địa chỉ dạng https://cholaxanh-nap.<tên>.workers.dev
```
Nên đổi `ALLOWED_ORIGIN` trong `wrangler.toml` thành địa chỉ trang game, ví dụ `https://minhvy107.github.io`, rồi chạy `deploy` lại.

## 3. Nối SePay với máy chủ
Trong SePay, tạo **Webhook**:
- URL: `https://cholaxanh-nap.<tên>.workers.dev/sepay`
- Kiểu chứng thực: **API Key** (dùng đúng khóa đã nạp ở bước 2)
- Chỉ nhận **tiền vào**

## 4. Điền thông tin vào game
Trong `index.html`, tìm `const PAY_CFG` và điền:
```js
const PAY_CFG={bin:'970422',acct:'SO_TAI_KHOAN',holder:'TEN CHU TK IN HOA',api:'https://cholaxanh-nap.<tên>.workers.dev'};
```
`bin` là mã ngân hàng, xem `PAY_BANKS` ngay bên dưới: Vietcombank 970436, MB 970422, Techcombank 970407, BIDV 970418…
Nếu ngân hàng yêu cầu tiền tố trong nội dung (VietinBank + SePay cần `SEVQR`), thêm `memo:'SEVQR'`. Nội dung chuyển khoản sẽ thành `SEVQR CLX…`.
Những thông tin này không phải bí mật, vì khi chuyển khoản người chơi cũng thấy chúng.

## 5. Thử
- Khi chưa điền `PAY_CFG`, game chạy ở **chế độ thử nghiệm**: có mã QR mẫu, kèm cảnh báo không chuyển tiền.
  Thêm `?paytest=1` vào cuối link để hiện nút *Giả lập đã nhận tiền*.
- Sau khi điền, tự nạp gói nhỏ nhất (22.000đ) để kiểm tra cả luồng.

## Giá gói
| Gói | Giá | Nhận |
|---|---|---|
| p1 | 22.000đ | 60💎 |
| p2 | 99.000đ | 320💎 + 30 tặng |
| p3 | 199.000đ | 700💎 + 100 tặng |
| p4 | 399.000đ | 1.500💎 + 300 tặng |
| p5 | 999.000đ | 4.000💎 + 1.200 tặng |
| 🌱 Khởi nghiệp (1 lần) | 29.000đ | 300💎 + Áo dài đỏ + Mái hiên cầu vồng |
| 📅 Thẻ tháng | 49.000đ | 150💎 ngay + 30💎 mỗi sáng trong 30 ngày |
| 👑 Tiểu thư (1 lần) | 149.000đ | 700💎 + Váy công chúa + Vương miện + Vương miện mèo |

Gói p1–p5: **lần nạp đầu mỗi gói được x2 kim cương gốc**.

Giá đang được khai báo ở **hai nơi** và phải khớp nhau:
- `GEM_PACKS` / `GEM_OFFERS` trong `index.html`
- `PACKS` trong `server/worker.js` (số 💎 ở đây đã gồm quà tặng; thưởng x2, vật phẩm, thẻ tháng do game tự cộng)

Máy chủ chỉ tin giá của chính nó. Nếu tiền chuyển ít hơn giá gói, đơn sẽ không được duyệt.

## Lưu ý quan trọng
- **Pháp lý:** Ở Việt Nam, bán vật phẩm ảo trong game online để thu tiền thường cần giấy phép phát hành game (G1) theo Nghị định 147/2024/NĐ-CP. Hãy tìm hiểu hoặc hỏi luật sư trước khi mở nạp tiền cho công chúng.
- **Chống gian lận:** Kim cương được lưu trong trình duyệt của người chơi (localStorage). Người rành kỹ thuật vẫn có thể tự sửa số kim cương. Máy chủ chỉ đảm bảo mỗi khoản tiền thật cộng đúng một lần.
- **Hoàn tiền:** Nếu người chơi chuyển sai nội dung, đơn sẽ không tự duyệt. Bạn xem lịch sử giao dịch trên SePay để xử lý thủ công.
