-- Publication must pass server byte verification, including legacy upload endpoints.
revoke insert on public.catalog_reference_images from authenticated;
grant insert on public.catalog_reference_images to service_role;

-- Private immutable staging and server-only completion receipts. No historical rows changed.
create table public.media_upload_jobs (
  owner_id uuid not null references public.users(id) on delete cascade,
  id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  expires_at timestamptz not null default now()+interval '2 hours',
  result jsonb,
  destination_created boolean not null default false,
  cleanup_claimed_at timestamptz,
  staging_cleaned_at timestamptz,
  created_at timestamptz not null default now(),
  primary key(owner_id,id)
);
alter table public.media_upload_jobs enable row level security;
revoke all on public.media_upload_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.media_upload_jobs to service_role;
create index media_upload_jobs_expiry on public.media_upload_jobs(expires_at) where staging_cleaned_at is null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('media-upload-staging','media-upload-staging',false,52428800,
 array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']);
-- No authenticated/anonymous staging policies: only server-issued single-object signed uploads.

-- Shared server-verified publication boundary, also used by legacy upload routes.
create function public.create_verified_catalog_reference(p_owner uuid,p_template uuid,p_id uuid,p_path text,p_mime text,p_size bigint,p_source_key text)
returns public.catalog_reference_images language plpgsql security definer set search_path=pg_catalog as $$
declare r public.catalog_reference_images;
begin
 if p_path<>p_owner::text||'/'||p_template::text||'/'||p_id::text
  or not exists(select 1 from public.collectible_templates where id=p_template and status<>'restricted')
  or (not exists(select 1 from public.holdings where template_id=p_template and owner_user_id=p_owner)
      and not exists(select 1 from public.catalog_contributions where template_id=p_template and contributor_user_id=p_owner))
  then raise exception 'not_authorized'; end if;
 if not exists(select 1 from storage.objects where bucket_id='catalog-reference-images' and name=p_path) then raise exception 'upload_object_missing'; end if;
 insert into public.catalog_reference_images(id,collectible_template_id,storage_bucket,storage_path,contributed_by_user_id,source_type,status,mime_type,byte_size,source_key)
 values(p_id,p_template,'catalog-reference-images',p_path,p_owner,'community_contribution','active',p_mime,p_size,p_source_key) returning * into r;
 return r;
end $$;
revoke all on function public.create_verified_catalog_reference(uuid,uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.create_verified_catalog_reference(uuid,uuid,uuid,text,text,bigint,text) to service_role;

create function public.complete_media_upload(p_owner uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare j public.media_upload_jobs; p jsonb; purpose text; context_id uuid;
 bucket text; path text; v_result jsonb; old_path text;
begin
 select * into j from public.media_upload_jobs where owner_id=p_owner and id=p_id for update;
 if not found then raise exception 'upload_not_found'; end if;
 if j.result is not null then return j.result; end if;
 if j.cleanup_claimed_at is not null then raise exception 'upload_busy'; end if;
 if j.expires_at<=clock_timestamp() then raise exception 'upload_expired'; end if;
 p:=j.payload; purpose:=p->>'purpose'; context_id:=nullif(p->>'contextId','')::uuid;
 bucket:=case purpose when 'holding' then 'collectible-media' when 'catalog' then 'catalog-reference-images'
 when 'avatar' then 'profile-avatars' when 'post' then 'post-media' else null end;
 path:=p_owner::text||'/'||p_id::text;
 if purpose='holding' then path:=path||'/original';
 elsif purpose='catalog' then path:=p_owner::text||'/'||context_id::text||'/'||p_id::text;
 elsif purpose='avatar' then path:=path||'.jpg';
 elsif purpose='post' then path:=path||'/0'; end if;
 if bucket is null then raise exception 'invalid_purpose'; end if;
 if p->'media' <> 'null'::jsonb and not exists(select 1 from storage.objects where bucket_id=bucket and name=path)
 then raise exception 'upload_object_missing'; end if;
 -- This RPC is service-role ONLY, after byte/size/type verification and Storage copy.
 if purpose='holding' then
  if not exists(select 1 from public.holdings where id=context_id and owner_user_id=p_owner) then raise exception 'not_authorized'; end if;
  select storage_path into old_path from public.media_assets where holding_id=context_id;
  insert into public.media_assets(id,owner_user_id,holding_id,storage_bucket,storage_path,mime_type,byte_size)
  values(p_id,p_owner,context_id,bucket,path,p->'media'->>'mimeType',(p->'media'->>'byteSize')::bigint)
  on conflict(holding_id) do update set id=excluded.id,storage_path=excluded.storage_path,mime_type=excluded.mime_type,byte_size=excluded.byte_size;
  v_result:=jsonb_build_object('assetId',p_id,'holdingId',context_id,'oldPath',old_path);
 elsif purpose='catalog' then
  perform public.create_verified_catalog_reference(p_owner,context_id,p_id,path,p->'media'->>'mimeType',(p->'media'->>'byteSize')::bigint,p_id::text);
  v_result:=jsonb_build_object('referenceId',p_id,'templateId',context_id);
 elsif purpose='avatar' then
  v_result:=jsonb_build_object('avatarSubmissionId',p_id);
 elsif purpose='post' then
  if exists(select 1 from jsonb_array_elements_text(p->'taggedUserIds') v where not exists(select 1 from public.profiles where user_id=v::uuid)) then raise exception 'invalid_user_tag'; end if;
  if exists(select 1 from jsonb_array_elements_text(p->'taggedTemplateIds') v where not exists(select 1 from public.collectible_templates where id=v::uuid and status<>'restricted' and publication_state in ('published','needs-media'))) then raise exception 'invalid_collectible_tag'; end if;
  insert into public.posts(id,author_user_id,caption,location_text,visibility) values(p_id,p_owner,nullif(p->>'caption',''),nullif(p->>'location',''),'public');
  if p->'media'<>'null'::jsonb then
   insert into public.post_media(post_id,owner_user_id,storage_bucket,storage_path,media_type,mime_type,byte_size,sort_order)
   values(p_id,p_owner,bucket,path,case when p->'media'->>'mimeType' like 'video/%' then 'video' else 'image' end,p->'media'->>'mimeType',(p->'media'->>'byteSize')::bigint,0);
  end if;
  insert into public.post_user_tags(post_id,tagged_user_id) select p_id,v::uuid from jsonb_array_elements_text(p->'taggedUserIds') v;
  insert into public.post_collectible_tags(post_id,template_id) select p_id,v::uuid from jsonb_array_elements_text(p->'taggedTemplateIds') v;
  v_result:=jsonb_build_object('postId',p_id);
 end if;
 update public.media_upload_jobs set result=v_result where owner_id=p_owner and id=p_id;
 return v_result;
end $$;
revoke all on function public.complete_media_upload(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_media_upload(uuid,uuid) to service_role;

-- Expired operations can obtain fresh authorization under the same retry identity.
create function public.renew_media_upload(p_owner uuid,p_id uuid) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare j public.media_upload_jobs;
begin
 select * into j from public.media_upload_jobs where owner_id=p_owner and id=p_id for update;
 if not found then raise exception 'upload_not_found'; end if;
 if j.cleanup_claimed_at is not null then raise exception 'upload_busy'; end if;
 if j.result is null and j.expires_at<=clock_timestamp() then
  update public.media_upload_jobs set expires_at=clock_timestamp()+interval '2 hours',staging_cleaned_at=null where owner_id=p_owner and id=p_id;
 end if;
end $$;
revoke all on function public.renew_media_upload(uuid,uuid) from public,anon,authenticated;
grant execute on function public.renew_media_upload(uuid,uuid) to service_role;

-- Not scheduled by this migration. An approved worker calls this bounded claim.
create function public.claim_media_upload_cleanup(p_limit integer default 25)
returns setof public.media_upload_jobs language sql security definer set search_path=pg_catalog as $$
 with candidates as (
  select owner_id,id from public.media_upload_jobs where expires_at<now()-interval '24 hours'
   and staging_cleaned_at is null and (cleanup_claimed_at is null or cleanup_claimed_at<now()-interval '1 hour')
  order by expires_at limit greatest(1,least(coalesce(p_limit,25),50)) for update skip locked
 ) update public.media_upload_jobs j set cleanup_claimed_at=now() from candidates c
 where j.owner_id=c.owner_id and j.id=c.id returning j.*;
$$;
revoke all on function public.claim_media_upload_cleanup(integer) from public,anon,authenticated;
grant execute on function public.claim_media_upload_cleanup(integer) to service_role;

-- Editing a failed draft must cancel its previous unfinished transaction before retry.
create function public.abandon_media_post(p_owner uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare j public.media_upload_jobs; receipt jsonb:='{"canceled":true}';
begin
 select * into j from public.media_upload_jobs where owner_id=p_owner and id=p_id for update;
 if not found then return receipt; end if;
 if j.payload->>'purpose'<>'post' then raise exception 'not_authorized'; end if;
 if j.result is not null then return j.result; end if;
 update public.media_upload_jobs set result=receipt where owner_id=p_owner and id=p_id;
 return receipt;
end $$;
revoke all on function public.abandon_media_post(uuid,uuid) from public,anon,authenticated;
grant execute on function public.abandon_media_post(uuid,uuid) to service_role;
