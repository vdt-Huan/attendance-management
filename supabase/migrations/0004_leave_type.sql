-- =====================================================================
-- Attendance Management — Migration 0004: loại nghỉ phép
-- File: supabase/migrations/0004_leave_type.sql
--
-- Thay đổi:
-- 1. Thêm cột leave_type (text, NOT NULL, default 'annual') vào leave_requests.
-- 2. Ràng buộc CHECK: leave_type in (annual, sick, unpaid, wedding, maternity, other).
-- 3. Dữ liệu cũ (nếu có) được đặt leave_type = 'annual'.
-- 4. Cập nhật trigger enforce_leave_insert / enforce_leave_update để kiểm tra
--    leave_type hợp lệ; nhân viên không được tự đổi leave_type sau khi đơn
--    đã xử lý (chỉ được sửa khi pending).
-- Không phá hủy dữ liệu: chỉ ADD COLUMN (IF NOT EXISTS) + CREATE OR REPLACE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cột leave_type
-- ---------------------------------------------------------------------
alter table public.leave_requests
  add column if not exists leave_type text;

-- Dữ liệu cũ: đặt mặc định 'annual'.
update public.leave_requests
  set leave_type = 'annual'
  where leave_type is null;

alter table public.leave_requests
  alter column leave_type set default 'annual';

alter table public.leave_requests
  alter column leave_type set not null;

-- Ràng buộc giá trị (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leave_type_check'
  ) then
    alter table public.leave_requests
      add constraint leave_type_check
      check (leave_type in ('annual', 'sick', 'unpaid', 'wedding', 'maternity', 'other'));
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
  if new.leave_type is null
     or new.leave_type not in ('annual', 'sick', 'unpaid', 'wedding', 'maternity', 'other') then
    raise exception 'Loại nghỉ phép không hợp lệ.';
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
  if new.leave_type is null
     or new.leave_type not in ('annual', 'sick', 'unpaid', 'wedding', 'maternity', 'other') then
    raise exception 'Loại nghỉ phép không hợp lệ.';
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
