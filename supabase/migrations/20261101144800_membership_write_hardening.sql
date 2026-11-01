-- Memberships are readable through the existing tenant-scoped SELECT policy, but
-- all membership mutations must go through the SECURITY DEFINER RPCs. RLS DML
-- policies alone are not a sufficient write boundary for this table.
revoke insert, update, delete on table public.memberships from authenticated;

drop policy if exists memberships_insert_admin on public.memberships;
drop policy if exists memberships_update_admin on public.memberships;
drop policy if exists memberships_delete_admin on public.memberships;

-- Serialize every change that could remove an owner against a stable row shared
-- by all membership rows in the organization. The separate count statement below
-- runs after acquiring this lock; in READ COMMITTED, the volatile trigger's SQL
-- statement gets a current snapshot after any wait, so it observes a preceding
-- transaction's committed demotion/deletion before deciding whether this change
-- would remove the last owner. The lock is also retained through commit.
create or replace function app.protect_last_owner()
returns trigger
language plpgsql
as $$
declare
  v_remaining integer;
begin
  if tg_op = 'UPDATE' and new.role = 'owner' and new.organization_id = old.organization_id then
    return new;
  end if;

  -- Lock both organizations in a stable UUID order if a membership is moved.
  -- Deletes and ordinary role changes only need the old organization's row.
  if tg_op = 'UPDATE'
    and new.organization_id is distinct from old.organization_id
    and new.organization_id < old.organization_id then
    perform 1 from public.organizations where id = new.organization_id for update;
    perform 1 from public.organizations where id = old.organization_id for update;
  else
    perform 1 from public.organizations where id = old.organization_id for update;
    if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
      perform 1 from public.organizations where id = new.organization_id for update;
    end if;
  end if;

  select count(*)
  into v_remaining
  from public.memberships
  where organization_id = old.organization_id
    and role = 'owner'
    and id <> old.id;

  if v_remaining = 0 then
    raise exception 'organization_requires_owner' using errcode = '23514';
  end if;

  return coalesce(new, old);
end
$$;
