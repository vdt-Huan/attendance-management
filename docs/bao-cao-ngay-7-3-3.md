# BÁO CÁO — LOẠI NGHỈ PHÉP (Ngày 7.3.3)

## 1. Thay đổi database

- Migration: `supabase/migrations/0004_leave_type.sql`
- Thêm cột `leave_type text NOT NULL DEFAULT 'annual'` vào `leave_requests`.
- Dữ liệu cũ được đặt `leave_type = 'annual'`.
- CHECK constraint: `leave_type in (annual, sick, unpaid, wedding, maternity, other)`.
- Trigger kiểm tra `leave_type` hợp lệ khi insert/update.

## 2. Thay đổi frontend

- `src/services/leave.ts`: thêm `LeaveType`, `LEAVE_TYPE_LABEL`, trường `leave_type` trong `LeaveRequest`, filter `leaveType`, `createLeaveRequest(..., leaveType)`.
- `src/hooks/useLeaveRequests.ts`: state `leaveType` + filter.
- `src/pages/LeavePage.tsx`: select loại nghỉ trong form, lọc theo loại, cột "Loại nghỉ".
- `src/pages/ReportPage.tsx`: lọc và cột "Loại nghỉ".

## 3. Kiểm thử

- `npm run lint`: PASS (0 errors).
- `npm run build`: PASS.

## 4. Ghi chú

- Migration cần áp dụng thủ công trên Supabase SQL Editor.
- Không tự trừ phép/tính lương theo loại nghỉ.
