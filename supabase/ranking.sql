-- 総合レベルのランキング。SQL Editor で Run。何度実行しても安全。
-- 点数（展示している魚種の「レベル×星の重み」の合計）は端末で計算し、submit_score でだけ書き込める。
-- 1魚種の上限は Lv999×重み10 = 9990 なので、それを超える値は受け付けない。

create table if not exists public.rankings (
  user_id uuid primary key references public.profiles on delete cascade,
  score integer not null default 0 check (score >= 0),
  species integer not null default 0 check (species >= 0),
  updated_at timestamptz not null default now()
);
create index if not exists rankings_score on public.rankings (score desc);

alter table public.rankings enable row level security;
drop policy if exists "rankings read" on public.rankings;
create policy "rankings read" on public.rankings for select to authenticated using (true);
-- insert / update のポリシーは作らない（直接は書けない）

create or replace function public.submit_score(p_score integer, p_species integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if p_species < 0 or p_species > 500 or p_score < 0 or p_score > p_species * 9990 then
    raise exception '点数が正しくありません';
  end if;
  insert into rankings (user_id, score, species, updated_at) values (auth.uid(), p_score, p_species, now())
  on conflict (user_id) do update set score = excluded.score, species = excluded.species, updated_at = now();
end $$;

create or replace function public.top_ranking(p_limit integer default 100)
returns table (pos bigint, user_id uuid, name text, score integer, species integer)
language sql stable security definer set search_path = public as $$
  select rank() over (order by r.score desc), r.user_id, p.name, r.score, r.species
  from rankings r join profiles p on p.id = r.user_id
  where r.score > 0
  order by r.score desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.my_rank() returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) + 1 from rankings
  where score > coalesce((select score from rankings where user_id = auth.uid()), 0);
$$;

revoke all on function public.submit_score(integer, integer) from public, anon;
revoke all on function public.top_ranking(integer) from public, anon;
revoke all on function public.my_rank() from public, anon;
grant execute on function public.submit_score(integer, integer) to authenticated;
grant execute on function public.top_ranking(integer) to authenticated;
grant execute on function public.my_rank() to authenticated;
