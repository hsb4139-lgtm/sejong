/* 한글 수호대 — 데이터·실시간 연결
   - Supabase 설정이 있으면 Supabase(데이터베이스 + Realtime)로 반 전체가 연결돼요.
   - 설정이 없으면 '로컬 테스트 모드'로 같은 브라우저의 여러 탭끼리 연결돼요.
   - 체험판(demo)은 한 기기에서 혼자 모든 역할을 맡고, 다른 모둠은 자동으로 움직여요. */
(function () {
  const HS = (window.HS = window.HS || {});
  HS.BOSS_PER_TEAM = 25;

  function newTeams(code, goal, teamCount) {
    const parts = HS.distribute(HS.syllables(goal).length, teamCount);
    return parts.map((targets, i) => ({ room: code, no: i + 1, targets, map: 1, done: {}, pieces: {}, letters: {}, hints: 3, help_sent: 0, member_order: [], boss_hits: 0 }));
  }
  const cp = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  function teamComplete(t) { return Object.keys(t.letters || {}).length >= (t.targets || []).length; }

  /* ================= Supabase ================= */
  class SupaBackend {
    constructor(url, key) {
      this.mode = 'supabase';
      this.sb = window.supabase.createClient(url, key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 20 } } });
    }
    async createRoom(goal, teamCount) {
      for (let tries = 0; tries < 12; tries++) {
        const code = String(Math.floor(1000 + Math.random() * 9000));
        const hp = teamCount * HS.BOSS_PER_TEAM;
        const { error } = await this.sb.from('hs_rooms').insert({ code, goal, team_count: teamCount, status: 'lobby', paused: false, boss_hp: hp, boss_max: hp });
        if (error) { if (error.code === '23505') continue; throw error; }
        const r2 = await this.sb.from('hs_teams').insert(newTeams(code, goal, teamCount));
        if (r2.error) throw r2.error;
        return code;
      }
      throw new Error('방 코드를 만들지 못했어요. 다시 눌러 주세요.');
    }
    async getRoom(code) { const { data, error } = await this.sb.from('hs_rooms').select('*').eq('code', code).maybeSingle(); if (error) throw error; return data; }
    async getTeams(code) { const { data, error } = await this.sb.from('hs_teams').select('*').eq('room', code).order('no'); if (error) throw error; return data || []; }
    async updateRoom(code, patch) { const { data, error } = await this.sb.from('hs_rooms').update(patch).eq('code', code).select().single(); if (error) throw error; return data; }
    async patchTeam(code, no, p) {
      const { data, error } = await this.sb.rpc('hs_patch_team', {
        p_room: code, p_no: no, p_done: p.done || {}, p_pieces: p.pieces || {}, p_letters: p.letters || {},
        p_map: p.map == null ? null : p.map, p_hints: p.hints || 0, p_help: p.help || 0, p_order: p.order || null, p_boss_hits: p.bossHits || 0
      });
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    }
    async hitBoss(code, dmg) { const { data, error } = await this.sb.rpc('hs_hit_boss', { p_room: code, p_dmg: dmg }); if (error) throw error; return Array.isArray(data) ? data[0] : data; }
    log(code, team, qid, correct) { this.sb.from('hs_logs').insert({ room: code, team, qid, correct }).then(() => {}, () => {}); }
    async getLogs(code) { const { data } = await this.sb.from('hs_logs').select('*').eq('room', code); return data || []; }
    join(code, meta, h) {
      this.code = code; this.meta = meta; this.h = h;
      this.ch = this.sb.channel('room-' + code, { config: { presence: { key: meta.id }, broadcast: { self: false } } });
      this.ch.on('presence', { event: 'sync' }, () => {
        const st = this.ch.presenceState();
        h.presence && h.presence(Object.keys(st).map((k) => st[k][0]).filter(Boolean));
      });
      this.ch.on('broadcast', { event: 'evt' }, ({ payload }) => h.event && h.event(payload));
      this.ch.subscribe(async (status) => { if (status === 'SUBSCRIBED') { try { await this.ch.track(meta); } catch (e) {} } });
      this.db = this.sb.channel('db-' + code + '-' + meta.id)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hs_rooms', filter: 'code=eq.' + code }, (p) => h.room && p.new && h.room(p.new))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hs_teams', filter: 'room=eq.' + code }, (p) => h.team && p.new && p.new.no && h.team(p.new))
        .subscribe();
      // 와이파이가 잠깐 끊겨도 따라잡도록 주기적으로 다시 읽기
      this.poll = setInterval(async () => {
        try {
          const r = await this.getRoom(code); if (r && h.room) h.room(r);
          const ts = await this.getTeams(code); ts.forEach((t) => h.team && h.team(t));
        } catch (e) {}
      }, 8000);
    }
    retrack(meta) { this.meta = meta; if (this.ch) this.ch.track(meta).catch(() => {}); }
    send(evt) { if (this.ch) this.ch.send({ type: 'broadcast', event: 'evt', payload: evt }); }
    joinTeam(code, no, onPos) {
      this.tch = this.sb.channel('team-' + code + '-' + no, { config: { broadcast: { self: false } } });
      this.tch.on('broadcast', { event: 'pos' }, ({ payload }) => onPos(payload));
      this.tch.subscribe();
    }
    sendPos(p) { if (this.tch) this.tch.send({ type: 'broadcast', event: 'pos', payload: p }); }
  }

  /* ================= 로컬 / 체험판 ================= */
  class LocalBackend {
    constructor(demo) {
      this.mode = demo ? 'demo' : 'local';
      this.demo = demo;
      this.mem = { rooms: {}, teams: {}, logs: [] };
      this.pres = {};
      this.bc = null;
      if (!demo && 'BroadcastChannel' in window) {
        this.bc = new BroadcastChannel('hs-local');
        this.bc.onmessage = (e) => this._handle(e.data);
      }
    }
    _db() {
      if (this.demo) return this.mem;
      try { return JSON.parse(localStorage.getItem('hs_local_db')) || { rooms: {}, teams: {}, logs: [] }; } catch (e) { return this.mem; }
    }
    _save(db) { if (this.demo) { this.mem = db; return; } try { localStorage.setItem('hs_local_db', JSON.stringify(db)); } catch (e) { this.mem = db; } }
    _emit(msg) { this._handle(msg, true); if (this.bc) this.bc.postMessage(msg); }
    _handle(msg, own) {
      if (!this.h || msg.code !== this.code) return;
      const h = this.h;
      if (msg.type === 'room') h.room && h.room(msg.row);
      else if (msg.type === 'team') h.team && h.team(msg.row);
      else if (msg.type === 'evt') { if (!own) h.event && h.event(msg.evt); }
      else if (msg.type === 'pres') { this.pres[msg.meta.id] = Object.assign({}, msg.meta, { ts: Date.now() }); this._presOut(); }
      else if (msg.type === 'bye') { delete this.pres[msg.id]; this._presOut(); }
      else if (msg.type === 'pos') { if (!own && this.onPos && msg.team === this.teamNo) this.onPos(msg.p); }
    }
    _presOut() {
      const now = Date.now();
      Object.keys(this.pres).forEach((k) => { if (now - this.pres[k].ts > 7000) delete this.pres[k]; });
      if (this.meta) this.pres[this.meta.id] = Object.assign({}, this.meta, { ts: now });
      this.h && this.h.presence && this.h.presence(Object.values(this.pres));
    }
    async createRoom(goal, teamCount, fixedCode) {
      const db = this._db();
      let code = fixedCode;
      while (!code || (db.rooms[code] && !fixedCode)) code = String(Math.floor(1000 + Math.random() * 9000));
      const hp = teamCount * HS.BOSS_PER_TEAM;
      db.rooms[code] = { code, goal, team_count: teamCount, status: 'lobby', paused: false, boss_hp: hp, boss_max: hp };
      newTeams(code, goal, teamCount).forEach((t) => (db.teams[code + '_' + t.no] = t));
      this._save(db);
      return code;
    }
    async getRoom(code) { return cp(this._db().rooms[code] || null); }
    async getTeams(code) { const db = this._db(); return cp(Object.values(db.teams).filter((t) => t.room === code).sort((a, b) => a.no - b.no)); }
    async updateRoom(code, patch) {
      const db = this._db(); const r = db.rooms[code]; if (!r) return null;
      Object.assign(r, patch); this._save(db); this._emit({ type: 'room', code, row: cp(r) }); return cp(r);
    }
    async patchTeam(code, no, p) {
      const db = this._db(); const t = db.teams[code + '_' + no]; if (!t) return null;
      Object.assign(t.done, p.done || {}); Object.assign(t.pieces, p.pieces || {}); Object.assign(t.letters, p.letters || {});
      if (p.map != null) t.map = Math.max(t.map, p.map);
      t.hints = Math.max(0, t.hints + (p.hints || 0)); t.help_sent += p.help || 0; t.boss_hits += p.bossHits || 0;
      if (p.order) t.member_order = p.order;
      const r = db.rooms[code];
      let roomChanged = false;
      if (p.letters && Object.keys(p.letters).length && r.status === 'play') {
        const all = Object.values(db.teams).filter((x) => x.room === code);
        if (all.every(teamComplete)) { r.status = 'boss'; roomChanged = true; }
      }
      this._save(db);
      this._emit({ type: 'team', code, row: cp(t) });
      if (roomChanged) this._emit({ type: 'room', code, row: cp(r) });
      return cp(t);
    }
    async hitBoss(code, dmg) {
      const db = this._db(); const r = db.rooms[code]; if (!r || r.status !== 'boss') return cp(r);
      r.boss_hp = Math.max(0, r.boss_hp - dmg); if (r.boss_hp === 0) r.status = 'ending';
      this._save(db); this._emit({ type: 'room', code, row: cp(r) }); return cp(r);
    }
    log(code, team, qid, correct) { const db = this._db(); db.logs.push({ room: code, team, qid, correct, created_at: new Date().toISOString() }); this._save(db); }
    async getLogs(code) { return this._db().logs.filter((l) => l.room === code); }
    join(code, meta, h) {
      this.code = code; this.meta = meta; this.h = h;
      const beat = () => this._emit({ type: 'pres', code, meta: this.meta });
      beat(); this.beat = setInterval(beat, 2000);
      this.prune = setInterval(() => this._presOut(), 3000);
      window.addEventListener('pagehide', () => { if (this.bc) this.bc.postMessage({ type: 'bye', code, id: meta.id }); });
      if (this.demo) this._startBots(code);
    }
    retrack(meta) { this.meta = meta; this._emit({ type: 'pres', code: this.code, meta }); }
    send(evt) { this._emit({ type: 'evt', code: this.code, evt }); }
    joinTeam(code, no, onPos) { this.teamNo = no; this.onPos = onPos; }
    sendPos(p) { if (this.bc) this.bc.postMessage({ type: 'pos', code: this.code, team: this.teamNo, p }); }

    /* 체험판: 다른 모둠이 자동으로 진행하고, 서로 돕기도 해요 */
    _startBots(code) {
      const bots = {};
      const tick = async () => {
        const r = await this.getRoom(code); if (!r || r.paused) return;
        const teams = await this.getTeams(code);
        const me = teams.find((t) => t.no === 1);
        const meWaiting = me && me.map >= 5;
        if (r.status === 'play') {
          for (const t of teams) {
            if (t.no === 1) continue;
            const b = bots[t.no] || (bots[t.no] = { next: Date.now() + 15000 + Math.random() * 20000 });
            if (meWaiting) b.next = Math.min(b.next, (b.last || 0) + 1500);
            if (Date.now() < b.next) continue;
            b.last = Date.now();
            b.next = Date.now() + (meWaiting ? 1500 : 22000 + Math.random() * 25000);
            if (t.map < 4) { await this.patchTeam(code, t.no, { map: t.map + 1 }); }
            else if (!teamComplete(t)) {
              const idx = t.targets.find((i) => !t.letters[i]);
              await this.patchTeam(code, t.no, { letters: { [idx]: true } });
              const after = (await this.getTeams(code)).find((x) => x.no === t.no);
              if (teamComplete(after)) {
                await this.patchTeam(code, t.no, { map: 5 });
                if (me && !teamComplete(me) && Math.random() < 0.6) {
                  await this.patchTeam(code, 1, { hints: 1 }); await this.patchTeam(code, t.no, { help: 1 });
                  this._handle({ type: 'evt', code, evt: { type: 'help', from: t.no, to: 1 } });
                }
              }
            }
          }
        } else if (r.status === 'boss') {
          for (const t of teams) { if (t.no !== 1 && Math.random() < 0.45) await this.hitBoss(code, 1); }
        }
      };
      this.botTimer = setInterval(tick, 1500);
    }
  }

  HS.createBackend = function (opts) {
    const cfg = HS.CONFIG || {};
    if (opts && opts.demo) return new LocalBackend(true);
    if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) return new SupaBackend(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return new LocalBackend(false);
  };
  HS.teamComplete = teamComplete;
})();
