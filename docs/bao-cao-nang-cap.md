# BÁO CÁO AUDIT, NGHIÊN CỨU VÀ NÂNG CẤP — ATTENDANCE MANAGEMENT

**Ngày:** 19/10/2026  
**Phạm vi:** Audit toàn bộ source, nghiên cứu đối thủ, triển khai P1  
**Môi trường:** Localhost `http://localhost:5173/` + Supabase `hvslmudmadrsgyssnqlh.supabase.co`

## 1. Tổng quan dự án

- Frontend: React 19 + TypeScript + Vite 8 + Tailwind 4.
- Backend: Supabase PostgreSQL + RLS + RPC SECURITY DEFINER.
- Auth: Supabase Auth email/password.
- Phân quyền: `admin`, `hr`, `employee`.
- 7 bảng: `profiles`, `departments`, `employees`, `work_shifts`, `shift_assignments`, `attendance_records`, `leave_requests`.
- Không có test framework (Vitest/Jest) trong `package.json`.

## 2. Kiểm kê module

| Module | Trạng thái | Ghi chú |
|---|---|---|
| Auth/session | PASS (code) | Supabase Auth + getSession + onAuthStateChange |
| RBAC frontend | PASS (code) | PAGE_ACCESS + guard route |
| Nhân viên | PASS (code) | CRUD + lọc + phân trang |
| Phòng ban | PASS (code) | CRUD + chặn xóa khi còn NV |
| Ca làm | PASS (code) | CRUD + ca qua đêm |
| Lịch làm việc | PASS (code) | Tuần + CRUD phân công |
| Chấm công | PASS (code) | RPC clock_in/clock_out |
| Lịch sử chấm công | PASS (code) | Lọc + tổng hợp |
| Nghỉ phép | PASS (code) | Gửi + duyệt/từ chối + race guard |
| Dashboard | PASS (code) | KPI thật |
| Export CSV | PASS (code) | Chống formula injection |
| Báo cáo | PARTIAL → P1 đã triển khai | Trước đây PlaceholderPage; nay ReportPage |
| Cài đặt | MISSING | Chưa triển khai (P2) |
| Thông báo | MISSING | Chưa có bảng/store (P2) |
| Audit trail | MISSING | Chưa có bảng audit (P2) |

## 3. Nghiên cứu website tham khảo

| Nguồn | URL | Chức năng quan sát | Giá trị cho dự án | Ưu tiên |
|---|---|---|---|---|
| Jibble | https://www.jibble.io/features | Kiosk, QR/NFC, GPS/geofencing, offline sync, timesheet, báo cáo | Tham khảo UX và mẫu báo cáo; GPS/kiosk chưa triển khai do chưa có schema | P2 |
| Connecteam | https://connecteam.com/operations/ | Template/recurring shifts, cảnh báo đi muộn/missed clock-in, inconsistency alerts, export payroll | Cải tiến lịch lặp và cảnh báo bất thường | P1/P2 |
| Deputy | https://www.deputy.com/features | Shift swap/open shifts, real-time attendance, reporting, leave management | Cải tiến báo cáo và đổi ca có phê duyệt | P1/P2 |
| Supabase RLS | https://supabase.com/docs/guides/database/postgres/row-level-security | Grants + policies + tests + index | Xác nhận thiết kế RLS hiện tại đúng hướng | P0/P1 |

## 4. Bảng GAP

| ID | Chức năng đề xuất | Hiện trạng | Nguồn | Giá trị | Độ khó | Rủi ro | Ưu tiên |
|---|---|---|---|---|---|---|---|
| G1 | Trang Báo cáo tổng hợp | MISSING | Deputy/Jibble | Cao | Thấp | Thấp | P1 |
| G2 | Export CSV theo báo cáo | PARTIAL | Jibble/Connecteam | Cao | Thấp | Thấp | P1 |
| G3 | Tổng hợp chấm công theo trạng thái | PASS | Nội bộ | Cao | Thấp | Thấp | P1 |
| G4 | Tổng hợp đơn nghỉ phép | PARTIAL | Deputy | Cao | Thấp | Thấp | P1 |
| G5 | Cảnh báo nhân viên chưa check-in | MISSING | Connecteam | Trung bình | Trung bình | Trung bình | P2 |
| G6 | Đổi ca có phê duyệt | MISSING | Deputy | Cao | Cao | Cao | P2 |
| G7 | Kiosk/QR/GPS | MISSING | Jibble | Trung bình | Cao | Cao (privacy) | P2 |
| G8 | Trang Cài đặt/quản lý tài khoản | MISSING | Nội bộ | Trung bình | Cao | Cao | P2 |
| G9 | Audit trail | MISSING | Supabase docs | Trung bình | Trung bình | Thấp | P2 |

## 5. Chức năng mới đã triển khai

### 5.1. ReportPage (`src/pages/ReportPage.tsx`)

- Tab **Chấm công**: lọc ngày/trạng thái/sắp xếp, tổng hợp theo trạng thái, bảng dữ liệu, xuất CSV.
- Tab **Nghỉ phép**: lọc trạng thái/ngày/phòng ban/tìm kiếm, bảng dữ liệu, xuất CSV.
- Dữ liệu thật từ Supabase qua `useAttendanceHistory` và `useLeaveRequests`.
- Employee chỉ thấy dữ liệu của mình nhờ RLS; HR/Admin thấy toàn phạm vi.
- Export CSV tái sử dụng `exportAttendanceCsv` / `exportLeaveCsv` (đã có chống CSV formula injection).

### 5.2. Cập nhật điều hướng

- `src/components/navigation.ts`: `report.implemented = true`.
- `src/App.tsx`: render `ReportPage` cho route `report`.

## 6. Kiểm tra bảo mật

- Không thêm secret/service-role key.
- Không tắt RLS.
- Không tự cấp quyền.
- ReportPage dùng dữ liệu đã được RLS giới hạn; không gửi `employee_id` từ client để vượt quyền.
- Export CSV giữ nguyên sanitize injection.

## 7. Test matrix

| Test ID | Module | Kết quả |
|---|---|---|
| T1 | `npm run lint` | PASS — 0 errors, 22 warnings (pattern có sẵn) |
| T2 | `npm run build` | PASS — `tsc -b && vite build` thành công |
| T3 | `npm run check:supabase` | PASS (đã ghi nhận trước) |
| T4 | ReportPage TypeScript | PASS (build) |
| T5 | Route `#/report` render | PASS (build + logic) |
| T6 | Live end-to-end | UNVERIFIED — chưa có tài khoản test |

## 8. Ảnh minh chứng

- `docs/screenshots/report-login-desktop.png` — màn hình đăng nhập (localhost).
- Chưa chụp được màn hình ReportPage sau đăng nhập do không có tài khoản test trong môi trường này.

## 9. Lỗi còn tồn tại

1. 22 warnings `set-state-in-effect` — pattern có sẵn, không chặn build.
2. Bundle size > 500KB — do Supabase SDK.
3. Không có unit/integration tests.
4. Chưa có tài khoản test Admin/HR/Employee để kiểm tra end-to-end.
5. Trang Cài đặt (`#/settings`) vẫn placeholder.
6. Chưa triển khai cảnh báo thông minh, đổi ca, kiosk/QR/GPS.

## 10. Hướng phát triển tiếp theo

1. Tạo tài khoản test và kiểm tra end-to-end ReportPage.
2. Thêm Vitest + Testing Library.
3. Triển khai cảnh báo "nhân viên chưa check-in hôm nay" trên Dashboard.
4. Triển khai đổi ca có phê duyệt (P2).
5. Cân nhắc code-split bundle.

## 11. Ứng dụng đang chạy

- URL: `http://localhost:5173/`
- Server dev đã khởi động.
