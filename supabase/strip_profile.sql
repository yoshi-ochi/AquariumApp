-- Google 等の外部ログインで受け取った名前・プロフィール写真をサーバーに残さない。SQL Editor で Run。何度実行しても安全。
-- ゲームはこれらを使わない（表示名の初期値はプレイヤーID）。ログインのたびに書き戻されるため、トリガーで毎回取り除く。

create or replace function public.strip_profile_meta(j jsonb) returns jsonb
language sql immutable as $$
  select coalesce(j, '{}'::jsonb) - array['name', 'full_name', 'given_name', 'family_name', 'nickname',
    'user_name', 'preferred_username', 'avatar_url', 'picture', 'custom_claims'];
$$;

create or replace function public.strip_user_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.raw_user_meta_data := public.strip_profile_meta(new.raw_user_meta_data);
  return new;
end $$;

create or replace function public.strip_identity_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.identity_data := public.strip_profile_meta(new.identity_data);
  return new;
end $$;

drop trigger if exists strip_user_profile on auth.users;
create trigger strip_user_profile before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.strip_user_profile();

drop trigger if exists strip_identity_profile on auth.identities;
create trigger strip_identity_profile before insert or update of identity_data on auth.identities
  for each row execute function public.strip_identity_profile();

-- 既存アカウントに残っている名前・写真も消す
update auth.users set raw_user_meta_data = public.strip_profile_meta(raw_user_meta_data)
  where raw_user_meta_data ?| array['name', 'full_name', 'given_name', 'family_name', 'nickname', 'user_name', 'preferred_username', 'avatar_url', 'picture', 'custom_claims'];
update auth.identities set identity_data = public.strip_profile_meta(identity_data)
  where identity_data ?| array['name', 'full_name', 'given_name', 'family_name', 'nickname', 'user_name', 'preferred_username', 'avatar_url', 'picture', 'custom_claims'];
