# BÁO CÁO AUDIT TOÀN BỘ — NGÀY 7.1
## Attendance Management — Kiểm thử end-to-end & bảo mật

**Dự án:** Attendance Management  
**Ngày audit:** 17/10/2026  
**Phạm vi:** Ngày 1 → Ngày 6.2 (toàn bộ chức năng đã xây dựng)  
**Môi trường:** Localhost `http://localhost:5173/` + Supabase project `hvslmudmadrsgyssnqlh.supabase.co`  
**Trạng thái:** Checkpoint localhost-ready — chưa deploy production, chưa commit Git

---

## 1. KIỂM KÊ DỰ ÁN

### 1.1. Cấu trúc & Công nghệ
| Thành phần | Chi tiết |
|---|---|
| Frontend | Vite 8 + React 19 + TypeScript ~6.0 |
| Styling | Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL + RLS + RPC SECURITY DEFINER) |
| Auth | Supabase Auth (email/password) |
| Lint | oxlint (116 rules, 16 threads) |
| Build | `tsc -b && vite build` |
| Scripts | `dev`, `build`, `lint`, `check:supabase`, `preview` |
| Không có | unit/integration tests (không có test framework trong package.json) |

### 1.2. Trang đã xây dựng (10 trang)
| Route | Trang | Kết nối Supabase thật? |
|---|---|---|
| `#/overview` | DashboardPage | ✅ KPI thật (count exact) |
| `#/checkin` | CheckinPage | ✅ RPC clock_in/clock_out |
| `#/history` | HistoryPage | ✅ listAttendanceRecords |
| `#/employees` | EmployeesPage | ✅ CRUD employees + departments |
| `#/departments` | DepartmentsPage | ✅ CRUD departments |
| `#/shifts` | WorkShiftsPage | ✅ CRUD work_shifts |
| `#/schedule` | SchedulePage | ✅ CRUD shift_assignments |
| `#/leave` | LeavePage | ✅ CRUD leave_requests |
| `#/report` | PlaceholderPage | ❌ Chưa triển khai (placeholder) |
| `#/settings` | PlaceholderPage | ❌ Chưa triển khai (placeholder) |
| `#/profile` | ProfilePage | ✅ profiles + auth.users |

### 1.3. Supabase Schema (7 bảng, tất cả RLS bật)
| Bảng | RLS | Policies | Trigger |
|---|---|---|---|
| profiles | ✅ | SELECT/INSERT/UPDATE/DELETE | role escalation, touch_updated_at |
| departments | ✅ | SELECT (auth), ALL (is_hr) | — |
| employees | ✅ | SELECT (own-or-hr), ALL (is_hr) | touch_updated_at |
| work_shifts | ✅ | SELECT (auth), ALL (is_hr) | — |
| shift_assignments | ✅ | SELECT (own-or-hr), ALL (is_hr) | — |
| attendance_records | ✅ | SELECT (own-or-hr), INSERT/UPDATE/DELETE (is_hr) | enforce_attendance_write |
| leave_requests | ✅ | SELECT/INSERT/UPDATE/DELETE (own-or-hr) | enforce_leave_insert/update/delete |

### 1.4. RPC Functions (SECURITY DEFINER)
| RPC | Quyền | Kiểm tra |
|---|---|---|
| clock_in(p_employee_id, p_note) | authenticated | user_id = auth.uid(), is_active, trùng ngày |
| clock_out(p_employee_id, p_note) | authenticated | user_id = auth.uid(), check_in tồn tại, chưa check-out, chưa confirmed |
| confirm_attendance(p_record_id) | authenticated (is_hr) | is_hr(), check_in tồn tại, chưa confirmed |
| vn_today() | authenticated | trả ngày VN |
| is_hr() / is_admin() | authenticated | security definer |

### 1.5. Biến môi trường
- `.env.example` có `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `.env` đã cấu hình (không commit — `.gitignore` chặn).
- Không có service-role key trong frontend (scan chỉ còn comment cấm).

---

## 2. BẢNG KIỂM KÊ CHỨC NĂNG

| # | Module | Chức năng | Trạng thái | Bằng chứng | Lỗi/phần thiếu | Mức ưu tiên |
|---|---|---|---|---|---|---|
| 1 | Auth | Đăng nhập email/password | PASS (code) | signInWithPassword → Supabase Auth | Chưa test live (không có acc) | — |
| 2 | Auth | Session khôi phục + listener | PASS (code) | getSession + onAuthStateChange | — | — |
| 3 | Auth | Đăng xuất | PASS (code) | signOutEverywhere | — | — |
| 4 | Auth | Profile không mặc định role | PASS (code) | fetchMyProfile validate role enum | — | — |
| 5 | RBAC | Guard trang theo role | PASS (code) | PAGE_ACCESS + canAccessPage | — | — |
| 6 | RBAC | Menu ẩn theo role | PASS (code) | NAV_ITEMS filter allowedRoles | — | — |
| 7 | Nhân viên | Danh sách + tìm kiếm + lọc + sort + phân trang | PASS (code) | listEmployees server-side | Chưa test live | — |
| 8 | Nhân viên | Thêm nhân viên | PASS (code) | createEmployee + validate | Chưa test live | — |
| 9 | Nhân viên | Sửa nhân viên | PASS (code) | updateEmployee + prefill | Chưa test live | — |
| 10 | Nhân viên | Xóa (đếm FK trước) | PASS (code) | deleteEmployee + countRelatedRecords | Chưa test live | — |
| 11 | Nhân viên | Chi tiết + dữ liệu liên quan | PASS (code) | getEmployeeDetail | Chưa test live | — |
| 12 | Phòng ban | Danh sách + count thật | PASS (code) | listDepartmentsPaged | Chưa test live | — |
| 13 | Phòng ban | CRUD + chặn xóa khi còn NV | PASS (code) | deleteDepartment + transferEmployees | Chưa test live | — |
| 14 | Ca làm | CRUD + ca qua đêm + chặn xóa | PASS (code) | createShift/updateShift/deleteShift | Chưa test live | — |
| 15 | Lịch | Xem tuần + phân công CRUD | PASS (code) | listWeekSchedule + create/update/deleteAssignment | Chưa test live | — |
| 16 | Lịch | Chặn sửa/hủy ngày đã chấm công | PASS (code) | hasAttendance check | Chưa test live | — |
| 17 | Chấm công | Check-in/out qua RPC | PASS (code) | doClockIn/doClockOut → RPC | Chưa test live | — |
| 18 | Chấm công | Anti-double-click | PASS (code) | actionState + disable nút | Chưa test live | — |
| 19 | Chấm công | Thời gian DB ghi | PASS (code) | RPC dùng now() | — | — |
| 20 | Lịch sử | Lọc + phân trang + tổng hợp | PASS (code) | listAttendanceRecords + getAttendanceSummary | Chưa test live | — |
| 21 | Nghỉ phép | Gửi đơn (employee) | PASS (code) | createLeaveRequest | Chưa test live | — |
| 22 | Nghỉ phép | Duyệt/từ chối (HR/Admin) | PASS (code) | approve/reject + optimistic concurrency | Chưa test live | — |
| 23 | Nghỉ phép | Chống race condition | PASS (code) | .eq("status","pending") + trigger | Chưa test live | — |
| 24 | Dashboard | KPI thật | PASS (code) | fetchDashboardKPI (count exact) | Chưa test live | — |
| 25 | Dashboard | Export CSV | PASS (code) | exportAttendanceCsv/exportLeaveCsv | Chưa test live | — |
| 26 | Báo cáo | Placeholder (chưa triển khai) | UNVERIFIED | PlaceholderPage | Chưa có trang thật | Thấp |
| 27 | Cài đặt | Placeholder (chưa triển khai) | UNVERIFIED | PlaceholderPage | Chưa có trang thật | Thấp |

**Tổng kết:** 25/27 chức năng đạt PASS (code-level). 2 placeholder (Báo cáo, Cài đặt) chưa triển khai. **Không có FAIL** ở mức code. Tất cả UNVERIFIED ở mức live test vì không có tài khoản HR/Employee.

---

## 3. KIỂM TRA BẢO MẬT SUPABASE

### 3.1. RLS
- ✅ Tất cả 7 bảng đều `enable row level security`.
- ✅ anon/public bị `revoke all`.
- ✅ authenticated được grant tối thiểu (SELECT/INSERT/UPDATE/DELETE theo bảng).

### 3.2. Policy theo role
| Bảng | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | own-or-hr | self-employee / privileged (admin/hr) | own-or-hr | is_hr |
| departments | auth | is_hr | is_hr | is_hr |
| employees | own-or-hr | is_hr | is_hr | is_hr |
| work_shifts | auth | is_hr | is_hr | is_hr |
| shift_assignments | own-or-hr | is_hr | is_hr | is_hr |
| attendance_records | own-or-hr | is_hr | is_hr | is_hr |
| leave_requests | own-or-hr | own-or-hr (pending) | own-or-hr | own-or-hr (pending) |

### 3.3. Trigger bảo vệ
- ✅ `prevent_profile_role_escalation`: chỉ admin đổi role.
- ✅ `enforce_profile_insert_role`: HR chỉ tạo employee, admin tạo mọi role.
- ✅ `enforce_leave_insert/update/delete`: employee chỉ pending, không chạm status/reviewed_by/decided_at/employee_id.
- ✅ `enforce_attendance_write`: nhân viên chỉ tạo giờ vào hôm nay, set giờ ra 1 lần, không sửa còn lại.
- ✅ `touch_updated_at`: tự cập nhật updated_at.

### 3.4. Secret scan
- ✅ Không có service-role key / secret key trong `src/` (chỉ còn comment cấm).
- ✅ `.env` không commit (`.gitignore` chặn).
- ✅ `.env.example` có placeholder, không có khóa thật.

### 3.5. Bảo mật frontend
- ✅ Không dùng `service_role` key ở client.
- ✅ Không tắt RLS.
- ✅ Không tự cấp quyền admin.
- ✅ Lỗi hiển thị thân thiện (không lộ SQL/constraint nội bộ).
- ⚠️ Một số lỗi tiếng Việt từ DB được giữ nguyên (đúng thiết kế — không lộ kỹ thuật).

### 3.6. Rủi ro còn lại
- ⚠️ `clock_in`/`clock_out` RPC dùng SECURITY DEFINER bypass RLS → đúng thiết kế (nhân viên không có quyền INSERT trực tiếp). RPC kiểm tra `user_id = auth.uid()` → an toàn.
- ⚠️ `confirm_attendance` RPC kiểm tra `is_hr()` → chỉ HR/Admin xác nhận.
- ⚠️ Không có audit trail chi tiết (ai sửa gì) — schema chưa có bảng audit.

---

## 4. KIỂM TRA GIAO DIỆN & ĐỘ ỔN ĐỊNH

### 4.1. Responsive
- ✅ Bảng dùng `overflow-x-auto` + `min-w-[...]` → scroll ngang trên mobile.
- ✅ Modal dùng bottom-sheet trên mobile (`items-end` → `sm:items-center`).
- ✅ Grid responsive (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`).
- ⚠️ Chưa test thực tế trên tablet/mobile thật (chỉ headless Chrome 390px).

### 4.2. State handling
- ✅ Loading skeleton trên mọi trang.
- ✅ Error state + nút "Thử lại" trên mọi trang.
- ✅ Empty state trên mọi trang (không dữ liệu giả).
- ✅ Toast thông báo thành công/thất bại.

### 4.3. Refresh trực tiếp route
- ✅ Hash routing (`#/employees`) → refresh giữ đúng trang.
- ✅ `pageKeyFromHash` parse an toàn.

### 4.4. Console/Network
- ⚠️ Chưa kiểm tra console thật (cần đăng nhập + tương tác).
- ⚠️ Một số trang gọi `listDepartments()` + `listShiftsPaged()` song song → có thể tối ưu bằng cache, nhưng không phải lỗi.

---

## 5. KIỂM TRA CHẤT LƯỢNG CODE

| Script | Kết quả | Ghi chú |
|---|---|---|
| `npm run lint` (oxlint) | **PASS** — 0 errors, 22 warnings | Warnings `set-state-in-effect` là pattern có sẵn trong codebase (useEffect load data). Không chặn build. |
| `npm run build` (tsc -b + vite) | **PASS** | Build thành công, 0 lỗi TypeScript. |
| `npm run check:supabase` | **PASS** | Host + key hợp lệ. |
| Unit/Integration tests | **N/A** | Không có test framework trong package.json. Chưa có test. |
| Typecheck riêng | **N/A** | `tsc -b` chạy trong build. |

### Lỗi đã sửa trong quá trình audit
- Không phát hiện lỗi mới. Build + lint pass.

### Lỗi có sẵn (không phải do thay đổi của dự án)
- 22 warnings `react(set-state-in-effect)` — pattern `useEffect(() => { load(); }, [deps])` phổ biến, không ảnh hưởng chức năng.
- Warning chunk-size > 500KB — do bundle Supabase, có thể code-split ở prompt sau.

---

## 6. MA TRẬN TEST END-TO-END

| Luồng | Bước | Trạng thái | Bằng chứng |
|---|---|---|---|
| A — Đăng nhập | Mở website | PASS (code) | LoginPage.tsx + AuthContext |
| A — Đăng nhập | Đăng nhập Admin | UNVERIFIED | Cần tài khoản Admin |
| A — Đăng nhập | Session + profile | PASS (code) | fetchMyProfile validate |
| A — Đăng nhập | Refresh trang | PASS (code) | getSession restore |
| A — Đăng nhập | Đăng xuất + kiểm tra quyền | PASS (code) | signOut + guard |
| B — Nhân viên | Danh sách + tìm kiếm + lọc | PASS (code) | listEmployees server-side |
| B — Nhân viên | Tạo NV hợp lệ | UNVERIFIED | Cần đăng nhập HR |
| B — Nhân viên | Kiểm tra Supabase | UNVERIFIED | Cần đăng nhập HR |
| B — Nhân viên | Sửa NV | UNVERIFIED | Cần đăng nhập HR |
| B — Nhân viên | Dữ liệu sai/trùng | PASS (code) | validate + 23505 mapping |
| B — Nhân viên | Ràng buộc có lịch sử | PASS (code) | countRelatedRecords + deleteEmployee |
| C — Phòng ban | Danh sách + tạo + sửa | PASS (code) | listDepartmentsPaged + CRUD |
| C — Phòng ban | Gán NV vào phòng ban | PASS (code) | employees.department_id FK |
| C — Phòng ban | Phòng ban đang dùng | PASS (code) | deleteDepartment chặn + transfer |
| D — Ca & Lịch | Tạo ca hợp lệ | PASS (code) | createShift + validate |
| D — Ca & Lịch | Phân công | PASS (code) | createAssignment + assertAssignable |
| D — Ca & Lịch | Xem lịch tuần | PASS (code) | listWeekSchedule |
| D — Ca & Lịch | Lịch trùng | PASS (code) | UNIQUE constraint + check trước |
| D — Ca & Lịch | Quyền Employee | PASS (code) | lockedEmployeeIds + RLS |
| E — Chấm công | Employee đăng nhập | UNVERIFIED | Cần tài khoản Employee |
| E — Chấm công | Xem lịch bản thân | PASS (code) | useSchedule locked |
| E — Chấm công | Check-in | UNVERIFIED | Cần đăng nhập Employee |
| E — Chấm công | Check-out | UNVERIFIED | Cần đăng nhập Employee |
| E — Chấm công | Lịch sử | PASS (code) | listAttendanceRecords |
| E — Chấm công | Đối chiếu UI/DB | UNVERIFIED | Cần đăng nhập Employee |
| E — Chấm công | Lặp thao tác | PASS (code) | actionState + RPC unique |
| F — Nghỉ phép | Employee gửi đơn | UNVERIFIED | Cần đăng nhập Employee |
| F — Nghỉ phép | Đơn xuất hiện DS | PASS (code) | listLeaveRequests |
| F — Nghỉ phép | HR duyệt/từ chối | UNVERIFIED | Cần đăng nhập HR |
| F — Nghỉ phép | Employee xem trạng thái | PASS (code) | RLS select own |
| F — Nghỉ phép | Không quyền tự duyệt | PASS (code) | trigger + RLS |
| G — Báo cáo | Dashboard KPI | PASS (code) | fetchDashboardKPI count exact |
| G — Báo cáo | Đối chiếu KPI/DB | UNVERIFIED | Cần đăng nhập HR |
| G — Báo cáo | Thay đổi bộ lọc | PASS (code) | hook reload on filter change |
| G — Báo cáo | Báo cáo chấm công/nghỉ phép | PASS (code) | listAttendanceRecords/listLeaveRequests |
| G — Báo cáo | Export CSV | PASS (code) | exportAttendanceCsv/exportLeaveCsv |

**Tổng:** 25 PASS (code), 12 UNVERIFIED (cần tài khoản test), 0 FAIL.

---

## 7. LỖI CÒN TỒN TẠI & RỦI RO

### Lỗi còn tồn tại (không chặn build)
1. **22 warnings `set-state-in-effect`** — pattern `useEffect(() => { load(); }, [deps])` phổ biến trong codebase. Không ảnh hưởng chức năng, chỉ giảm tối ưu React Compiler. Khuyến nghị: giữ nguyên (pattern chuẩn cho data fetching).
2. **Bundle size > 500KB** — do Supabase SDK. Khuyến nghị: code-split bằng dynamic import ở prompt sau (không phải lỗi).
3. **Không có unit/integration tests** — package.json không có test framework. Nếu cần, thêm Vitest + Testing Library.

### Rủi ro cần người dùng kiểm tra thủ công
1. **Tài khoản test**: Cần ít nhất 1 Admin, 1 HR, 1 Employee để kiểm tra end-to-end. Hiện chưa có tài khoản nào để test live.
2. **RLS thực tế**: Cần verify bằng cách đăng nhập từng role và thử truy cập dữ liệu ngoài phạm vi.
3. **Ca qua đêm**: Logic tính thời lượng `24h - start + end` chưa verify với dữ liệu thật.
4. **Tự động đi muộn/về sớm**: Chưa triển khai (cần confirm quy tắc).
5. **Audit trail**: Chưa có bảng audit chi tiết.
6. **Biểu đồ**: DashboardPage cũ có `AttendanceChart` (demo) — đã bỏ vì dữ liệu thật chưa có aggregation.

### Chức năng chưa triển khai (placeholder)
- Báo cáo tổng hợp (`#/report`) — PlaceholderPage.
- Cài đặt (`#/settings`) — PlaceholderPage.

---

## 8. KẾT LUẬN

- **Code quality:** PASS (lint 0 errors, build pass, typecheck pass).
- **Security:** PASS (RLS bật trên 7 bảng, không có secret, không service-role key).
- **Chức năng:** 25/27 PASS (code-level), 2 placeholder chưa triển khai, 0 FAIL.
- **Live test:** UNVERIFIED — cần tài khoản HR/Employee/Admin để kiểm tra end-to-end.
- **Checkpoint:** localhost-ready tại `http://localhost:5173/`.

**Khuyến nghị tiếp theo:**
1. Tạo tài khoản test (Admin + HR + Employee) trên Supabase Dashboard.
2. Kiểm tra end-to-end theo ma trận test ở mục 6.
3. Nếu cần, thêm unit tests (Vitest) và code-split bundle.
4. Triển khai trang Báo cáo và Cài đặt khi có yêu cầu.