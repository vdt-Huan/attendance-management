# Báo cáo Ngày 2.2 — Role-Based Access Control (RBAC)

Ngày thực hiện: 14/10/2026. Server dev đang chạy tại **http://127.0.0.1:5173/** (giữ hoạt động, không tắt).
Checkpoint: **localhost-ready**. Không add/commit/push Git, không triển khai production, không tạo Admin, không đổi role tài khoản thật.

## 1. Khảo sát trước khi sửa (bằng chứng thật)

- Schema đọc từ `supabase/migrations/0001_initial_schema.sql` (873 dòng, chưa áp dụng thủ công ngoài file này):
  - Role duy nhất trong DB là chữ thường: `check (role in ('admin', 'hr', 'employee'))` (dòng 55). Frontend dùng đúng 3 giá trị này (`src/types/auth.ts`), không chuẩn hoá hoa/thường.
  - Hàm phân quyền tồn tại: `public.is_hr()` (admin HOẶC hr, dòng 231) và `public.is_admin()` (chỉ admin, dòng 248). Không tạo hàm trùng tên.
  - Trigger tồn tại: `trg_prevent_role_escalation` (chặn đổi role khi UPDATE trừ admin), `trg_enforce_profile_insert_role` (admin cấp mọi role; HR chỉ cấp `employee`; người thường chỉ tự tạo `employee`), `trg_enforce_leave_insert/update/delete`, `trg_enforce_attendance_write`, `trg_touch_*`. Không tạo trigger trùng.
  - Policy RLS đã đọc toàn bộ mục 13 (dòng 647–825). Không có `USING (true)` cho dữ liệu nhạy cảm (profiles/employees/attendance/leave/assignments đều `own-or-HR`). Hai ngoại lệ `USING (true)` là `departments_select_auth` và `shifts_select_auth` cho vai trò **authenticated** — đây là master data ít nhạy cảm, cần đọc để đổ dropdown; chấp nhận được, không nới rộng.
  - Router hiện tại: **không dùng react-router**, `src/App.tsx` dùng `useState<PageKey>` + `NAV_ITEMS` (8 mục). Lỗ hổng UI trước khi sửa: `Sidebar` hiện **tất cả** mục cho mọi role, không có guard — đã sửa.
  - `ProfilePage` chỉ đọc (read-only), không có form sửa `role`/`id`/email — đạt yêu cầu "không cho tự sửa role qua form profile".
  - Quét `service_role`: toàn repo chỉ có 1 dòng comment cảnh báo trong `src/lib/supabase.ts` (dòng 7); `getSupabaseClient()` chỉ dùng `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`. Bundle `dist` sau build chứa `role-banner` + `access-denied`, không chứa `service_role`/`sb_secret`.

## 2. File đã tạo / sửa

Tạo mới:

- `src/types/rbac.ts` — `PAGE_ACCESS` (ma trận trang ↔ vai trò), `PAGE_LABEL`, `canAccessPage()`, `getVisiblePageKeys()`, `isHrOrAdmin()`, `isAdmin()`. Nguồn role là chữ thường đúng CHECK constraint.
- `src/components/AccessDenied.tsx` — màn hình 403 (`data-testid="access-denied"`): nêu trang yêu cầu, vai trò hiện tại, vai trò cần, nút về Tổng quan. Phân biệt với đang-tải/chưa-login/lỗi-profile.
- `src/components/RequireRole.tsx` — component bảo vệ route dùng chung (guard khi `status === "ready"`; các trạng thái khác do cổng `App.tsx` xử lý).

Sửa:

- `src/components/navigation.ts` — thêm `allowedRoles` cho từng `NavItem` (đồng bộ `PAGE_ACCESS`), thêm `PAGE_KEYS`, `isPageKey()`, `pageKeyFromHash()` (hash `#/key`).
- `src/components/Sidebar.tsx` — nhận thêm `role`, lọc menu (`allowedRoles.includes(role)`). Kết quả: admin thấy 8 mục, HR 7 mục (thiếu Cài đặt), employee 4 mục (Tổng quan, Chấm công, Lịch sử, Nghỉ phép).
- `src/layouts/DashboardLayout.tsx` — nhận thêm `role`, truyền xuống `Sidebar`.
- `src/App.tsx` — hash routing (đọc hash lúc khởi tạo + listener `hashchange`, ghi hash khi navigate) để hỗ trợ tải trực tiếp URL / refresh / back-forward; guard `canAccessPage()` → render `AccessDenied` khi thiếu quyền; thêm `role-banner` phân biệt chế độ quản trị/nhân sự/nhân viên. Cổng trạng thái cũ giữ nguyên: `booting` / `loading-profile` (đang tải), `signed-out` (LoginPage), `missing-profile`, `error` (Thử lại + Đăng xuất), `ready`.

Ma trận `PAGE_ACCESS`:

| Trang | admin | hr | employee | Lý do (ánh xạ RLS) |
|---|---|---|---|---|
| Tổng quan | ✅ | ✅ | ✅ | dashboard cá nhân theo vai trò |
| Chấm công | ✅ | ✅ | ✅ | tự chấm công (RPC `clock_in/out` siết chủ sở hữu) |
| Lịch sử chấm công | ✅ | ✅ | ✅ | RLS `attendance_select_own_or_hr` |
| Nhân viên | ✅ | ✅ | ❌ | `employees_write_hr` — chỉ HR/Admin |
| Ca làm việc | ✅ | ✅ | ❌ | `shifts_write_hr` — trang quản lý ca; lịch cá nhân xem ở Tổng quan/Lịch sử |
| Nghỉ phép | ✅ | ✅ | ✅ | RLS `leave_*_own_or_hr` + trigger ép pending/duyệt |
| Báo cáo | ✅ | ✅ | ❌ | tổng hợp — chỉ HR/Admin |
| Cài đặt | ✅ | ❌ | ❌ | quản lý quyền/cấu hình — **chỉ admin** (phân biệt HR không tự nâng quyền) |

Không đụng: migration SQL, `.env`, dữ liệu thật, lịch sử Git.

## 3. Rà soát RLS theo từng bảng × vai trò (không sửa policy)

Kết luận: **không cần sửa policy nào**. Mọi policy hiện tại đã đủ chặn trái quyền; sửa rộng hơn sẽ vi phạm yêu cầu. Chi tiết:

| Bảng | SELECT | INSERT | UPDATE | DELETE | Ghi chú |
|---|---|---|---|---|---|
| `profiles` | own hoặc HR (`profiles_select_own`) | self-employee (`id=uid, role=employee`) hoặc privileged (admin mọi role; HR chỉ employee) | own hoặc HR, **trigger chặn đổi role trừ admin** | chỉ HR | anon: `permission denied` (đã test) |
| `departments` | mọi authenticated (`USING (true)` — master data, chấp nhận) | chỉ HR | chỉ HR | chỉ HR | anon bị revoke (đã test) |
| `employees` | own (`user_id=uid`) hoặc HR | chỉ HR | chỉ HR | chỉ HR | employee không ghi — chống tự sửa liên kết `user_id` |
| `work_shifts` | mọi authenticated (`USING (true)` — master data, chấp nhận) | chỉ HR | chỉ HR | chỉ HR | — |
| `shift_assignments` | own (qua `employees.user_id`) hoặc HR | chỉ HR | chỉ HR | chỉ HR | — |
| `attendance_records` | own (qua `employees.user_id`) hoặc HR | **chỉ HR trực tiếp**; nhân viên qua RPC `clock_in/out` (trigger siết giờ VN, 1 dòng/ngày, không sửa khi đã xác nhận) | chỉ HR trực tiếp; nhân viên chỉ set `check_out` 1 lần qua trigger | chỉ HR | anon RPC bị `permission denied` (đã test) |
| `leave_requests` | own hoặc HR | own-pending (`status=pending`, `reviewed_by/decided_at=null`) hoặc HR | own-pending + trigger cấm đổi `employee_id`/`status`/`reviewed_by`/`decided_at`, hoặc HR | own-pending hoặc HR | — |

Tự sửa `role`/`id`/email/liên kết nhân viên:

- `role`: employee/HR đổi role của chính mình → trigger `trg_prevent_role_escalation` ném `Không được phép tự thay đổi vai trò (role).`; INSERT role trái phép → trigger `trg_enforce_profile_insert_role` chặn. Frontend không có form sửa role.
- `id`: PK = `auth.users.id`; policy update yêu cầu `id = auth.uid()` (tự mình) nên UPDATE dòng người khác rớt `USING` → 0 dòng/không lọt.
- email: employee được UPDATE email **của chính mình** ở tầng policy (giữ tương thích hiển thị), nhưng không đổi được email đăng nhập (`auth.users`) và không leo quyền; frontend không cho sửa — rủi ro thấp, cố ý không siết thêm để tránh vỡ luồng hiện có.
- Liên kết nhân viên (`employees.user_id`): chỉ HR ghi (`employees_write_hr`), employee không UPDATE — chống tự gán/giành hồ sơ.

Vì không sửa policy nên không có cặp "policy cũ → policy mới"; lý do: mọi kiểm tra khả thi (8/8 anon) đều PASS, policy đã qua 5 vòng rà soát ở migration v6.

## 4. Lệnh đã chạy

- `npm run lint` → 0 warnings, 0 errors (39 files).
- `npx tsc -b` → exit 0.
- `npm run build` → exit 0 (89 modules; `dist/assets/index-*.js` chứa `role-banner` + `access-denied`).
- Không có test framework trong `package.json` nên chạy kiểm thử RLS trực tiếp bằng script tạm (đã xóa sau khi chạy, không commit).

## 5. Ma trận kiểm thử (10 mục theo yêu cầu — TẤT CẢ PASS, đều có bằng chứng)

Tài khoản test (do bạn tạo trong Dashboard theo ủy quyền, sẽ xóa sau nghiệm thu):
`rbac.hr.20261014@gmail.com` (role `hr`, mã `TEST-HR-01`),
`rbac.employee.20261014@gmail.com` (role `employee`, mã `TEST-EMP-01`).
Đăng nhập API trực tiếp dùng publishable key + session từng tài khoản (không service_role);
mật khẩu chỉ truyền qua biến môi trường, không lưu file/ảnh. Không tạo Admin mới, không đổi
role tài khoản thật. Lần signUp đầu qua API bị Supabase rate-limit mail nên chuyển sang tạo
trong Dashboard (Auto Confirm) — cùng kết quả, không ảnh hưởng tính khách quan của test.

| Mã | Vai trò | Thao tác | Mong đợi | Thực tế / Bằng chứng | Kết quả |
|---|---|---|---|---|---|
| RBAC-01 | chưa đăng nhập | mở `/` và `/#/employees` | về trang Đăng nhập, không lọt nội dung riêng tư | Playwright mở thật cả 2 URL đều hiện "Đăng nhập"; `01-login-unauth.png`, `02-unauth-hash-employees.png` | **PASS** |
| RBAC-02 | employee | truy cập route Admin (Nhân viên/Báo cáo/Cài đặt) | menu ẩn mục nhạy cảm; đoán hash thì màn "Không đủ quyền" | Login thật employee: menu đếm được **4 mục** (`05-menu-employee.png`); mở `#/employees` → 403 "Trang Nhân viên yêu cầu vai trò Quản trị viên, Nhân sự (HR)" (`06-forbidden-employee.png`). Guard logic 15/15 assert PASS | **PASS** |
| RBAC-03 | employee | đọc profile người khác (`SELECT profiles` toàn bảng) | RLS chỉ trả dòng của mình | API trực tiếp với session employee: `SELECT id FROM profiles` → đúng **1 dòng = id của mình** | **PASS** |
| RBAC-04 | employee | tự sửa `role` thành `admin` | trigger chặn, role không đổi | API trực tiếp: `UPDATE profiles SET role='admin'` → lỗi `Không được phép tự thay đổi vai trò (role).`; SELECT lại role vẫn `employee` | **PASS** |
| RBAC-05 | hr | tự nâng thành `admin` + chèn profile `admin` | trigger + policy chặn | API trực tiếp: UPDATE role → lỗi trigger như trên, role vẫn `hr`; INSERT profile ma role=`admin` → lỗi `Chỉ Admin được cấp vai trò HR/Admin. HR chỉ được tạo tài khoản employee.` (không tạo rác) | **PASS** |
| RBAC-06 | admin | truy cập trang quản trị | vào được mọi trang, menu đủ 8 mục, banner quản trị | Login thật `admin@gmail.com`: menu đếm được **8 mục**, banner "Chế độ quản trị" (`07-menu-admin.png`, `08-dashboard-admin.png`); mở `#/overview` không bị 403 (đúng vì admin được phép) | **PASS** |
| RBAC-07 | HR đã login | tải trực tiếp URL không phép (`/#/settings`) | 403, không lộ nội dung; unauth → login | Login thật HR: menu **7 mục** (`03-menu-hr.png`); mở `#/settings` → 403 (`04-forbidden-hr-settings.png`). Unauth: về login (RBAC-01) | **PASS** |
| RBAC-08 | employee đã login | refresh trang ở `#/history` | ở đúng trang, vẫn đăng nhập | Playwright: sau reload vẫn thấy banner + heading "Lịch sử chấm công", hash giữ `#/history` (`09-refresh-employee.png`) | **PASS** |
| RBAC-09 | mất/hết session | xóa session rồi reload | về Đăng nhập, không kẹt 403 | Playwright: `localStorage.clear()` + reload → hiện "Đăng nhập để quản lý chấm công" (`10-session-expired.png`). Thông điệp "Phiên đăng nhập đã hết hạn…" phủ trường hợp token hết hạn trong `fetchMyProfile` | **PASS** |
| RBAC-10 | API trực tiếp | gọi Supabase API trái quyền | RLS/revoke từ chối tất cả; đọc hợp lệ vẫn qua | Anon 8/8 PASS (SELECT/INSERT/RPC đều `permission denied`, báo cáo trước). Session employee/HR 8/8 PASS: EMP SELECT employees chỉ 1 dòng của mình; HR SELECT employees thấy 2 dòng; EMP INSERT attendance trực tiếp → `violates row-level security policy`; EMP `clock_in` hộ HR → `Chỉ được chấm công cho chính mình.` (không tạo dữ liệu); HR SELECT attendance được phép (0 dòng); EMP DELETE attendance → 0 dòng bị ảnh hưởng, kiểm tra lại sau đó bảng vẫn 0 dòng (ngữ nghĩa RLS DELETE: `USING` sai → không thấy dòng → không xóa, không lỗi — đúng thiết kế) | **PASS** |

## 6. Việc còn tồn tại

1. **Xóa 2 tài khoản test sau nghiệm thu** (Supabase Dashboard → Authentication → Users → Delete):
   `rbac.hr.20261014@gmail.com`, `rbac.employee.20261014@gmail.com` (kèm dòng `profiles`/`employees`
   `TEST-HR-01`/`TEST-EMP-01` và phòng ban `Kiem Thu RBAC` nếu không dùng tiếp).
2. Dashboard/báo cáo vẫn là dữ liệu demo (giữ từ Ngày 2.1); các trang Nhân sự/Ca/Nghỉ phép/Báo cáo/Cài đặt
   còn placeholder — nghiệp vụ thật ở prompt sau, guard đã sẵn sàng.
3. Độ trễ Auth 3–5s ở lần đăng nhập đầu kế thừa từ Ngày 2.1 (UI đã có trạng thái loading rõ ràng).

Bằng chứng trong repo (`docs/ngay-2-2-rbac/`): `01-login-unauth.png`, `02-unauth-hash-employees.png`,
`03-menu-hr.png`, `04-forbidden-hr-settings.png`, `05-menu-employee.png`, `06-forbidden-employee.png`,
`07-menu-admin.png`, `07b-admin-overview-check.png`, `08-dashboard-admin.png`,
`09-refresh-employee.png`, `10-session-expired.png`, báo cáo này.
