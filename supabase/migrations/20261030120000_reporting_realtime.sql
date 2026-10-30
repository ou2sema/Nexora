-- Reporting reads balances, reservations, devices and the ledger directly, so
-- the dashboard subscribes to changes on those tables. Supabase Realtime
-- evaluates the caller's RLS policies for every change, so a subscription never
-- widens tenant access. Local test databases have no supabase_realtime
-- publication; the guard keeps the migration applicable everywhere.

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'stock_balances',
      'stock_movements',
      'stock_reservations',
      'devices'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end
$$;
