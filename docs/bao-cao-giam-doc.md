# BÁO CÁO GỬI GIÁM ĐỐC
## Attendance Management — Tổng hợp chức năng đã triển khai (Ngày 1 → 6.2)
**Dự án:** Attendance Management (Quản lý chấm công)  
**Công nghệ:** Vite + React 19 + TypeScript + Supabase (RLS + RPC)  
**Ngày báo cáo:** 17/10/2026  
**Trạng thái:** Đang chạy localhost (`http://127.0.0.1:5173/`) — chưa deploy production, chưa commit Git

---

## 1. TỔNG QUAN HỆ THỐNG

Ứng dụng web quản lý chấm công cho công ty, với phân quyền 3 cấp: **Admin / HR / Employee**. Dữ liệu lưu trên Supabase (PostgreSQL) với Row Level Security (RLS) — bảo mật thật nằm ở database, không chỉ ẩn nút trên giao diện. Không dùng service-role key ở frontend.

---

## 2. CÁC CHỨC NĂNG ĐÃ TRIỂN KHAI

### 2.1. Xác thực & Phân quyền (Ngày 2.1–2.2)
- Đăng nhập bằng email + mật khẩu qua Supabase Auth.
- Profile đọc từ bảng `public.profiles` — không mặc định role, không tự nâng quyền.
- Ma trận quyền: `employees/departments/shifts` chỉ Admin+HR; `schedule/leave/checkin/history` cả 3 role; `settings` chỉ Admin.
- Guard chặn truy cập cả khi người dùng đoán URL/hash; RLS là lớp chặn thật.

### 2.2. Quản lý Nhân viên (Ngày 3.1)
- Bảng responsive: mã NV, họ tên, email (join từ `profiles` qua `user_id`), SĐT, phòng ban, trạng thái.
- Tìm kiếm theo tên/mã/email (truy vấn server, debounce), lọc phòng ban + trạng thái, sắp xếp 4 trường, phân trang 10/trang.
- Loading skeleton, lỗi + retry, empty state.
- Thêm/sửa: validate frontend, chỉ 7 trường được phép (employee_code, full_name, department_id, phone, hire_date, is_active, user_id), prefill khi sửa.
- Lỗi trùng mã nhân viên (23505) dịch sang tiếng Việt; từ chối phòng ban không tồn tại.
- Chi tiết: thông tin + phòng ban + phân ca/chấm công/đơn nghỉ thật (trống → empty state, không dữ liệu giả).
- Xóa: đếm FK trước (shift_assignments, attendance_records, leave_requests), còn liên quan → chặn và ép vô hiệu hóa.

### 2.3. Quản lý Phòng ban (Ngày 3.2)
- Bảng: tên, ngày tạo, số nhân viên đếm thật (count exact trên DB).
- Tìm kiếm, sắp xếp, phân trang.
- Thêm/sửa, trùng tên bị từ chối (unique constraint).
- Xóa chặn khi còn nhân viên liên kết; kèm quy trình chuyển nhân viên sang phòng ban khác có xác nhận từng bước.
- Không động lịch sử chấm công (chấm công gắn với employees, không gắn với departments).

### 2.4. Quản lý Ca làm việc (Ngày 4.1)
- Bảng: tên ca, giờ vào-ra, thời lượng (ca qua đêm 22:00–06:00 tính vòng nửa đêm + badge "Qua đêm"), phút cho phép muộn, lượt phân công thật.
- Giờ kiểu `time` (không ngày/múi giờ) — lưu nguyên, không quy đổi.
- Form có preview thời lượng live; trùng tên bị từ chối (DB không unique → check ở app).
- Xóa chặn khi còn phân công (FK RESTRICT dự phòng).

### 2.5. Lịch làm việc & Phân công ca (Ngày 4.2)
- Lưới tuần T2–CN, chuyển tuần/chọn ngày/Hôm nay.
- Ô có ca hiện tên + giờ (click để sửa); ô trống "—"; tuần trống → empty state.
- Lọc NV/phòng ban/ca (HR/Admin); Employee bị khóa cứng chỉ xem lịch mình.
- Phân công: combobox NV tìm trên Supabase (chỉ người đang hoạt động), validate, trùng 1 người/ngày bị từ chối, NV ngừng hoạt động/ca không tồn tại bị từ chối.
- Sửa/hủy có xác nhận; ngày đã chấm công bị **chặn** sửa/hủy để giữ toàn vẹn.

### 2.6. Chấm công (Ngày 5.1)
- Employee lấy employee_id qua `user_id = auth.uid()` (không tin frontend gửi id khác).
- Hiển thị ca hôm nay, trạng thái (chưa check-in → Check-in; đã check-in → Check-out; đã check-out/xác nhận → chỉ xem).
- Anti-double-click (disable nút), loading, lỗi thân thiện từ RPC.
- Form ghi chú (max 1000 ký tự), thời gian do DB `now()` ghi (không tin client).
- Không có ca → cảnh báo vẫn cho check-in. Không GPS/selfie/IP (schema chưa hỗ trợ).

### 2.7. Lịch sử chấm công & Tổng hợp (Ngày 5.2)
- Employee: chỉ xem lịch của mình (RLS). HR/Admin: toàn phạm vi + lọc NV/phòng ban/khoảng ngày/trạng thái.
- Bảng: ngày, NV, giờ vào/ra, trạng thái, xác nhận. Phân trang 20/trang, empty state.
- Tổng hợp (HR/Admin): số ngày có bản ghi, thiếu check-out, vắng, đi muộn, về sớm, đúng giờ, đã xác nhận — định nghĩa rõ trên UI.
- Employee không tự sửa thời gian (không có UI sửa; DB trigger chặn).

### 2.8. Quản lý Đơn nghỉ phép (Ngày 6.1)
- Employee: gửi đơn (ngày bắt đầu/kết thúc + lý do), xem đơn mình, xóa đơn pending.
- HR/Admin: xem toàn phạm vi, lọc theo trạng thái/ngày/NV/phòng ban, duyệt/từ chối đơn pending (xác nhận trước), xóa pending.
- Chống race condition: optimistic concurrency (`.eq("status", "pending")`) + trigger DB.
- Employee gửi đơn cho người khác bị RLS chặn; employee tự duyệt bị trigger chặn; duyệt đơn đã xử lý bị từ chối.

### 2.9. Dashboard & Báo cáo (Ngày 6.2)
- **Dashboard Admin/HR**: 4 KPI cards (NV đang hoạt động, phòng ban, ca làm, đơn nghỉ chờ duyệt) + chấm công hôm nay (tổng/đã check-in/đã check-out). Mỗi KPI có hint SQL để đối chiếu.
- **Employee**: Tổng quan cá nhân (không số liệu công ty).
- **Export CSV**: UTF-8 BOM, chống CSV formula injection, escape ký tự đặc biệt, format ngày giờ nhất quán.

---

## 3. ẢNH CHỤP MÀN HÌNH MINH CHỨNG

| # | File | Mô tả |
|---|------|-------|
| 1 | `docs/screenshots/01-dashboard-overview.png` | Dashboard tổng quan (dữ liệu demo ban đầu) |
| 2 | `docs/screenshots/02-history-full.png` | Lịch sử chấm công đầy đủ |
| 3 | `docs/screenshots/03-history-filter-late.png` | Lịch sử chấm công lọc đi muộn |
| 4 | `docs/screenshots/04-placeholder-checkin.png` | Placeholder chấm công (trước triển khai) |
| 5 | `docs/screenshots/05-header-notification.png` | Header + thông báo |
| 6 | `docs/screenshots/06-login-desktop.png` | Màn hình đăng nhập — desktop 1366px (mới chụp) |
| 7 | `docs/screenshots/07-login-mobile.png` | Màn hình đăng nhập — mobile 390px (mới chụp) |

**Lưu ý trung thực:** các màn hình chức năng (Nhân viên, Phòng ban, Ca làm, Lịch, Chấm công, Nghỉ phép, Dashboard mới) đứng sau đăng nhập Supabase + RLS. Tôi không có tài khoản HR và không được tự tạo dữ liệu/tài khoản trên production, nên **không dựng ảnh giả** bằng cách tắt auth. Sau khi đăng nhập HR trên localhost, bạn có thể chụp thêm theo checklist ở cuối báo cáo.

---

## 4. KIỂM TRA KỸ THUẬT

| Kiểm tra | Kết quả |
|----------|---------|
| `npm run lint` (oxlint) | **PASS** — 0 errors (warnings `set-state-in-effect` là pattern có sẵn trong codebase) |
| `npm run build` (tsc -b + vite) | **PASS** — build thành công, không lỗi TypeScript |
| `node scripts/check-supabase.mjs` | **PASS** — host + key hợp lệ |
| Dev server `http://127.0.0.1:5173/` | **PASS** — HTTP 200 |
| Service-role key trong frontend | **Không có** (grep chỉ còn comment cấm) |
| Git staged | **Rỗng** — không commit, không sửa lịch sử |

---

## 5. GIỚI HẠN & ĐỀ XUẤT CẦN XÁC NHẬN

1. **Tự động đánh dấu đi muộn/về sớm**: hiện tại `status` do HR/Admin set thủ công. Nếu muốn tự động tính theo `shift.start_time + late_after_minutes` khi check-in, cần confirm quy tắc trước khi áp dụng.
2. **Lý do từ chối đơn nghỉ phép**: schema không có cột `rejection_reason` → chỉ ghi nhận trạng thái `rejected`. Nếu cần lưu lý do, đề xuất migration thêm cột.
3. **Loại nghỉ phép**: schema không có cột `leave_type` → không phân biệt annual/sick/... Nếu cần, đề xuất migration.
4. **Tự động trừ phép/tính lương**: schema chưa hỗ trợ → không triển khai.
5. **Biểu đồ**: DashboardPage cũ có `AttendanceChart` (demo). Hiện tại bỏ vì dữ liệu thật chưa có aggregation. Nếu muốn biểu đồ chấm công 7 ngày, cần query GROUP BY `work_date`.
6. **Xuất Excel/PDF**: chỉ triển khai CSV. Nếu cần Excel/PDF, cần thêm thư viện.
7. **Audit trail**: schema chưa có bảng audit chi tiết. Nếu cần, đề xuất migration.
8. **GPS/selfie/IP cho chấm công**: schema không có cột → không triển khai. Nếu cần, đề xuất migration.

---

## 6. CHECKLIST ẢNH CẦN BẠN CHỤP SAU ĐĂNG NHẬP HR

1. Dashboard tổng quan (KPI thật).
2. Danh sách nhân viên → tìm kiếm/lọc → form thêm/sửa + 1 case lỗi → chi tiết NV.
3. Danh sách phòng ban (cột số NV) → dialog chặn xóa phòng ban.
4. Danh sách ca làm (badge qua đêm) → form + preview thời lượng.
5. Lịch tuần → form phân công → dialog chặn hủy phân công đã chấm công.
6. Trang chấm công (trước check-in → sau check-in → sau check-out).
7. Lịch sử chấm công + tổng hợp.
8. Danh sách đơn nghỉ phép → form đăng ký → dialog duyệt/từ chối.