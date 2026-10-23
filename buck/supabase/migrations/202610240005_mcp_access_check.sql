-- Buck MCP server (ADR-050): lets the caller ask whether its own token may
-- read data, so a connected app gets a clear "reconnect after 2FA" message
-- instead of empty results.
--
-- It only reports private.mfa_satisfied() (ADR-048/049) for the caller's own
-- JWT: no other user's data, nothing the RLS policies don't already decide.

create or replace function public.current_session_can_read()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.mfa_satisfied();
$$;

comment on function public.current_session_can_read() is
  'True when the caller''s token passes the 2FA rule (private.mfa_satisfied). Used by the Buck MCP server (ADR-050).';

revoke all on function public.current_session_can_read() from public, anon;
grant execute on function public.current_session_can_read() to authenticated, service_role;

-- Down:
--   drop function if exists public.current_session_can_read();
