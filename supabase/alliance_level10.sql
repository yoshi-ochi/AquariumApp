-- 同盟レベルの上限を10にする。SQL Editor で Run。何度実行しても安全。
-- 必要な累計の貢献：Lv2 100 / Lv3 500 / Lv4 2,000 / Lv5 5,000 / Lv6 12,000 / Lv7 25,000 / Lv8 50,000 / Lv9 100,000 / Lv10 200,000
-- （アプリの creatureData.js の ALLIANCE_XP と同じ値。メンバーの上限は 10 + レベル×5 人のまま）
create or replace function public.alliance_level(p_xp bigint) returns int
language sql immutable as $$
  select case
    when p_xp >= 200000 then 10 when p_xp >= 100000 then 9 when p_xp >= 50000 then 8
    when p_xp >= 25000 then 7 when p_xp >= 12000 then 6 when p_xp >= 5000 then 5
    when p_xp >= 2000 then 4 when p_xp >= 500 then 3 when p_xp >= 100 then 2 else 1 end;
$$;
