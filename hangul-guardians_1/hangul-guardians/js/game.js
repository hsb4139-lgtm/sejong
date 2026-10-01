/* 한글 수호대 — 학생용 게임 */
(function () {
  const HS = window.HS;
  const T = HS.TILE;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const has = (r) => G.myRoles.includes(r);
  const CRAFT_PIECE = { 1: 'ㅈ', 2: 'ㅌ', 3: 'ㅓ' };

  const G = {
    net: null, code: null, me: null, room: null, team: null, teams: {}, presence: [], members: [], myRoles: [], roleMap: {},
    mapId: 0, def: null, grid: null, mapCanvas: null, npcAt: {},
    p: { x: 0, y: 0, fx: 0, fy: 0, t: 1, dir: 'down', moving: false, frame: 0 },
    path: [], pendingInteract: null, peers: {}, bubbles: {}, fx: [],
    blocked: 0, scale: 3, S: 48, dpr: 1, cam: { x: 0, y: 0 }, keys: {}, joy: null,
    seenPrologue: false, inCutscene: false, transitioning: false, bossHurt: 0, wrong: {}, lastPos: 0,
    bossQ: null, nextInk: 0, endingShown: false, introSeen: {}
  };
  HS.G = G;

  /* =============== 시작 화면 =============== */
  function boot() {
    HS.audio.init();
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('touchstart', () => HS.audio.unlock(), { passive: true });
    document.addEventListener('pointerdown', () => HS.audio.unlock());
    const demo = HS.DEMO || /[?&]demo=1/.test(location.search);
    const backendProbe = HS.createBackend({ demo });
    const note = $('#join-mode');
    if (demo) { $('#join-code-row').classList.add('hidden'); $('#join-team-row').classList.add('hidden'); note.textContent = '체험판: 혼자서 모든 역할을 맡고, 다른 4개 모둠은 자동으로 움직여요.'; }
    else if (backendProbe.mode === 'local') note.textContent = 'Supabase 설정 전이라 로컬 테스트 모드로 실행 중이에요. 같은 브라우저의 탭끼리만 연결돼요.';
    else note.textContent = '';
    try { $('#join-name').value = localStorage.getItem('hs_name') || ''; } catch (e) {}
    $('#join-btn').onclick = () => join(demo);
    $('#join-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') join(demo); });
  }

  async function join(demo) {
    HS.audio.unlock();
    const name = $('#join-name').value.trim();
    const err = $('#join-err'); err.textContent = '';
    if (!name) { err.textContent = '닉네임을 입력해 주세요.'; return; }
    const btn = $('#join-btn'); btn.disabled = true; btn.textContent = '들어가는 중…';
    try {
      G.net = HS.createBackend({ demo });
      let code, team;
      if (demo) { code = await G.net.createRoom(HS.DEFAULT_GOAL, 5, 'DEMO'); team = 1; }
      else {
        code = $('#join-code').value.trim(); team = parseInt($('#join-team').value, 10);
        if (!/^\d{4}$/.test(code)) throw new Error('방 코드는 숫자 4자리예요.');
      }
      const room = await G.net.getRoom(code);
      if (!room) throw new Error('방 코드 ' + code + '번 방이 없어요. 선생님 화면의 코드를 다시 확인해 주세요.');
      if (!(team >= 1 && team <= room.team_count)) throw new Error('이 방은 1~' + room.team_count + '모둠까지 있어요.');
      try { localStorage.setItem('hs_name', name); } catch (e) {}
      let pid, joinedAt;
      // 같은 방 + 같은 닉네임으로 다시 들어오면 같은 사람으로 인식(역할 순서 유지)
      const idKey = 'hs_pid_' + code + '_' + name, atKey = 'hs_jat_' + code + '_' + name;
      try { pid = localStorage.getItem(idKey); joinedAt = +localStorage.getItem(atKey); } catch (e) {}
      if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); joinedAt = Date.now(); try { localStorage.setItem(idKey, pid); localStorage.setItem(atKey, joinedAt); } catch (e) {} }
      G.code = code; G.me = { id: pid, name, team, joinedAt, teacher: false }; G.room = room;
      (await G.net.getTeams(code)).forEach((t) => (G.teams[t.no] = t));
      G.team = G.teams[team];
      G.net.join(code, G.me, { room: onRoom, team: onTeam, presence: onPresence, event: onEvent });
      G.net.joinTeam(code, team, onPos);
      computeMembers();
      setupGame();
      route();
    } catch (e) {
      err.textContent = e.message || '연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
      btn.disabled = false; btn.textContent = '입장하기';
    }
  }

  /* =============== 실시간 이벤트 =============== */
  function onRoom(r) {
    const prev = G.room; G.room = r;
    if (!prev || prev.status !== r.status || prev.paused !== r.paused) route();
    if (prev && r.boss_hp < prev.boss_hp) G.bossHurt = performance.now();
    renderHud();
  }
  function onTeam(t) {
    G.teams[t.no] = t;
    if (t.no === G.me.team) {
      const prev = G.team; G.team = t;
      if (prev && t.hints > prev.hints && !G.helpToastLock) toast('힌트 두루마리가 ' + t.hints + '개가 되었어요.');
      if (prev) {
        Object.keys(t.done).forEach((k) => { if (!prev.done[k] && /_h\d+$/.test(k)) { const m = k.match(/^m(\d)_h(\d+)$/); if (m) banner('📜 힌트: ' + HS.MAPS[m[1]].hints[m[2]], 9000); } });
        Object.keys(t.pieces).forEach((k) => { if (!prev.pieces[k]) toast('조각 「' + k + '」을(를) 얻었어요!', 'good'); });
      }
      computeMembers();
      if (G.room && (G.room.status === 'boss' || G.room.status === 'ending') && t.map < 5) G.net.patchTeam(G.code, G.me.team, { map: 5 });
      checkMapChange();
      if (G.modalRefresh) G.modalRefresh();
    }
    renderHud();
  }
  function onPresence(list) { G.presence = list; computeMembers(); }
  function onPos(p) {
    if (!p || p.id === G.me.id) return;
    const peer = G.peers[p.id] || (G.peers[p.id] = { x: p.x, y: p.y, rx: p.x, ry: p.y });
    Object.assign(peer, p, { ts: performance.now() });
  }
  function onEvent(e) {
    if (!e) return;
    if (e.type === 'signal' && e.team === G.me.team) { G.bubbles[e.from] = { text: e.text, until: performance.now() + 3500 }; toast(e.name + ': ' + e.text); HS.audio.sfx('blip'); }
    else if (e.type === 'help' && e.to === G.me.team) { toast(e.from + '모둠이 힌트 두루마리를 보내 주었어요! 고마워요!', 'good'); HS.audio.sfx('piece'); }
    else if (e.type === 'hint' && (!e.team || e.team === G.me.team)) { banner('💡 선생님 힌트: ' + e.text, 12000); HS.audio.sfx('piece'); }
    else if (e.type === 'special' && e.team === G.me.team) { specialFx(e.name); }
    else if (e.type === 'swap' && e.team === G.me.team) { toast('모둠 역할이 바뀌었어요.'); }
  }

  function computeMembers() {
    if (!G.me) return;
    const seen = {};
    let list = G.presence.filter((p) => p && p.team === G.me.team && !p.teacher && !seen[p.id] && (seen[p.id] = 1));
    if (!list.find((p) => p.id === G.me.id)) list.push(G.me);
    const order = ((G.team && G.team.member_order) || []).filter((id) => list.find((p) => p.id === id));
    list.sort((a, b) => a.joinedAt - b.joinedAt).forEach((p) => { if (!order.includes(p.id)) order.push(p.id); });
    G.members = order.map((id) => list.find((p) => p.id === id));
    const prevRoles = G.myRoles.join(',');
    G.roleMap = HS.assignRoles(order);
    G.myRoles = G.roleMap[G.me.id] || [];
    if (prevRoles && prevRoles !== G.myRoles.join(',')) toast('내 역할: ' + G.myRoles.map((r) => HS.ROLES[r].name).join(', '));
    if (G.me) { const look = lookOf(G.myRoles); if (G.me.look !== look) { G.me.look = look; G.net.retrack && G.net.retrack(G.me); } }
    renderHud();
    if (G.screen === 'lobby') renderLobby();
  }
  function lookOf(roles) { return (roles && roles[0]) || 'quiz'; }

  /* =============== 화면 전환 =============== */
  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id)); }
  function route() {
    if (!G.room) return;
    $('#pause').classList.toggle('hidden', !G.room.paused);
    const st = G.room.status;
    if (st === 'lobby') { G.screen = 'lobby'; show('screen-lobby'); renderLobby(); return; }
    if (G.screen !== 'game') {
      G.screen = 'game'; show('screen-game'); resize();
      loadMap(G.team.map, true);
      const fresh = G.team.map === 1 && Object.keys(G.team.done).length === 0;
      if (st === 'play' && fresh && !G.seenPrologue) prologue();
      else introDialog();
    }
    if (st === 'boss') { closeModal(); G.nextInk = performance.now() + 9000; if (G.team.map < 5) G.net.patchTeam(G.code, G.me.team, { map: 5 }); banner('⚔️ 모든 모둠이 글자를 되찾았어요! 묵귀와 싸워요!', 6000); HS.audio.bgm('palace'); }
    if (st === 'ending' && !G.endingShown) ending();
    renderHud();
  }

  /* =============== 대기실 =============== */
  function renderLobby() {
    const box = $('#lobby-body'); if (!box) return;
    const roles = G.myRoles;
    box.innerHTML = '';
    box.appendChild(el('p', 'lobby-team', esc(G.me.team) + '모둠 · 방 ' + esc(G.code)));
    const card = el('div', 'role-card');
    card.innerHTML = '<div class="role-big">' + roles.map((r) => '<span class="role-pill" style="--rc:' + HS.ROLES[r].color + '">' + HS.ROLES[r].icon + ' ' + HS.ROLES[r].name + '</span>').join('') + '</div>' +
      roles.map((r) => '<p class="role-desc">' + HS.ROLES[r].desc + '</p>').join('');
    box.appendChild(el('h3', 'lobby-h', '나의 역할'));
    box.appendChild(card);
    box.appendChild(el('h3', 'lobby-h', '우리 모둠 (' + G.members.length + '명)'));
    const ul = el('ul', 'member-list');
    G.members.forEach((m) => { ul.appendChild(el('li', m.id === G.me.id ? 'me' : '', esc(m.name) + ' <small>' + (G.roleMap[m.id] || []).map((r) => HS.ROLES[r].icon + HS.ROLES[r].name).join(' · ') + '</small>')); });
    box.appendChild(ul);
    const row = el('div', 'lobby-actions');
    const sw = el('button', 'btn ghost', '역할 바꾸기'); sw.onclick = openSwap; row.appendChild(sw);
    if (G.net.mode === 'demo') { const go = el('button', 'btn primary', '모험 시작하기'); go.onclick = () => G.net.updateRoom(G.code, { status: 'play' }); row.appendChild(go); }
    else row.appendChild(el('p', 'wait', '선생님이 시작하면 모험이 시작돼요.'));
    box.appendChild(row);
  }

  /* =============== 게임 준비 =============== */
  function setupGame() {
    const cv = $('#cv');
    G.ctx = cv.getContext('2d');
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', (e) => { G.keys[e.key] = true; if (e.key === ' ' || e.key === 'Enter') { if (!blocked()) doAction(); } });
    window.addEventListener('keyup', (e) => { G.keys[e.key] = false; });
    cv.addEventListener('pointerdown', onTap);
    setupJoystick();
    $('#act-btn').onclick = doAction;
    $('#btn-signal').onclick = openSignals;
    $('#btn-bag').onclick = openBag;
    $('#btn-map').onclick = openMap;
    $('#btn-hint').onclick = openHint;
    $('#btn-menu').onclick = openMenu;
    $('#class-prog').onclick = openClassBoard;
    $('#tasks-toggle').onclick = () => $('#tasks').classList.toggle('open');
    $('#dialog').addEventListener('pointerdown', advanceDialog);
    requestAnimationFrame(loop);
  }
  function resize() {
    const cv = $('#cv'); if (!cv) return;
    const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    G.dpr = dpr; cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px';
    G.scale = Math.max(2, Math.min(5, Math.floor(Math.min(w / (17 * T), h / (11 * T)))));
    G.S = G.scale * T; G.vw = w; G.vh = h;
  }

  function loadMap(id, silent) {
    const def = HS.MAPS[id];
    G.mapId = id; G.def = def; G.grid = def.build();
    G.mapCanvas = HS.renderMap(G.grid, def.theme);
    G.npcAt = {}; def.npcs.forEach((n) => (G.npcAt[n.x + ',' + n.y] = n));
    G.p.x = G.p.fx = def.spawn[0]; G.p.y = G.p.fy = def.spawn[1]; G.p.t = 1; G.p.moving = false; G.p.dir = 'down';
    G.path = []; G.pendingInteract = null; G.peers = {};
    $('#map-name').textContent = id + '. ' + def.name;
    document.body.dataset.theme = def.theme;
    HS.audio.bgm(G.room && G.room.status === 'boss' ? 'palace' : def.theme);
    renderHud();
    if (!silent) introDialog();
  }
  function introDialog() {
    if (G.introSeen[G.mapId]) return;
    G.introSeen[G.mapId] = true;
    const lines = G.def.intro.map((t) => ({ who: '먹돌이', look: 'mukdori', text: t }));
    if (G.mapId < 5) lines.push({ who: '먹돌이', look: 'mukdori', text: '내 역할: ' + G.myRoles.map((r) => HS.ROLES[r].name).join(', ') + '. 왼쪽 위 「우리 모둠 할 일」을 함께 보며 움직여!' });
    dialog(lines);
  }
  function checkMapChange() {
    if (!G.team || G.screen !== 'game' || G.transitioning) return;
    if (G.team.map > G.mapId) {
      G.transitioning = true; closeModal();
      const f = $('#fade'); f.classList.add('on');
      HS.audio.sfx('gate');
      setTimeout(() => { loadMap(G.team.map); f.classList.remove('on'); G.transitioning = false; }, 700);
    }
  }

  /* =============== 이동 =============== */
  function solidAt(x, y) {
    const g = G.grid; if (!g || y < 0 || x < 0 || y >= g.length || x >= g[0].length) return true;
    if (HS.SOLID.has(g[y][x])) return true;
    if (G.npcAt[x + ',' + y]) return true;
    if (G.mapId === 5 && bossActive() && x >= 11 && x <= 15 && y >= 5 && y <= 8) return true;
    return false;
  }
  function bossActive() { return G.room && G.room.status === 'boss'; }
  function blocked() { return !$('#modal').classList.contains('hidden') || !$('#dialog').classList.contains('hidden') || G.inCutscene || G.transitioning || (G.room && G.room.paused); }

  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function wantDir() {
    const k = G.keys;
    if (k.ArrowUp || k.w || k.W) return 'up'; if (k.ArrowDown || k.s || k.S) return 'down';
    if (k.ArrowLeft || k.a || k.A) return 'left'; if (k.ArrowRight || k.d || k.D) return 'right';
    if (G.joy && G.joy.mag > 0.35) { const { dx, dy } = G.joy; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
    return null;
  }
  function updatePlayer(dt) {
    const p = G.p;
    if (p.moving) {
      p.t += dt * 6.5;
      if (p.t >= 1) { p.t = 1; p.moving = false; p.fx = p.x; p.fy = p.y; p.frame++; sendPos(true); }
      else return;
    }
    if (blocked()) return;
    let dir = wantDir();
    if (dir) { G.path = []; G.pendingInteract = null; }
    else if (G.path.length) {
      const [nx, ny] = G.path[0];
      dir = nx > p.x ? 'right' : nx < p.x ? 'left' : ny > p.y ? 'down' : 'up';
      G.path.shift();
    } else if (G.pendingInteract) { const o = G.pendingInteract; G.pendingInteract = null; faceTo(o); interact(o); return; }
    if (!dir) return;
    p.dir = dir;
    const [dx, dy] = DIRS[dir];
    if (!solidAt(p.x + dx, p.y + dy)) { p.fx = p.x; p.fy = p.y; p.x += dx; p.y += dy; p.t = 0; p.moving = true; }
    else G.path = [];
  }
  function faceTo(o) { const dx = o.x - G.p.x, dy = o.y - G.p.y; G.p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  function bfs(sx, sy, goalFn) {
    const g = G.grid, W = g[0].length, H = g.length, prev = {}, q = [[sx, sy]]; prev[sx + ',' + sy] = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (goalFn(x, y)) { const path = []; let k = x + ',' + y; while (prev[k]) { const [a, b] = k.split(',').map(Number); path.unshift([a, b]); k = prev[k]; } return path; }
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || k in prev || solidAt(nx, ny)) continue;
        prev[k] = x + ',' + y; q.push([nx, ny]);
      }
    }
    return null;
  }
  function onTap(e) {
    if (blocked()) return;
    const rect = e.target.getBoundingClientRect();
    const tx = Math.floor((e.clientX - rect.left + G.cam.x) / G.S), ty = Math.floor((e.clientY - rect.top + G.cam.y) / G.S);
    const obj = objectAt(tx, ty);
    const p = G.p;
    if (obj) {
      if (Math.abs(obj.x - p.x) + Math.abs(obj.y - p.y) <= 1) { faceTo(obj); interact(obj); return; }
      const path = bfs(p.x, p.y, (x, y) => Math.abs(obj.x - x) + Math.abs(obj.y - y) === 1 || (obj.kind === 'clue' && x === obj.x && y === obj.y));
      if (path) { G.path = path; G.pendingInteract = obj; }
      return;
    }
    const path = bfs(p.x, p.y, (x, y) => x === tx && y === ty);
    if (path) { G.path = path; G.pendingInteract = null; }
  }
  function setupJoystick() {
    const joy = $('#joy'), knob = $('#joy-knob');
    let id = null, cx = 0, cy = 0;
    joy.addEventListener('pointerdown', (e) => { id = e.pointerId; joy.setPointerCapture(id); const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; G.joy = null; knob.style.transform = ''; };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    function move(e) {
      const R = joy.offsetWidth / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / R); dx = (dx / d) * m; dy = (dy / d) * m;
      G.joy = { dx, dy, mag: m }; knob.style.transform = 'translate(' + dx * R * 0.6 + 'px,' + dy * R * 0.6 + 'px)';
    }
  }
  function sendPos(force) {
    const now = performance.now();
    if (!force && now - G.lastPos < 2000) return;
    G.lastPos = now;
    G.net.sendPos({ id: G.me.id, name: G.me.name, map: G.mapId, x: G.p.x, y: G.p.y, dir: G.p.dir, look: lookOf(G.myRoles), frame: G.p.frame });
  }

  /* =============== 상호작용 대상 =============== */
  function objectsHere() {
    const list = [];
    const d = G.def; if (!d) return list;
    d.npcs.forEach((n) => list.push(Object.assign({ kind: n.kind, npc: n }, { x: n.x, y: n.y })));
    if (d.station) list.push({ kind: 'station', x: d.station.x, y: d.station.y });
    if (has('detective')) {
      if (G.mapId === 4) (G.team.targets || []).forEach((idx, k) => { const s = d.letterSpots[k % d.letterSpots.length]; if (!G.team.done['m4_c' + k]) list.push({ kind: 'clue', note: true, k, idx, x: s[0], y: s[1] }); });
      else (d.clues || []).forEach((c) => { if (!G.team.done[c.id]) list.push({ kind: 'clue', clue: c, x: c.x, y: c.y }); });
    }
    return list;
  }
  function objectAt(x, y) { return objectsHere().find((o) => o.x === x && o.y === y); }
  function nearObject() {
    const p = G.p; if (p.moving) return null;
    let best = null;
    objectsHere().forEach((o) => {
      const d = Math.abs(o.x - p.x) + Math.abs(o.y - p.y);
      if ((o.kind === 'clue' && d <= 1) || (o.kind !== 'clue' && d === 1)) { if (!best || o.kind === 'clue') best = o; }
    });
    return best;
  }
  function actionLabel(o) {
    if (!o) return '';
    if (o.kind === 'clue') return o.note ? '쪽지 줍기' : '단서 줍기';
    if (o.kind === 'station') return G.def.station.name + ' 쓰기';
    if (o.kind === 'gate') return '문지기에게 말 걸기';
    return o.npc.name + '에게 말 걸기';
  }
  function doAction() { if (blocked()) return; const o = nearObject(); if (o) { faceTo(o); interact(o); } }

  function interact(o) {
    HS.audio.sfx('blip');
    const m = G.mapId;
    if (o.kind === 'quiz') {
      const n = o.npc, key = 'm' + m + '_' + n.id;
      if (G.team.done[key]) return dialog([{ who: n.name, look: n.look, text: '고맙소! 글자 조각은 이미 돌려주었소. 다른 친구들을 도와주시오.' }]);
      if (!has('quiz')) return dialog([{ who: n.name, look: n.look, text: n.talk[0] }, { who: n.name, look: n.look, text: '내 문제는 「퀴즈 박사」만 풀 수 있소. 모둠의 퀴즈 박사를 데려와 주시오!' }]);
      return dialog(n.talk.map((t) => ({ who: n.name, look: n.look, text: t })), () => openQuiz(n));
    }
    if (o.kind === 'gate') {
      const n = o.npc;
      if (m === 5) return;
      const tasks = HS.mapTasks(m, G.team), left = tasks.filter((t) => !t.ok);
      if (left.length) return dialog([{ who: n.name, look: n.look, text: '아직 이 문을 열 수 없소. 남은 일: ' + left.map((t) => t.label).join(', ') }]);
      if (!has('leader')) return dialog([{ who: n.name, look: n.look, text: '임무를 모두 마쳤구려! 길잡이 대장이 오면 문을 열어 주겠소.' }]);
      const lines = [{ who: n.name, look: n.look, text: '모든 임무를 마쳤구려! 길잡이 대장, 문을 열겠소!' }];
      if (m === 4) lines.push({ who: '먹돌이', look: 'mukdori', text: '우리 모둠 글자를 모두 되찾았어! 궁궐 앞마당에서 다른 모둠을 기다리자.' });
      return dialog(lines, () => { G.net.patchTeam(G.code, G.me.team, { map: m + 1, done: { ['t' + (m + 1)]: Date.now() } }); });
    }
    if (o.kind === 'station') {
      if (!has('builder')) return dialog([{ who: '먹돌이', look: 'mukdori', text: G.def.station.name + '는 「글자 조립왕」만 쓸 수 있어. 조립왕에게 알려 주자!' }]);
      if (m === 4) return openSyllable();
      if (G.team.done['m' + m + '_b']) return toast('이미 완성했어요!');
      return openCraft(m);
    }
    if (o.kind === 'clue') return pickClue(o);
  }

  /* =============== 단서 =============== */
  function pickClue(o) {
    HS.audio.sfx('piece');
    if (o.note) {
      const syl = HS.syllables(G.room.goal)[o.idx]; const d = HS.decompose(syl.ch);
      const parts = [d.cho, d.jung].concat(d.jong ? [d.jong] : []).join(' + ');
      G.net.patchTeam(G.code, G.me.team, { done: { ['m4_c' + o.k]: true } });
      return openPanel('쪽지 ' + (o.k + 1), '<p class="clue-text big">' + (o.k + 1) + '번째 글자는<br><b class="jamo">' + esc(parts) + '</b><br>로 되어 있어요.</p><p class="say">글자 조립왕에게 소리 내어 알려 주세요!</p>', 'clue');
    }
    const c = o.clue;
    G.net.patchTeam(G.code, G.me.team, { done: { [c.id]: true }, pieces: { [c.piece]: true } });
    openPanel('단서를 찾았어요!', '<p class="clue-text">' + esc(c.text) + '</p><p class="say">모둠 친구들에게 소리 내어 읽어 주세요! 퀴즈를 풀 때 도움이 돼요.</p>', 'clue');
  }

  /* =============== 퀴즈 =============== */
  function openQuiz(n) {
    let i = 0;
    const render = () => {
      const q = n.quizzes[i];
      const body = el('div', 'quiz');
      body.appendChild(el('div', 'quiz-meta', esc(n.name) + '의 문제 ' + (i + 1) + ' / ' + n.quizzes.length));
      body.appendChild(el('p', 'quiz-q', esc(q.q)));
      const opts = el('div', 'opts');
      const hint = el('div', 'hintbox hidden');
      q.opts.forEach((o, k) => {
        const b = el('button', 'opt', esc(o));
        b.onclick = () => {
          G.net.log(G.code, G.me.team, q.id, k === q.a);
          if (k === q.a) {
            HS.audio.sfx('ok'); b.classList.add('right'); opts.querySelectorAll('button').forEach((x) => (x.disabled = true));
            body.appendChild(el('p', 'exp', '⭕ 정답! ' + esc(q.exp)));
            const next = el('button', 'btn primary', i + 1 < n.quizzes.length ? '다음 문제' : '조각 받기');
            next.onclick = () => { i++; if (i < n.quizzes.length) render(); else finishQuiz(n); };
            body.appendChild(next);
          } else {
            HS.audio.sfx('no'); b.classList.add('wrong'); b.disabled = true;
            G.wrong[q.id] = (G.wrong[q.id] || 0) + 1;
            if (G.wrong[q.id] >= 2) { hint.classList.remove('hidden'); hint.innerHTML = '<b>먹돌이 힌트</b> ' + esc(q.hint); }
            else toast('다시 생각해 봐요. 친구들과 상의해도 좋아요!');
          }
        };
        opts.appendChild(b);
      });
      body.appendChild(opts); body.appendChild(hint);
      openModal(n.name + '의 퀴즈', body, { portrait: n.look });
    };
    render();
  }
  function finishQuiz(n) {
    const piece = G.def.quizPieces && G.def.quizPieces[n.id];
    const patch = { done: { ['m' + G.mapId + '_' + n.id]: true } };
    if (piece) patch.pieces = { [piece]: true };
    G.net.patchTeam(G.code, G.me.team, patch);
    closeModal(); HS.audio.sfx('piece');
    dialog([{ who: n.name, look: n.look, text: '훌륭하오! 약속대로 글자 조각' + (piece ? ' 「' + piece + '」' : '') + '을(를) 돌려주겠소.' }]);
  }

  /* =============== 조립대 (맵 1~3) =============== */
  function openCraft(m) {
    const C = HS.CRAFT[m]; let i = 0, wrong = 0;
    const render = () => {
      const it = C.items[i]; wrong = 0;
      const body = el('div', 'craft');
      body.appendChild(el('p', 'craft-intro', esc(C.intro)));
      body.appendChild(el('div', 'quiz-meta', (i + 1) + ' / ' + C.items.length));
      body.appendChild(el('div', 'craft-big', esc(it.big)));
      const opts = el('div', 'opts glyphs');
      it.opts.forEach((o, k) => {
        const b = el('button', 'opt glyph', esc(o));
        b.onclick = () => {
          if (k === it.a) {
            HS.audio.sfx('ok'); b.classList.add('right');
            setTimeout(() => { i++; if (i < C.items.length) render(); else { G.net.patchTeam(G.code, G.me.team, { done: { ['m' + m + '_b']: true }, pieces: { [CRAFT_PIECE[m]]: true } }); closeModal(); HS.audio.sfx('piece'); toast(C.title + ' 완성!', 'good'); } }, 450);
          } else {
            HS.audio.sfx('no'); b.classList.add('wrong'); b.disabled = true; wrong++;
            if (wrong >= 2) opts.children[it.a].classList.add('glow');
          }
        };
        opts.appendChild(b);
      });
      body.appendChild(opts);
      openModal(C.title, body);
    };
    render();
  }

  /* =============== 글자 조립 (맵 4) =============== */
  function openSyllable() {
    const syls = HS.syllables(G.room.goal);
    let sel = null, cho = '', jung = '', jong = '';
    const render = () => {
      const t = G.team, body = el('div', 'syl');
      const cards = el('div', 'syl-cards');
      t.targets.forEach((idx, k) => {
        const done = !!t.letters[idx], found = !!t.done['m4_c' + k];
        const c = el('button', 'syl-card' + (done ? ' done' : '') + (sel === k ? ' sel' : '') + (!found && !done ? ' locked' : ''));
        c.innerHTML = '<span class="n">' + (k + 1) + '번 글자</span><span class="ch">' + (done ? esc(syls[idx].ch) : '?') + '</span><span class="st">' + (done ? '복원 완료' : found ? '쪽지 찾음' : '쪽지를 찾아야 해요') + '</span>';
        c.disabled = done || !found;
        c.onclick = () => { sel = k; cho = jung = jong = ''; render(); };
        cards.appendChild(c);
      });
      body.appendChild(cards);
      if (sel == null || t.letters[t.targets[sel]]) {
        const allDone = t.targets.every((idx) => t.letters[idx]);
        body.appendChild(el('p', 'syl-guide', allDone ? '우리 모둠 글자를 모두 되찾았어요! 길잡이 대장이 문지기에게 가면 돼요.' : '단서 탐정이 쪽지를 찾으면 글자 카드가 열려요. 카드를 눌러 조립을 시작해요.'));
      } else {
        const preview = HS.compose(cho, jung, jong);
        body.appendChild(el('p', 'syl-guide', '<b>' + (sel + 1) + '번 글자</b>를 만들어요. 단서 탐정에게 쪽지 내용을 물어보세요.'));
        const pv = el('div', 'syl-preview');
        pv.innerHTML = '<span class="slot">' + (cho || '첫소리') + '</span>+<span class="slot">' + (jung || '가운뎃소리') + '</span>+<span class="slot">' + (jong === '' ? '받침 없음' : jong) + '</span>=<span class="result">' + (preview || '?') + '</span>';
        body.appendChild(pv);
        const pal = (label, arr, cur, set) => {
          body.appendChild(el('div', 'pal-label', label));
          const row = el('div', 'palette');
          arr.forEach((j) => { const b = el('button', 'jamo-btn' + (j === '' ? ' none' : '') + (cur === j ? ' on' : ''), j === '' ? '없음' : j); b.onclick = () => { set(j); render(); }; row.appendChild(b); });
          body.appendChild(row);
        };
        pal('첫소리 (초성)', HS.CHO, cho, (v) => (cho = v));
        pal('가운뎃소리 (중성)', HS.JUNG, jung, (v) => (jung = v));
        pal('받침 (종성)', HS.JONG_PALETTE, jong, (v) => (jong = v));
        const go = el('button', 'btn primary wide', '글자 완성하기');
        go.disabled = !preview;
        go.onclick = () => {
          const idx = t.targets[sel];
          if (preview === syls[idx].ch) {
            HS.audio.sfx('piece'); G.net.patchTeam(G.code, G.me.team, { letters: { [idx]: true } });
            toast('「' + preview + '」 글자를 되찾았어요!', 'good'); G.net.log(G.code, G.me.team, 'L' + idx, true); sel = null; cho = jung = jong = '';
          } else {
            HS.audio.sfx('no'); G.net.log(G.code, G.me.team, 'L' + idx, false);
            const wk = 'L' + idx; G.wrong[wk] = (G.wrong[wk] || 0) + 1;
            if (G.wrong[wk] >= 3) { const d = HS.decompose(syls[idx].ch); toast('먹돌이 힌트: ' + [d.cho, d.jung, d.jong || '받침 없음'].join(' + '), 'hint', 7000); }
            else toast('쪽지와 다른 것 같아요. 탐정에게 다시 물어봐요!');
          }
        };
        body.appendChild(go);
      }
      openModal('글자 조립대', body, { keep: true });
    };
    G.modalRefresh = render;
    render();
  }

  /* =============== 대화창 =============== */
  let dlg = null;
  function dialog(lines, onDone) {
    dlg = { lines, i: 0, onDone, typing: null };
    $('#dialog').classList.remove('hidden');
    showLine();
  }
  function showLine() {
    const L = dlg.lines[dlg.i];
    $('#dlg-name').textContent = L.who;
    const pc = $('#dlg-face'); pc.innerHTML = ''; pc.appendChild(HS.portrait(L.look, 96));
    const tx = $('#dlg-text'); tx.textContent = '';
    let k = 0; clearInterval(dlg.typing);
    dlg.full = L.text;
    dlg.typing = setInterval(() => { k++; tx.textContent = L.text.slice(0, k); if (k % 3 === 0) HS.audio.sfx('step'); if (k >= L.text.length) { clearInterval(dlg.typing); dlg.typing = null; } }, 28);
  }
  function advanceDialog(e) {
    e && e.preventDefault();
    if (!dlg) return;
    if (dlg.typing) { clearInterval(dlg.typing); dlg.typing = null; $('#dlg-text').textContent = dlg.full; return; }
    dlg.i++;
    if (dlg.i < dlg.lines.length) return showLine();
    const cb = dlg.onDone; dlg = null; $('#dialog').classList.add('hidden');
    if (cb) cb();
  }

  /* =============== 창(모달) =============== */
  function openModal(title, body, opts) {
    opts = opts || {};
    if (!opts.keep) G.modalRefresh = null;
    const m = $('#modal'), p = $('#modal-panel');
    p.innerHTML = ''; p.className = 'panel ' + (opts.cls || '');
    const head = el('div', 'panel-head');
    if (opts.portrait) { const f = el('div', 'panel-face'); f.appendChild(HS.portrait(opts.portrait, 56)); head.appendChild(f); }
    head.appendChild(el('h2', 'panel-title', esc(title)));
    if (!opts.noClose) { const x = el('button', 'x', '닫기'); x.onclick = closeModal; head.appendChild(x); }
    p.appendChild(head); p.appendChild(body);
    m.classList.remove('hidden');
  }
  function openPanel(title, html, cls) { const b = el('div', 'panel-body', html); const ok = el('button', 'btn primary', '확인'); ok.onclick = closeModal; b.appendChild(ok); openModal(title, b, { cls }); }
  function closeModal() { $('#modal').classList.add('hidden'); G.modalRefresh = null; }

  /* =============== 도구 버튼 =============== */
  function openSignals() {
    const body = el('div', 'signals');
    ['여기 단서!', '도와줘!', '좋아!', '이리 와!', '퀴즈 박사 불러요!', '조립왕 불러요!'].forEach((t) => {
      const b = el('button', 'btn sig', t);
      b.onclick = () => { G.net.send({ type: 'signal', team: G.me.team, from: G.me.id, name: G.me.name, text: t }); G.bubbles[G.me.id] = { text: t, until: performance.now() + 3500 }; closeModal(); };
      body.appendChild(b);
    });
    openModal('신호 보내기', body);
  }
  function openBag() {
    const t = G.team, body = el('div', 'bag');
    const ps = Object.keys(t.pieces);
    body.appendChild(el('p', 'bag-sub', '우리 모둠이 모은 글자 조각 ' + ps.length + '개'));
    const g = el('div', 'pieces'); ps.forEach((p) => g.appendChild(el('span', 'piece', esc(p)))); if (!ps.length) g.appendChild(el('p', 'muted', '아직 모은 조각이 없어요. 퀴즈와 단서로 조각을 모아요!'));
    body.appendChild(g);
    if (has('detective')) {
      body.appendChild(el('h3', 'bag-h', '내가 찾은 단서'));
      const ul = el('ul', 'clue-list');
      [1, 2, 3].forEach((mi) => HS.MAPS[mi].clues.forEach((c) => { if (t.done[c.id]) ul.appendChild(el('li', '', esc(c.text))); }));
      const syls = HS.syllables(G.room.goal);
      (t.targets || []).forEach((idx, k) => { if (t.done['m4_c' + k]) { const d = HS.decompose(syls[idx].ch); ul.appendChild(el('li', '', '쪽지 ' + (k + 1) + ': ' + [d.cho, d.jung].concat(d.jong ? [d.jong] : []).join(' + '))); } });
      if (!ul.children.length) ul.appendChild(el('li', 'muted', '아직 없어요.'));
      body.appendChild(ul);
    }
    openModal('가방', body);
  }
  function openMap() {
    const g = G.grid, W = g[0].length, H = g.length, s = 12;
    const cv = document.createElement('canvas'); cv.width = W * s; cv.height = H * s; cv.className = 'minimap';
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(G.mapCanvas, 0, 0, W * s, H * s);
    x.fillStyle = 'rgba(242,230,201,.35)'; x.fillRect(0, 0, W * s, H * s);
    const mark = (mx, my, c, lab) => { x.fillStyle = '#221c18'; x.fillRect(mx * s - 2, my * s - 2, s + 4, s + 4); x.fillStyle = c; x.fillRect(mx * s, my * s, s, s); if (lab) { x.font = 'bold 11px sans-serif'; x.fillStyle = '#221c18'; x.fillText(lab, mx * s + s + 3, my * s + s - 1); } };
    G.def.npcs.forEach((n) => mark(n.x, n.y, n.kind === 'gate' ? '#b8412c' : '#2e6f9e', n.kind === 'gate' ? '문' : n.name));
    if (G.def.station) mark(G.def.station.x, G.def.station.y, '#2e7d6b', '조립대');
    Object.values(G.peers).forEach((p) => { if (p.map === G.mapId) mark(p.x, p.y, '#d9a441'); });
    mark(G.p.x, G.p.y, '#f6eec7', '나');
    const body = el('div', 'mapbox'); body.appendChild(cv);
    body.appendChild(el('p', 'muted', '파란색: 퀴즈 내는 사람 · 초록색: 조립대 · 빨간색: 문지기 · 노란색: 모둠 친구'));
    openModal('지도 — ' + G.def.name, body);
  }
  function openHint() {
    const t = G.team, m = G.mapId, H = (HS.MAPS[m].hints || []);
    const body = el('div', 'hint');
    body.appendChild(el('p', 'bag-sub', '힌트 두루마리 ' + t.hints + '개'));
    const ul = el('ul', 'hint-list'); let next = -1;
    H.forEach((h, k) => { const open = t.done['m' + m + '_h' + k]; if (!open && next < 0) next = k; ul.appendChild(el('li', open ? '' : 'muted', open ? esc(h) : '두루마리 ' + (k + 1) + ' (아직 펼치지 않음)')); });
    body.appendChild(ul);
    if (next >= 0) {
      const b = el('button', 'btn primary', '두루마리 펼치기'); b.disabled = t.hints <= 0;
      b.onclick = () => { G.net.patchTeam(G.code, G.me.team, { hints: -1, done: { ['m' + m + '_h' + next]: true } }); closeModal(); };
      body.appendChild(b);
      if (t.hints <= 0) body.appendChild(el('p', 'muted', '두루마리가 없어요. 다른 모둠이 보내 줄 수도 있어요.'));
    } else body.appendChild(el('p', 'muted', H.length ? '이 장소의 힌트를 모두 펼쳤어요.' : '이곳에는 힌트가 없어요.'));
    openModal('힌트 두루마리', body);
  }
  function openMenu() {
    const body = el('div', 'menu');
    const mute = el('button', 'btn ghost', HS.audio.isMuted() ? '소리 켜기' : '소리 끄기');
    mute.onclick = () => { HS.audio.setMuted(!HS.audio.isMuted()); closeModal(); };
    const sw = el('button', 'btn ghost', '역할 바꾸기'); sw.onclick = openSwap;
    const me = el('div', 'role-card');
    me.innerHTML = G.myRoles.map((r) => '<p><b>' + HS.ROLES[r].icon + ' ' + HS.ROLES[r].name + '</b> — ' + HS.ROLES[r].desc + '</p>').join('');
    body.appendChild(me); body.appendChild(sw); body.appendChild(mute);
    openModal('메뉴', body);
  }
  function openSwap() {
    const body = el('div', 'swap');
    body.appendChild(el('p', 'muted', '바꾸고 싶은 친구를 누르면 서로의 역할이 바뀌어요. 친구와 먼저 이야기하고 눌러 주세요.'));
    const others = G.members.filter((m) => m.id !== G.me.id);
    if (!others.length) body.appendChild(el('p', '', '지금은 모둠에 나 혼자 있어요.'));
    others.forEach((m) => {
      const b = el('button', 'btn ghost wide', esc(m.name) + ' · ' + (G.roleMap[m.id] || []).map((r) => HS.ROLES[r].name).join(', '));
      b.onclick = () => {
        const order = G.members.map((x) => x.id), a = order.indexOf(G.me.id), c = order.indexOf(m.id);
        [order[a], order[c]] = [order[c], order[a]];
        G.net.patchTeam(G.code, G.me.team, { order }); G.net.send({ type: 'swap', team: G.me.team }); closeModal();
      };
      body.appendChild(b);
    });
    openModal('역할 바꾸기', body);
  }
  function openClassBoard() {
    const render = () => {
      const syls = HS.syllables(G.room.goal), teams = Object.values(G.teams).sort((a, b) => a.no - b.no);
      const owner = {}; teams.forEach((t) => t.targets.forEach((i) => (owner[i] = t)));
      const body = el('div', 'board');
      const sent = el('div', 'sentence');
      let si = 0;
      Array.from(G.room.goal).forEach((ch) => {
        if (!HS.isSyllable(ch)) { sent.appendChild(el('span', 'sp', ch === ' ' ? '&nbsp;' : esc(ch))); return; }
        const i = si++, t = owner[i], ok = t && t.letters[i];
        sent.appendChild(el('span', 'lt' + (ok ? ' ok' : '') + (t && t.no === G.me.team ? ' mine' : ''), ok ? esc(ch) : ''));
      });
      body.appendChild(sent);
      const myDone = HS.teamComplete(G.team);
      const list = el('div', 'team-rows');
      teams.forEach((t) => {
        const n = Object.keys(t.letters).length;
        const row = el('div', 'team-row' + (t.no === G.me.team ? ' mine' : ''));
        row.innerHTML = '<b>' + t.no + '모둠</b><span class="maps">' + [1, 2, 3, 4, 5].map((i) => '<i class="' + (t.map >= i ? 'on' : '') + '"></i>').join('') + '</span><span>글자 ' + n + '/' + t.targets.length + '</span>';
        if (myDone && t.no !== G.me.team && !HS.teamComplete(t) && G.team.help_sent < 3) {
          const b = el('button', 'btn small', '힌트 보내기');
          b.onclick = async () => { b.disabled = true; await G.net.patchTeam(G.code, t.no, { hints: 1 }); await G.net.patchTeam(G.code, G.me.team, { help: 1 }); G.net.send({ type: 'help', from: G.me.team, to: t.no }); toast(t.no + '모둠에 힌트 두루마리를 보냈어요!', 'good'); };
          row.appendChild(b);
        }
        list.appendChild(row);
      });
      body.appendChild(list);
      body.appendChild(el('p', 'muted', myDone ? '먼저 끝난 모둠은 힌트 두루마리를 3번까지 보낼 수 있어요. (보낸 횟수 ' + G.team.help_sent + '/3)' : '우리 모둠 글자는 금색 테두리로 표시돼요.'));
      openModal('우리 반 한글 복원판', body, { keep: true });
    };
    G.modalRefresh = render; render();
  }

  /* =============== HUD =============== */
  function renderHud() {
    if (!G.team || !$('#hud-tl')) return;
    $('#my-roles').innerHTML = G.myRoles.map((r) => '<span class="role-pill" style="--rc:' + HS.ROLES[r].color + '">' + HS.ROLES[r].icon + ' ' + HS.ROLES[r].name + '</span>').join('');
    $('#btn-map').classList.toggle('hidden', !has('leader'));
    $('#btn-hint').classList.toggle('hidden', !has('keeper'));
    $('#hint-count').textContent = G.team.hints;
    // 반 전체 진행
    if (G.room) {
      const total = HS.syllables(G.room.goal).length;
      const got = Object.values(G.teams).reduce((s, t) => s + Object.keys(t.letters || {}).length, 0);
      $('#class-bar').style.width = Math.round((got / Math.max(1, total)) * 100) + '%';
      $('#class-num').textContent = got + ' / ' + total;
    }
    // 할 일
    const box = $('#tasks-list'); box.innerHTML = '';
    if (G.mapId === 5 || G.team.map === 5) {
      const st = G.room && G.room.status;
      box.appendChild(el('li', '', st === 'boss' ? '⚔️ 문제를 맞혀 묵귀를 공격해요!' : st === 'ending' ? '🎉 한글을 지켜냈어요!' : '⏳ 다른 모둠을 기다려요. 오른쪽 위 복원판에서 힌트를 보낼 수 있어요.'));
    } else {
      HS.mapTasks(G.mapId, G.team).forEach((t) => box.appendChild(el('li', t.ok ? 'ok' : '', (t.ok ? '✔' : HS.ROLES[t.role].icon) + ' ' + esc(t.label))));
      const left = HS.mapTasks(G.mapId, G.team).filter((t) => !t.ok).length;
      box.appendChild(el('li', left ? 'muted' : 'go', left ? '🚩 다 마치면 대장이 문을 열어요' : '🚩 길잡이 대장, 문지기에게 가요!'));
    }
    $('#tasks-count').textContent = G.mapId === 5 ? '' : HS.mapTasks(G.mapId, G.team).filter((t) => t.ok).length + '/' + HS.mapTasks(G.mapId, G.team).length;
    $('#boss-hud').classList.toggle('hidden', !(G.room && G.room.status === 'boss'));
    if (G.room && G.room.boss_max) $('#boss-bar').style.width = (100 * G.room.boss_hp / G.room.boss_max) + '%';
  }
  function toast(text, kind, ms) {
    const t = el('div', 'toast ' + (kind || ''), esc(text)); $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), (ms || 3200)); setTimeout(() => t.remove(), (ms || 3200) + 400);
  }
  function banner(text, ms) {
    const b = $('#banner'); b.textContent = text; b.classList.add('on');
    clearTimeout(G.bannerT); G.bannerT = setTimeout(() => b.classList.remove('on'), ms || 5000);
  }

  /* =============== 보스전 =============== */
  function bossTick(now) {
    if (!bossActive() || G.mapId !== 5 || G.inCutscene) { $('#boss-q').classList.add('hidden'); return; }
    const box = $('#boss-q');
    if (box.classList.contains('hidden')) { box.classList.remove('hidden'); nextBossQ(); }
    if (now > G.nextInk) { G.nextInk = now + 15000 + Math.random() * 6000; inkAttack(); }
  }
  function nextBossQ() {
    const pool = HS.BOSS_QUESTIONS; const q = pool[Math.floor(Math.random() * pool.length)];
    const box = $('#boss-q'); box.innerHTML = '';
    box.appendChild(el('p', 'bq', esc(q.q)));
    const row = el('div', 'bopts');
    q.opts.forEach((o, k) => {
      const b = el('button', 'opt', esc(o));
      b.onclick = async () => {
        row.querySelectorAll('button').forEach((x) => (x.disabled = true));
        if (k === q.a) {
          b.classList.add('right'); HS.audio.sfx('hit'); G.bossHurt = performance.now(); addFx('-1', '#f6eec7');
          setTimeout(nextBossQ, 500);
          try {
            await G.net.hitBoss(G.code, 1);
            const t = await G.net.patchTeam(G.code, G.me.team, { bossHits: 1 });
            const K = Math.max(4, G.members.length * 2);
            if (t && t.boss_hits % K === 0) { await G.net.hitBoss(G.code, 3); G.net.send({ type: 'special', team: G.me.team, name: G.me.name }); specialFx(G.me.name); }
          } catch (e) {}
        } else { b.classList.add('wrong'); HS.audio.sfx('no'); setTimeout(nextBossQ, 1300); }
      };
      row.appendChild(b);
    });
    box.appendChild(row);
  }
  function specialFx(name) { HS.audio.sfx('special'); banner('🔥 ' + G.me.team + '모둠 필살기! 「한글 붓 일격」', 2500); addFx('-3', '#e3b341'); G.bossHurt = performance.now(); }
  function addFx(text, color) { G.fx.push({ text, color, t0: performance.now(), x: 13.5 + (Math.random() - 0.5) * 2, y: 5.5 }); }
  function inkAttack() {
    HS.audio.sfx('ink');
    const layer = $('#ink-layer');
    for (let i = 0; i < 3; i++) {
      const b = el('button', 'ink-blot'); b.setAttribute('aria-label', '먹물 닦기');
      b.style.left = (10 + Math.random() * 70) + '%'; b.style.top = (15 + Math.random() * 45) + '%';
      b.style.setProperty('--s', (0.8 + Math.random() * 0.6).toFixed(2));
      let hp = 2; b.onclick = () => { hp--; b.style.opacity = hp ? 0.55 : 0; if (!hp) setTimeout(() => b.remove(), 250); };
      layer.appendChild(b);
      setTimeout(() => b.remove(), 12000);
    }
    toast('묵귀가 먹물을 뿌렸어요! 눌러서 닦아요!', 'warn');
  }

  /* =============== 프롤로그 / 엔딩 =============== */
  function prologue() {
    G.seenPrologue = true; G.inCutscene = true;
    const syls = HS.syllables(G.room.goal), mine = G.team.targets;
    const cs = $('#cutscene'); cs.innerHTML = ''; cs.classList.remove('hidden'); cs.className = 'cutscene prologue';
    const stage = el('div', 'cs-stage');
    const sent = el('div', 'sentence big clean');
    let si = 0;
    Array.from(G.room.goal).forEach((ch) => {
      if (!HS.isSyllable(ch)) { sent.appendChild(el('span', 'sp', ch === ' ' ? '&nbsp;' : esc(ch))); return; }
      const i = si++; sent.appendChild(el('span', 'lt' + (mine.includes(i) ? ' mine' : ''), esc(ch)));
    });
    stage.appendChild(sent);
    const face = el('div', 'cs-face'); face.appendChild(HS.portrait('mukdori', 120));
    const txt = el('p', 'cs-text');
    const next = el('button', 'btn primary', '다음');
    cs.appendChild(stage); cs.appendChild(face); cs.appendChild(txt); cs.appendChild(next);
    const nums = mine.map((i) => (i + 1) + '번째 「?」').join(', ');
    const lines = [
      ['우리 반이 한글날을 맞아 꾸민 문장이야.', null],
      ['그런데 먹물 요괴 「묵귀」가 나타나 글자를 조각조각 흩뿌려 버렸어!', 'ink'],
      ['조각난 글자들은 조선 곳곳에 숨겨졌대. 반 친구들이 모두 힘을 합쳐야 되찾을 수 있어.', null],
      [G.me.team + '모둠은 ' + nums + ' 글자를 찾아야 해. 금색으로 빛나는 칸이야!', 'mine'],
      ['자, 시간의 문을 열고 조선으로 출발하자!', 'go']
    ];
    let k = 0;
    const step = () => {
      const [t, fx] = lines[k];
      txt.textContent = t;
      if (fx === 'ink') { sent.classList.remove('clean'); HS.audio.sfx('ink'); }
      if (fx === 'mine') sent.classList.add('show-mine');
      next.textContent = k === lines.length - 1 ? '출발!' : '다음';
    };
    next.onclick = () => {
      HS.audio.sfx('blip'); k++;
      if (k < lines.length) return step();
      cs.classList.add('hidden'); G.inCutscene = false; introDialog();
    };
    step();
    void syls;
  }

  function ending() {
    G.endingShown = true; closeModal(); $('#boss-q').classList.add('hidden'); $('#ink-layer').innerHTML = '';
    if (G.mapId !== 5) loadMap(5, true);
    G.inCutscene = true; G.kingY = 1; G.kingShow = true; HS.audio.sfx('win');
    banner('묵귀를 물리쳤어요!', 4000);
    setTimeout(() => {
      G.inCutscene = false;
      dialog([
        { who: '세종대왕', look: 'king', text: '그대들이 한글 수호대로구나. 참으로 장하다.' },
        { who: '세종대왕', look: 'king', text: '우리말이 중국과 달라 한자로는 백성들이 뜻을 다 펴지 못하였느니라.' },
        { who: '세종대왕', look: 'king', text: '그래서 누구나 쉽게 익혀 날마다 편히 쓰라고 스물여덟 글자를 만들었다.' },
        { who: '세종대왕', look: 'king', text: '오늘 그 글자를 반 친구들이 모두 힘을 모아 지켜 주었구나. 고맙다.' },
        { who: '세종대왕', look: 'king', text: '앞으로도 우리 한글을 아끼고 바르게 써 주겠느냐?' }
      ], finale);
    }, 2600);
  }
  function finale() {
    G.inCutscene = true;
    const cs = $('#cutscene'); cs.innerHTML = ''; cs.className = 'cutscene finale';
    const sent = el('div', 'sentence big restore');
    let si = 0;
    Array.from(G.room.goal).forEach((ch) => {
      if (!HS.isSyllable(ch)) { sent.appendChild(el('span', 'sp', ch === ' ' ? '&nbsp;' : esc(ch))); return; }
      const sp = el('span', 'lt', esc(ch)); sp.style.animationDelay = (0.25 * si++) + 's'; sent.appendChild(sp);
    });
    cs.appendChild(el('p', 'cs-title', '우리 반이 한글을 지켜냈어요!'));
    cs.appendChild(sent);
    const btn = el('button', 'btn primary', '임명장 받기');
    btn.onclick = certificate;
    cs.appendChild(btn);
    HS.audio.sfx('win');
  }
  function certificate() {
    const W = 900, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#f2e6c9'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#221c18'; x.lineWidth = 8; x.strokeRect(24, 24, W - 48, H - 48);
    x.strokeStyle = '#b8412c'; x.lineWidth = 3; x.strokeRect(40, 40, W - 80, H - 80);
    x.fillStyle = '#2e7d6b'; x.fillRect(40, 40, W - 80, 14); x.fillStyle = '#d9a441'; x.fillRect(40, 54, W - 80, 4);
    x.fillStyle = '#221c18'; x.textAlign = 'center';
    x.font = '700 64px "Nanum Brush Script", "Gowun Batang", serif'; x.fillText('한글 수호대 임명장', W / 2, 150);
    x.font = '700 34px "Gowun Dodum", sans-serif'; x.fillText(G.me.team + '모둠  ' + G.me.name, W / 2, 230);
    x.font = '26px "Gowun Dodum", sans-serif';
    ['위 어린이는 조선으로 떠나 먹물 요괴 묵귀를 물리치고', '반 친구들과 힘을 모아 우리 한글을 지켜냈기에', '이에 「한글 수호대」로 임명합니다.'].forEach((l, i) => x.fillText(l, W / 2, 310 + i * 46));
    x.font = '700 30px "Gowun Dodum", sans-serif'; x.fillText('「' + G.room.goal + '」', W / 2, 470);
    const d = new Date(); x.font = '24px "Gowun Dodum", sans-serif'; x.fillText(d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일', W / 2, 530);
    x.fillStyle = '#b8412c'; x.fillRect(W - 210, H - 190, 110, 110); x.fillStyle = '#f2e6c9'; x.font = '700 30px "Gowun Batang", serif';
    x.fillText('세종', W - 155, H - 140); x.fillText('대왕', W - 155, H - 104);
    x.drawImage(HS.sprite('king', 'down', 0), 100, H - 200, 96, 96);
    const img = el('img', 'cert'); img.src = c.toDataURL('image/png'); img.alt = '한글 수호대 임명장';
    const cs = $('#cutscene'); cs.innerHTML = ''; cs.className = 'cutscene cert-wrap';
    cs.appendChild(img);
    cs.appendChild(el('p', 'muted light', '임명장 그림을 길게 누르면 사진에 저장할 수 있어요.'));
    const back = el('button', 'btn ghost', '닫기'); back.onclick = () => { cs.classList.add('hidden'); G.inCutscene = false; }; cs.appendChild(back);
  }

  /* =============== 그리기 =============== */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.screen === 'game' && G.grid) { updatePlayer(dt); updateCam(); draw(now); bossTick(now); updateAction(); if (now - G.lastPos > 2000) sendPos(true); }
    requestAnimationFrame(loop);
  }
  function updateCam() {
    const p = G.p, S = G.S, W = G.grid[0].length * S, H = G.grid.length * S;
    let px = (p.fx + (p.x - p.fx) * p.t) * S + S / 2, py = (p.fy + (p.y - p.fy) * p.t) * S + S / 2;
    if (G.mapId === 5 && G.room && (G.room.status === 'boss' || G.room.status === 'ending')) { px = 13 * S; py = 9.6 * S; }
    G.cam.x = W <= G.vw ? (W - G.vw) / 2 : Math.max(0, Math.min(W - G.vw, px - G.vw / 2));
    G.cam.y = H <= G.vh ? (H - G.vh) / 2 : Math.max(0, Math.min(H - G.vh, py - G.vh / 2));
  }
  let lastAct = '';
  function updateAction() {
    const o = blocked() ? null : nearObject(); const lab = actionLabel(o);
    if (lab !== lastAct) { lastAct = lab; const b = $('#act-btn'); b.textContent = lab || '살펴보기'; b.classList.toggle('ready', !!lab); }
  }
  function draw(now) {
    const c = G.ctx, S = G.S, dpr = G.dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false;
    c.fillStyle = G.def.theme === 'night' ? '#0f1626' : '#221c18'; c.fillRect(0, 0, G.vw, G.vh);
    const g = G.grid, W = g[0].length, H = g.length;
    c.drawImage(G.mapCanvas, 0, 0, W * T, H * T, Math.round(-G.cam.x), Math.round(-G.cam.y), W * S, H * S);
    const sx = (x) => Math.round(x * S - G.cam.x), sy = (y) => Math.round(y * S - G.cam.y);
    const ents = [];
    // 반짝이 / 쪽지 (탐정에게만)
    objectsHere().filter((o) => o.kind === 'clue').forEach((o) => ents.push({ y: o.y - 0.1, f: () => {
      c.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(now / 300));
      c.drawImage(o.note ? HS.noteSprite() : HS.sparkle(now), sx(o.x), sy(o.y), S, S); c.globalAlpha = 1;
    } }));
    // NPC
    G.def.npcs.forEach((n) => ents.push({ y: n.y, f: () => {
      c.drawImage(HS.sprite(n.look, 'down', Math.floor(now / 600) % 2 && n.kind !== 'gate' ? 1 : 0), sx(n.x), sy(n.y), S, S);
      const mk = npcMark(n); if (mk) mark(c, mk, sx(n.x) + S / 2, sy(n.y) - S * 0.15 + Math.sin(now / 250) * 3, S);
    } }));
    if (G.def.station) { const st = G.def.station; const mk = stationMark(); if (mk) ents.push({ y: st.y + 0.5, f: () => mark(c, mk, sx(st.x) + S / 2, sy(st.y) - S * 0.1 + Math.sin(now / 250) * 3, S) }); }
    // 모둠 친구
    Object.values(G.peers).forEach((p) => {
      if (p.map !== G.mapId || now - p.ts > 9000) return;
      p.rx += (p.x - p.rx) * 0.25; p.ry += (p.y - p.ry) * 0.25;
      ents.push({ y: p.ry, f: () => { c.drawImage(HS.sprite(p.look || 'quiz', p.dir || 'down', p.frame || 0), sx(p.rx), sy(p.ry), S, S); label(c, p.name, sx(p.rx) + S / 2, sy(p.ry) - 4, S); bubble(c, p.id, sx(p.rx) + S / 2, sy(p.ry) - S * 0.35, now); } });
    });
    // 나
    const p = G.p, ix = p.fx + (p.x - p.fx) * p.t, iy = p.fy + (p.y - p.fy) * p.t;
    const fr = p.moving ? Math.floor(p.t * 2) + p.frame : 0;
    ents.push({ y: iy, f: () => {
      c.drawImage(HS.mukdori(Math.floor(now / 400)), sx(ix - 0.55), sy(iy - 0.35) + Math.sin(now / 300) * 2, S * 0.7, S * 0.7);
      c.drawImage(HS.sprite(lookOf(G.myRoles), p.dir, fr), sx(ix), sy(iy), S, S);
      label(c, G.me.name, sx(ix) + S / 2, sy(iy) - 4, S, true); bubble(c, G.me.id, sx(ix) + S / 2, sy(iy) - S * 0.35, now);
    } });
    // 보스 / 임금
    if (G.mapId === 5 && (bossActive() || (G.room.status === 'ending' && G.inCutscene && !G.kingShow))) {
      const hurt = now - G.bossHurt < 220, bw = 48 * G.scale * 0.9, bh = 40 * G.scale * 0.9;
      ents.push({ y: 7.9, f: () => { c.drawImage(HS.boss(Math.floor(now / 250), hurt), Math.round(13 * S - G.cam.x - bw / 2 + (hurt ? (Math.random() - 0.5) * 8 : 0)), Math.round(6.6 * S - G.cam.y - bh / 2 + Math.sin(now / 500) * 6), bw, bh); } });
    }
    if (G.mapId === 5 && G.room.status === 'ending') {
      if (G.kingY < 6) G.kingY += 0.02;
      const ky = G.kingY;
      ents.push({ y: ky, f: () => { c.drawImage(HS.sprite('king', 'down', Math.floor(now / 500)), sx(12.5), sy(ky), S * 1.2, S * 1.2); } });
    }
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.f());
    // 효과 글자
    G.fx = G.fx.filter((f) => now - f.t0 < 900);
    G.fx.forEach((f) => { const k = (now - f.t0) / 900; c.globalAlpha = 1 - k; c.font = 'bold ' + Math.round(S * 0.6) + 'px "Gowun Dodum", sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#221c18'; c.strokeText(f.text, sx(f.x), sy(f.y - k)); c.fillStyle = f.color; c.fillText(f.text, sx(f.x), sy(f.y - k)); c.globalAlpha = 1; });
    // 경로 표시
    if (G.path.length) { const [tx, ty] = G.path[G.path.length - 1]; c.strokeStyle = 'rgba(246,238,199,.8)'; c.lineWidth = 2; c.strokeRect(sx(tx) + 4, sy(ty) + 4, S - 8, S - 8); }
  }
  function npcMark(n) {
    const m = G.mapId;
    if (n.kind === 'quiz' && !G.team.done['m' + m + '_' + n.id] && has('quiz')) return '!';
    if (n.kind === 'gate' && has('leader') && m < 5) return HS.mapTasks(m, G.team).every((t) => t.ok) ? '문' : '';
    return '';
  }
  function stationMark() {
    if (!has('builder')) return '';
    if (G.mapId === 4) { const t = G.team; return t.targets.some((idx, k) => !t.letters[idx] && t.done['m4_c' + k]) ? '!' : ''; }
    return G.team.done['m' + G.mapId + '_b'] ? '' : '!';
  }
  function mark(c, txt, x, y, S) {
    const r = S * 0.28;
    c.fillStyle = '#221c18'; c.beginPath(); c.arc(x, y - r, r + 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = txt === '문' ? '#2e7d6b' : '#e3b341'; c.beginPath(); c.arc(x, y - r, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = txt === '문' ? '#f6eec7' : '#221c18'; c.font = 'bold ' + Math.round(r * 1.3) + 'px "Gowun Dodum", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y - r + 1); c.textBaseline = 'alphabetic';
  }
  function label(c, text, x, y, S, me) {
    c.font = '700 ' + Math.max(11, Math.round(S * 0.24)) + 'px "Gowun Dodum", sans-serif'; c.textAlign = 'center';
    const w = c.measureText(text).width + 10, h = Math.max(15, S * 0.3);
    c.fillStyle = me ? 'rgba(184,65,44,.9)' : 'rgba(34,28,24,.75)'; c.fillRect(x - w / 2, y - h, w, h);
    c.fillStyle = '#f6eec7'; c.fillText(text, x, y - h * 0.25);
  }
  function bubble(c, id, x, y, now) {
    const b = G.bubbles[id]; if (!b || now > b.until) return;
    c.font = '700 16px "Gowun Dodum", sans-serif'; c.textAlign = 'center';
    const w = c.measureText(b.text).width + 18, h = 28;
    c.fillStyle = '#221c18'; c.fillRect(x - w / 2 - 2, y - h - 2 - 18, w + 4, h + 4);
    c.fillStyle = '#f6eec7'; c.fillRect(x - w / 2, y - h - 18, w, h);
    c.fillStyle = '#221c18'; c.fillText(b.text, x, y - 26);
  }

  HS.game = { boot, G };
  window.addEventListener('DOMContentLoaded', boot);
})();
