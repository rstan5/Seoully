-- LOCAL/DISPOSABLE ONLY: minimal Supabase Auth/Storage test substitutes.

      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create schema storage;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
      create table auth.users (
        id uuid primary key, instance_id uuid, aud text, role text, email text,
        encrypted_password text, email_confirmed_at timestamptz,
        raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz
      );
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      create table storage.buckets (id text primary key, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(),
        bucket_id text references storage.buckets(id), name text, owner uuid);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as
        $$select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1]$$;
      grant all on all tables in schema storage to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
