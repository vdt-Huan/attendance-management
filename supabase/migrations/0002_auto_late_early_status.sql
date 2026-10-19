-- =====================================================================
-- Attendance Management — Migration 0002: tự động đánh dấu đi muộn / về sớm
-- File: supabase/migrations/0002_auto_late_early_status.sql
--
-- Thay đổi:
-- 1. Thêm cột late_minutes (integer, >= 0) vào attendance_records để lưu
--    số phút đi muộn thực tế (tính từ giờ vào ca, không trừ grace).
-- 2. Cập nhật RPC clock_in: tự xác định ca được phân công trong ngày, so
--    sánh check_in với start_time + late_after_minutes (timezone VN), gán
--    status 'di-muon' và late_minutes tương ứng.
-- 3. Cập nhật RPC clock_out: phát hiện check_out < end_time của ca (kể cả
--    ca qua đêm) và gán status 've-som' khi trước đó đúng giờ.
-- 4. Cập nhật trigger enforce_attendance_write để cho phép các giá trị status
--    do RPC sinh ra và giữ nguyên late_minutes.
--
-- Không phá hủy dữ liệu: chỉ ADD COLUMN (IF NOT EXISTS) và CREATE OR REPLACE
-- function/trigger. Chạy lại an toàn.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cột late_minutes
-- ---------------------------------------------------------------------
alter table public.attendance_records
  add column if not exists late_minutes integer
    check (late_minutes is null or late_minutes >= 0);

-- ---------------------------------------------------------------------
-- 2. RPC clock_in: tự tính đi muộn theo ca được phân công
-- ---------------------------------------------------------------------
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
  v_shift_start time;
  v_late_after integer;
  v_has_shift boolean := false;
  v_shift_start_ts timestamptz;
  v_allowed_ts timestamptz;
  v_status text := 'dung-gio';
  v_late_minutes integer := 0;
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

  -- Ca được phân công trong ngày (nếu có) để xác định giờ chuẩn.
  select ws.start_time, ws.late_after_minutes
    into v_shift_start, v_late_after
  from public.shift_assignments sa
  join public.work_shifts ws on ws.id = sa.shift_id
  where sa.employee_id = p_employee_id and sa.work_date = v_today
  limit 1;
  v_has_shift := found;

  if v_has_shift then
    v_shift_start_ts := ((v_today::timestamp + v_shift_start) at time zone 'Asia/Ho_Chi_Minh');
    v_allowed_ts := v_shift_start_ts + (coalesce(v_late_after, 0) || ' minutes')::interval;
    if now() > v_allowed_ts then
      v_status := 'di-muon';
      v_late_minutes := floor(extract(epoch from (now() - v_shift_start_ts)) / 60)::integer;
      if v_late_minutes < 0 then v_late_minutes := 0; end if;
    end if;
  end if;

  insert into public.attendance_records
    (employee_id, work_date, check_in, status, note, late_minutes)
  values
    (p_employee_id, v_today, now(), v_status, p_note, v_late_minutes)
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. RPC clock_out: phát hiện về sớm theo ca (kể cả ca qua đêm)
-- ---------------------------------------------------------------------
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
  v_shift_start time;
  v_shift_end time;
  v_late_after integer;
  v_has_shift boolean := false;
  v_shift_start_ts timestamptz;
  v_shift_end_ts timestamptz;
  v_early boolean := false;
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

  -- Ca được phân công (nếu có) để xác định giờ kết thúc.
  select ws.start_time, ws.end_time, ws.late_after_minutes
    into v_shift_start, v_shift_end, v_late_after
  from public.shift_assignments sa
  join public.work_shifts ws on ws.id = sa.shift_id
  where sa.employee_id = p_employee_id and sa.work_date = v_today
  limit 1;
  v_has_shift := found;

  if v_has_shift then
    v_shift_start_ts := ((v_today::timestamp + v_shift_start) at time zone 'Asia/Ho_Chi_Minh');
    if v_shift_end < v_shift_start then
      -- Ca qua đêm: kết thúc vào ngày hôm sau.
      v_shift_end_ts := (((v_today + 1)::timestamp + v_shift_end) at time zone 'Asia/Ho_Chi_Minh');
    else
      v_shift_end_ts := ((v_today::timestamp + v_shift_end) at time zone 'Asia/Ho_Chi_Minh');
    end if;
    if now() < v_shift_end_ts then
      v_early := true;
    end if;
  end if;

  update public.attendance_records r
  set check_out = now(),
      note = coalesce(r.note, p_note),
      status = case
        when v_early and r.status = 'dung-gio' then 've-som'
        else r.status
      end
  where r.id = v_row.id
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Trigger enforce_attendance_write: cho phép status do RPC sinh ra
-- ---------------------------------------------------------------------
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
    new.created_at := now();
    new.updated_at := now();
    if new.work_date is distinct from public.vn_today()
       or new.check_in is null
       or new.check_out is not null
       or new.status not in ('dung-gio', 'di-muon')
       or new.confirmed_at is not null
       or new.confirmed_by is not null
       or (new.note is not null and char_length(new.note) > 1000)
       or (new.late_minutes is not null and (new.late_minutes < 0 or new.late_minutes > 100000)) then
      raise exception 'Bản ghi giờ vào không hợp lệ.';
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE': nhân viên chỉ được thực hiện đúng một thao tác
  -- "ghi nhận giờ ra": set check_out lần đầu trên dòng chưa xác nhận.
  -- Status chỉ được chuyển dung-gio -> ve-som (về sớm) khi checkout sớm;
  -- di-muon giữ nguyên. late_minutes bất biến.
  if old.confirmed_at is not null or new.confirmed_at is not null
     or new.confirmed_by is not null
     or new.id is distinct from old.id
     or new.employee_id is distinct from old.employee_id
     or new.work_date is distinct from old.work_date
     or new.check_in is distinct from old.check_in
     or new.created_at is distinct from old.created_at
     or old.check_out is not null
     or new.check_out is null
     or new.check_out < new.check_in
     or new.late_minutes is distinct from old.late_minutes
     or not (
          new.status = old.status
          or (old.status = 'dung-gio' and new.status = 've-som')
        )
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
-- 5. Cấp quyền thực thi RPC (đảm bảo authenticated gọi được)
-- ---------------------------------------------------------------------
revoke all on function public.clock_in(uuid, text) from anon, public;
revoke all on function public.clock_out(uuid, text) from anon, public;
grant execute on function public.clock_in(uuid, text) to authenticated;
grant execute on function public.clock_out(uuid, text) to authenticated;
