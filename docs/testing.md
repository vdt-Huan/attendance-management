# Tài liệu kiểm thử — Attendance Management

## Ma trận test theo module

### A. Đăng nhập & Phân quyền

| Test ID | Module | Tiền điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|---|
| A-01 | Auth | Mở website | 1. Truy cập URL 2. Quan sát màn hình | Hiển thị form đăng nhập (email + mật khẩu) | Hiển thị đúng | PASS (live) |
| A-02 | Auth | Có tài khoản Admin | 1. Nhập email/password đúng 2. Nhấn Đăng nhập | Chuyển tới Dashboard, hiển thị tên + role | Chưa test (không có acc) | UNVERIFIED |
| A-03 | Auth | Có tài khoản Admin | 1. Đăng nhập 2. Refresh trang | Session khôi phục, không mất trạng thái | Chưa test | UNVERIFIED |
| A-04 | Auth | Đã đăng nhập | 1. Nhấn Đăng xuất | Chuyển về trang đăng nhập, không truy cập được route con | Chưa test | UNVERIFIED |
| A-05 | RBAC | Đăng nhập Employee | 1. Thử truy cập #/employees | Hiển thị AccessDenied | Chưa test | UNVERIFIED |
| A-06 | RBAC | Đăng nhập Employee | 1. Kiểm tra menu sidebar | Chỉ thấy Tổng quan, Chấm công, Lịch làm việc, Lịch sử, Nghỉ phép | Chưa test | UNVERIFIED |

### B. Quản lý Nhân viên

| Test ID | Module | Tiền điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|---|
| B-01 | NV | Đăng nhập HR | 1. Vào #/employees | Danh sách NV hiển thị (hoặc empty state) | Chưa test | UNVERIFIED |
| B-02 | NV | Danh sách có dữ liệu | 1. Nhập từ khóa tìm kiếm 2. Quan sát | Kết quả lọc theo tên/mã/email | Chưa test | UNVERIFIED |
| B-03 | NV | Danh sách có dữ liệu | 1. Chọn phòng ban trong bộ lọc | Chỉ NV thuộc phòng ban đó hiển thị | Chưa test | UNVERIFIED |
| B-04 | NV | Đăng nhập HR | 1. Nhấn Thêm NV 2. Nhập dữ liệu hợp lệ 3. Lưu | NV mới xuất hiện trong danh sách + Supabase | Chưa test | UNVERIFIED |
| B-05 | NV | Đăng nhập HR | 1. Thêm NV với mã trùng | Hiển thị lỗi "Mã nhân viên đã tồn tại" | Chưa test | UNVERIFIED |
| B-06 | NV | Đăng nhập HR | 1. Thêm NV bỏ trống tên | Hiển thị lỗi "Vui lòng nhập họ tên" | PASS (code) | PASS |
| B-07 | NV | NV có lịch sử chấm công | 1. Thử xóa NV | Chặn xóa + thông báo còn bản ghi liên quan | PASS (code) | PASS |

### C. Quản lý Phòng ban

| Test ID | Module | Tiền điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|---|
| C-01 | PB | Đăng nhập HR | 1. Vào #/departments | Danh sách PB + số NV đếm thật | Chưa test | UNVERIFIED |
| C-02 | PB | Đăng nhập HR | 1. Tạo PB mới | PB xuất hiện + Supabase | Chưa test | UNVERIFIED |
| C-03 | PB | PB đang có NV | 1. Thử xóa PB | Chặn + quy trình chuyển NV | PASS (code) | PASS |
| C-04 | PB | PB không có NV | 1. Xóa PB | Xóa thành công | Chưa test | UNVERIFIED |

### D. Ca làm & Lịch

| Test ID | Module | Tiền điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|---|
| D-01 | Ca | Đăng nhập HR | 1. Tạo ca 22:00–06:00 | Ca hiển thị badge "Qua đêm", thời lượng 8h | Chưa test | UNVERIFIED |
| D-02 | Ca | Ca đang phân công | 1. Thử xóa ca | Chặn + thông báo còn phân công | PASS (code) | PASS |
| D-03 | Lịch | Đăng nhập HR | 1. Phân công ca cho NV | Phân công xuất hiện trong lưới tuần | Chưa test | UNVERIFIED |
| D-04 | Lịch | NV đã có phân công cùng ngày | 1. Phân công thêm ca cho cùng NV/ngày | Từ chối (trùng) | PASS (code) | PASS |
| D-05 | Lịch | Ngày đã chấm công | 1. Sửa/hủy phân công | Chặn + thông báo | PASS (code) | PASS |
| D-06 | Lịch | Đăng nhập Employee | 1. Vào #/schedule | Chỉ thấy lịch của mình | Chưa test | UNVERIFIED |

### E. Chấm công

| Test ID | Module | Tiền điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|---|
| E-01 | CC | Employee chưa check-in | 1. Nhấn Check-in | Giờ vào hiển thị, trạng thái "Đã check-in" | Chưa test | UNVERIFIED |
| E-02 | CC | Employee đã check-in | 1. Nhấn Check-out | Giờ ra hiển thị, trạng thái "Đã check-out" | Chưa test | UNVERIFIED |
| E-03 | CC | Employee chưa check-in | 1. Nhấn Check-out | Từ chối "Chưa check-in hôm nay" | PASS (code) | PASS |
| E-04 | CC | Employee đã check-in | 1. Nhấn Check-in lại | Từ chối "Hôm nay đã check-in rồi" | PASS (code) | PASS |
| E-05 | CC | Sau check-in | 1. Refresh trang | Trạng thái vẫn hiển thị đúng | Chưa test | UNVERIFIED |
| E-06 | CC | — | 1. Kiểm tra Supabase attendance_records | Bản ghi khớp với UI | Chưa test | UNVERIFIED |

### F. Nghỉ phép

| Test ID | Module | Tiền điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|---|
| F-01 | NP | Employee đã liên kết NV | 1. Gửi đơn nghỉ phép | Đơn xuất hiện trạng thái "Chờ duyệt" | Chưa test | UNVERIFIED |
| F-02 | NP | Đơn pending | 1. HR duyệt | Trạng thái "Đã duyệt" + người duyệt | Chưa test | UNVERIFIED |
| F-03 | NP | Đơn pending | 1. HR từ chối | Trạng thái "Từ chối" | Chưa test | UNVERIFIED |
| F-04 | NP | Đơn đã duyệt | 1. HR duyệt lại | Từ chối "Đơn đã được xử lý" | PASS (code) | PASS |
| F-05 | NP | Employee | 1. Thử tự duyệt đơn | Bị chặn (trigger + RLS) | PASS (code) | PASS |
| F-06 | NP | Employee | 1. Xóa đơn pending | Xóa thành công | Chưa test | UNVERIFIED |

### G. Dashboard & Báo cáo

| Test ID | Module | Tiền điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế | Trạng thái |
|---|---|---|---|---|---|---|
| G-01 | DB | Đăng nhập Admin | 1. Mở Dashboard | KPI hiển thị (NV, PB, Ca, đơn chờ) | Chưa test | UNVERIFIED |
| G-02 | DB | Dashboard hiển thị | 1. Đối chiếu KPI với SQL | Số khớp với DB | Chưa test | UNVERIFIED |
| G-03 | DB | Có dữ liệu chấm công | 1. Mở Lịch sử | Bảng hiển thị đúng | Chưa test | UNVERIFIED |
| G-04 | DB | Có dữ liệu | 1. Export CSV | File CSV tiếng Việt đúng, không injection | PASS (code) | PASS |
| G-05 | DB | Không có dữ liệu | 1. Mở trang với DB rỗng | Empty state hiển thị | PASS (code) | PASS |

## Ma trận test theo Role

| Role | Trang được vào | Trang bị chặn | RLS bảo vệ |
|---|---|---|---|
| admin | Tất cả (overview, checkin, history, employees, departments, shifts, schedule, leave, report, settings) | — | Toàn quyền |
| hr | overview, checkin, history, employees, departments, shifts, schedule, leave, report | settings | Quản lý NV/PB/Ca/Lịch, duyệt NP |
| employee | overview, checkin, history, schedule, leave | employees, departments, shifts, report, settings | Chỉ dữ liệu của mình |

## Kết quả lint/typecheck/test/build

| Kiểm tra | Kết quả |
|---|---|
| `npm run lint` (oxlint) | PASS — 0 errors, 22 warnings (set-state-in-effect, pattern có sẵn) |
| `npm run build` (tsc -b + vite) | PASS — build thành công |
| `npm run check:supabase` | PASS — host + key hợp lệ |
| Unit/Integration tests | N/A — không có test framework |
| Typecheck riêng | N/A — chạy trong build |

## Ghi chú

- **UNVERIFIED** = chưa test live do không có tài khoản HR/Employee/Admin để đăng nhập.
- **PASS (code)** = logic đã code đúng theo schema + RLS, nhưng chưa verify live.
- Để test live: tạo tài khoản Admin/HR/Employee trên Supabase Dashboard, sau đó đăng nhập và thực hiện các bước trong ma trận test.
- Ảnh chụp màn hình minh chứng: `docs/screenshots/` (7 ảnh). Cần chụp thêm theo checklist trong README.