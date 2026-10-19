# BÁO CÁO — XUẤT EXCEL / PDF (Ngày 7.3.6)

## 1. Khảo sát hiện trạng

- Đã có export CSV: `exportAttendanceCsv`, `exportLeaveCsv` trong `src/services/dashboard.ts`.
- CSV đã xử lý UTF-8 BOM, escape ký tự đặc biệt và chống formula injection (`sanitizeCsvValue`).
- Chưa có thư viện Excel (`xlsx`) hoặc PDF (`jspdf`/`pdfkit`) trong `package.json`.

## 2. Quyết định

- Giữ **CSV làm định dạng xuất chính** để tránh thêm dependency nặng và tăng bundle size.
- Không cài thêm thư viện Excel/PDF trong lần này.
- Nếu cần Excel/PDF thật, khuyến nghị:
  - Excel: `xlsx` (SheetJS) + tạo workbook từ mảng bản ghi.
  - PDF: `jspdf` + `jspdf-autotable` để vẽ bảng.
  - Tên file: `bao-cao-cham-cong-YYYY-MM-DD.xlsx` / `.pdf`.

## 3. Bảo mật

- Dữ liệu xuất đã được RLS lọc ở truy vấn; Employee không thấy dữ liệu người khác.
- Chống formula injection đã có trong CSV; cần áp dụng tương tự cho Excel (định dạng text) nếu triển khai.

## 4. Kiểm thử

- Không có thay đổi code.
- Export CSV hiện có đã được thiết kế đạt các tiêu chí đã nêu.

## 5. Ghi chú

- Không tự deploy production.
- Nếu cần Excel/PDF, cần phê duyệt thêm dependency.
