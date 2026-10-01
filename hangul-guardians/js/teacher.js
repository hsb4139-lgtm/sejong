/* 한글 수호대 — 교사용 화면 (전자칠판) */
(function () {
  const HS = window.HS;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TEAM_COLORS = ['#b8412c', '#2e6f9e', '#2e7d6b', '#7a5aa6', '#b8862a', '#5a7d2e', '#a8466e', '#3f6f8f'];
  const S = { net: null, code: null, room: null, teams: {}, presence: [], shownEnding: false };

  function boot() {
    S.net = HS.createBackend({});
    const cfg = HS.CONFIG || {};
    if (S.net.mode === 'supabase') { $('#t-mode').textContent = '🟢 Supabase 연결 설정됨 (' + cfg.SUPABASE_URL.replace(/^https:\/\//, '') + ')'; checkDb(); }
    else if (cfg.SUPABASE_URL && !window.supabase) $('#t-mode').textContent = '🔴 Supabase 프로그램을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.';
    else $('#t-mode').textContent = '🟡 Supabase 환경변수가 없어 로컬 테스트 모드예요. 같은 브라우저 탭끼리만 연결돼요.';
    $('#t-goal').value = HS.DEFAULT_GOAL;
    $('#t-goal').addEventListener('input', preview); $('#t-teams').addEventListener('input', preview); preview();
    $('#t-create').onclick = create;
    $('#t-reopen').onclick = () => open($('#t-code').value.trim());
    try { const last = localStorage.getItem('hs_teacher_code'); if (last) $('#t-code').value = last; } catch (e) {}
  }
  /* 데이터베이스 설정(schema.sql)을 했는지 확인 */
  async function checkDb() {
    try { await S.net.getRoom('0000'); }
    catch (e) { $('#t-mode').textContent = '🔴 Supabase에 연결했지만 ' + friendly(e); }
  }
  function friendly(e) {
    const m = (e && (e.message || e.code)) || String(e);
    if (/relation .* does not exist|42P01|PGRST205|Could not find the table/i.test(m)) return '데이터베이스 표가 없어요. Supabase SQL Editor에서 supabase/schema.sql 을 실행해 주세요.';
    if (/Invalid API key|JWT|401|apikey/i.test(m)) return 'API 키가 맞지 않아요. Vercel 환경변수 SUPABASE_ANON_KEY 를 확인하고 Redeploy 해 주세요.';
    if (/patch_team|hit_boss|PGRST202|function/i.test(m)) return '게임 기능(함수)이 없어요. supabase/schema.sql 을 다시 실행해 주세요.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '서버에 닿지 못했어요. SUPABASE_URL 과 인터넷 연결을 확인해 주세요.';
    return '오류가 났어요: ' + m;
  }
  function preview() {
    const goal = $('#t-goal').value.trim(), n = Math.max(2, Math.min(8, parseInt($('#t-teams').value, 10) || 5));
    const syl = HS.syllables(goal), parts = HS.distribute(syl.length, n);
    $('#t-preview').innerHTML = syl.length < n ? '<span class="warn">글자 수(' + syl.length + ')가 모둠 수보다 적어요. 문장을 늘리거나 모둠 수를 줄여 주세요.</span>' :
      parts.map((p, i) => '<span class="chip" style="--tc:' + TEAM_COLORS[i] + '">' + (i + 1) + '모둠: ' + p.map((k) => esc(syl[k].ch)).join('') + '</span>').join(' ');
  }
  async function create() {
    const goal = $('#t-goal').value.trim(), n = parseInt($('#t-teams').value, 10);
    const err = $('#t-err'); err.textContent = '';
    if (!goal) return (err.textContent = '목표 문장을 입력해 주세요.');
    if (!(n >= 2 && n <= 8)) return (err.textContent = '모둠 수는 2~8개로 정해 주세요.');
    if (HS.syllables(goal).length < n) return (err.textContent = '목표 문장의 글자 수가 모둠 수보다 많아야 해요.');
    try { const code = await S.net.createRoom(goal, n); open(code); } catch (e) { err.textContent = '방을 만들지 못했어요. ' + friendly(e); }
  }
  async function open(code) {
    const err = $('#t-err'); err.textContent = '';
    if (!/^\d{4}$/.test(code)) return (err.textContent = '방 코드는 숫자 4자리예요.');
    const room = await S.net.getRoom(code).catch(() => null);
    if (!room) return (err.textContent = code + '번 방을 찾지 못했어요.');
    try { localStorage.setItem('hs_teacher_code', code); } catch (e) {}
    S.code = code; S.room = room;
    (await S.net.getTeams(code)).forEach((t) => (S.teams[t.no] = t));
    S.net.join(code, { id: 'teacher-' + Math.random().toString(36).slice(2, 7), teacher: true, team: 0, name: '선생님', joinedAt: Date.now() }, {
      room: (r) => { S.room = r; render(); }, team: (t) => { S.teams[t.no] = t; render(); }, presence: (l) => { S.presence = l; render(); }, event: () => {}
    });
    $('#t-setup').classList.add('hidden'); $('#t-board').classList.remove('hidden');
    $('#t-start').onclick = () => S.net.updateRoom(code, { status: 'play' });
    $('#t-pause').onclick = () => S.net.updateRoom(code, { paused: !S.room.paused });
    $('#t-boss').onclick = () => { if (confirm('아직 글자를 다 찾지 못한 모둠이 있어도 보스전을 시작할까요?')) S.net.updateRoom(code, { status: 'boss' }); };
    $('#t-prologue').onclick = prologue;
    $('#t-hint').onclick = hintDialog;
    $('#t-results').onclick = results;
    $('#t-full').onclick = () => { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d); };
    render();
  }

  function render() {
    const r = S.room; if (!r) return;
    $('#t-code-big').textContent = S.code;
    const st = { lobby: '대기 중', play: '모험 중', boss: '보스전', ending: '완료' }[r.status] + (r.paused ? ' · 일시정지' : '');
    $('#t-status').textContent = st;
    $('#t-start').classList.toggle('hidden', r.status !== 'lobby');
    $('#t-pause').textContent = r.paused ? '계속하기' : '일시정지';
    $('#t-boss').classList.toggle('hidden', r.status !== 'play');
    $('#t-pausebar').classList.toggle('hidden', !r.paused);

    const syls = HS.syllables(r.goal), teams = Object.values(S.teams).sort((a, b) => a.no - b.no);
    const owner = {}; teams.forEach((t) => t.targets.forEach((i) => (owner[i] = t)));
    const sent = $('#t-sentence'); sent.innerHTML = '';
    let si = 0;
    Array.from(r.goal).forEach((ch) => {
      if (!HS.isSyllable(ch)) { sent.appendChild(el('span', 'sp', ch === ' ' ? '&nbsp;' : esc(ch))); return; }
      const i = si++, t = owner[i], ok = t && t.letters[i];
      const s = el('span', 'lt' + (ok ? ' ok' : ''), ok ? esc(ch) : '');
      s.style.setProperty('--tc', TEAM_COLORS[(t ? t.no : 1) - 1]);
      s.appendChild(el('small', 'own', t ? t.no + '모둠' : ''));
      sent.appendChild(s);
    });
    const got = teams.reduce((s, t) => s + Object.keys(t.letters).length, 0);
    $('#t-progress').textContent = '복원한 글자 ' + got + ' / ' + syls.length;

    const grid = $('#t-teams-grid'); grid.innerHTML = '';
    teams.forEach((t) => {
      const mem = S.presence.filter((p) => p && p.team === t.no && !p.teacher);
      const order = (t.member_order || []).filter((id) => mem.find((m) => m.id === id));
      mem.slice().sort((a, b) => a.joinedAt - b.joinedAt).forEach((m) => { if (!order.includes(m.id)) order.push(m.id); });
      const roles = HS.assignRoles(order);
      const tasks = t.map < 5 ? HS.mapTasks(t.map, t) : [];
      const card = el('div', 'tcard' + (HS.teamComplete(t) ? ' done' : ''));
      card.style.setProperty('--tc', TEAM_COLORS[t.no - 1]);
      card.innerHTML = '<div class="tc-head"><b>' + t.no + '모둠</b><span>' + (t.map >= 5 ? (HS.teamComplete(t) ? '앞마당 도착' : '앞마당') : esc(HS.MAPS[t.map].name)) + '</span></div>' +
        '<div class="maps">' + [1, 2, 3, 4, 5].map((i) => '<i class="' + (t.map > i || (i === 5 && t.map >= 5) ? 'on' : t.map === i ? 'cur' : '') + '" title="' + esc(HS.MAPS[i].name) + '"></i>').join('') + '</div>' +
        '<div class="tc-stats"><span>글자 ' + Object.keys(t.letters).length + '/' + t.targets.length + '</span><span>할 일 ' + tasks.filter((x) => x.ok).length + '/' + tasks.length + '</span><span>힌트 ' + t.hints + '</span><span>도움 ' + t.help_sent + '</span></div>' +
        '<ul class="tc-mem">' + (order.length ? order.map((id) => { const m = mem.find((x) => x.id === id); return '<li>' + esc(m.name) + ' <small>' + (roles[id] || []).map((k) => HS.ROLES[k].icon).join('') + '</small></li>'; }).join('') : '<li class="muted">아직 아무도 없어요</li>') + '</ul>';
      grid.appendChild(card);
    });

    const boss = $('#t-bosswrap'); boss.classList.toggle('hidden', r.status !== 'boss');
    if (r.boss_max) $('#t-bossbar').style.width = (100 * r.boss_hp / r.boss_max) + '%';
    $('#t-bossnum').textContent = r.boss_hp + ' / ' + r.boss_max;
    if (r.status === 'ending' && !S.shownEnding) { S.shownEnding = true; celebrate(); }
  }

  function overlay(content, cls) {
    const o = $('#t-overlay'); o.innerHTML = ''; o.className = 't-overlay ' + (cls || '');
    o.appendChild(content);
    const x = el('button', 'btn ghost', '닫기'); x.onclick = () => o.classList.add('hidden'); o.appendChild(x);
  }
  function prologue() {
    const box = el('div', 'tp');
    const lines = ['한글날을 앞둔 어느 날, 교실의 글자가 먹물처럼 번지며 사라지기 시작했어요.', '먹물 요괴 「묵귀」가 한글을 조각조각 흩뿌려 조선 곳곳에 숨겨 버렸대요.', '우리 반 목표 문장도 먹물에 가려졌어요. 모둠마다 맡은 글자를 찾아야 해요.', '한 모둠이라도 글자를 못 찾으면 묵귀를 이길 수 없어요. 서로 도우며 끝까지 함께 가요!', '자, 한글 수호대! 조선으로 출발!'];
    const face = el('div', 'tp-face'); face.appendChild(HS.portrait('mukdori', 180));
    const p = el('p', 'tp-text'); let k = 0; p.textContent = lines[0];
    const nx = el('button', 'btn primary', '다음'); nx.onclick = () => { k++; if (k >= lines.length) return $('#t-overlay').classList.add('hidden'); p.textContent = lines[k]; if (k === lines.length - 1) nx.textContent = '끝'; };
    box.appendChild(face); box.appendChild(p); box.appendChild(nx);
    overlay(box, 'dark');
  }
  function hintDialog() {
    const box = el('div', 'th');
    box.appendChild(el('h2', '', '힌트 보내기'));
    const sel = el('select', 'inp'); sel.innerHTML = '<option value="0">모든 모둠</option>' + Object.keys(S.teams).map((n) => '<option value="' + n + '">' + n + '모둠</option>').join('');
    const ta = el('textarea', 'inp'); ta.rows = 3; ta.placeholder = '예: 탐정은 서가 사이를 잘 살펴봐요.';
    const presets = el('div', 'presets');
    const fill = () => {
      presets.innerHTML = ''; const n = +sel.value; const t = S.teams[n]; const m = t ? Math.min(4, t.map) : 1;
      (HS.MAPS[m].hints || []).forEach((h) => { const b = el('button', 'chip btnchip', esc(h)); b.onclick = () => (ta.value = h); presets.appendChild(b); });
    };
    sel.onchange = fill; fill();
    const go = el('button', 'btn primary', '보내기');
    go.onclick = () => { if (!ta.value.trim()) return; S.net.send({ type: 'hint', team: +sel.value, text: ta.value.trim() }); $('#t-overlay').classList.add('hidden'); };
    box.appendChild(el('label', 'lab', '받는 모둠')); box.appendChild(sel);
    box.appendChild(el('label', 'lab', '자주 쓰는 힌트 (현재 장소 기준)')); box.appendChild(presets);
    box.appendChild(el('label', 'lab', '힌트 내용')); box.appendChild(ta); box.appendChild(go);
    overlay(box);
  }
  async function results() {
    const logs = await S.net.getLogs(S.code);
    const qtext = {};
    [1, 2, 3, 4].forEach((m) => HS.MAPS[m].npcs.forEach((n) => (n.quizzes || []).forEach((q) => (qtext[q.id] = q.q))));
    const stat = {};
    logs.forEach((l) => { if (!qtext[l.qid]) return; const s = stat[l.qid] || (stat[l.qid] = { ok: 0, no: 0 }); l.correct ? s.ok++ : s.no++; });
    const rows = Object.keys(stat).sort((a, b) => stat[b].no - stat[a].no);
    const box = el('div', 'tres');
    box.appendChild(el('h2', '', '결과 보기'));
    box.appendChild(el('h3', '', '많이 틀린 문제'));
    const tb = el('table', 'rtable');
    tb.innerHTML = '<thead><tr><th>문제</th><th>오답</th><th>정답</th></tr></thead><tbody>' + (rows.length ? rows.map((id) => '<tr><td>' + esc(qtext[id]) + '</td><td>' + stat[id].no + '</td><td>' + stat[id].ok + '</td></tr>').join('') : '<tr><td colspan="3">아직 기록이 없어요.</td></tr>') + '</tbody>';
    box.appendChild(tb);
    box.appendChild(el('h3', '', '모둠별 도착 시각'));
    const tb2 = el('table', 'rtable');
    const fmt = (ts) => ts ? new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '–';
    tb2.innerHTML = '<thead><tr><th>모둠</th><th>서당</th><th>천문대</th><th>집현전</th><th>앞마당</th><th>보낸 도움</th></tr></thead><tbody>' +
      Object.values(S.teams).sort((a, b) => a.no - b.no).map((t) => '<tr><td>' + t.no + '모둠</td>' + [2, 3, 4, 5].map((i) => '<td>' + fmt(t.done['t' + i]) + '</td>').join('') + '<td>' + t.help_sent + '</td></tr>').join('') + '</tbody>';
    box.appendChild(tb2);
    overlay(box);
  }
  function celebrate() {
    const box = el('div', 'tc-end');
    box.appendChild(el('p', 'tc-end-t', '우리 반이 한글을 지켜냈어요!'));
    const s = el('div', 'sentence big restore'); let si = 0;
    Array.from(S.room.goal).forEach((ch) => { if (!HS.isSyllable(ch)) { s.appendChild(el('span', 'sp', ch === ' ' ? '&nbsp;' : esc(ch))); return; } const sp = el('span', 'lt', esc(ch)); sp.style.animationDelay = (0.25 * si++) + 's'; s.appendChild(sp); });
    box.appendChild(s);
    const k = el('div', 'tp-face'); k.appendChild(HS.portrait('king', 160)); box.appendChild(k);
    box.appendChild(el('p', 'tp-text', '세종대왕: "누구나 쉽게 쓰라고 만든 글자를 지켜 주어 고맙구나."'));
    overlay(box, 'dark');
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
