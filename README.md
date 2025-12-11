# Smart Class Control Interface

Giao diện điều khiển lớp học thông minh (Smart Classroom IoT Control Panel).

## Tính năng
- Điều khiển Đèn và Quạt (Giao diện).
- Chỉnh tốc độ quạt (Slider).
- Chế độ Demo (Mô phỏng phản hồi mạng).
- Giao diện Glassmorphism hiện đại.

## Cách đưa lên GitHub (Deploy)

Để đưa dự án này lên GitHub và chạy trang web (GitHub Pages), bạn hãy làm theo các bước sau:

### Bước 1: Tạo Repository trên GitHub
1. Đăng nhập vào [GitHub](https://github.com).
2. Bấm dấu **+** ở góc trên bên phải -> chọn **New repository**.
3. Đặt tên (ví dụ: `classroom-control`).
4. Chọn **Public**.
5. Bấm **Create repository**.

### Bước 2: Đẩy code lên GitHub (Dùng Terminal)
Mở Terminal tại thư mục dự án này và chạy lần lượt các lệnh sau:

```bash
# Khởi tạo git
git init

# Thêm tất cả file vào
git add .

# Lưu trạng thái (Commit)
git commit -m "Khoi tao giao dien control"

# Đổi nhánh chính thành main
git branch -M main

# Kết nối với GitHub (Thay link bằng link repo bạn vừa tạo ở Bước 1)
# Ví dụ: git remote add origin https://github.com/TênBạn/classroom-control.git
git remote add origin <LINK_REPOSITORY_CUA_BAN>

# Đẩy code lên
git push -u origin main
```

### Bước 3: Bật GitHub Pages (Để chạy web)
1. Vào trang repository của bạn trên GitHub.
2. Vào **Settings** (Cài đặt) -> Chọn tab **Pages** ở cột bên trái.
3. Phần **Source**, chọn `Deploy from a branch`.
4. Phần **Branch**, chọn `main` và folder `/ (root)`.
5. Bấm **Save**.

Sau khoảng 1-2 phút, GitHub sẽ cung cấp cho bạn một đường link (dạng `https://tenban.github.io/classroom-control/`). Bạn có thể gửi link này cho mọi người truy cập.
