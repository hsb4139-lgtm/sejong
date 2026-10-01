-- 한글 수호대 — Supabase 데이터베이스 설정
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 전체를 붙여 넣고 Run 을 누르세요.
-- 여러 번 실행해도 괜찮아요.

-- 1) 수업 방
create table if not exists public.rooms (
  code        text primary key,
  goal        text not null,
  team_count  int  not null,
  status      text not null default 'lobby',   -- lobby | play | boss | ending
  paused      boolean not null default false,
  boss_hp     int  not null default 0,
  boss_max    int  not null default 0,
  created_at  timestamptz not null default now()
);

-- 2) 모둠 진행 상황 (한 모둠 = 한 줄)
create table if not exists public.teams (
  room          text not null references public.rooms(code) on delete cascade,
  no            int  not null,
  targets       jsonb not null default '[]',   -- 이 모둠이 찾을 글자 번호
  map           int  not null default 1,
  done          jsonb not null default '{}',   -- 마친 임무 표시
  pieces        jsonb not null default '{}',   -- 모은 글자 조각
  letters       jsonb not null default '{}',   -- 되찾은 글자
  hints         int  not null default 3,       -- 힌트 두루마리
  help_sent     int  not null default 0,       -- 다른 모둠에 보낸 도움
  member_order  jsonb not null default '[]',   -- 역할 순서 (역할 바꾸기)
  boss_hits     int  not null default 0,
  primary key (room, no)
);

-- 3) 퀴즈 기록 (결과 보기용, 이름 없이 모둠 번호만 저장)
create table if not exists public.logs (
  id          bigserial primary key,
  room        text not null references public.rooms(code) on delete cascade,
  team        int,
  qid         text,
  correct     boolean,
  created_at  timestamptz not null default now()
);
create index if not exists logs_room_idx on public.logs(room);

-- 4) 접근 권한: 로그인 없이 방 코드로 참여하는 수업용 앱이라 anon 사용자에게 읽기/쓰기를 열어 둡니다.
--    학생 개인정보(실명 등)는 저장하지 않아요. 닉네임은 실시간 접속 정보로만 오가고 DB에 남지 않아요.
alter table public.rooms enable row level security;
alter table public.teams enable row level security;
alter table public.logs  enable row level security;

drop policy if exists "classroom rooms" on public.rooms;
drop policy if exists "classroom teams" on public.teams;
drop policy if exists "classroom logs"  on public.logs;
create policy "classroom rooms" on public.rooms for all to anon, authenticated using (true) with check (true);
create policy "classroom teams" on public.teams for all to anon, authenticated using (true) with check (true);
create policy "classroom logs"  on public.logs  for all to anon, authenticated using (true) with check (true);

-- 5) 모둠 진행 합치기: 여러 학생이 동시에 눌러도 서로 덮어쓰지 않게 서버에서 합칩니다.
create or replace function public.patch_team(
  p_room text, p_no int,
  p_done jsonb default '{}', p_pieces jsonb default '{}', p_letters jsonb default '{}',
  p_map int default null, p_hints int default 0, p_help int default 0,
  p_order jsonb default null, p_boss_hits int default 0
) returns public.teams
language plpgsql as $$
declare
  r public.teams;
  incomplete int;
begin
  update public.teams set
    done         = done || coalesce(p_done, '{}'),
    pieces       = pieces || coalesce(p_pieces, '{}'),
    letters      = letters || coalesce(p_letters, '{}'),
    map          = greatest(map, coalesce(p_map, map)),
    hints        = greatest(0, hints + coalesce(p_hints, 0)),
    help_sent    = help_sent + coalesce(p_help, 0),
    member_order = coalesce(p_order, member_order),
    boss_hits    = boss_hits + coalesce(p_boss_hits, 0)
  where room = p_room and no = p_no
  returning * into r;

  -- 반 전체 글자가 다 모이면 보스전 시작
  if coalesce(p_letters, '{}') <> '{}'::jsonb then
    select count(*) into incomplete from public.teams t
     where t.room = p_room
       and (select count(*) from jsonb_object_keys(t.letters)) < jsonb_array_length(t.targets);
    if incomplete = 0 then
      update public.rooms set status = 'boss' where code = p_room and status = 'play';
    end if;
  end if;
  return r;
end $$;

-- 6) 보스 공격: 체력이 0이 되면 엔딩
create or replace function public.hit_boss(p_room text, p_dmg int)
returns public.rooms
language plpgsql as $$
declare r public.rooms;
begin
  update public.rooms set
    boss_hp = greatest(0, boss_hp - p_dmg),
    status  = case when boss_hp - p_dmg <= 0 then 'ending' else status end
  where code = p_room and status = 'boss'
  returning * into r;
  if r is null then select * into r from public.rooms where code = p_room; end if;
  return r;
end $$;

grant execute on function public.patch_team(text,int,jsonb,jsonb,jsonb,int,int,int,jsonb,int) to anon, authenticated;
grant execute on function public.hit_boss(text,int) to anon, authenticated;

-- 7) 실시간 변경 알림 켜기
do $$
begin
  begin alter publication supabase_realtime add table public.rooms; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.teams; exception when duplicate_object then null; end;
end $$;

-- (선택) 오래된 방 정리: 필요할 때 아래 줄의 -- 를 지우고 실행하세요.
-- delete from public.rooms where created_at < now() - interval '30 days';
