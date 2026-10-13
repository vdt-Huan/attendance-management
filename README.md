# Attendance Management

Website quản lý chấm công nhân viên (tiếng Việt, múi giờ Asia/Ho_Chi_Minh).

> Phạm vi Prompt 1 (Ngày 1): khởi tạo dự án React + TypeScript + Vite chạy
> được bằng npm, có cấu trúc thư mục mở rộng và trang ban đầu. Chưa có xác
> thực, chưa kết nối Supabase, chưa có nghiệp vụ chấm công.

## Công nghệ

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4 (qua `@tailwindcss/vite`)
- Triển khai dự kiến: Vercel
- Cơ sở dữ liệu: Supabase PostgreSQL (kết nối ở Prompt 3, schema trong `supabase/`)

## Cấu trúc thư mục

```text
src/
  components/  Component dùng chung (StatusCard, ...)
  layouts/     Khung trang (MainLayout)
  pages/       Trang ứng dụng (HomePage)
  lib/         Hằng số, helper (constants, timezone)
  services/    Tầng gọi Supabase (Prompt 2, hiện là placeholder)
  hooks/       Custom hooks (useNow)
  types/       Kiểu dùng chung
```

## Cài đặt và chạy

Yêu cầu: Node.js (đã kiểm tra với Node 24), npm, Git.

```bash
npm install
npm run dev
```

Mở trình duyệt tại địa chỉ Vite in ra (mặc định `http://localhost:5173`).

Build kiểm tra tương thích Vercel:

```bash
npm run build
```

Kiểm tra lint:

```bash
npm run lint
```

## Biến môi trường

Sao chép `.env.example` thành `.env` và điền giá trị của **đúng project
Supabase mới** của Attendance Management. Không commit file `.env` lên Git
(`.gitignore` đã chặn). Chỉ dùng publishable key — không dùng
`service_role`/secret key trong frontend.

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key-here
```

Kiểm tra kết nối an toàn (không đọc/ghi dữ liệu nghiệp vụ):

```bash
npm run check:supabase
```

## Triển khai Vercel

Chưa bắt buộc ở Prompt này nếu repo chưa đẩy code. Khi deploy, vào Vercel
Project → Settings → Environment Variables, thêm cho cả 3 môi trường
(Production, Preview, Development):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Lưu và **Redeploy** để biến có hiệu lực. Schema DB chạy thủ công theo
`supabase/README.md` trước khi dùng chức năng cần dữ liệu thật.

## Ghi chú

- Chưa đẩy code lên GitHub và chưa triển khai Vercel trong Prompt 1.
- Prompt 2 (Ngày 1): giao diện Dashboard. Số liệu trong
  `src/services/demoData.ts` là **dữ liệu demo**, không phải nghiệp vụ thật.
- Prompt 3 (Ngày 1): module `src/lib/supabase.ts`, migration
  `supabase/migrations/0001_initial_schema.sql` (7 bảng + RLS, **chưa áp
  dụng** — chạy thủ công theo `supabase/README.md`), script
  `npm run check:supabase`. Chưa có project/key thật nên chưa thể xác nhận
  kết nối thành công.
