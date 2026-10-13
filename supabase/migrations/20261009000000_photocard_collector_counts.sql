-- Aggregate ownership only. Never expose another collector's inventory/identity.
create index if not exists holdings_template_owner_count_idx
  on public.holdings (template_id, owner_user_id);

create function public.get_photocard_collector_counts(p_template_ids uuid[])
returns table(template_id uuid, collector_count bigint)
language plpgsql stable security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.users u where u.auth_subject = auth.uid() and u.status = 'active'
  ) then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if p_template_ids is null or cardinality(p_template_ids) > 100
    or array_position(p_template_ids, null) is not null then
    raise exception 'invalid_template_ids' using errcode = '22023';
  end if;
  return query
    select t.id, count(distinct u.id)
    from public.collectible_templates t
    left join public.holdings h on h.template_id = t.id
    left join public.users u on u.id = h.owner_user_id and u.status = 'active'
    where t.id = any(p_template_ids) and t.kind = 'photocard' and t.status <> 'restricted'
    group by t.id;
end;
$$;
revoke all on function public.get_photocard_collector_counts(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.get_photocard_collector_counts(uuid[]) to authenticated;
