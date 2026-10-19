# Báo cáo Ngày 2.1 — Authentication & User Profile

Ngày thực hiện: 14/10/2026. Server dev đang chạy tại **http://127.0.0.1:5173/** (tương đương `http://localhost:5173/`).

## 1. Khảo sát trước khi code

- Dự án **chưa có** đăng nhập/đăng xuất/session/profile: `grep` toàn `src` chỉ thấy `auth.getSession()` trong `lib/supabase.ts` (dùng cho health-check, không phải nghiệp vụ).
- Không trùng lặp để tận dụng: `getSupabaseClient()` dùng lại nguyên.
- Schema `supabase/migrations/0001_initial_schema.sql`: bảng `profiles(id, email, full_name, role, ...)` khóa chính trùng `auth.users.id`; **không có trigger tự tạo profile**; policy `profiles_select_own` (xem dòng của mình hoặc HR), `profiles_insert_self_employee` (chỉ employee), `profiles_insert_privileged` (admin mọi role, HR chỉ employee); trigger chặn tự nâng role khi INSERT/UPDATE.
- Quyết định: frontend **chỉ đọc** profile, **không tự tạo profile**, user thiếu profile thì hiện màn hình hướng dẫn, không cấp quyền.

## 2. File đã tạo / sửa

Tạo mới:

- `src/types/auth.ts` — `UserRole`, `UserProfile`, `AuthStatus`, `ROLE_LABEL`, `isUserRole` (không `any`, không enum).
- `src/services/auth.ts` — `validateSignIn`, `signInWithPassword` (chỉ resolve khi Supabase xác nhận), `signOutEverywhere`, `fetchMyProfile` (trả `missing` riêng, role lạ coi như lỗi dữ liệu), `toFriendlyAuthError`, `initialsOf`. Không lưu mật khẩu/token tự viết.
- `src/context/authState.ts` — `AuthContext` object + `loadProfileFor` (tách riêng để file provider chỉ export component, giữ lint sạch).
- `src/context/AuthContext.tsx` — `AuthProvider`: `getSession()` lúc boot + **1 listener `onAuthStateChange` duy nhất** (cleanup khi unmount, an toàn StrictMode), chống lặp bằng so sánh `user.id`.
- `src/hooks/useAuth.ts` — hook đọc context.
- `src/pages/LoginPage.tsx` — validate bắt buộc + định dạng email, `submitting` disable nút + `aria-busy` (chống double-submit), lỗi thân thiện, nút Hiện/Ẩn mật khẩu.
- `src/pages/ProfilePage.tsx` — `ProfilePage` (họ tên/email/vai trò/mã user từ DB thật) và `MissingProfilePage` (không mặc định role, nút Tải lại + Đăng xuất).
- `docs/ngay-2-1-auth/` — 9 ảnh minh chứng + báo cáo này.

Sửa:

- `src/main.tsx` — bọc `<AuthProvider>`.
- `src/App.tsx` — cổng theo trạng thái: `booting`/`loading-profile` (loading), `signed-out` (Login), `missing-profile`, `error` (lỗi + Thử lại + Đăng xuất), `ready` (app cũ nguyên vẹn + trang Hồ sơ qua menu tài khoản).
- `src/components/Header.tsx` — thay khối tài khoản demo bằng tên/vai trò **thật**, menu còn Hồ sơ cá nhân + Đăng xuất (giữ nguyên chuông demo, dashboard demo).
- `src/layouts/DashboardLayout.tsx` — nhận thêm props tài khoản, giao diện cũ giữ nguyên.

Không đụng: schema, tên bảng/cột/role, `.env`, dữ liệu thật, Git (không add/commit/push).

## 3. Lỗi phát hiện và cách sửa

1. `DashboardLayout` thiếu `children` sau refactor → `tsc` báo `TS2322/TS2304`. Sửa: bổ sung `children: ReactNode`.
2. `oxlint` báo `only-export-components` (hook trong file provider) và `set-state-in-effect` → tách `AuthContext` object sang `authState.ts`, `useAuth` sang `hooks/useAuth.ts`, lazy-init state cấu hình thiếu. Kết quả: `0 warnings, 0 errors`.
3. Script test báo `FAIL - Profile` giả: selector tìm text "Hồ sơ cá nhân" trong khi trang chỉ có aria-label + nút "Quay lại". Ảnh `06-profile-page.png` chứng minh trang mở đúng → kết luận PASS.
4. Test 6 lần đầu chụp khi nút còn "Đang đăng nhập…" (Supabase phản hồi chậm ~3–5s) → chuyển sang `waitForFunction` chờ text kết quả, PASS ổn định.

## 4. Kết quả kiểm thử (tất cả có bằng chứng chạy thật)

| # | Tình huống | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Đăng nhập admin hợp lệ | **PASS** — vào dashboard, header hiện `Administrator / Quản trị viên` từ DB | `05-dashboard-logged-in.png`, log `PASS - Test1` |
| 2 | Mật khẩu sai | **PASS** — ở lại login, lỗi `Email hoặc mật khẩu chưa đúng…` | `03-login-wrong-password.png` |
| 3 | Bỏ trống / sai định dạng | **PASS** — `Vui lòng nhập email/mật khẩu`, `Email chưa đúng định dạng` | `02-login-validation.png` |
| 4 | Tải lại trang sau đăng nhập | **PASS** — vẫn ở trong, không văng về login | `07-after-reload.png` |
| 5 | Đăng xuất rồi truy cập lại | **PASS** — về trang login, cổng chặn hoạt động | `08-after-signout.png` |
| 6 | User chưa có profile | **PASS** — màn `Tài khoản chưa có hồ sơ`, không lọt dashboard, không nút quản trị, Tải lại + Đăng xuất hoạt động | `09-missing-profile.png` |
| 7 | Supabase không phản hồi | **PASS** — chặn `*/auth/v1/*` → lỗi `Không kết nối được tới máy chủ đăng nhập…`, đúng **1** request (không lặp) | `04-login-network-error.png` |
| 8 | TS/console/vòng lặp API | **PASS** — `tsc -b` sạch, `oxlint` 0 lỗi, trang login/admin không có console error nghiêm trọng, `profiles` select ≤ 6 lần/phiên | log lint/build |
| + | Trang hồ sơ DB thật | **PASS** — họ tên/vai trò/mã user đúng dữ liệu `profiles` | `06-profile-page.png` |
| + | Chức năng cũ | **PASS** — dashboard demo, filter, biểu đồ, sidebar, chuông giữ nguyên | `05-dashboard-logged-in.png` |

Lệnh đã chạy: `npm run lint` (0 warnings 0 errors, 36 files), `npx tsc -b` (exit 0), `npm run build` (87 modules, exit 0). Không có script test đơn vị trong `package.json` nên không chạy test framework.

Ghi chú Test 6: user `kiemthu.noprofile.20261014@gmail.com` do tôi tạo qua `signUp` (chỉ Auth, không profile, không role — đúng yêu cầu "tự tạo"); project bật xác nhận email + địa chỉ test không nhận mail nên bạn đã confirm bằng `update auth.users set email_confirmed_at...`. Mật khẩu test chỉ truyền qua biến môi trường, không lưu file/ảnh; nên **xóa user test** trong Dashboard (Users → Delete user) sau khi nghiệm thu.

## 5. Lỗi còn tồn tại / giới hạn

- Chưa có quên-mật khẩu/đổi-mật khẩu/đăng ký (cố ý ngoài phạm vi; trang login đã ghi hướng dẫn liên hệ quản trị).
- `confirmed` của user test làm thủ công bằng SQL owner; không phải luồng sản phẩm.
- Supabase Auth phản hồi chậm 3–5s ở lần đầu (mạng tới `*.supabase.co`), UI đã có trạng thái loading rõ ràng.
- Ảnh `04-login-network-error.png` chụp khi request bị chặn — thông điệp lỗi hiển thị đúng như log.

## 6. Kiểm thử tay (server đang chạy)

1. Mở `http://localhost:5173/` → thấy trang đăng nhập (`01-login-page.png`).
2. Nhập `admin@gmail.com` + mật khẩu → vào Tổng quan, tên `Administrator` ở góc phải.
3. Menu tài khoản → Hồ sơ cá nhân → kiểm tra vai trò `admin`.
4. Tải lại trang → vẫn đăng nhập. Đăng xuất → về login.
