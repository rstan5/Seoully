-- RLS helper: catalog contributions are intentionally not directly readable,
-- so reference-image insert authorization checks them through a definer function.
create or replace function public.user_catalog_contribution_exists(p_template_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.catalog_contributions
    where template_id = p_template_id and contributor_user_id = p_user_id
  );
$$;
revoke all on function public.user_catalog_contribution_exists(uuid, uuid) from public, anon, authenticated;
grant execute on function public.user_catalog_contribution_exists(uuid, uuid) to authenticated;

drop policy if exists catalog_reference_images_insert_contributor on public.catalog_reference_images;
create policy catalog_reference_images_insert_contributor on public.catalog_reference_images for insert to authenticated
with check (
  contributed_by_user_id = (select public.current_seoully_user_id())
  and storage_bucket = 'catalog-reference-images'
  and storage_path like ((select public.current_seoully_user_id())::text || '/%')
  and public.user_catalog_contribution_exists(collectible_template_id, (select public.current_seoully_user_id()))
);
