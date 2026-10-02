revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.is_project_client(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role), public.is_owner(), public.is_project_client(uuid) to authenticated;