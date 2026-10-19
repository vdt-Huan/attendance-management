# BÁO CÁO — TỰ ĐỘNG ĐÁNH DẤU ĐI MUỘN / VỀ SỚM (Ngày 7.3.1)

## 1. Khảo sát

- `work_shifts`: `start_time`, `end_time`, `late_after_minutes` (mặc định 15).
- `attendance_records`: `check_in`, `check_out`, `status` (`dung-gio`, `di-muon`, `ve-som`, `vang`).
- Ca qua đêm: `end_time < start_time`.

## 2. Công thức

- Đi muộn: `check_in > work_date + start_time + late_after_minutes` (timezone Asia/Ho_Chi_Minh).
- Về sớm: `check_out < work_date + end_time` (ca qua đêm: end sang ngày hôm sau).
- Đúng giờ: check-in trong grace và checkout >= end_time (hoặc chưa checkout).
- Vắng: không có check-in trong ngày có phân công (tính ở báo cáo/KPI, không tự tạo dòng).
- `late_minutes` = số phút từ `start_time` đến `check_in` (>= 0).

## 3. Thay đổi

- Migration: `supabase/migrations/0002_auto_late_early_status.sql`
  - ADD COLUMN `late_minutes integer CHECK (>=0)`.
  - RPC `clock_in` tự tính `di-muon` + `late_minutes`.
  - RPC `clock_out` tự tính `ve-som` (chỉ khi trước đó `dung-gio`).
  - Trigger `enforce_attendance_write` cho phép status do RPC sinh.
- Frontend:
  - `src/services/attendanceHistory.ts`: map `late_minutes`.
  - `src/services/dashboard.ts`: KPI `todayLate`, `todayEarly`.
  - `src/pages/DashboardPage.tsx`: hiển thị số đi muộn/về sớm hôm nay.

## 4. Bảo mật

- Không dùng service-role key.
- Employee không tự sửa status/check_in/check_out (trigger + RLS).
- HR/Admin vẫn có quyền thủ công.

## 5. Kiểm thử

- `npm run lint`: PASS (0 errors).
- `npm run build`: PASS.

## 6. Ghi chú

- Migration cần được áp dụng thủ công trên Supabase SQL Editor.
- Không tự động trừ phép/tính lương.
