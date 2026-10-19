# BÁO CÁO — TỰ ĐỘNG TRỪ PHÉP / TÍNH LƯƠNG (Ngày 7.3.4)

## 1. Khảo sát

- Schema hiện tại **không** có bảng `payroll`, `leave_balance`, `employee_leave_entitlement`, và `employees` không có cột `remaining_leave_days`.
- Chưa có quy tắc lương cơ bản, thưởng, khấu trừ, ngày cutoff hoặc hạn mức phép theo loại nghỉ.
- Đơn nghỉ phép hiện chỉ lưu `status`, `leave_type`, `start_date`, `end_date`, `reason`, `rejection_reason`.

## 2. Quyết định

- **Không** tạo bảng lương/trừ phép trong lần này vì thiếu yêu cầu nghiệp vụ rõ ràng (base salary, entitlement, cutoff, chính sách pháp luật).
- **Không** tự động trừ phép khi tạo đơn; chỉ xử lý khi đơn `approved` (nếu sau này có bảng balance).
- Không tự động tính lương.

## 3. Đề xuất P2 (chưa triển khai)

- Tạo bảng `leave_balances (employee_id, leave_type, year, total_days, used_days, remaining_days)` khi có quy tắc hạn mức.
- RPC `calculate_leave_balance(employee_id, year)` chỉ chạy khi đơn được duyệt.
- Báo cáo "Lương tháng" chỉ hiển thị, không tự tạo phiếu lương.
- RLS: Admin xem toàn bộ, HR theo phạm vi, Employee chỉ xem của mình.

## 4. Kiểm thử

- Không có thay đổi code/database trong prompt này.
- `npm run lint` / `npm run build`: không chạy thêm vì không thay đổi code.

## 5. Ghi chú

- Không áp dụng migration phá hủy dữ liệu.
- Cần xác nhận chính sách phép/lương trước khi triển khai.
