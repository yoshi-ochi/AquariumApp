-- アカウント削除。schema.sql（同盟を使う場合は alliance.sql も）の実行後に SQL Editor で Run。何度実行しても安全。
-- auth.users の行を消すと、プロフィール・セーブ・フレンド・同盟の所属・合同調査の出資が連鎖して削除される。
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'ログインが必要です'; end if;
  -- 盟主の退会で同盟全体が消えないよう、先に脱退して盟主を引き継ぐ
  if to_regprocedure('public.leave_alliance()') is not null then
    execute 'select public.leave_alliance()';
  end if;
  delete from auth.users where id = v_uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
