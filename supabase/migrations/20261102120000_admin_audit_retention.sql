-- The operator audit trail is append-only, so left alone it grows for the life of the
-- project. This adds the retention operation. Scheduling stays an operator choice: no
-- scheduler inside the application is trusted with the connection string, and the API
-- has no route that may call this function.
--
-- One window for every organization: these rows exist to answer "what did the operator
-- do across tenants", so per-tenant windows would fragment that answer without keeping
-- the table smaller overall.

create or replace function app.prune_admin_audit_events(p_retention_days integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz;
  v_deleted integer;
begin
  -- A mistyped window here deletes history, so out-of-range values are treated as a
  -- mistake rather than a policy: below 30 days is too short to investigate an
  -- incident, above 10 years is not a retention window.
  if p_retention_days is null or p_retention_days < 30 or p_retention_days > 3650 then
    raise exception 'invalid_retention_window' using errcode = '22023';
  end if;

  v_cutoff := now() - make_interval(days => p_retention_days);

  delete from public.admin_audit_events
  where created_at < v_cutoff;

  get diagnostics v_deleted = row_count;

  return v_deleted;
end
$$;

-- Owner-only by design: the operator runs it with the migration/administration role
-- through a scheduler. CREATE FUNCTION grants EXECUTE to PUBLIC, so both the implicit
-- and the application-role paths are closed explicitly — a signed-in member must not
-- be able to shorten the trail.
revoke execute on function app.prune_admin_audit_events(integer) from public;
revoke execute on function app.prune_admin_audit_events(integer) from authenticated;
