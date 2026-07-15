REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- has_role remains executable by authenticated for RLS policies that reference it inline; but since it is SECURITY DEFINER and called from RLS policies (which use the function owner's privileges), we can safely revoke from authenticated too. RLS-invoked functions do not require caller EXECUTE.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;