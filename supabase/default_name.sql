-- 初期の表示名をプレイヤーID（フレンドコード）にする。schema.sql の実行後に SQL Editor で Run。何度実行しても安全。
-- Google 等のアカウント名やメールアドレスを、他のプレイヤーに見せないため。

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  loop
    v_code := upper(substr(md5(random()::text), 1, 8));
    exit when not exists (select 1 from public.profiles where friend_code = v_code);
  end loop;
  insert into public.profiles (id, name, friend_code) values (new.id, v_code, v_code)
  on conflict do nothing;
  return new;
end $$;

-- 既存アカウントのうち、表示名がログイン元の名前のまま（未変更）の人をIDに戻す
update public.profiles p
set name = p.friend_code
from auth.users u
where u.id = p.id
  and p.name in (
    coalesce(u.raw_user_meta_data->>'full_name', ''),
    coalesce(u.raw_user_meta_data->>'name', ''),
    coalesce(u.raw_user_meta_data->>'user_name', '')
  );
