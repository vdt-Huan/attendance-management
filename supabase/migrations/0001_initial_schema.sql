-- =====================================================================
-- Attendance Management — Schema khởi tạo v6 (Ngày 1, Prompt 3 + 5 vòng rà soát)
-- File: supabase/migrations/0001_initial_schema.sql
--
-- TRẠNG THÁI: CHƯA ÁP DỤNG lên project nào. Chỉ chạy thủ công trên ĐÚNG
-- project Supabase mới của Attendance Management sau khi xác nhận project
-- đích (xem supabase/README.md). Không chạy trên project cũ.
-- KHÔNG sửa trực tiếp trên Supabase, KHÔNG tự chạy SQL ngoài file này.
--
-- Nội dung: 7 bảng (profiles, departments, employees, work_shifts,
-- shift_assignments, attendance_records, leave_requests) + RLS phân quyền
-- Admin/HR và Nhân viên + RPC chấm công + trigger chống tự nâng quyền,
-- chống tự duyệt đơn, chống sửa bản ghi đã xác nhận.
--
-- NGUYÊN TẮC BẢO MẬT CỦA FILE NÀY:
-- 1. Không ai tự trở thành Admin/HR: tài khoản Admin đầu tiên CHỈ được tạo
--    bằng câu lệnh thủ công của chủ project trong SQL Editor
--    (xem supabase/README.md mục "Tạo Admin đầu tiên"). Về sau, chỉ Admin
--    hiện hữu được cấp role admin/hr (hàm is_admin + trigger
--    enforce_profile_insert_role + policy profiles_insert_privileged);
--    HR chỉ được tạo tài khoản employee.
-- 2. Nhân viên chấm công CHỈ qua RPC clock_in/clock_out (không được
--    INSERT/UPDATE/DELETE trực tiếp bảng attendance_records).
-- 3. Đơn nghỉ phép do nhân viên tạo LUÔN ở trạng thái pending; chỉ HR/Admin
--    được duyệt/từ chối; nhân viên không được sửa reviewed_by/decided_at.
-- 4. Ngày làm việc (work_date) tính theo múi giờ Asia/Ho_Chi_Minh ngay trong
--    database; timestamp lưu timestamptz (UTC).
-- 5. File chạy lại an toàn: mọi CREATE đều IF NOT EXISTS / OR REPLACE,
--    mọi policy/trigger cũ (kể cả tên của bản v1) đều DROP IF EXISTS trước.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Hàm không phụ thuộc bảng: ngày làm việc VN (phải đứng trước CREATE TABLE
--    vì được dùng làm DEFAULT của attendance_records.work_date).
--    LƯU Ý THỨ TỰ: is_hr()/is_admin() là SQL-language function nên Postgres
--    kiểm tra bảng public.profiles ngay khi CREATE — hai hàm đó được định
--    nghĩa ở mục 7A, SAU khi tạo bảng. Đừng chuyển lên trước.
-- ---------------------------------------------------------------------
create or replace function public.vn_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date;
$$;

-- ---------------------------------------------------------------------
-- 1. Bảng profiles: hồ sơ người dùng, khóa chính trùng auth.users.id.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'employee'
    check (role in ('admin', 'hr', 'employee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chặn tự nâng quyền khi UPDATE: chỉ admin được đổi cột role.
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_role text;
begin
  if new.role = old.role then
    return new;
  end if;
  -- SQL Editor / service_role (không có JWT user) bypass RLS theo ngữ nghĩa
  -- Postgres; cho qua để chủ project tạo Admin đầu tiên thủ công.
  if auth.uid() is null then
    return new;
  end if;
  select p.role into requester_role
  from public.profiles p
  where p.id = auth.uid();
  if requester_role is distinct from 'admin' then
    raise exception 'Không được phép tự thay đổi vai trò (role).';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on public.profiles;
create trigger trg_prevent_role_escalation
  before update of role on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

-- Chặn tự nâng quyền khi INSERT (phòng thủ chiều sâu bên cạnh RLS).
-- Ma trận cấp vai trò:
-- - SQL Editor / service_role (không JWT): toàn quyền (bootstrap Admin).
-- - Admin hiện hữu: cấp mọi vai trò (employee/hr/admin).
-- - HR: chỉ được cấp role 'employee' (KHÔNG được tạo admin, cũng không
--   được tạo HR khác — nâng lên HR phải do Admin thực hiện).
-- - Người còn lại: chỉ được tự tạo profile 'employee' của chính mình
--   (đúng id do policy profiles_insert_self_employee siết thêm).
create or replace function public.enforce_profile_insert_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bypass cho SQL Editor / service_role (chủ project, không có JWT user).
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from 'employee' then
    raise exception 'Chỉ Admin được cấp vai trò HR/Admin. HR chỉ được tạo tài khoản employee.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_insert_role on public.profiles;
create trigger trg_enforce_profile_insert_role
  before insert on public.profiles
  for each row execute function public.enforce_profile_insert_role();

-- ---------------------------------------------------------------------
-- 2. Bảng departments: phòng ban.
-- ---------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Bảng employees: hồ sơ nhân viên (mỗi user tối đa 1 hồ sơ).
-- ---------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null,
  employee_code text not null unique,
  full_name text not null,
  department_id uuid references public.departments (id) on delete set null,
  phone text,
  hire_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Bảng work_shifts: định nghĩa ca làm việc.
-- ---------------------------------------------------------------------
create table if not exists public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  late_after_minutes integer not null default 15
    check (late_after_minutes >= 0),
  created_at timestamptz not null default now(),
  check (start_time <> end_time)
);

-- ---------------------------------------------------------------------
-- 5. Bảng shift_assignments: lịch phân ca theo ngày.
-- ---------------------------------------------------------------------
create table if not exists public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_id uuid not null references public.work_shifts (id) on delete restrict,
  work_date date not null,
  created_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

-- ---------------------------------------------------------------------
-- 6. Bảng attendance_records: bản ghi chấm công (1 dòng/người/ngày).
-- work_date tính theo giờ Việt Nam; confirmed_at đánh dấu bản ghi đã xác
-- nhận (bất biến với nhân viên, chỉ HR/Admin được sửa/xóa).
-- ---------------------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null default public.vn_today(),
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'dung-gio'
    check (status in ('dung-gio', 'di-muon', 've-som', 'vang')),
  note text,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date),
  check (check_out is null or check_in is null or check_out >= check_in),
  check (confirmed_at is null or confirmed_by is not null)
);

-- Nâng cấp database đã chạy bản v1: thêm cột xác nhận + sửa default work_date.
alter table public.attendance_records
  add column if not exists confirmed_at timestamptz;
alter table public.attendance_records
  add column if not exists confirmed_by uuid references public.profiles (id) on delete set null;
alter table public.attendance_records
  alter column work_date set default public.vn_today();

-- ---------------------------------------------------------------------
-- 7. Bảng leave_requests: đơn nghỉ phép.
-- ---------------------------------------------------------------------
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------
-- 7A. Hàm phân quyền (BẮT BUỘC đứng sau mục 7 vì tham chiếu public.profiles;
--     SQL-language function bị lỗi 42P01 nếu bảng chưa tồn tại khi CREATE).
-- ---------------------------------------------------------------------
create or replace function public.is_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'hr')
  );
$$;

-- Người gọi có phải Admin không (riêng biệt với is_hr()).
-- Dùng cho mọi quyết định cấp/thu hồi vai trò: chỉ Admin được cấp role
-- admin/hr; HR chỉ được cấp role employee (xem enforce_profile_insert_role).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 8. Trigger dùng chung: tự cập nhật updated_at.
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_profiles on public.profiles;
create trigger trg_touch_profiles
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_employees on public.employees;
create trigger trg_touch_employees
  before update on public.employees
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_attendance on public.attendance_records;
create trigger trg_touch_attendance
  before update on public.attendance_records
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_leave on public.leave_requests;
create trigger trg_touch_leave
  before update on public.leave_requests
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 9. Trigger bảo vệ đơn nghỉ phép.
-- ---------------------------------------------------------------------

-- Nhân viên tạo đơn: ép pending + chưa có người duyệt (HR tạo hộ thì giữ
-- nguyên nhưng reviewed_by/decided_at phải đi cùng nhau).
create or replace function public.enforce_leave_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bypass cho SQL Editor / service_role (chủ project, không có JWT user).
  if auth.uid() is null then
    return new;
  end if;
  if public.is_hr() then
    if (new.reviewed_by is null) <> (new.decided_at is null) then
      raise exception 'reviewed_by và decided_at phải đi cùng nhau.';
    end if;
    return new;
  end if;
  if new.status is distinct from 'pending'
     or new.reviewed_by is not null
     or new.decided_at is not null then
    raise exception 'Đơn mới của nhân viên phải ở trạng thái pending và chưa có người duyệt.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_leave_insert on public.leave_requests;
create trigger trg_enforce_leave_insert
  before insert on public.leave_requests
  for each row execute function public.enforce_leave_insert();

-- Nhân viên chỉ được sửa nội dung đơn đang pending của chính mình; mọi thay
-- đổi status/reviewed_by/decided_at/employee_id đều chỉ HR được làm.
create or replace function public.enforce_leave_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bypass cho SQL Editor / service_role (chủ project, không có JWT user).
  if auth.uid() is null then
    return new;
  end if;
  if public.is_hr() then
    if (new.reviewed_by is null) <> (new.decided_at is null) then
      raise exception 'reviewed_by và decided_at phải đi cùng nhau.';
    end if;
    if new.status in ('approved', 'rejected')
       and (new.reviewed_by is null or new.decided_at is null) then
      raise exception 'Duyệt/từ chối đơn phải ghi rõ người duyệt và thời điểm duyệt.';
    end if;
    return new;
  end if;
  if old.status is distinct from 'pending' then
    raise exception 'Chỉ được sửa đơn đang chờ duyệt.';
  end if;
  if new.status is distinct from 'pending'
     or new.employee_id is distinct from old.employee_id
     or new.reviewed_by is distinct from old.reviewed_by
     or new.decided_at is distinct from old.decided_at then
    raise exception 'Nhân viên không được tự duyệt đơn hoặc sửa thông tin người duyệt.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_leave_update on public.leave_requests;
create trigger trg_enforce_leave_update
  before update on public.leave_requests
  for each row execute function public.enforce_leave_update();

-- Nhân viên chỉ được xóa đơn pending của chính mình.
create or replace function public.enforce_leave_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bypass cho SQL Editor / service_role (chủ project, không có JWT user).
  if auth.uid() is null then
    return old;
  end if;
  if public.is_hr() then
    return old;
  end if;
  if old.status is distinct from 'pending' then
    raise exception 'Chỉ được xóa đơn đang chờ duyệt.';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_enforce_leave_delete on public.leave_requests;
create trigger trg_enforce_leave_delete
  before delete on public.leave_requests
  for each row execute function public.enforce_leave_delete();

-- ---------------------------------------------------------------------
-- 10. RPC chấm công (nhân viên CHỈ được chấm công qua 2 hàm này).
-- Hàm chạy SECURITY DEFINER nên bypass RLS; mọi kiểm tra quyền và ngày
-- Việt Nam nằm ngay trong hàm + trigger enforce_attendance_write bên dưới.
-- ---------------------------------------------------------------------

-- Bấm giờ vào: tạo bản ghi ngày hôm nay (giờ VN), mỗi người 1 dòng/ngày.
create or replace function public.clock_in(p_employee_id uuid, p_note text default null)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_active boolean;
  v_today date := public.vn_today();
  v_row public.attendance_records;
begin
  select e.user_id, e.is_active into v_owner, v_active
  from public.employees e
  where e.id = p_employee_id;

  if not found then
    raise exception 'Không tìm thấy hồ sơ nhân viên.';
  end if;
  if v_owner is distinct from auth.uid() then
    raise exception 'Chỉ được chấm công cho chính mình.';
  end if;
  if coalesce(v_active, false) = false then
    raise exception 'Hồ sơ nhân viên đã bị vô hiệu hóa.';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Ghi chú không được vượt quá 1000 ký tự.';
  end if;
  if exists (
    select 1 from public.attendance_records r
    where r.employee_id = p_employee_id and r.work_date = v_today
  ) then
    raise exception 'Hôm nay đã có bản ghi chấm công. Hãy bấm giờ ra.';
  end if;

  insert into public.attendance_records (employee_id, work_date, check_in, note)
  values (p_employee_id, v_today, now(), p_note)
  returning * into v_row;
  return v_row;
end;
$$;

-- Bấm giờ ra: chỉ được set check_out một lần cho bản ghi hôm nay chưa xác nhận.
create or replace function public.clock_out(p_employee_id uuid, p_note text default null)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_today date := public.vn_today();
  v_row public.attendance_records;
begin
  select e.user_id into v_owner
  from public.employees e
  where e.id = p_employee_id;

  if not found then
    raise exception 'Không tìm thấy hồ sơ nhân viên.';
  end if;
  if v_owner is distinct from auth.uid() then
    raise exception 'Chỉ được chấm công cho chính mình.';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Ghi chú không được vượt quá 1000 ký tự.';
  end if;

  select * into v_row
  from public.attendance_records r
  where r.employee_id = p_employee_id and r.work_date = v_today;
  if not found then
    raise exception 'Chưa có giờ vào hôm nay. Hãy bấm giờ vào trước.';
  end if;
  if v_row.check_in is null then
    raise exception 'Bản ghi thiếu giờ vào. Hãy liên hệ HR để xử lý.';
  end if;
  if v_row.confirmed_at is not null then
    raise exception 'Bản ghi đã được xác nhận, không thể sửa.';
  end if;
  if v_row.check_out is not null then
    raise exception 'Hôm nay đã bấm giờ ra rồi.';
  end if;

  update public.attendance_records r
  set check_out = now(),
      note = coalesce(r.note, p_note)
  where r.id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

-- Xác nhận bản ghi (khóa sửa): chỉ HR/Admin, và chỉ bản ghi hợp lệ
-- (đã có giờ vào, chưa từng được xác nhận).
create or replace function public.confirm_attendance(p_record_id uuid)
returns public.attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.attendance_records;
begin
  if not public.is_hr() then
    raise exception 'Chỉ HR/Admin được xác nhận bản ghi chấm công.';
  end if;

  select * into v_row
  from public.attendance_records r
  where r.id = p_record_id;

  if not found then
    raise exception 'Không tìm thấy bản ghi chấm công.';
  end if;
  if v_row.check_in is null then
    raise exception 'Không xác nhận bản ghi thiếu giờ vào.';
  end if;
  if v_row.confirmed_at is not null then
    raise exception 'Bản ghi đã được xác nhận trước đó.';
  end if;

  update public.attendance_records r
  set confirmed_at = now(),
      confirmed_by = auth.uid()
  where r.id = p_record_id
  returning * into v_row;
  return v_row;
end;
$$;

-- Phòng thủ chiều sâu cho mọi đường ghi attendance_records (kể cả khi ai đó
-- vô tình mở thêm policy permissive): người không phải HR chỉ được tạo dòng
-- giờ vào hôm nay của chính mình và set giờ ra một lần; cấm xóa/sửa còn lại.
create or replace function public.enforce_attendance_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  -- Bypass cho SQL Editor / service_role (chủ project, không có JWT user).
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if public.is_hr() then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Nhân viên không được xóa bản ghi chấm công.';
  end if;

  select e.user_id into v_owner
  from public.employees e
  where e.id = new.employee_id;
  if v_owner is distinct from auth.uid() then
    raise exception 'Chỉ được chấm công cho chính mình.';
  end if;

  if tg_op = 'INSERT' then
    -- Giờ hệ thống do database ấn định (chống khai man thời điểm tạo).
    new.created_at := now();
    new.updated_at := now();
    if new.work_date is distinct from public.vn_today()
       or new.check_in is null
       or new.check_out is not null
       or new.status is distinct from 'dung-gio'
       or new.confirmed_at is not null
       or new.confirmed_by is not null
       or (new.note is not null and char_length(new.note) > 1000) then
      raise exception 'Bản ghi giờ vào không hợp lệ.';
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE': nhân viên chỉ được thực hiện đúng một thao tác
  -- "ghi nhận giờ ra": set check_out lần đầu trên dòng chưa xác nhận, và
  -- (nếu ghi chú còn trống) điền ghi chú một lần duy nhất. Mọi trường khác
  -- (id, giờ vào, trạng thái, ngày, created_at, người/thời điểm xác nhận...)
  -- bất biến. updated_at do trigger trg_touch_attendance ấn định sau bước này.
  if old.confirmed_at is not null or new.confirmed_at is not null
     or new.confirmed_by is not null
     or new.id is distinct from old.id
     or new.employee_id is distinct from old.employee_id
     or new.work_date is distinct from old.work_date
     or new.check_in is distinct from old.check_in
     or new.status is distinct from old.status
     or new.created_at is distinct from old.created_at
     or old.check_out is not null
     or new.check_out is null
     or new.check_out < new.check_in
     or (new.note is distinct from old.note
         and (old.note is not null
              or new.note is null
              or char_length(new.note) > 1000)) then
    raise exception 'Nhân viên không được sửa giờ vào/ra, trạng thái hoặc bản ghi đã xác nhận.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_attendance_write on public.attendance_records;
create trigger trg_enforce_attendance_write
  before insert or update or delete on public.attendance_records
  for each row execute function public.enforce_attendance_write();

-- ---------------------------------------------------------------------
-- 11. Index cho các khóa ngoại hay truy vấn.
-- ---------------------------------------------------------------------
create index if not exists idx_employees_department on public.employees (department_id);
create index if not exists idx_employees_user on public.employees (user_id);
create index if not exists idx_shift_assignments_employee_date
  on public.shift_assignments (employee_id, work_date);
create index if not exists idx_attendance_employee_date
  on public.attendance_records (employee_id, work_date);
create index if not exists idx_leave_employee on public.leave_requests (employee_id);
create index if not exists idx_leave_status on public.leave_requests (status);

-- ---------------------------------------------------------------------
-- 12. Bật RLS cho mọi bảng nhân sự.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.work_shifts enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.leave_requests enable row level security;

-- ---------------------------------------------------------------------
-- 13. Policies.
-- Quy tắc chung: Admin/HR (is_hr()) quản trị toàn quyền; Nhân viên chỉ
-- thấy dữ liệu của chính mình; chấm công/đơn từ nhạy cảm do trigger + RPC
-- kiểm soát thêm; KHÔNG mở đọc/ghi public cho anon.
-- Trước mỗi CREATE đều DROP IF EXISTS, kể cả tên policy của bản v1 đã bỏ.
-- ---------------------------------------------------------------------

-- profiles --
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_hr());

drop policy if exists "profiles_insert_self_employee" on public.profiles;
create policy "profiles_insert_self_employee" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'employee');

-- Dọn tên policy bản cũ đã bỏ (từng cho HR chèn mọi role) để chạy lại
-- không để lại quyền cũ ngoài ý muốn.
drop policy if exists "profiles_insert_hr" on public.profiles;

-- Cấp profile đặc quyền: Admin chèn mọi vai trò; HR chỉ chèn employee.
-- (Trigger enforce_profile_insert_role siết trùng ở tầng database.)
drop policy if exists "profiles_insert_privileged" on public.profiles;
create policy "profiles_insert_privileged" on public.profiles
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.is_hr() and role = 'employee')
  );

drop policy if exists "profiles_update_own_or_hr" on public.profiles;
create policy "profiles_update_own_or_hr" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_hr())
  with check (id = auth.uid() or public.is_hr());
-- Đổi role trái phép bị trigger trg_prevent_role_escalation chặn.

drop policy if exists "profiles_delete_hr" on public.profiles;
create policy "profiles_delete_hr" on public.profiles
  for delete to authenticated using (public.is_hr());

-- departments: ai đăng nhập cũng được đọc (đổ dropdown); chỉ HR được ghi --
drop policy if exists "departments_select_auth" on public.departments;
create policy "departments_select_auth" on public.departments
  for select to authenticated using (true);

drop policy if exists "departments_write_hr" on public.departments;
create policy "departments_write_hr" on public.departments
  for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- employees: xem dòng của mình; mọi ghi chép do HR --
drop policy if exists "employees_select_own_or_hr" on public.employees;
create policy "employees_select_own_or_hr" on public.employees
  for select to authenticated
  using (user_id = auth.uid() or public.is_hr());

drop policy if exists "employees_write_hr" on public.employees;
create policy "employees_write_hr" on public.employees
  for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- work_shifts: đọc mở cho người đăng nhập; ghi cho HR --
drop policy if exists "shifts_select_auth" on public.work_shifts;
create policy "shifts_select_auth" on public.work_shifts
  for select to authenticated using (true);

drop policy if exists "shifts_write_hr" on public.work_shifts;
create policy "shifts_write_hr" on public.work_shifts
  for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- shift_assignments: xem lịch của mình; ghi cho HR --
drop policy if exists "assignments_select_own_or_hr" on public.shift_assignments;
create policy "assignments_select_own_or_hr" on public.shift_assignments
  for select to authenticated
  using (
    public.is_hr()
    or exists (
      select 1 from public.employees e
      where e.id = shift_assignments.employee_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "assignments_write_hr" on public.shift_assignments;
create policy "assignments_write_hr" on public.shift_assignments
  for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- attendance_records: nhân viên CHỈ SELECT dòng của mình; mọi ghi trực tiếp
-- do HR; chấm công của nhân viên đi qua RPC clock_in/clock_out.
-- (Dọn tên policy bản v1 đã bỏ để chạy lại không để lại quyền cũ.)
drop policy if exists "attendance_insert_own_or_hr" on public.attendance_records;
drop policy if exists "attendance_update_own_or_hr" on public.attendance_records;

drop policy if exists "attendance_select_own_or_hr" on public.attendance_records;
create policy "attendance_select_own_or_hr" on public.attendance_records
  for select to authenticated
  using (
    public.is_hr()
    or exists (
      select 1 from public.employees e
      where e.id = attendance_records.employee_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "attendance_insert_hr" on public.attendance_records;
create policy "attendance_insert_hr" on public.attendance_records
  for insert to authenticated with check (public.is_hr());

drop policy if exists "attendance_update_hr" on public.attendance_records;
create policy "attendance_update_hr" on public.attendance_records
  for update to authenticated
  using (public.is_hr())
  with check (public.is_hr());

drop policy if exists "attendance_delete_hr" on public.attendance_records;
create policy "attendance_delete_hr" on public.attendance_records
  for delete to authenticated using (public.is_hr());

-- leave_requests: xem đơn của mình; tạo đơn (trigger ép pending với nhân
-- viên); sửa/xóa đơn pending của mình trong giới hạn trigger; HR toàn quyền.
-- (Dọn tên policy bản v1 đã bỏ.)
drop policy if exists "leave_insert_own" on public.leave_requests;
drop policy if exists "leave_update_own_pending_or_hr" on public.leave_requests;
drop policy if exists "leave_delete_own_pending_or_hr" on public.leave_requests;

drop policy if exists "leave_select_own_or_hr" on public.leave_requests;
create policy "leave_select_own_or_hr" on public.leave_requests
  for select to authenticated
  using (
    public.is_hr()
    or exists (
      select 1 from public.employees e
      where e.id = leave_requests.employee_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "leave_insert_own_or_hr" on public.leave_requests;
create policy "leave_insert_own_or_hr" on public.leave_requests
  for insert to authenticated
  with check (
    public.is_hr()
    or (
      exists (
        select 1 from public.employees e
        where e.id = leave_requests.employee_id and e.user_id = auth.uid()
      )
      and status = 'pending'
      and reviewed_by is null
      and decided_at is null
    )
  );

drop policy if exists "leave_update_own_or_hr" on public.leave_requests;
create policy "leave_update_own_or_hr" on public.leave_requests
  for update to authenticated
  using (
    public.is_hr()
    or exists (
      select 1 from public.employees e
      where e.id = leave_requests.employee_id and e.user_id = auth.uid()
    )
  )
  with check (
    public.is_hr()
    or (
      status = 'pending'
      and reviewed_by is null
      and decided_at is null
    )
  );
-- Trigger trg_enforce_leave_update siết thêm: cấm đổi employee_id, cấm sửa
-- đơn đã duyệt/từ chối, cấm chạm reviewed_by/decided_at.

drop policy if exists "leave_delete_own_pending_or_hr" on public.leave_requests;
create policy "leave_delete_own_pending_or_hr" on public.leave_requests
  for delete to authenticated
  using (
    public.is_hr()
    or (
      status = 'pending'
      and exists (
        select 1 from public.employees e
        where e.id = leave_requests.employee_id and e.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------
-- 14. Phân quyền: khóa hoàn toàn anon, cấp tối thiểu cho authenticated
--     (RLS + trigger + RPC là lớp kiểm soát chính). Function RPC chỉ cho
--     authenticated thực thi.
-- ---------------------------------------------------------------------
revoke all on public.profiles from anon, public;
revoke all on public.departments from anon, public;
revoke all on public.employees from anon, public;
revoke all on public.work_shifts from anon, public;
revoke all on public.shift_assignments from anon, public;
revoke all on public.attendance_records from anon, public;
revoke all on public.leave_requests from anon, public;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.work_shifts to authenticated;
grant select on public.shift_assignments to authenticated;
grant select, insert, update, delete on public.shift_assignments to authenticated;
grant select on public.attendance_records to authenticated;
grant select, insert, update, delete on public.attendance_records to authenticated;
grant select, insert, update, delete on public.leave_requests to authenticated;

revoke all on function public.is_hr() from anon, public;
revoke all on function public.is_admin() from anon, public;
revoke all on function public.vn_today() from anon, public;
revoke all on function public.clock_in(uuid, text) from anon, public;
revoke all on function public.clock_out(uuid, text) from anon, public;
revoke all on function public.confirm_attendance(uuid) from anon, public;
grant execute on function public.is_hr() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.vn_today() to authenticated;
grant execute on function public.clock_in(uuid, text) to authenticated;
grant execute on function public.clock_out(uuid, text) to authenticated;
grant execute on function public.confirm_attendance(uuid) to authenticated;

-- Các hàm trigger (RETURNS trigger) không bao giờ được gọi trực tiếp qua API
-- (Postgres cấm thực thi hàm trigger bằng SELECT); thu hồi EXECUTE để giảm
-- bề mặt tấn công. Trigger vẫn kích hoạt bình thường vì việc bắn trigger
-- không kiểm tra quyền EXECUTE trên hàm.
revoke all on function public.prevent_profile_role_escalation() from anon, authenticated, public;
revoke all on function public.enforce_profile_insert_role() from anon, authenticated, public;
revoke all on function public.touch_updated_at() from anon, authenticated, public;
revoke all on function public.enforce_leave_insert() from anon, authenticated, public;
revoke all on function public.enforce_leave_update() from anon, authenticated, public;
revoke all on function public.enforce_leave_delete() from anon, authenticated, public;
revoke all on function public.enforce_attendance_write() from anon, authenticated, public;
