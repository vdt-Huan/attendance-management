# BÁO CÁO — GPS / SELFIE / IP CHO CHẤM CÔNG (Ngày 7.3.8)

## 1. Khảo sát

- `attendance_records` hiện **không** có cột `latitude`, `longitude`, `accuracy`, `ip_address`, `selfie_url`, `device_info`.
- Chưa có yêu cầu nghiệp vụ rõ ràng về bán kính cho phép, tọa độ văn phòng, selfie bắt buộc hay IP tracking.
- Dữ liệu vị trí/ảnh là dữ liệu nhạy cảm (quyền riêng tư).

## 2. Quyết định

- **Không** triển khai GPS/selfie/IP trong lần này.
- Không thêm cột hoặc bucket Storage vì chưa có yêu cầu rõ và để tránh rủi ro quyền riêng tư.
- Nếu cần sau này:
  - Migration thêm cột nullable vào `attendance_records` (hoặc bảng `attendance_checkin_meta`).
  - Supabase Storage bucket private + signed URL.
  - Geolocation API chỉ chạy khi người dùng đồng ý; từ chối vẫn cho chấm công.
  - RLS: chỉ bản thân và HR/Admin xem metadata.

## 3. Kiểm thử

- Không có thay đổi code/database.

## 4. Ghi chú

- Không tự áp dụng migration.
- Không tự triển khai production.
