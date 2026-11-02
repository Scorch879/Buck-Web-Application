-- Anonymous feedback identity hashing (2026-10-28).
--
-- Ensures `public.feedback.user_email` never stores plaintext e-mail addresses:
-- 1. `private.sha256_email(text)` computes the 64-character lowercase SHA-256
--    hex digest of `lower(btrim(email))` using PostgreSQL's built-in `sha256`.
-- 2. Backfills all existing `public.feedback` rows so any plaintext `user_email`
--    is replaced in-place with its SHA-256 hex digest.
-- 3. `private.hash_feedback_user_email()` BEFORE INSERT OR UPDATE trigger
--    transparently hashes the caller's e-mail (accepting either the caller's
--    raw e-mail or its pre-computed SHA-256 digest) while preserving caller
--    verification in the RLS `WITH CHECK` policy.
-- 4. Enforces `feedback_email_sha256_check` (`user_email ~ '^[0-9a-f]{64}$'`).
--
-- Down:
--   drop trigger if exists trg_feedback_hash_user_email on public.feedback;
--   drop function if exists private.hash_feedback_user_email();
--   drop function if exists private.sha256_email(text);
--   alter table public.feedback drop constraint if exists feedback_email_sha256_check;

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.sha256_email(p_email text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))),
        'UTF8'
      )
    ),
    'hex'
  );
$$;

comment on function private.sha256_email(text) is
  'Returns the 64-char lowercase SHA-256 hex digest of a normalized email address.';

revoke execute on function private.sha256_email(text) from public, anon;
grant execute on function private.sha256_email(text) to authenticated, service_role;

-- Backfill existing plaintext feedback rows to SHA-256 digests.
update public.feedback
   set user_email = private.sha256_email(user_email)
 where user_email !~ '^[0-9a-f]{64}$';

create or replace function private.hash_feedback_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jwt_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_input text := pg_catalog.lower(pg_catalog.btrim(coalesce(new.user_email, '')));
  v_jwt_hash text;
begin
  if v_jwt_email <> '' then
    v_jwt_hash := private.sha256_email(v_jwt_email);
    if v_input = v_jwt_email or v_input = v_jwt_hash then
      new.user_email := v_jwt_hash;
    end if;
  elsif v_input !~ '^[0-9a-f]{64}$' and v_input <> '' then
    new.user_email := private.sha256_email(v_input);
  else
    new.user_email := v_input;
  end if;
  return new;
end;
$$;

revoke execute on function private.hash_feedback_user_email() from public, anon, authenticated;
grant execute on function private.hash_feedback_user_email() to postgres, service_role;

drop trigger if exists trg_feedback_hash_user_email on public.feedback;
create trigger trg_feedback_hash_user_email
  before insert or update on public.feedback
  for each row
  execute function private.hash_feedback_user_email();

alter table public.feedback
  drop constraint if exists feedback_email_len,
  drop constraint if exists feedback_email_sha256_check;

alter table public.feedback
  add constraint feedback_email_len check (char_length(user_email) <= 254),
  add constraint feedback_email_sha256_check check (user_email ~ '^[0-9a-f]{64}$');

drop policy if exists "Users can submit feedback" on public.feedback;
create policy "Users can submit feedback" on public.feedback
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and length(btrim(user_email)) = 64
    and length(btrim(title)) > 0
    and length(btrim(details)) > 0
    and user_email = private.sha256_email((select auth.jwt()) ->> 'email')
  );

commit;
