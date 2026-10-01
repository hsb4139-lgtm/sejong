/* 한글 수호대 — 도트(픽셀) 그림을 코드로 그리기 */
(function () {
  const HS = (window.HS = window.HS || {});
  const T = 16; // 원본 타일 크기(px)

  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }

  const THEMES = {
    market: { ground: ['#c9a36b', '#b8915a', '#d6b47e'], grass: ['#86a856', '#6f9046', '#9cbb68'], tree: ['#3f7a3a', '#2f5f2c', '#5d9a4c'], trunk: '#6b4a2f' },
    seodang: { ground: ['#86a856', '#6f9046', '#9cbb68'], grass: ['#86a856', '#6f9046', '#9cbb68'], tree: ['#3c7a46', '#2d5e36', '#5a9a5c'], trunk: '#6b4a2f' },
    night: { ground: ['#2a3b3a', '#22312f', '#33494a'], grass: ['#2a3b3a', '#22312f', '#33494a'], tree: ['#1d3f37', '#15302a', '#2a574b'], trunk: '#3b2a1f' },
    hall: { ground: ['#b98b5a', '#a77a4c', '#c79a68'], grass: ['#b98b5a', '#a77a4c', '#c79a68'], tree: ['#3f7a3a', '#2f5f2c', '#5d9a4c'], trunk: '#6b4a2f' },
    palace: { ground: ['#c8c2b4', '#b5ae9f', '#d6d0c3'], grass: ['#c8c2b4', '#b5ae9f', '#d6d0c3'], tree: ['#3f7a3a', '#2f5f2c', '#5d9a4c'], trunk: '#6b4a2f' }
  };

  function speckle(x, r, cols, n) { for (let i = 0; i < n; i++) { x.fillStyle = cols[1 + Math.floor(r() * (cols.length - 1))]; x.fillRect(Math.floor(r() * T), Math.floor(r() * T), 1 + (r() < 0.3 ? 1 : 0), 1); } }

  function drawGround(x, th, r, ch) {
    const theme = THEMES[th];
    let cols = theme.ground;
    if (ch === ',') cols = theme.grass;
    if (th === 'hall' || ch === 'w') return drawFloor(x, r);
    if (th === 'palace' || ch === 'k') return drawPave(x, r);
    x.fillStyle = cols[0]; x.fillRect(0, 0, T, T);
    speckle(x, r, cols, 14);
    if (ch === ',' && th !== 'night') {
      for (let i = 0; i < 3; i++) { const px = Math.floor(r() * 13) + 1, py = Math.floor(r() * 12) + 2; x.fillStyle = cols[1]; x.fillRect(px, py, 1, 2); x.fillRect(px + 2, py + 1, 1, 1); }
      if (r() < 0.5) { x.fillStyle = r() < 0.5 ? '#f0d7e4' : '#f6eec7'; x.fillRect(Math.floor(r() * 12) + 2, Math.floor(r() * 12) + 2, 2, 2); }
    }
    if (th === 'night' && r() < 0.25) { x.fillStyle = '#c9e48a'; x.fillRect(Math.floor(r() * 14) + 1, Math.floor(r() * 14) + 1, 1, 1); }
  }
  function drawFloor(x, r) {
    x.fillStyle = '#b98b5a'; x.fillRect(0, 0, T, T);
    x.fillStyle = '#9c7045'; for (let y = 3; y < T; y += 4) x.fillRect(0, y, T, 1);
    x.fillStyle = '#c99a68'; for (let y = 0; y < T; y += 4) x.fillRect(0, y, T, 1);
    x.fillStyle = '#9c7045'; for (let y = 0; y < T; y += 4) x.fillRect(Math.floor(r() * T), y, 1, 3);
  }
  function drawPave(x, r) {
    x.fillStyle = '#c8c2b4'; x.fillRect(0, 0, T, T);
    x.fillStyle = '#a79f8f'; x.fillRect(0, 7, T, 1); x.fillRect(0, 15, T, 1); x.fillRect(5, 0, 1, 7); x.fillRect(11, 8, 1, 7);
    x.fillStyle = '#d8d3c7'; x.fillRect(0, 0, T, 1); x.fillRect(0, 8, T, 1);
    speckle(x, r, ['#c8c2b4', '#b9b2a3', '#d3cdc0'], 6);
  }
  function drawRoad(x, r) {
    x.fillStyle = '#8f836f'; x.fillRect(0, 0, T, T);
    const stones = [[0, 0, 7, 5], [8, 0, 8, 5], [0, 6, 4, 4], [5, 6, 7, 4], [13, 6, 3, 4], [0, 11, 8, 5], [9, 11, 7, 5]];
    stones.forEach(([a, b, w, h]) => { x.fillStyle = r() < 0.5 ? '#b5a894' : '#a89b86'; x.fillRect(a, b, w, h); x.fillStyle = '#c7bca9'; x.fillRect(a, b, w, 1); });
  }
  function drawWall(x, th) {
    x.fillStyle = '#e9e0cc'; x.fillRect(0, 0, T, T);
    x.fillStyle = '#6b4a2f'; x.fillRect(0, 0, T, 2); x.fillRect(0, 0, 2, 12); x.fillRect(14, 0, 2, 12); x.fillRect(0, 6, T, 1);
    x.fillStyle = '#8d8478'; x.fillRect(0, 12, T, 4);
    x.fillStyle = '#756d62'; x.fillRect(0, 12, T, 1); x.fillRect(5, 13, 1, 3); x.fillRect(11, 13, 1, 3);
    if (th === 'hall' || th === 'palace') { x.fillStyle = '#2e7d6b'; x.fillRect(2, 2, 12, 2); x.fillStyle = '#b8412c'; x.fillRect(2, 4, 12, 1); }
  }
  function drawGiwa(x) {
    x.fillStyle = '#3d4753'; x.fillRect(0, 0, T, T);
    for (let y = 0; y < T; y += 4) for (let i = (y / 4) % 2 ? 2 : 0; i < T; i += 4) {
      x.fillStyle = '#56626f'; x.fillRect(i, y, 3, 3); x.fillStyle = '#6f7c8a'; x.fillRect(i, y, 3, 1);
    }
    x.fillStyle = '#2a323b'; x.fillRect(0, 14, T, 2);
  }
  function drawThatch(x, r) {
    x.fillStyle = '#c9a24f'; x.fillRect(0, 0, T, T);
    x.fillStyle = '#a8822e'; for (let i = 0; i < 18; i++) x.fillRect(Math.floor(r() * T), Math.floor(r() * 13), 1, 3);
    x.fillStyle = '#ddb968'; for (let i = 0; i < 8; i++) x.fillRect(Math.floor(r() * T), Math.floor(r() * 13), 1, 2);
    x.fillStyle = '#7e6122'; x.fillRect(0, 13, T, 3);
  }
  function drawTree(x, th) {
    const t = THEMES[th];
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(3, 13, 11, 2);
    x.fillStyle = t.trunk; x.fillRect(7, 10, 3, 5);
    x.fillStyle = t.tree[1]; x.fillRect(2, 3, 13, 9); x.fillRect(4, 1, 9, 12);
    x.fillStyle = t.tree[0]; x.fillRect(3, 2, 11, 8); x.fillRect(5, 1, 7, 10);
    x.fillStyle = t.tree[2]; x.fillRect(5, 2, 4, 2); x.fillRect(4, 4, 2, 2); x.fillRect(10, 5, 2, 1);
  }
  function drawWater(x, r) {
    x.fillStyle = '#4f8fb3'; x.fillRect(0, 0, T, T);
    x.fillStyle = '#7fb6d3'; for (let i = 0; i < 4; i++) { const px = Math.floor(r() * 12), py = Math.floor(r() * 14) + 1; x.fillRect(px, py, 4, 1); }
    x.fillStyle = '#3d7598'; x.fillRect(0, 15, T, 1);
  }
  function drawFence(x) {
    x.fillStyle = '#7a5434'; x.fillRect(1, 4, 2, 11); x.fillRect(13, 4, 2, 11); x.fillRect(0, 6, T, 2); x.fillRect(0, 11, T, 2);
    x.fillStyle = '#9b7048'; x.fillRect(1, 4, 2, 1); x.fillRect(13, 4, 2, 1);
  }
  function drawStall(x, r) {
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(1, 13, 14, 2);
    x.fillStyle = '#7a5434'; x.fillRect(1, 7, 14, 6); x.fillRect(2, 13, 2, 2); x.fillRect(12, 13, 2, 2);
    const cloth = ['#b8412c', '#2e6f9e', '#2e7d6b'][Math.floor(r() * 3)];
    x.fillStyle = cloth; x.fillRect(1, 7, 14, 2);
    const goods = ['#f0d48a', '#e8e2d2', '#c9563f', '#8fbf6a', '#f2a65a'];
    for (let i = 0; i < 4; i++) { x.fillStyle = goods[Math.floor(r() * goods.length)]; x.fillRect(2 + i * 3, 4 + Math.floor(r() * 2), 3, 3); }
  }
  function drawShelf(x, r) {
    x.fillStyle = '#4e321e'; x.fillRect(0, 0, T, T);
    x.fillStyle = '#3a2416'; x.fillRect(0, 7, T, 1); x.fillRect(0, 15, T, 1);
    const cols = ['#e8e2d2', '#b8412c', '#2e6f9e', '#d9a441', '#2e7d6b', '#efe6d2'];
    for (let row = 0; row < 2; row++) for (let i = 1; i < 15; i += 2) { if (r() < 0.15) continue; x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(i, 1 + row * 8, 2, 6); }
  }
  function drawDesk(x) {
    x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(1, 12, 14, 3);
    x.fillStyle = '#8a5a33'; x.fillRect(1, 6, 14, 6); x.fillStyle = '#a06c40'; x.fillRect(1, 6, 14, 1);
    x.fillStyle = '#6b4426'; x.fillRect(2, 12, 2, 2); x.fillRect(12, 12, 2, 2);
    x.fillStyle = '#f2ead6'; x.fillRect(3, 7, 6, 4); x.fillStyle = '#221c18'; x.fillRect(4, 8, 3, 1); x.fillRect(4, 9, 4, 1);
    x.fillStyle = '#2f2a28'; x.fillRect(10, 7, 4, 3); x.fillStyle = '#4b4542'; x.fillRect(11, 8, 2, 1);
  }
  function drawRock(x) {
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(2, 12, 12, 3);
    x.fillStyle = '#7d7a73'; x.fillRect(3, 6, 10, 7); x.fillRect(4, 5, 8, 9);
    x.fillStyle = '#9a978f'; x.fillRect(5, 6, 4, 2);
  }
  function drawPillar(x) {
    x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(3, 13, 10, 3);
    x.fillStyle = '#8f2a22'; x.fillRect(5, 0, 6, 15); x.fillStyle = '#b8412c'; x.fillRect(6, 0, 2, 15);
    x.fillStyle = '#2e7d6b'; x.fillRect(4, 0, 8, 3); x.fillStyle = '#d9a441'; x.fillRect(4, 3, 8, 1);
    x.fillStyle = '#8d8478'; x.fillRect(4, 14, 8, 2);
  }
  function drawGate(x) {
    x.fillStyle = '#5a2a1c'; x.fillRect(0, 0, T, T);
    x.fillStyle = '#9c2f22'; x.fillRect(1, 1, 6, 15); x.fillRect(9, 1, 6, 15);
    x.fillStyle = '#d9a441'; [[3, 4], [3, 9], [11, 4], [11, 9], [6, 7], [9, 7]].forEach(([a, b]) => x.fillRect(a, b, 2, 2));
    x.fillStyle = '#2e7d6b'; x.fillRect(0, 0, T, 1);
  }
  function drawJar(x) {
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(3, 13, 10, 2);
    x.fillStyle = '#6b3f24'; x.fillRect(4, 5, 8, 9); x.fillRect(3, 7, 10, 5);
    x.fillStyle = '#8a5530'; x.fillRect(5, 6, 3, 3); x.fillStyle = '#3a2416'; x.fillRect(5, 4, 6, 2);
  }
  function drawLantern(x) {
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(4, 13, 8, 2);
    x.fillStyle = '#9a978f'; x.fillRect(7, 8, 2, 6); x.fillRect(5, 13, 6, 2); x.fillRect(4, 3, 8, 5); x.fillRect(3, 2, 10, 2);
    x.fillStyle = '#f6c56a'; x.fillRect(6, 4, 4, 3); x.fillStyle = '#fff1bf'; x.fillRect(7, 5, 2, 1);
  }
  function drawPlatform(x) {
    x.fillStyle = '#7f8c8d'; x.fillRect(0, 0, T, T);
    x.fillStyle = '#95a2a3'; for (let y = 0; y < T; y += 4) for (let i = (y / 4) % 2 ? 0 : 4; i < T; i += 8) x.fillRect(i, y, 7, 3);
    x.fillStyle = '#5f6b6c'; x.fillRect(0, 15, T, 1);
  }
  function drawSphere(x) {
    x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(3, 13, 10, 2);
    x.fillStyle = '#6b4a2f'; x.fillRect(6, 11, 4, 3); x.fillRect(4, 13, 8, 2);
    x.fillStyle = '#d9a441'; x.fillRect(4, 2, 8, 1); x.fillRect(4, 10, 8, 1); x.fillRect(3, 3, 1, 7); x.fillRect(12, 3, 1, 7);
    x.fillStyle = '#b8862a'; x.fillRect(3, 6, 10, 1); x.fillRect(7, 2, 1, 9);
    x.fillStyle = '#f2d78a'; x.fillRect(7, 5, 2, 2);
  }

  const SOLID = new Set(['#', '^', '"', 'T', '~', 'f', 's', 'b', 'd', 'r', 'p', 'G', 'j', 'l', 'o', 'x']);
  HS.SOLID = SOLID;

  /* 맵 전체를 하나의 캔버스에 미리 그려 두기 */
  HS.renderMap = function (g, theme) {
    const h = g.length, w = g[0].length;
    const [c, x] = mk(w * T, h * T);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = g[j][i], r = rng(i * 7919 + j * 104729 + ch.charCodeAt(0));
      x.save(); x.translate(i * T, j * T);
      const baseCh = ch === 'w' ? 'w' : ch === 'k' ? 'k' : ch === ',' ? ',' : '.';
      if (ch === '=') drawRoad(x, r);
      else if (ch === '#') drawWall(x, theme);
      else if (ch === '^') drawGiwa(x);
      else if (ch === '"') drawThatch(x, r);
      else if (ch === '~') drawWater(x, r);
      else if (ch === 'b') drawShelf(x, r);
      else if (ch === 'o') drawPlatform(x);
      else if (ch === 'G') drawGate(x);
      else {
        drawGround(x, theme, r, theme === 'hall' ? 'w' : theme === 'palace' ? 'k' : baseCh);
        if (ch === 'T') drawTree(x, theme);
        else if (ch === 'f') drawFence(x);
        else if (ch === 's') drawStall(x, r);
        else if (ch === 'd') drawDesk(x);
        else if (ch === 'r') drawRock(x);
        else if (ch === 'p') drawPillar(x);
        else if (ch === 'j') drawJar(x);
        else if (ch === 'l') drawLantern(x);
        else if (ch === 'x') drawSphere(x);
      }
      x.restore();
    }
    return c;
  };

  /* ---------- 사람 캐릭터 (16x16) ---------- */
  const SKIN = '#f1c9a0', SKIN2 = '#d9a87c', INK = '#221c18', HAIR = '#1e1a1a';
  function hat(x, L, dir) {
    const t = L.hat;
    if (t === 'gat') { x.fillStyle = '#1b1b1f'; x.fillRect(5, 0, 6, 3); x.fillStyle = 'rgba(27,27,31,.85)'; x.fillRect(1, 3, 14, 1); x.fillStyle = '#3b3b44'; x.fillRect(6, 0, 2, 1); }
    else if (t === 'jeonlip') { x.fillStyle = '#26262c'; x.fillRect(5, 0, 6, 3); x.fillRect(2, 3, 12, 1); x.fillStyle = L.plume || '#c23a2a'; x.fillRect(dir === 'left' ? 4 : 10, 0, 2, 2); x.fillRect(dir === 'left' ? 3 : 11, 0, 1, 1); }
    else if (t === 'straw') { x.fillStyle = L.hatColor || '#c9a24f'; x.fillRect(5, 1, 6, 2); x.fillRect(2, 3, 12, 1); x.fillStyle = '#8a6a2e'; x.fillRect(5, 2, 6, 1); }
    else if (t === 'bokgeon') { x.fillStyle = L.hatColor || '#2b3a55'; x.fillRect(4, 1, 8, 3); x.fillRect(dir === 'left' ? 11 : 3, 3, 2, 4); }
    else if (t === 'band') { x.fillStyle = HAIR; x.fillRect(4, 2, 8, 2); x.fillStyle = L.hatColor || '#efe6d2'; x.fillRect(4, 3, 8, 1); x.fillRect(5, 1, 6, 1); }
    else if (t === 'samo') { x.fillStyle = '#16161a'; x.fillRect(5, 0, 6, 4); x.fillRect(2, 2, 3, 1); x.fillRect(11, 2, 3, 1); }
    else if (t === 'ikseon') { x.fillStyle = '#16161a'; x.fillRect(4, 0, 8, 4); x.fillStyle = '#d9a441'; x.fillRect(4, 3, 8, 1); x.fillStyle = '#16161a'; x.fillRect(3, 1, 1, 2); x.fillRect(12, 1, 1, 2); }
    else if (t === 'daenggi') { x.fillStyle = HAIR; x.fillRect(4, 2, 8, 2); x.fillStyle = L.ribbon || '#c23a2a'; if (dir !== 'up') x.fillRect(dir === 'left' ? 11 : 3, 3, 2, 2); else x.fillRect(7, 9, 2, 3); }
  }
  function person(L, dir, frame) {
    const [c, x] = mk(T, T);
    // 그림자
    x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(4, 14, 8, 2);
    // 다리/신발
    const f = frame % 2;
    x.fillStyle = '#3a2e2a';
    if (dir === 'left' || dir === 'right') { x.fillRect(f ? 5 : 7, 13, 3, 2); x.fillRect(f ? 9 : 7, 13, 2, 2); }
    else { x.fillRect(5, f ? 12 : 13, 2, 2); x.fillRect(9, f ? 13 : 12, 2, 2); }
    // 몸(도포)
    const side = dir === 'left' || dir === 'right';
    x.fillStyle = L.robe2; side ? x.fillRect(5, 8, 7, 5) : x.fillRect(4, 8, 8, 5);
    x.fillStyle = L.robe; side ? x.fillRect(5, 8, 6, 4) : x.fillRect(5, 8, 6, 4);
    if (!side && dir !== 'up') { x.fillStyle = '#f5efe2'; x.fillRect(7, 8, 2, 2); x.fillStyle = L.patch || '#b8412c'; x.fillRect(7, 10, 1, 2); }
    if (L.patch && dir === 'down') { x.fillStyle = L.patch; x.fillRect(6, 9, 4, 3); }
    // 팔
    x.fillStyle = L.robe2;
    if (!side) { x.fillRect(3, 9, 1, 3); x.fillRect(12, 9, 1, 3); x.fillStyle = SKIN; x.fillRect(3, 12, 1, 1); x.fillRect(12, 12, 1, 1); }
    else { x.fillRect(dir === 'right' ? 7 : 8, 9, 2, 3); x.fillStyle = SKIN; x.fillRect(dir === 'right' ? 8 : 8, 12, 1, 1); }
    // 머리
    x.fillStyle = INK; x.fillRect(4, 3, 8, 6);
    x.fillStyle = SKIN; x.fillRect(5, 4, 6, 4);
    if (dir === 'up') { x.fillStyle = HAIR; x.fillRect(5, 3, 6, 5); }
    else if (side) {
      x.fillStyle = HAIR; x.fillRect(dir === 'right' ? 4 : 8, 3, 4, 3);
      x.fillStyle = INK; x.fillRect(dir === 'right' ? 9 : 6, 5, 1, 1);
      x.fillStyle = '#e8998a'; x.fillRect(dir === 'right' ? 9 : 6, 7, 1, 1);
    } else {
      x.fillStyle = HAIR; x.fillRect(5, 3, 6, 1);
      x.fillStyle = INK; x.fillRect(6, 5, 1, 1); x.fillRect(9, 5, 1, 1);
      x.fillStyle = '#e8998a'; x.fillRect(5, 6, 1, 1); x.fillRect(10, 6, 1, 1);
      if (L.beard) { x.fillStyle = '#e9e5dc'; x.fillRect(6, 7, 4, 2); }
    }
    x.fillStyle = SKIN2; if (!side && dir !== 'up') x.fillRect(5, 7, 6, 1);
    hat(x, L, dir);
    return c;
  }
  const cache = {};
  HS.sprite = function (lookKey, dir, frame) {
    const k = lookKey + dir + (frame % 2);
    if (!cache[k]) {
      const L = HS.LOOKS[lookKey] || HS.LOOKS.merchant;
      if (dir === 'left') { const base = person(L, 'right', frame); const [c, x] = mk(T, T); x.translate(T, 0); x.scale(-1, 1); x.drawImage(base, 0, 0); cache[k] = c; }
      else cache[k] = person(L, dir, frame);
    }
    return cache[k];
  };

  /* 먹돌이 (먹물 방울 정령) 12x12 → 16 */
  HS.mukdori = function (frame) {
    const k = 'muk' + (frame % 2);
    if (cache[k]) return cache[k];
    const [c, x] = mk(T, T);
    const by = frame % 2;
    x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(4, 14, 8, 2);
    x.fillStyle = '#221c18'; x.fillRect(7, 1 + by, 2, 2); x.fillRect(6, 3 + by, 4, 2); x.fillRect(4, 5 + by, 8, 7); x.fillRect(5, 12 + by, 6, 1);
    x.fillStyle = '#3d3530'; x.fillRect(5, 6 + by, 2, 2);
    x.fillStyle = '#fff'; x.fillRect(6, 8 + by, 2, 2); x.fillRect(9, 8 + by, 2, 2);
    x.fillStyle = '#221c18'; x.fillRect(7, 9 + by, 1, 1); x.fillRect(10, 9 + by, 1, 1);
    x.fillStyle = '#e8998a'; x.fillRect(5, 10 + by, 1, 1); x.fillRect(11, 10 + by, 1, 1);
    x.fillStyle = '#8a5a33'; x.fillRect(12, 6 + by, 1, 6); x.fillStyle = '#efe6d2'; x.fillRect(12, 4 + by, 1, 2);
    cache[k] = c; return c;
  };

  /* 묵귀 (보스) 48x40 */
  HS.boss = function (frame, hurt) {
    const k = 'boss' + (frame % 4) + (hurt ? 'h' : '');
    if (cache[k]) return cache[k];
    const W = 48, H = 40; const [c, x] = mk(W, H);
    const r = rng(77 + frame);
    const body = hurt ? '#5b1d1a' : '#1c1816', edge = hurt ? '#8f2a22' : '#3a322d';
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const dx = (i - 24) / 20, dy = (j - 18) / 15;
      const wob = Math.sin(i * 0.5 + frame) * 0.06;
      const d = dx * dx + dy * dy + wob;
      if (d < 1) { x.fillStyle = d > 0.78 ? edge : body; x.fillRect(i, j, 1, 1); }
    }
    // 먹물 방울 흘러내림
    x.fillStyle = body;
    [[10, 28], [17, 31], [25, 32], [33, 30], [39, 27]].forEach(([a, b], n) => { const len = 4 + ((n + frame) % 3) * 2; x.fillRect(a, b, 3, len); x.fillRect(a + 1, b + len, 1, 2); });
    // 눈
    x.fillStyle = '#f5efe2'; x.fillRect(14, 13, 7, 5); x.fillRect(28, 13, 7, 5);
    x.fillStyle = '#c23a2a'; x.fillRect(17, 14, 3, 3); x.fillRect(29, 14, 3, 3);
    x.fillStyle = '#1c1816'; x.fillRect(13, 11, 9, 2); x.fillRect(27, 11, 9, 2);
    // 입
    x.fillStyle = '#5b1d1a'; x.fillRect(19, 22, 11, 3); x.fillStyle = '#f5efe2'; x.fillRect(20, 22, 2, 2); x.fillRect(26, 22, 2, 2);
    // 붓 뿔
    x.fillStyle = '#8a5a33'; x.fillRect(10, 2, 2, 6); x.fillRect(36, 2, 2, 6);
    x.fillStyle = '#1c1816'; x.fillRect(9, 0, 4, 3); x.fillRect(35, 0, 4, 3);
    if (r() < 0) x.fillRect(0, 0, 1, 1);
    cache[k] = c; return c;
  };

  /* 단서 반짝이 */
  HS.sparkle = function (t) {
    const [c, x] = mk(T, T);
    const s = Math.floor(t / 180) % 3;
    x.fillStyle = '#ffe680'; x.fillRect(7, 3 - s, 2, 10 + s * 2); x.fillRect(3 - s, 7, 10 + s * 2, 2);
    x.fillStyle = '#fff8d6'; x.fillRect(6, 6, 4, 4);
    return c;
  };
  /* 쪽지 */
  HS.noteSprite = function () {
    if (cache.note) return cache.note;
    const [c, x] = mk(T, T);
    x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(3, 12, 11, 2);
    x.fillStyle = '#f2ead6'; x.fillRect(3, 4, 10, 8); x.fillStyle = '#d9cba8'; x.fillRect(3, 11, 10, 1);
    x.fillStyle = '#221c18'; x.fillRect(5, 6, 6, 1); x.fillRect(5, 8, 4, 1);
    x.fillStyle = '#b8412c'; x.fillRect(10, 8, 2, 2);
    cache.note = c; return c;
  };

  /* 대화창 얼굴 그림 */
  HS.portrait = function (lookKey, size) {
    const [c, x] = mk(size, size);
    const src = lookKey === 'mukdori' ? HS.mukdori(0) : HS.sprite(lookKey, 'down', 0);
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0, T, 12, 0, 0, size, size * 12 / T);
    return c;
  };
  HS.TILE = T;
})();
