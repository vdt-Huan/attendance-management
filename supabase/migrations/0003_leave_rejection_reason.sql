-- =====================================================================
-- Attendance Management — Migration 0003: lý do từ chối đơn nghỉ phép
-- File: supabase/migrations/0003_leave_rejection_reason.sql
--
-- Thay đổi:
-- 1. Thêm cột rejection_reason (text, nullable) vào leave_requests.
-- 2. Ràng buộc: rejection_reason chỉ có khi status = 'rejected', và phải
--    có độ dài 5–1000 ký tự; khi status khác 'rejected' thì phải NULL.
-- 3. Cập nhật trigger enforce_leave_insert / enforce_leave_update để:
--    - Nhân viên không được chạm rejection_reason.
--    - HR/Admin từ chối phải nhập lý do; khi duyệt/làm lại pending phải
--      xóa lý do từ chối.
-- Không phá hủy dữ liệu: chỉ ADD COLUMN (IF NOT EXISTS) + CREATE OR REPLACE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cột rejection_reason
-- ---------------------------------------------------------------------
alter table public.leave_requests
  add column if not exists rejection_reason text;

-- Ràng buộc độ dài (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leave_rejection_reason_length'
  ) then
    alter table public.leave_requests
      add constraint leave_rejection_reason_length
      check (rejection_reason is null or (char_length(rejection_reason) between 5 and 1000));
  end if;
end $$;

-- Ràng buộc trạng thái: chỉ rejected mới có lý do (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leave_rejection_reason_status'
  ) then
    alter table public.leave_requests
      add constraint leave_rejection_reason_status
      check (
        (status = 'rejected' and rejection_reason is not null)
        or (status <> 'rejected' and rejection_reason is null)
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Trigger enforce_leave_insert
-- ---------------------------------------------------------------------
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
    if new.status = 'rejected' then
      if new.rejection_reason is null or char_length(new.rejection_reason) < 5 or char_length(new.rejection_reason) > 1000 then
        raise exception 'Từ chối đơn phải có lý do từ chối (5–1000 ký tự).';
      end if;
    else
      if new.rejection_reason is not null then
        raise exception 'Chỉ đơn bị từ chối mới có lý do từ chối.';
      end if;
    end if;
    return new;
  end if;
  if new.status is distinct from 'pending'
     or new.reviewed_by is not null
     or new.decided_at is not null
     or new.rejection_reason is not null then
    raise exception 'Đơn mới của nhân viên phải ở trạng thái pending và chưa có người duyệt.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_leave_insert on public.leave_requests;
create trigger trg_enforce_leave_insert
  before insert on public.leave_requests
  for each row execute function public.enforce_leave_insert();

-- ---------------------------------------------------------------------
-- 3. Trigger enforce_leave_update
-- ---------------------------------------------------------------------
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
    if new.status = 'rejected' then
      if new.rejection_reason is null or char_length(new.rejection_reason) < 5 or char_length(new.rejection_reason) > 1000 then
        raise exception 'Từ chối đơn phải có lý do từ chối (5–1000 ký tự).';
      end if;
    else
      if new.rejection_reason is not null then
        raise exception 'Chỉ đơn bị từ chối mới có lý do từ chối.';
      end if;
    end if;
    return new;
  end if;
  if old.status is distinct from 'pending' then
    raise exception 'Chỉ được sửa đơn đang chờ duyệt.';
  end if;
  if new.status is distinct from 'pending'
     or new.employee_id is distinct from old.employee_id
     or new.reviewed_by is distinct from old.reviewed_by
     or new.decided_at is distinct from old.decided_at
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Nhân viên không được tự duyệt đơn hoặc sửa thông tin người duyệt.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_leave_update on public.leave_requests;
create trigger trg_enforce_leave_update
  before update on public.leave_requests
  for each row execute function public.enforce_leave_update();
