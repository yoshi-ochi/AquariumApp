-- 同盟水族館・立地・合同調査。schema.sql の実行後に SQL Editor で Run。何度実行しても安全。

-- ---- 立地（おおまかな位置。0.1度単位で保存） ---------------------------------
alter table public.profiles add column if not exists lat double precision check (lat between -85 and 85);
alter table public.profiles add column if not exists lon double precision check (lon between -180 and 180);

-- ---- 同盟 --------------------------------------------------------------------
create table if not exists public.alliances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 16),
  owner uuid not null references public.profiles on delete cascade,
  xp bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.alliance_members (
  user_id uuid primary key references public.profiles on delete cascade, -- 1人1同盟
  alliance_id uuid not null references public.alliances on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists alliance_members_alliance on public.alliance_members (alliance_id);

-- ---- 合同調査 ----------------------------------------------------------------
create table if not exists public.joint_runs (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances on delete cascade,
  project text not null,
  funded bigint not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
-- 同じ調査は、資金集め中のものを同盟につき1件まで
create unique index if not exists joint_runs_open on public.joint_runs (alliance_id, project) where done_at is null;

create table if not exists public.joint_contribs (
  run_id uuid not null references public.joint_runs on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  amount bigint not null default 0,
  claimed boolean not null default false,
  primary key (run_id, user_id)
);

-- ---- 共通の計算 --------------------------------------------------------------
create or replace function public.alliance_level(p_xp bigint) returns int
language sql immutable as $$
  select case when p_xp >= 5000 then 5 when p_xp >= 2000 then 4 when p_xp >= 500 then 3 when p_xp >= 100 then 2 else 1 end;
$$;

create or replace function public.my_alliance() returns uuid
language sql stable security definer set search_path = public as $$
  select alliance_id from alliance_members where user_id = auth.uid();
$$;

create or replace function public.are_allied(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from alliance_members x join alliance_members y using (alliance_id)
    where x.user_id = a and y.user_id = b
  );
$$;

-- ---- 同盟の操作（表への直接の書き込みは禁止し、この関数だけを通す） ------------
create or replace function public.create_alliance(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if my_alliance() is not null then raise exception 'すでに同盟に入っています'; end if;
  insert into alliances (name, owner) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into alliance_members (user_id, alliance_id) values (auth.uid(), v_id);
  return v_id;
end $$;

create or replace function public.join_alliance(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_xp bigint; v_count int;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if my_alliance() is not null then raise exception 'すでに同盟に入っています'; end if;
  select xp into v_xp from alliances where id = p_id for update;
  if not found then raise exception '同盟が見つかりません'; end if;
  select count(*) into v_count from alliance_members where alliance_id = p_id;
  if v_count >= 10 + alliance_level(v_xp) * 5 then raise exception 'この同盟は満員です'; end if;
  insert into alliance_members (user_id, alliance_id) values (auth.uid(), p_id);
end $$;

create or replace function public.leave_alliance() returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid := my_alliance(); v_next uuid;
begin
  if v_id is null then return; end if;
  delete from alliance_members where user_id = auth.uid();
  select user_id into v_next from alliance_members where alliance_id = v_id order by joined_at limit 1;
  if v_next is null then delete from alliances where id = v_id;
  else update alliances set owner = v_next where id = v_id and owner = auth.uid();
  end if;
end $$;

-- 調査の定義（費用はサーバー側で管理）
create or replace function public.joint_project(p_project text, out cost bigint, out need_level int, out hours int)
language plpgsql immutable as $$
begin
  case p_project
    when 'ship' then cost := 5000000; need_level := 1; hours := 1;
    when 'rov' then cost := 20000000; need_level := 2; hours := 3;
    when 'polar' then cost := 80000000; need_level := 3; hours := 12;
    else raise exception '不明な調査です';
  end case;
end $$;

-- 出資。目標額に達すると調査が始まる。戻り値は実際に受け付けた金額
create or replace function public.fund_joint(p_project text, p_amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ally uuid := my_alliance();
  v_p record;
  v_xp bigint;
  v_run joint_runs;
  v_take bigint;
begin
  if v_ally is null then raise exception '同盟に入っていません'; end if;
  if p_amount <= 0 or p_amount > 100000000 then raise exception '出資額が正しくありません'; end if;
  select * into v_p from joint_project(p_project);
  select xp into v_xp from alliances where id = v_ally for update;
  if alliance_level(v_xp) < v_p.need_level then raise exception '同盟レベルが足りません'; end if;
  insert into joint_runs (alliance_id, project) values (v_ally, p_project) on conflict do nothing;
  select * into v_run from joint_runs where alliance_id = v_ally and project = p_project and done_at is null for update;
  v_take := least(p_amount, v_p.cost - v_run.funded);
  update joint_runs set funded = funded + v_take,
    done_at = case when funded + v_take >= v_p.cost then now() + make_interval(hours => v_p.hours) end
    where id = v_run.id;
  insert into joint_contribs (run_id, user_id, amount) values (v_run.id, auth.uid(), v_take)
    on conflict (run_id, user_id) do update set amount = joint_contribs.amount + excluded.amount;
  update alliances set xp = xp + floor(v_take / 100000) where id = v_ally;
  return v_take;
end $$;

-- 完了した調査の成果を受け取る（1人1回）
create or replace function public.claim_joint(p_run uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_done timestamptz;
begin
  select done_at into v_done from joint_runs where id = p_run;
  if v_done is null or v_done > now() then return false; end if;
  update joint_contribs set claimed = true where run_id = p_run and user_id = auth.uid() and not claimed;
  return found;
end $$;

-- ---- 権限 --------------------------------------------------------------------
alter table public.alliances enable row level security;
alter table public.alliance_members enable row level security;
alter table public.joint_runs enable row level security;
alter table public.joint_contribs enable row level security;

drop policy if exists "alliances read" on public.alliances;
create policy "alliances read" on public.alliances for select to authenticated using (true);
drop policy if exists "members read" on public.alliance_members;
create policy "members read" on public.alliance_members for select to authenticated using (true);
drop policy if exists "runs read" on public.joint_runs;
create policy "runs read" on public.joint_runs for select to authenticated using (alliance_id = public.my_alliance());
drop policy if exists "contribs read" on public.joint_contribs;
create policy "contribs read" on public.joint_contribs for select to authenticated
  using (exists (select 1 from public.joint_runs r where r.id = run_id and r.alliance_id = public.my_alliance()));

-- 同盟の仲間の水族館も訪問できる
drop policy if exists "saves allies read" on public.saves;
create policy "saves allies read" on public.saves for select to authenticated
  using (public.are_allied(auth.uid(), user_id));

grant select on public.alliances, public.alliance_members, public.joint_runs, public.joint_contribs to authenticated;
revoke all on function public.create_alliance(text), public.join_alliance(uuid), public.leave_alliance(),
  public.fund_joint(text, bigint), public.claim_joint(uuid) from public, anon;
grant execute on function public.create_alliance(text), public.join_alliance(uuid), public.leave_alliance(),
  public.fund_joint(text, bigint), public.claim_joint(uuid), public.alliance_level(bigint),
  public.my_alliance(), public.are_allied(uuid, uuid) to authenticated;
