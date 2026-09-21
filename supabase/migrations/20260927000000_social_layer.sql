-- Phase 13: production social graph and authored posts.

create table if not exists public.follows (
  follower_user_id uuid not null references public.users(id) on delete cascade,
  followed_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, followed_user_id),
  check (follower_user_id <> followed_user_id)
);

create index if not exists follows_followed_idx on public.follows (followed_user_id, created_at desc, follower_user_id);
create index if not exists follows_follower_idx on public.follows (follower_user_id, created_at desc, followed_user_id);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.users(id) on delete cascade,
  caption text,
  location_text text,
  visibility text not null default 'public' check (visibility in ('public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts add constraint posts_caption_length check (caption is null or char_length(caption) <= 2_000);
alter table public.posts add constraint posts_location_length check (location_text is null or char_length(location_text) <= 160);
create index if not exists posts_author_created_idx on public.posts (author_user_id, created_at desc, id desc);
create index if not exists posts_created_idx on public.posts (created_at desc, id desc);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  storage_bucket text not null default 'post-media',
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  width integer,
  height integer,
  duration_seconds numeric,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order < 4),
  created_at timestamptz not null default now(),
  unique (post_id, sort_order)
);

create index if not exists post_media_post_idx on public.post_media (post_id, sort_order);
create index if not exists post_media_owner_idx on public.post_media (owner_user_id, created_at desc);

create table if not exists public.post_user_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tagged_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tagged_user_id)
);

create index if not exists post_user_tags_user_idx on public.post_user_tags (tagged_user_id, created_at desc);

create table if not exists public.post_collectible_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  template_id uuid not null references public.collectible_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, template_id)
);

create index if not exists post_collectible_tags_template_idx on public.post_collectible_tags (template_id, created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_post_idx on public.post_likes (post_id, created_at desc, user_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1_000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at asc, id asc);

create or replace function public.touch_posts_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at before update on public.posts
for each row execute function public.touch_posts_updated_at();

create or replace function public.touch_post_comments_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists post_comments_touch_updated_at on public.post_comments;
create trigger post_comments_touch_updated_at before update on public.post_comments
for each row execute function public.touch_post_comments_updated_at();

alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_user_tags enable row level security;
alter table public.post_collectible_tags enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

revoke all on public.follows, public.posts, public.post_media, public.post_user_tags, public.post_collectible_tags, public.post_likes, public.post_comments from anon, authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.post_media, public.post_user_tags, public.post_collectible_tags, public.post_likes to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;

create policy follows_select_authenticated on public.follows for select to authenticated using (true);
create policy follows_insert_self on public.follows for insert to authenticated
with check (follower_user_id = (select public.current_seoully_user_id()) and follower_user_id <> followed_user_id);
create policy follows_delete_self on public.follows for delete to authenticated
using (follower_user_id = (select public.current_seoully_user_id()));

create policy posts_select_visible on public.posts for select to authenticated
using (visibility = 'public' or author_user_id = (select public.current_seoully_user_id()));
create policy posts_insert_self on public.posts for insert to authenticated
with check (author_user_id = (select public.current_seoully_user_id()));
create policy posts_update_self on public.posts for update to authenticated
using (author_user_id = (select public.current_seoully_user_id()))
with check (author_user_id = (select public.current_seoully_user_id()));
create policy posts_delete_self on public.posts for delete to authenticated
using (author_user_id = (select public.current_seoully_user_id()));

create policy post_media_select_visible on public.post_media for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_media.post_id and (p.visibility = 'public' or p.author_user_id = (select public.current_seoully_user_id()))));
create policy post_media_insert_author on public.post_media for insert to authenticated
with check (owner_user_id = (select public.current_seoully_user_id()) and exists (select 1 from public.posts p where p.id = post_media.post_id and p.author_user_id = (select public.current_seoully_user_id())));
create policy post_media_delete_author on public.post_media for delete to authenticated
using (owner_user_id = (select public.current_seoully_user_id()));

create policy post_user_tags_select_visible on public.post_user_tags for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_user_tags.post_id and (p.visibility = 'public' or p.author_user_id = (select public.current_seoully_user_id()))));
create policy post_user_tags_insert_author on public.post_user_tags for insert to authenticated
with check (exists (select 1 from public.posts p where p.id = post_user_tags.post_id and p.author_user_id = (select public.current_seoully_user_id())));
create policy post_user_tags_delete_author on public.post_user_tags for delete to authenticated
using (exists (select 1 from public.posts p where p.id = post_user_tags.post_id and p.author_user_id = (select public.current_seoully_user_id())));

create policy post_collectible_tags_select_visible on public.post_collectible_tags for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_collectible_tags.post_id and (p.visibility = 'public' or p.author_user_id = (select public.current_seoully_user_id()))));
create policy post_collectible_tags_insert_author on public.post_collectible_tags for insert to authenticated
with check (exists (select 1 from public.posts p where p.id = post_collectible_tags.post_id and p.author_user_id = (select public.current_seoully_user_id())));
create policy post_collectible_tags_delete_author on public.post_collectible_tags for delete to authenticated
using (exists (select 1 from public.posts p where p.id = post_collectible_tags.post_id and p.author_user_id = (select public.current_seoully_user_id())));

create policy post_likes_select_visible on public.post_likes for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_likes.post_id and (p.visibility = 'public' or p.author_user_id = (select public.current_seoully_user_id()))));
create policy post_likes_insert_self on public.post_likes for insert to authenticated
with check (user_id = (select public.current_seoully_user_id()) and exists (select 1 from public.posts p where p.id = post_likes.post_id and p.visibility = 'public'));
create policy post_likes_delete_self on public.post_likes for delete to authenticated
using (user_id = (select public.current_seoully_user_id()));

create policy post_comments_select_visible on public.post_comments for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_comments.post_id and (p.visibility = 'public' or p.author_user_id = (select public.current_seoully_user_id()))));
create policy post_comments_insert_self on public.post_comments for insert to authenticated
with check (author_user_id = (select public.current_seoully_user_id()) and exists (select 1 from public.posts p where p.id = post_comments.post_id and p.visibility = 'public'));
create policy post_comments_update_self on public.post_comments for update to authenticated
using (author_user_id = (select public.current_seoully_user_id()))
with check (author_user_id = (select public.current_seoully_user_id()));
create policy post_comments_delete_self on public.post_comments for delete to authenticated
using (author_user_id = (select public.current_seoully_user_id()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']::text[])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists post_media_storage_insert_own on storage.objects;
create policy post_media_storage_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text);
drop policy if exists post_media_storage_update_own on storage.objects;
create policy post_media_storage_update_own on storage.objects for update to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text)
with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text);
drop policy if exists post_media_storage_delete_own on storage.objects;
create policy post_media_storage_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select public.current_seoully_user_id())::text);
