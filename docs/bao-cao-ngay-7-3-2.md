# BÁO CÁO — LÝ DO TỪ CHỐI ĐƠN NGHỈ PHÉP (Ngày 7.3.2)

## 1. Thay đổi database

- Migration: `supabase/migrations/0003_leave_rejection_reason.sql`
- Thêm cột `rejection_reason text` (nullable) vào `leave_requests`.
- Ràng buộc độ dài 5–1000 ký tự và chỉ có khi `status = 'rejected'`.
- Trigger `enforce_leave_insert` / `enforce_leave_update` siết:
  - Nhân viên không chạm `rejection_reason`.
  - HR/Admin từ chối phải nhập lý do; duyệt/làm lại pending phải xóa lý do.

## 2. Thay đổi frontend

- `src/services/leave.ts`: thêm `rejection_reason` vào `LeaveRequest`, select/map; `rejectLeaveRequest(id, reason)` validate 5–1000 ký tự; `approveLeaveRequest` đặt `rejection_reason = null`.
- `src/pages/LeavePage.tsx`: textarea lý do từ chối trong dialog, nút disabled nếu < 5 ký tự; hiển thị cột "Lý do từ chối".
- `src/pages/ReportPage.tsx`: hiển thị cột "Lý do từ chối".

## 3. Kiểm thử

- `npm run lint`: PASS (0 errors).
- `npm run build`: PASS.

## 4. Ghi chú

- Migration cần áp dụng thủ công trên Supabase SQL Editor.
- Không tự động trừ phép/tính lương.
