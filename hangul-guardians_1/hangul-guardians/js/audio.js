/* 한글 수호대 — 효과음과 배경음 (파일 없이 브라우저에서 합성) */
(function () {
  const HS = (window.HS = window.HS || {});
  let ctx = null, master = null, bgmGain = null, bgmTimer = null, muted = false, step = 0, currentTheme = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value = 0.18; bgmGain.connect(master);
    return ctx;
  }
  function tone(freq, dur, type, vol, when, dest) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.02);
  }

  const SFX = {
    blip: () => tone(880, 0.05, 'square', 0.06),
    step: () => tone(220, 0.03, 'triangle', 0.03),
    ok: () => { tone(659, 0.1, 'square', 0.12); tone(988, 0.18, 'square', 0.12, 0.09); },
    no: () => { tone(196, 0.12, 'sawtooth', 0.1); tone(147, 0.2, 'sawtooth', 0.1, 0.1); },
    piece: () => { [784, 988, 1175].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, i * 0.07)); },
    gate: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.18, 'square', 0.12, i * 0.1)); },
    hit: () => { tone(110, 0.12, 'sawtooth', 0.2); tone(880, 0.06, 'square', 0.08, 0.02); },
    special: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.14, 'square', 0.14, i * 0.06)); },
    ink: () => { tone(90, 0.3, 'sawtooth', 0.12); },
    win: () => { [523, 587, 659, 784, 880, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, i * 0.15)); }
  };

  /* 국악풍 5음계(궁상각치우) 반주 */
  const SCALE = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
  const PATTERNS = {
    market: { tempo: 260, mel: [0, 2, 4, 2, 3, 4, 5, 4, 3, 2, 0, -1, 2, 3, 4, -1], bass: 'triangle' },
    seodang: { tempo: 340, mel: [4, -1, 3, 2, 0, -1, 2, 3, 4, -1, 5, 4, 3, -1, 2, -1], bass: 'triangle' },
    night: { tempo: 420, mel: [5, -1, -1, 4, 2, -1, -1, 3, 4, -1, -1, 2, 0, -1, -1, -1], bass: 'sine' },
    hall: { tempo: 320, mel: [2, 3, 4, -1, 5, 4, 3, -1, 2, 0, 2, -1, 3, 2, 0, -1], bass: 'triangle' },
    palace: { tempo: 220, mel: [0, 0, 3, 0, 4, 3, 0, 5, 0, 0, 3, 0, 6, 5, 4, 3], bass: 'square' }
  };
  function playBgm(theme) {
    currentTheme = theme;
    if (bgmTimer) clearInterval(bgmTimer);
    if (!ensure() || !theme) return;
    const p = PATTERNS[theme] || PATTERNS.market;
    step = 0;
    bgmTimer = setInterval(() => {
      if (muted || ctx.state !== 'running') return;
      const n = p.mel[step % p.mel.length];
      if (n >= 0) tone(SCALE[n] * (theme === 'night' ? 1 : 1), (p.tempo / 1000) * 0.9, 'triangle', 0.5, 0, bgmGain);
      if (step % 4 === 0) tone(SCALE[[0, 3, 4, 0][(step / 4) % 4]] / 2, (p.tempo / 1000) * 1.8, p.bass, 0.35, 0, bgmGain);
      step++;
    }, p.tempo);
  }

  HS.audio = {
    /* 아이패드 사파리는 첫 터치 이후에만 소리를 낼 수 있어요 */
    unlock() { if (!ensure()) return; if (ctx.state === 'suspended') ctx.resume(); },
    sfx(name) { if (SFX[name]) SFX[name](); },
    bgm: playBgm,
    setMuted(m) { muted = m; try { localStorage.setItem('hs_muted', m ? '1' : '0'); } catch (e) {} },
    isMuted: () => muted,
    init() { try { muted = localStorage.getItem('hs_muted') === '1'; } catch (e) {} }
  };
})();
