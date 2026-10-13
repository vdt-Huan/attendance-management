# Supabase — Attendance Management

Thư mục này chứa schema SQL khởi tạo. **Chưa có migration nào được áp dụng
tự động** — mọi bước dưới đây đều làm thủ công sau khi xác nhận đúng project.

## 1. Xác nhận đúng project đích

1. Đăng nhập Supabase Dashboard và mở **đúng project mới** của Attendance
   Management (không dùng project cũ của các dự án khác).
2. Đối chiếu **Project URL** và **publishable key** tại
   Project Settings → Data API / API Keys với giá trị sẽ đưa vào `.env`.
3. Chỉ dùng **publishable key** cho frontend. Tuyệt đối không dán
   `service_role` / secret key vào `.env` hay mã nguồn.

## 2. Chạy migration thủ công

1. Trong Supabase Dashboard, mở **SQL Editor** → **New query**.
2. Sao chép toàn bộ nội dung file `migrations/0001_initial_schema.sql`.
3. Dán vào query editor, kiểm tra lại tên project trên thanh điều hướng,
   rồi nhấn **Run**. File chạy lại an toàn (mọi policy/trigger cũ đều
   `DROP IF EXISTS` trước khi tạo; bảng dùng `IF NOT EXISTS`).
4. Kiểm tra kết quả: vào **Table Editor**, phải thấy 7 bảng
   (`profiles`, `departments`, `employees`, `work_shifts`,
   `shift_assignments`, `attendance_records`, `leave_requests`).
5. Kiểm tra RLS: mỗi bảng phải có **RLS enabled** và policies tương ứng
   (Database → Policies hoặc câu lệnh kiểm tra trong mục 5).

## 3. Tạo Admin đầu tiên (bắt buộc, thủ công — KHÔNG có đường tự cấp quyền)

Schema cố tình **không cho bất kỳ ai tự trở thành Admin/HR**:
tài khoản tự đăng ký luôn bị ép `role = 'employee'` (policy + trigger
`trg_enforce_profile_insert_role`), và đổi `role` chỉ admin mới được làm
(trigger `trg_prevent_role_escalation`).

Các bước (làm 1 lần duy nhất, trong SQL Editor của đúng project):

1. Bảo nhân sự chủ chốt **đăng ký tài khoản** trên app (hoặc tạo user trong
   Authentication → Users). Lúc này `profiles` có dòng `role = 'employee'`.
2. Chạy lệnh sau (thay email thật), với vai trò chủ project:

```sql
update public.profiles set role = 'admin'
where email = 'admin@congty.vn';
```

3. Kiểm tra: chỉ đúng 1 dòng bị ảnh hưởng; đăng nhập lại tài khoản đó và
   gọi `select public.is_hr();` phải trả về `true`.
4. Từ đây, Admin tạo phòng ban, hồ sơ `employees` và phân quyền tiếp trong
   app (hoặc SQL Editor). Không bao giờ chia sẻ `service_role` key.

> Cảnh báo: đừng tự hạ quyền admin cuối cùng (`role` từ `admin` xuống thấp
> hơn) nếu chưa có admin dự phòng — hệ thống không chặn trường hợp này
> (xem mục Giới hạn).

## 4. Cấu hình môi trường local

```bash
cp .env.example .env
# Điền VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY của project mới
npm run check:supabase
```

Kết quả mong đợi khi cấu hình đúng và project mới (chưa đăng nhập):

```text
[ok] Auth phản hồi — host và key hợp lệ.
[ghi chú] Chưa đăng nhập — trạng thái bình thường.
```

Nếu báo `[invalid-key]` (401): key sai hoặc không thuộc project này —
lấy lại publishable key tại Project Settings → Data API / API Keys.
Nếu báo `[network]`: kiểm tra URL, mạng, DNS.

## 5. Câu lệnh kiểm tra nhanh sau migration (chạy trong SQL Editor)

```sql
-- Bảng nào chưa bật RLS (kết quả phải rỗng):
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','departments','employees','work_shifts',
    'shift_assignments','attendance_records','leave_requests')
  and rowsecurity = false;

-- Đếm policy từng bảng:
select tablename, count(*) from pg_policies
where schemaname = 'public'
group by tablename order by tablename;
-- Kỳ vọng: profiles 5, departments 2, employees 2, work_shifts 2,
-- shift_assignments 2, attendance_records 4, leave_requests 4.

-- Trigger và function đã đủ chưa:
select tgname from pg_trigger where not tisinternal order by tgname;
-- Kỳ vọng 10 trigger trg_* (role, insert_role, touch x4, leave x3,
-- attendance_write).
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('is_hr','is_admin','vn_today','clock_in','clock_out',
    'confirm_attendance');
-- Kỳ vọng đủ 6 hàm.
```

## 6. Ma trận kiểm thử quyền (đăng nhập từng vai trò trên app/API)

H = HR/Admin, E = Nhân viên (trên dữ liệu của chính mình), X = phải bị chặn.

| # | Hành động | H | E | Cơ chế chặn chính |
|---|---|---|---|---|
| 1 | Tự đăng ký với `role='admin'` | — | X | Policy + trigger ép `employee` |
| 2 | `UPDATE profiles SET role` của người khác | OK | X | Trigger (chỉ admin) |
| 3 | Chấm công hộ người khác (`clock_in`) | X | X* | RPC: chỉ chính mình (*H thao tác trực tiếp qua policy HR) |
| 4 | `clock_in` 2 lần/ngày | X | X | RPC báo "đã có bản ghi" |
| 5 | `clock_out` khi chưa `clock_in` | X | X | RPC báo "bấm giờ vào trước" |
| 6 | Sửa `check_in`/`status` trực tiếp | OK | X | Không có policy UPDATE cho E + trigger |
| 7 | Xóa bản ghi chấm công | OK | X | Không có policy DELETE cho E + trigger |
| 8 | Sửa bản ghi đã `confirmed_at` | OK | X | Trigger chặn mọi sửa của E |
| 15 | `confirm_attendance` dòng thiếu giờ vào | X | X | RPC: "thiếu giờ vào" (kể cả HR) |
| 16 | `confirm_attendance` 2 lần cùng dòng | X | X | RPC: "đã xác nhận trước đó" |
| 17 | `clock_out` khi dòng thiếu giờ vào | X | X | RPC yêu cầu liên hệ HR |
| 18 | HR duyệt/từ chối nhưng thiếu `reviewed_by`/`decided_at` | X | X | Trigger ép ghi người + thời điểm duyệt |
| 9 | Tạo đơn nghỉ với `status='approved'` | OK | X | Policy WITH CHECK + trigger |
| 10 | Tự duyệt đơn của mình | X** | X | Trigger: E không đổi status/duyệt |
| 11 | HR duyệt/từ chối đơn pending | OK | — | Policy + trigger cho phép H |
| 12 | Sửa đơn đã duyệt | OK | X | Trigger: E chỉ sửa đơn pending |
| 13 | Xem dữ liệu người khác | OK | X | Policy `own_or_hr` |
| 14 | Đọc/ghi không đăng nhập (anon) | X | X | `REVOKE ALL ... FROM anon`, không policy cho anon |
| 19 | Sửa `note` đã có / ghi `note` > 1000 ký tự | OK | X | Trigger: note chỉ điền 1 lần khi còn trống, tối đa 1000 ký tự |
| 20 | Sửa `created_at` / `confirmed_by` trực tiếp | OK | X | Trigger khóa mọi trường ngoài `check_out` (+`note` 1 lần) |
| 21 | Hai tab bấm `clock_in` cùng lúc (đua bản ghi) | — | 1 OK + 1 X | Unique `(employee_id, work_date)` — bản ghi thứ hai văng lỗi, không trùng dòng |
| 22 | HR chèn profile `role='admin'` | X | — | Policy `profiles_insert_privileged` + trigger (chỉ Admin) |
| 23 | Nhân viên tự chèn profile `role='admin'`/`'hr'` | — | X | Policy self (ép employee + đúng id) + trigger |
| 24 | Nhân viên `UPDATE profiles SET role='hr'` của chính mình | — | X | Trigger `trg_prevent_role_escalation` (chỉ admin đổi role) |
| 25 | Admin cấp `hr`/`employee` cho tài khoản khác | OK | — | `is_admin()` cho qua cả policy lẫn trigger |
| 26 | HR tạo tài khoản `employee` cho nhân viên mới | OK | — | Policy + trigger cho phép đúng phạm vi employee |
| 27 | HR tạo tài khoản `hr` cho người khác | X | — | Ngoài phạm vi HR (chỉ employee) — cần Admin thực hiện |

**HR tự duyệt đơn của chính mình vẫn qua được (thiếu kiểm soát 4-mắt) —
ghi nhận ở mục Giới hạn, xử lý ở Ngày 2+.

### Cách kiểm thử thực tế trên project `Cham_cong`

1. **Chuẩn bị 3 tài khoản:** tạo 3 user trong Authentication → Users
   (admin, hr, nhanvien) → chạy migration → promote admin theo mục 3 →
   admin tạo 2 hồ sơ `employees` gắn `user_id` cho hr và nhanvien.
2. **Test API với từng vai trò:** đăng nhập từng tài khoản trên app (hoặc
   lấy access token) rồi gọi REST/RPC tương ứng từng case #1–#21, ghi lại
   HTTP 200/403-409 và message lỗi tiếng Việt có đúng kỳ vọng không.
3. **Test RPC trực tiếp:** trong SQL Editor không test được quyền user
   (chạy dưới quyền postgres, bypass RLS) — chỉ dùng SQL Editor để kiểm
   đếm đối tượng (mục 5) và tạo Admin; mọi case phân quyền phải test bằng
   token user thật.
4. **Test đồng thời (#21):** mở 2 tab đăng nhập cùng nhân viên, bấm giờ vào
   cùng lúc — 1 tab thành công, tab còn lại phải báo lỗi trùng.

## 7. Chạy lại migration: đối tượng nào đổi, đối tượng nào giữ nguyên

- **Được tạo mới nếu chưa có:** 7 bảng (`IF NOT EXISTS`), 2 cột xác nhận
  (`ADD COLUMN IF NOT EXISTS`), 6 index (`IF NOT EXISTS`).
- **Được cập nhật thật khi chạy lại:** 12 functions (`OR REPLACE` — lưu ý:
  đổi kiểu trả về thì phải `DROP` tay trước), 10 trigger + 21 policy
  (mỗi cái đều `DROP IF EXISTS` rồi tạo mới, gồm cả 5 tên policy v1 đã bỏ),
  default `work_date` (`ALTER ... SET DEFAULT` chạy lại vô hại).
- **KHÔNG tự đổi khi chạy lại:** định nghĩa bảng đã tồn tại (PK/FK/CHECK/
  kiểu cột cũ giữ nguyên) — vì là project mới `Cham_cong` nên bảng được
  tạo đúng ngay lần đầu; nếu sau này đổi constraint phải viết migration mới.

## 8. Giới hạn còn lại (chấp nhận ở v4, xử lý ở các ngày tiếp theo)

- Chưa kiểm soát "4-mắt": HR có thể duyệt đơn nghỉ của chính mình.
- Chưa chặn admin cuối cùng tự hạ quyền (nguy cơ khóa quản trị).
- `status` chấm công (`di-muon`...) do HR nhập tay/RPC mặc định
  `dung-gio`; logic đi muộn theo ca làm việc làm ở Ngày 2.
- Chưa có audit log ai sửa/xóa bản ghi (chỉ có `confirmed_by`).
- Chưa rate-limit RPC `clock_in/clock_out` (chống spam bấm giờ; unique
  constraint chỉ chống trùng dòng, không chống gọi lặp vô ích).
- File mới chỉ validate **cú pháp** bằng parser libpg_query (135
  statements hợp lệ); hành vi RLS/RPC phải kiểm chứng trên project thật
  theo ma trận mục 6.

## 9. Cấu hình Vercel (khi deploy)

Project → Settings → Environment Variables, thêm 2 biến cho cả 3 môi
trường (Production, Preview, Development):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Lưu và **Redeploy** để biến có hiệu lực. Chi tiết xem README.md.
