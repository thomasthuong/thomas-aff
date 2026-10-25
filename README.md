# Beauty Universe — trang link Shopee & TikTok Shop của Thomas

Web tĩnh chạy miễn phí trên GitHub Pages. Mỗi sản phẩm có nút mua trên **Shopee** và/hoặc **TikTok Shop**. Thêm sản phẩm chỉ bằng cách dán link — web tự lấy tên + hình, tự đổi link Shopee thành link aff, và xếp theo thương hiệu.

## 1. Đưa web lên GitHub (đã làm xong)

Web đang chạy ở **https://thomasthuong.github.io/thomas-aff/**. Các bước dưới chỉ để tham khảo nếu cần làm lại.

1. Vào github.com → đăng nhập → bấm **+** (góc phải) → **New repository**.
   - Repository name: `thomas-aff` → chọn **Public** → **Create repository**.
2. Trong repo vừa tạo, bấm **uploading an existing file** → kéo **toàn bộ file và thư mục** trong thư mục dự án vào (gồm cả thư mục `.github` và `scripts`) → **Commit changes**.
   - Thư mục `.github` là ẩn trên máy; nếu không thấy, trên Mac bấm `Cmd + Shift + .` để hiện file ẩn, trên Windows bật "Hidden items" trong File Explorer.
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → **Save**.
   Sau ~1 phút web chạy ở `https://thomasthuong.github.io/thomas-aff/`.
4. **Settings → Actions → General** → mục *Workflow permissions* chọn **Read and write permissions** → **Save**.

## 2. Cài mã affiliate Shopee (làm 1 lần)

Để dán **link Shopee thường** mà web tự đổi thành **link aff của bạn**, chọn 1 trong 2 cách:

**Cách A — Open API (chính thức, khuyên dùng nếu có quyền):**
1. Vào affiliate.shopee.vn → mục **Open API** → đăng ký, lấy **AppID** và **Secret**.
2. Trong repo GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - Tên `SHOPEE_APP_ID` → dán AppID
   - Tên `SHOPEE_SECRET` → dán Secret
   (Secret được GitHub giấu kín, không ai xem được, kể cả trên web.)

**Cách B — chỉ cần Affiliate ID:**
1. Lấy Affiliate ID trong trang affiliate.shopee.vn (mục tài khoản), hoặc từ một link aff bạn đã tạo: mở link `s.shopee.vn/...` trên máy tính, trên thanh địa chỉ tìm đoạn `affiliate_id=` — dãy số phía sau là ID.
2. Mở `data.json` trên GitHub → ✏️ → điền vào `"affiliate": { "shopeeId": "dãy số đó", "subId": "web" }` → Commit.
3. **Kiểm tra lần đầu:** thêm 1 sản phẩm, bấm thử nút Shopee trên web, rồi xem trong báo cáo click của Shopee Affiliate có ghi nhận (sub_id = `web`) không. Cách này dùng định dạng link chuyển hướng của Shopee, không phải API chính thức — nếu không thấy ghi nhận thì chuyển sang Cách A hoặc dán thẳng link aff.

Có cả 2 thì web dùng Cách A trước. Không cài gì thì link dán vào giữ nguyên — vẫn dùng được nếu bạn dán sẵn link aff `s.shopee.vn/...`.

**TikTok Shop:** TikTok không cho tạo link aff từ ngoài app, nên hãy lấy link trong app: TikTok → **Trung tâm Nhà sáng tạo / Affiliate** → thêm sản phẩm vào **Showcase** → bấm **Chia sẻ** → **Sao chép liên kết**, rồi dán link đó vào web.

## 3. Thêm sản phẩm (từ điện thoại hay máy tính đều được)

1. Vào repo → tab **Issues** → **New issue** → chọn **➕ Thêm sản phẩm**.
2. Dán link vào ô **Link Shopee** và/hoặc **Link TikTok Shop** → **Submit**.
   - Mỗi ô 1 link → gộp thành 1 sản phẩm có 2 nút mua.
   - Nhiều link (mỗi dòng 1 link) → mỗi link 1 sản phẩm.
   - Muốn gắn thêm TikTok cho sản phẩm đã có: dán link Shopee cũ + link TikTok mới trong cùng 1 issue.
3. Khoảng 1 phút sau, bot trả lời ngay trong issue kèm tên + hình đã lấy, rồi tự đóng issue. Web cập nhật luôn.

Mẹo: lưu trang *New issue → Thêm sản phẩm* vào màn hình chính điện thoại để thêm nhanh.

Chỉ tài khoản chủ repo mới thêm/xoá được — người lạ mở issue sẽ bị bỏ qua.

## 4. Xoá sản phẩm

**Issues → New issue → 🗑️ Xoá sản phẩm** → dán link (hoặc 1 đoạn tên) → Submit.
Lần đầu nên xoá 4 sản phẩm mẫu bằng cách gõ `ví dụ`.

## 5. Sửa tay (tên, hình, ảnh đại diện, bio…)

Mở file `data.json` trên GitHub → bấm ✏️ → sửa → **Commit changes**.

- `profile.avatar`: dán link ảnh đại diện (VD ảnh TikTok/Facebook của bạn).
- `profile.socials`: thêm mạng xã hội `{ "label": "Instagram", "url": "..." }`.
- `brandOrder`: thứ tự thương hiệu muốn hiện trước, VD `["La Roche-Posay", "Romand"]`. Bỏ trống thì thương hiệu nhiều món nhất lên đầu.
- Mỗi sản phẩm: `shopee`, `tiktok` (link mua), `name`, `image`, `brand`, `note`, `hot` (true/false), `price` (tuỳ chọn, VD `"289.000₫"`).

## Nếu không lấy được tên/hình

Shopee/TikTok đôi khi chặn máy chủ GitHub. Khi đó bot vẫn thêm link (đánh dấu 🟡) với tên đọc từ link nếu có. Bạn tạo issue mới cho đúng link đó, điền ô **Tên tự đặt** và **Link hình** (trên Shopee: nhấn giữ ảnh sản phẩm → Sao chép địa chỉ ảnh), hoặc sửa thẳng trong `data.json`.
