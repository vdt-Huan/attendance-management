# Attendance Management

Hệ thống quản lý chấm công nhân viên (tiếng Việt, múi giờ Asia/Ho_Chi_Minh).

## Mục tiêu dự án

Website quản lý chấm công cho công ty với phân quyền 3 cấp: **Admin / HR / Employee**. Dữ liệu lưu trên Supabase (PostgreSQL) với Row Level Security (RLS) — bảo mật thật nằm ở database, không chỉ ẩn nút trên giao diện.

## Công nghệ sử dụng

- **Frontend:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS 4 (qua `@tailwindcss/vite`)
- **Backend:** Supabase (PostgreSQL + RLS + RPC SECURITY DEFINER)
- **Auth:** Supabase Auth (email/password)
- **Lint:** oxlint (116 rules)
- **Triển khai:** Vercel (đã deploy tại `https://attendance-management-9ev3m2h4x-syn-group1.vercel.app`)

## Yêu cầu môi trường

- Node.js >= 20 (đã test với Node 24)
- npm >= 10
- Git (không bắt buộc để chạy)
- Tài khoản Supabase (project mới)

## Hướng dẫn cài đặt

```bash
# 1. Clone hoặc copy dự án
cd Attendance_management

# 2. Cài dependency
npm install

# 3. Cấu hình biến môi trường
cp .env.example .env
# Mở .env và điền VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
# của ĐÚNG project Supabase Attendance Management

# 4. Chạy localhost
npm run dev
# Mở trình duyệt tại http://localhost:5173
```

## Các script kiểm tra thực tế

```bash
npm run dev              # Chạy dev server (Vite)
npm run build            # Typecheck (tsc -b) + build production (vite build)
npm run lint             # Lint (oxlint) — 0 errors, warnings set-state-in-effect (pattern có sẵn)
npm run check:supabase   # Kiểm tra kết nối Supabase an toàn (không đọc/ghi dữ liệu)
npm run preview          # Preview bản build production
```

## Cấu hình biến môi trường

Chỉ ghi tên biến, không ghi giá trị bí mật:

| Biến | Mô tả |
|---|---|
| `VITE_SUPABASE_URL` | URL project Supabase (https://xxx.supabase.co) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (anon) của project |

**Quan trọng:**
- Chỉ dùng publishable key — KHÔNG dùng `service_role` / secret key trong frontend.
- Không commit file `.env` lên Git (`.gitignore` đã chặn).

## Kết nối Supabase

1. Tạo project mới trên Supabase Dashboard.
2. Vào Project Settings → Data API / API Keys → copy Project URL và publishable key.
3. Điền vào `.env`.
4. Chạy `npm run check:supabase` để xác nhận kết nối.

## Áp dụng migration theo thứ tự

1. Mở Supabase Dashboard → SQL Editor → New query.
2. Sao chép toàn bộ nội dung `supabase/migrations/0001_initial_schema.sql`.
3. Dán vào query editor, kiểm tra project trên thanh điều hướng, nhấn Run.
4. Kiểm tra: Table Editor phải có 7 bảng (profiles, departments, employees, work_shifts, shift_assignments, attendance_records, leave_requests).
5. Kiểm tra RLS: mọi bảng phải có RLS enabled + policies tương ứng.

**Tạo Admin đầu tiên (bắt buộc, thủ công):**
1. Đăng ký tài khoản trên app (hoặc tạo user trong Authentication → Users).
2. Chạy SQL trong SQL Editor (thay email thật):

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
```

Lưu ý: Schema không cho phép tự nâng quyền — trigger `trg_prevent_role_escalation` chặn mọi thay đổi role trừ Admin.

## Lưu ý về RLS và phân quyền

- **RLS bật trên tất cả 7 bảng** — không tắt RLS.
- **3 vai trò:** admin, hr, employee (CHECK constraint trong DB).
- **Admin:** toàn quyền (tạo Admin/HR, quản lý tất cả).
- **HR:** quản lý nhân viên/phòng ban/ca/lịch, duyệt nghỉ phép, KHÔNG tạo HR/Admin khác.
- **Employee:** chỉ xem dữ liệu của chính mình (chấm công, lịch, đơn nghỉ).
- **RPC chấm công:** `clock_in`/`clock_out` SECURITY DEFINER — bypass RLS nhưng kiểm tra `user_id = auth.uid()` → nhân viên chỉ chấm công cho chính mình.
- **Trigger bảo vệ:** enforce_leave_insert/update/delete, enforce_attendance_write, prevent_profile_role_escalation, enforce_profile_insert_role.

## Cấu trúc thư mục

```text
src/
  components/     Component dùng chung (Modal, Toast, icons, ...)
  context/        AuthContext + authState
  hooks/          Custom hooks (useAuth, useEmployees, useSchedule, ...)
  layouts/        DashboardLayout
  lib/            Supabase client, constants, timezone
  pages/          Trang chính (Dashboard, Employees, Departments, WorkShifts, Schedule, Checkin, History, Leave, Profile, Login)
  services/       Tầng gọi Supabase (auth, employees, departments, workShifts, schedule, checkin, attendanceHistory, leave, dashboard)
  types/          Kiểu dữ liệu (auth, rbac, employees)
supabase/
  migrations/     0001_initial_schema.sql (7 bảng + RLS + RPC + trigger)
  README.md       Hướng dẫn áp dụng migration
docs/
  screenshots/    Ảnh chụp màn hình
  audit-7-1.md    Báo cáo audit
  bao-cao-giam-doc.md  Báo cáo gửi giám đốc
```

## Danh sách chức năng đã triển khai

| # | Module | Trạng thái |
|---|---|---|
| 1 | Đăng nhập / Đăng xuất / Session | ✅ Hoàn tất |
| 2 | Phân quyền Admin/HR/Employee | ✅ Hoàn tất |
| 3 | Quản lý Nhân viên (CRUD + lọc + tìm kiếm + phân trang) | ✅ Hoàn tất |
| 4 | Quản lý Phòng ban (CRUD + chặn xóa khi còn NV) | ✅ Hoàn tất |
| 5 | Quản lý Ca làm việc (CRUD + ca qua đêm) | ✅ Hoàn tất |
| 6 | Lịch làm việc & Phân công ca (tuần + CRUD) | ✅ Hoàn tất |
| 7 | Chấm công (Check-in/Check-out qua RPC) | ✅ Hoàn tất |
| 8 | Lịch sử chấm công & Tổng hợp | ✅ Hoàn tất |
| 9 | Đơn nghỉ phép (gửi + duyệt/từ chối) | ✅ Hoàn tất |
| 10 | Dashboard KPI thật | ✅ Hoàn tất |
| 11 | Export CSV (chống formula injection) | ✅ Hoàn tất |
| 12 | Báo cáo tổng hợp | ✅ Hoàn tất (ReportPage + tổng hợp + CSV) |
| 13 | Cài đặt | ❌ Chưa triển khai (placeholder) |

## Triển khai Vercel

1. Cài Vercel CLI: `npm i -g vercel`
2. Đăng nhập: `vercel login`
3. Trong thư mục dự án: `vercel --prod`
4. Thêm biến môi trường trên Vercel Dashboard (Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   (cho cả Production, Preview, Development)
5. Redeploy sau khi thêm env vars.
6. URL production: `https://attendance-management-9ev3m2h4x-syn-group1.vercel.app`

### Checklist xác minh sau deploy

- [ ] Mở URL production → trang đăng nhập hiển thị.
- [ ] Đăng nhập Admin → Dashboard KPI hiển thị đúng.
- [ ] Đăng nhập Employee → chỉ thấy dữ liệu của mình.
- [ ] Refresh trực tiếp URL con (vd: `#/employees`) → không lỗi 404.
- [ ] Kiểm tra Console → không có lỗi đỏ.
- [ ] Kiểm tra Network → request tới Supabase thành công (200).

## Hướng dẫn kiểm tra ứng dụng

1. Chạy `npm run dev` → mở `http://localhost:5173`.
2. Đăng nhập bằng tài khoản Admin (tạo theo hướng dẫn migration).
3. Kiểm tra Dashboard → KPI phải khớp với dữ liệu trong DB.
4. Vào Nhân viên → thêm/sửa/xóa → kiểm tra trong Supabase Table Editor.
5. Vào Phòng ban → tạo phòng ban → gán NV → thử xóa phòng ban đang dùng.
6. Vào Ca làm việc → tạo ca (thử ca qua đêm 22:00–06:00).
7. Vào Lịch làm việc → phân công ca cho NV.
8. Đăng nhập Employee → Chấm công → Check-in → Check-out.
9. Xem Lịch sử chấm công → đối chiếu giờ.
10. Employee gửi đơn nghỉ phép → HR duyệt/từ chối.
11. Kiểm tra Export CSV tiếng Việt.

## Lỗi còn tồn tại

1. **22 warnings `set-state-in-effect`** — pattern có sẵn, không chặn build.
2. **Bundle size > 500KB** — do Supabase SDK, có thể code-split sau.
3. **Không có unit/integration tests** — chưa có test framework.
4. **Tự động đánh dấu đi muộn/về sớm** — chưa triển khai (cần confirm quy tắc).
5. **Lý do từ chối đơn nghỉ phép** — schema không có cột → chỉ ghi nhận trạng thái.
6. **Loại nghỉ phép** — schema không có cột `leave_type`.
7. **Audit trail** — schema chưa có bảng audit chi tiết.
8. **GPS/selfie/IP cho chấm công** — schema không hỗ trợ.

## Tài liệu liên quan

- `supabase/README.md` — Hướng dẫn áp dụng migration.
- `supabase/migrations/0001_initial_schema.sql` — Schema SQL (7 bảng + RLS + RPC + trigger).
- `docs/audit-7-1.md` — Báo cáo audit toàn bộ.
- `docs/bao-cao-giam-doc.md` — Báo cáo gửi giám đốc.
- `docs/screenshots/` — Ảnh chụp màn hình minh chứng.