/* 한글 수호대 — 게임 데이터 (역할, 한글 조합, 맵, 퀴즈, 단서) */
(function () {
  const HS = (window.HS = window.HS || {});

  HS.DEFAULT_GOAL = '한글을 사랑하는 뽀로로반!';

  /* ---------- 역할 ---------- */
  HS.ROLES = {
    leader: { key: 'leader', name: '길잡이 대장', icon: '🚩', color: '#b8412c',
      desc: '모둠을 이끌어요. 지도를 볼 수 있고, 임무를 다 마치면 문지기에게 가서 문을 열어요.' },
    quiz: { key: 'quiz', name: '퀴즈 박사', icon: '📖', color: '#2e6f9e',
      desc: '머리 위에 느낌표(!)가 뜬 사람에게 말을 걸어 퀴즈를 풀어요. 헷갈리면 친구들과 상의해요.' },
    detective: { key: 'detective', name: '단서 탐정', icon: '🔍', color: '#7a5aa6',
      desc: '나에게만 보이는 반짝이를 찾아 단서를 주워요. 단서 내용을 친구들에게 꼭 말로 알려 줘요.' },
    builder: { key: 'builder', name: '글자 조립왕', icon: '🖌️', color: '#2e7d6b',
      desc: '조립대에서 글자를 만들어요. 탐정이 알려 주는 단서를 잘 들어요.' },
    keeper: { key: 'keeper', name: '힌트 지킴이', icon: '📜', color: '#b8862a',
      desc: '힌트 두루마리를 지켜요. 모둠이 막히면 두루마리를 펼쳐 모두에게 힌트를 보여 줘요.' }
  };
  HS.ROLE_ORDER = ['leader', 'quiz', 'detective', 'builder', 'keeper'];

  /* ids: 들어온 순서(또는 모둠이 바꾼 순서)대로 정렬된 학생 id 목록 */
  HS.assignRoles = function (ids) {
    const n = ids.length, res = {};
    ids.forEach((id) => (res[id] = []));
    if (!n) return res;
    ['leader', 'quiz', 'detective', 'builder'].forEach((r, i) => res[ids[i % n]].push(r));
    if (n >= 5) res[ids[4]].push('keeper');
    else res[ids[0]].push('keeper');
    for (let i = 5; i < n; i++) res[ids[i]].push('detective');
    return res;
  };

  /* ---------- 한글 조합 ---------- */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('');
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'.split('');
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  HS.CHO = CHO; HS.JUNG = JUNG; HS.JONG = JONG;
  HS.JONG_PALETTE = ['', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㄲ', 'ㅆ'];

  HS.isSyllable = (ch) => { const c = ch.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3; };
  HS.decompose = function (ch) {
    const c = ch.charCodeAt(0) - 0xac00;
    return { cho: CHO[Math.floor(c / 588)], jung: JUNG[Math.floor((c % 588) / 28)], jong: JONG[c % 28] };
  };
  HS.compose = function (cho, jung, jong) {
    const a = CHO.indexOf(cho), b = JUNG.indexOf(jung), c = JONG.indexOf(jong || '');
    if (a < 0 || b < 0 || c < 0) return '';
    return String.fromCharCode(0xac00 + (a * 21 + b) * 28 + c);
  };
  /* 목표 문장 → 한글 음절 목록 (공백·문장부호 제외) */
  HS.syllables = function (goal) {
    const out = [];
    Array.from(goal).forEach((ch, pos) => { if (HS.isSyllable(ch)) out.push({ ch, pos }); });
    return out;
  };
  /* 음절 n개를 모둠 수만큼 앞에서부터 고르게 나누기 */
  HS.distribute = function (n, teamCount) {
    const res = [], base = Math.floor(n / teamCount), extra = n % teamCount;
    let k = 0;
    for (let t = 0; t < teamCount; t++) {
      const size = base + (t < extra ? 1 : 0), arr = [];
      for (let i = 0; i < size; i++) arr.push(k++);
      res.push(arr);
    }
    return res;
  };

  /* ---------- 맵 만들기 도구 ---------- */
  function grid(w, h, ch) { return Array.from({ length: h }, () => Array(w).fill(ch)); }
  function rect(g, x, y, w, h, ch) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = ch; }
  function border(g, ch) { const h = g.length, w = g[0].length; rect(g, 0, 0, w, 1, ch); rect(g, 0, h - 1, w, 1, ch); rect(g, 0, 0, 1, h, ch); rect(g, w - 1, 0, 1, h, ch); }
  function house(g, x, y, w, roof, wallRows) { rect(g, x, y, w, 1, roof); rect(g, x, y + 1, w, wallRows || 2, '#'); }
  function put(g, list, ch) { list.forEach(([x, y]) => (g[y][x] = ch)); }

  /* 맵 1 — 한양 저잣거리 (낮, 흙길) */
  function map1() {
    const g = grid(26, 18, '.');
    border(g, 'T');
    rect(g, 1, 8, 24, 2, '=');
    house(g, 2, 2, 5, '"'); house(g, 9, 2, 5, '"'); house(g, 16, 2, 5, '^');
    house(g, 2, 13, 5, '^'); house(g, 10, 13, 6, '"'); house(g, 18, 13, 5, '"');
    put(g, [[4, 6], [5, 6], [11, 6], [12, 6], [19, 6], [6, 11], [7, 11], [15, 11], [16, 11], [21, 11]], 's');
    put(g, [[22, 3], [23, 3], [22, 4], [8, 16], [9, 16]], 'j');
    put(g, [[1, 4], [24, 12], [1, 11], [17, 16], [24, 5]], 'T');
    put(g, [[3, 5], [14, 4], [21, 7], [8, 12], [20, 10], [13, 16], [23, 15]], ',');
    g[8][25] = 'G'; g[9][25] = 'G';
    g[11][13] = 'd'; // 조립대
    return g;
  }
  /* 맵 2 — 마을 서당 (풀밭, 마루) */
  function map2() {
    const g = grid(26, 18, ',');
    border(g, 'T');
    house(g, 6, 2, 14, '^');
    rect(g, 6, 5, 14, 2, 'w');
    put(g, [[8, 5], [11, 5], [15, 5], [18, 5]], 'd');
    rect(g, 2, 11, 4, 4, '~');
    rect(g, 1, 15, 24, 1, '=');
    rect(g, 12, 7, 2, 8, '=');
    put(g, [[3, 9], [21, 13], [22, 13], [23, 13], [21, 14]], 'f');
    put(g, [[3, 3], [4, 3], [22, 7], [9, 10], [17, 12]], 'T');
    put(g, [[7, 13], [19, 9]], 'r');
    put(g, [[23, 3], [24, 3]], 'j');
    g[9][25] = 'G'; g[10][25] = 'G';
    rect(g, 14, 9, 11, 1, '=');
    g[12][8] = 'd'; // 조립대 (벼루)
    return g;
  }
  /* 맵 3 — 별 보는 천문대 (밤) */
  function map3() {
    const g = grid(26, 18, 'n');
    border(g, 'T');
    rect(g, 11, 4, 4, 3, 'o');
    rect(g, 1, 8, 24, 1, '=');
    rect(g, 12, 7, 2, 1, '=');
    rect(g, 12, 9, 2, 5, '=');
    rect(g, 12, 13, 13, 1, '=');
    put(g, [[7, 4], [19, 11]], 'x');
    put(g, [[10, 7], [15, 7], [4, 11], [21, 6]], 'l');
    rect(g, 17, 14, 4, 2, '~');
    put(g, [[3, 5], [8, 13], [21, 3], [5, 15], [16, 10]], 'T');
    put(g, [[9, 10], [23, 10]], 'r');
    g[13][25] = 'G'; g[12][25] = 'G';
    g[12][6] = 'x'; // 조립대 (혼천의)
    return g;
  }
  /* 맵 4 — 궁궐 집현전 (실내, 서가) */
  function map4() {
    const g = grid(26, 18, 'w');
    border(g, '#');
    rect(g, 0, 0, 26, 1, '^');
    rect(g, 3, 3, 6, 1, 'b'); rect(g, 11, 3, 5, 1, 'b'); rect(g, 18, 3, 5, 1, 'b');
    rect(g, 3, 6, 6, 1, 'b'); rect(g, 18, 6, 5, 1, 'b');
    rect(g, 3, 12, 5, 1, 'b'); rect(g, 18, 12, 5, 1, 'b');
    put(g, [[10, 7], [15, 7], [10, 11], [15, 11]], 'p');
    put(g, [[5, 9], [20, 9], [12, 14], [13, 14]], 'd');
    put(g, [[1, 1], [24, 1]], 'l');
    g[9][25] = 'G'; g[10][25] = 'G';
    return g;
  }
  /* 맵 5 — 궁궐 앞마당 (보스, 반 전체 공용) */
  function map5() {
    const g = grid(26, 18, 'k');
    border(g, '#');
    rect(g, 0, 0, 26, 1, '^');
    rect(g, 5, 1, 16, 1, '^');
    rect(g, 5, 2, 16, 1, '#');
    put(g, [[6, 3], [10, 3], [15, 3], [19, 3]], 'p');
    rect(g, 12, 3, 2, 14, '=');
    for (let y = 9; y <= 14; y += 2) { g[y][9] = 'r'; g[y][16] = 'r'; }
    put(g, [[2, 3], [23, 3], [2, 14], [23, 14]], 'l');
    return g;
  }

  /* ---------- 캐릭터 모습 ---------- */
  HS.LOOKS = {
    merchant: { hat: 'band', robe: '#8b6b4a', robe2: '#6e5238', hatColor: '#efe6d2' },
    merchant2: { hat: 'straw', robe: '#5f7f5a', robe2: '#4a6546', hatColor: '#c9a24f' },
    teacher: { hat: 'gat', robe: '#e8e2d2', robe2: '#c9c0aa', beard: true },
    pupil: { hat: 'bokgeon', robe: '#6d8fb3', robe2: '#557394', hatColor: '#2b3a55' },
    astro: { hat: 'samo', robe: '#3f6f8f', robe2: '#2f5670' },
    astro2: { hat: 'samo', robe: '#6b4f8f', robe2: '#523b70' },
    scholar: { hat: 'gat', robe: '#4f7f73', robe2: '#3c6358' },
    scholar2: { hat: 'gat', robe: '#8a5a44', robe2: '#6e4535' },
    guard: { hat: 'jeonlip', robe: '#3b3f4a', robe2: '#2b2e36', plume: '#c23a2a' },
    king: { hat: 'ikseon', robe: '#b8342a', robe2: '#8f2a22', patch: '#e3b341' },
    leader: { hat: 'jeonlip', robe: '#b8412c', robe2: '#8f3222', plume: '#e3b341' },
    quiz: { hat: 'gat', robe: '#2e6f9e', robe2: '#245a80' },
    detective: { hat: 'straw', robe: '#7a5aa6', robe2: '#614885', hatColor: '#d6b46a' },
    builder: { hat: 'bokgeon', robe: '#2e7d6b', robe2: '#246455', hatColor: '#1f3b36' },
    keeper: { hat: 'daenggi', robe: '#d9a441', robe2: '#b8862a', ribbon: '#c23a2a' }
  };

  /* ---------- 퀴즈 (3지선다, 쉬운 난이도) ---------- */
  const Q = {
    m1a: [
      { id: 'm1q1', q: 'ㄱ은 무엇의 모양을 본떠 만들었을까요?', opts: ['혀뿌리가 목구멍을 막는 모양', '새가 날개를 편 모양', '집 지붕 모양'], a: 0,
        hint: 'ㄱ을 소리 내 보세요. 혀 안쪽이 목 쪽으로 올라가요.', exp: '자음의 기본 글자는 소리 낼 때 발음 기관의 모양을 본떴어요.' },
      { id: 'm1q2', q: '입술 모양을 본떠 만든 자음은 무엇일까요?', opts: ['ㅇ', 'ㅁ', 'ㅅ'], a: 1,
        hint: '입을 다물었다 떼면서 "음-마" 하고 소리 내 보세요.', exp: 'ㅁ은 네모난 입술 모양을 본떴어요.' }
    ],
    m1b: [
      { id: 'm1q3', q: '목구멍의 둥근 모양을 본뜬 자음은 무엇일까요?', opts: ['ㅇ', 'ㄴ', 'ㄱ'], a: 0,
        hint: '동그란 모양의 자음을 찾아보세요.', exp: 'ㅇ은 목구멍의 둥근 모양을 본떴어요.' },
      { id: 'm1q4', q: '뾰족한 이(치아)의 모양을 본뜬 자음은 무엇일까요?', opts: ['ㅁ', 'ㄴ', 'ㅅ'], a: 2,
        hint: '이처럼 뾰족하게 생긴 자음은?', exp: 'ㅅ은 뾰족한 이의 모양을 본떴어요.' }
    ],
    m2a: [
      { id: 'm2q1', q: 'ㄱ에 획을 하나 더하면 어떤 글자가 될까요?', opts: ['ㄲ', 'ㅋ', 'ㄴ'], a: 1,
        hint: 'ㄱ 가운데에 가로 획을 하나 그어 보세요.', exp: '소리가 더 세지면 획을 더했어요. ㄱ → ㅋ' },
      { id: 'm2q2', q: 'ㄴ → ㄷ → ? 획을 하나 더 더하면?', opts: ['ㅌ', 'ㄹ', 'ㅁ'], a: 0,
        hint: 'ㄷ 가운데에 가로 획을 하나 더해요.', exp: 'ㄴ에 획을 더해 ㄷ, 또 더해 ㅌ이 되었어요.' }
    ],
    m2b: [
      { id: 'm2q3', q: 'ㅁ에 획을 더해 만든 글자가 아닌 것은?', opts: ['ㅂ', 'ㅍ', 'ㅅ'], a: 2,
        hint: 'ㅅ은 어떤 기본 글자였는지 떠올려 보세요.', exp: 'ㅁ → ㅂ → ㅍ. ㅅ은 이 모양을 본뜬 기본 글자예요.' },
      { id: 'm2q4', q: 'ㅇ에 획을 더해 만든 글자는?', opts: ['ㅈ', 'ㅎ', 'ㅊ'], a: 1,
        hint: 'ㅇ 위에 모자처럼 획이 올라간 글자예요.', exp: 'ㅇ → ㆆ → ㅎ 처럼 획을 더했어요.' }
    ],
    m3a: [
      { id: 'm3q1', q: '모음의 기본 세 글자(·, ㅡ, ㅣ)가 본뜬 것은?', opts: ['하늘·땅·사람', '해·달·별', '산·물·나무'], a: 0,
        hint: '천지인(天地人)이라는 말을 떠올려 보세요.', exp: '·는 둥근 하늘, ㅡ는 평평한 땅, ㅣ는 서 있는 사람을 본떴어요.' },
      { id: 'm3q2', q: '평평한 땅을 본뜬 모음은 무엇일까요?', opts: ['ㅣ', 'ㅡ', '·'], a: 1,
        hint: '땅은 옆으로 쭉 평평하지요.', exp: 'ㅡ는 평평한 땅의 모양이에요.' }
    ],
    m3b: [
      { id: 'm3q3', q: 'ㅣ의 오른쪽에 점(·)을 찍으면 어떤 모음이 될까요?', opts: ['ㅓ', 'ㅗ', 'ㅏ'], a: 2,
        hint: '사람(ㅣ) 오른쪽에 하늘(·)이 붙어요.', exp: 'ㅣ + · = ㅏ. 기본 모음을 합쳐 새 모음을 만들었어요.' },
      { id: 'm3q4', q: 'ㅡ 위에 점(·)을 찍으면 어떤 모음이 될까요?', opts: ['ㅗ', 'ㅜ', 'ㅏ'], a: 0,
        hint: '땅(ㅡ) 위로 하늘(·)이 올라가요.', exp: '· + ㅡ = ㅗ. 점이 아래로 가면 ㅜ가 돼요.' }
    ],
    m4a: [
      { id: 'm4q1', q: '훈민정음(한글)을 만든 임금은 누구일까요?', opts: ['태조', '세종대왕', '정조'], a: 1,
        hint: '만 원짜리 지폐에 계신 분이에요.', exp: '세종대왕이 1443년에 훈민정음을 만들었어요.' },
      { id: 'm4q2', q: '세종대왕이 한글을 만든 까닭으로 알맞은 것은?', opts: ['백성이 글을 쉽게 읽고 쓰게 하려고', '신하들만 몰래 쓰게 하려고', '다른 나라에 선물하려고'], a: 0,
        hint: '어려운 한자를 모르는 백성들을 떠올려 보세요.', exp: '글을 모르는 백성을 가엾게 여겨, 누구나 쉽게 배우도록 만들었어요.' }
    ],
    m4b: [
      { id: 'm4q3', q: '훈민정음을 세상에 널리 알린(반포한) 해는?', opts: ['1392년', '1446년', '1592년'], a: 1,
        hint: '한글날(10월 9일)은 이 해를 기념해요.', exp: '1446년에 훈민정음을 반포했어요.' },
      { id: 'm4q4', q: '"훈민정음"의 뜻으로 알맞은 것은?', opts: ['백성을 가르치는 바른 소리', '나라의 큰 책', '임금의 말씀'], a: 0,
        hint: '훈(가르칠 훈) 민(백성 민) 정(바를 정) 음(소리 음)', exp: '훈민정음은 "백성을 가르치는 바른 소리"라는 뜻이에요.' }
    ]
  };

  /* 보스전 문제 (짧고 쉬운 문제) */
  HS.BOSS_QUESTIONS = [
    { q: '한글날은 몇 월 며칠일까요?', opts: ['10월 9일', '3월 1일', '8월 15일'], a: 0 },
    { q: '받침이 있는 글자는?', opts: ['나', '강', '소'], a: 1 },
    { q: '"ㅎ + ㅏ + ㄴ"을 합치면?', opts: ['한', '할', '핫'], a: 0 },
    { q: '"ㄱ + ㅡ + ㄹ"을 합치면?', opts: ['근', '글', '길'], a: 1 },
    { q: '하늘을 본뜬 모음은?', opts: ['ㅡ', 'ㅣ', '·'], a: 2 },
    { q: 'ㄴ에 획을 더한 글자는?', opts: ['ㄷ', 'ㅁ', 'ㅇ'], a: 0 },
    { q: '서 있는 사람을 본뜬 모음은?', opts: ['ㅣ', 'ㅡ', 'ㅏ'], a: 0 },
    { q: '한글을 만든 임금은?', opts: ['세종대왕', '광개토대왕', '태조 왕건'], a: 0 },
    { q: '"사랑"은 몇 글자일까요?', opts: ['1글자', '2글자', '3글자'], a: 1 },
    { q: '자음이 아닌 것은?', opts: ['ㅂ', 'ㅏ', 'ㅈ'], a: 1 },
    { q: '모음이 아닌 것은?', opts: ['ㅗ', 'ㅜ', 'ㅋ'], a: 2 },
    { q: 'ㅅ에 획을 더한 글자는?', opts: ['ㅈ', 'ㅂ', 'ㄹ'], a: 0 },
    { q: '"뽀"의 첫소리(초성)는?', opts: ['ㅂ', 'ㅃ', 'ㅍ'], a: 1 },
    { q: '"반"의 받침은?', opts: ['ㄴ', 'ㅂ', 'ㅏ'], a: 0 },
    { q: '입술 모양을 본뜬 자음은?', opts: ['ㅁ', 'ㄱ', 'ㅅ'], a: 0 },
    { q: '"ㄹ + ㅗ"를 합치면?', opts: ['루', '로', '라'], a: 1 },
    { q: '훈민정음을 반포한 해는?', opts: ['1446년', '1945년', '2000년'], a: 0 },
    { q: '"한글"의 "글"에 들어 있는 모음은?', opts: ['ㅡ', 'ㅏ', 'ㅣ'], a: 0 }
  ];

  /* ---------- 조립대 과제 ---------- */
  const CRAFT = {
    1: { title: '입 모양 짝짓기', intro: '설명에 맞는 자음을 골라 간판 글자를 되살려요.', items: [
      { big: '혀뿌리가 목구멍을 막는 모양', opts: ['ㄱ', 'ㅅ', 'ㅇ'], a: 0 },
      { big: '혀끝이 윗잇몸에 닿는 모양', opts: ['ㅁ', 'ㄴ', 'ㄱ'], a: 1 },
      { big: '다문 입술 모양', opts: ['ㅁ', 'ㅇ', 'ㄴ'], a: 0 },
      { big: '뾰족한 이 모양', opts: ['ㄴ', 'ㄱ', 'ㅅ'], a: 2 },
      { big: '둥근 목구멍 모양', opts: ['ㅇ', 'ㅁ', 'ㅅ'], a: 0 }
    ] },
    2: { title: '획 더하기', intro: '벼루에 먹을 갈아 획을 하나씩 더해 봐요.', items: [
      { big: 'ㄱ + 획', opts: ['ㅋ', 'ㄲ', 'ㄷ'], a: 0 },
      { big: 'ㄴ + 획', opts: ['ㄹ', 'ㄷ', 'ㅁ'], a: 1 },
      { big: 'ㄷ + 획', opts: ['ㅌ', 'ㅂ', 'ㄹ'], a: 0 },
      { big: 'ㅁ + 획', opts: ['ㅍ', 'ㅇ', 'ㅂ'], a: 2 },
      { big: 'ㅅ + 획', opts: ['ㅈ', 'ㅊ', 'ㅆ'], a: 0 }
    ] },
    3: { title: '모음 만들기', intro: '하늘(·), 땅(ㅡ), 사람(ㅣ)을 합쳐 모음을 만들어요.', items: [
      { big: 'ㅣ  +  ·(오른쪽)', opts: ['ㅓ', 'ㅏ', 'ㅗ'], a: 1 },
      { big: '·(왼쪽)  +  ㅣ', opts: ['ㅓ', 'ㅏ', 'ㅜ'], a: 0 },
      { big: '·(위)  +  ㅡ', opts: ['ㅜ', 'ㅗ', 'ㅏ'], a: 1 },
      { big: 'ㅡ  +  ·(아래)', opts: ['ㅗ', 'ㅓ', 'ㅜ'], a: 2 }
    ] }
  };
  HS.CRAFT = CRAFT;

  /* ---------- 맵 정의 ---------- */
  HS.MAPS = {
    1: {
      id: 1, name: '한양 저잣거리', theme: 'market', build: map1, spawn: [2, 8],
      intro: ['여기는 조선의 한양 저잣거리야!', '묵귀가 가게 간판 글자를 먹물로 지워 버렸어. 자음이 어떻게 만들어졌는지 알아내서 글자를 되찾자!'],
      npcs: [
        { id: 'n1', name: '떡집 상인', look: 'merchant', x: 8, y: 6, kind: 'quiz', quizzes: Q.m1a,
          talk: ['어이쿠, 우리 가게 간판 글자가 먹물에 지워졌지 뭐요.', '내 문제를 맞히면 글자 조각을 돌려주겠소!'] },
        { id: 'n2', name: '엿장수', look: 'merchant2', x: 17, y: 10, kind: 'quiz', quizzes: Q.m1b,
          talk: ['엿 사려~ 엿!', '글자를 찾는다고? 그럼 내 문제부터 풀어 보시게.'] },
        { id: 'g1', name: '문지기', look: 'guard', x: 24, y: 7, kind: 'gate' }
      ],
      station: { x: 13, y: 11, name: '간판 조립대' },
      clues: [
        { id: 'm1c1', x: 3, y: 11, text: 'ㄴ은 혀끝이 윗잇몸에 닿는 모양을 본떴대.', piece: 'ㄴ' },
        { id: 'm1c2', x: 14, y: 5, text: 'ㅁ은 입술 모양, ㅇ은 목구멍 모양이래.', piece: 'ㅁ' },
        { id: 'm1c3', x: 22, y: 12, text: 'ㅅ은 뾰족한 이의 모양을 본떴대.', piece: 'ㅅ' }
      ],
      quizPieces: { n1: 'ㄱ', n2: 'ㅇ' },
      hints: ['퀴즈 박사는 떡집 상인과 엿장수를 찾아가요.', '단서 탐정의 쪽지에 퀴즈 정답의 실마리가 있어요.', '자음 기본 글자는 소리 낼 때 입, 혀, 이, 목구멍의 모양을 본떴어요.']
    },
    2: {
      id: 2, name: '마을 서당', theme: 'seodang', build: map2, spawn: [2, 15],
      intro: ['서당에 왔어! 훈장님이 아이들에게 글을 가르치고 계셔.', '기본 자음에 획을 더하면 새로운 자음이 된대. 한번 알아보자!'],
      npcs: [
        { id: 'n1', name: '훈장님', look: 'teacher', x: 13, y: 6, kind: 'quiz', quizzes: Q.m2a,
          talk: ['에헴! 공부하러 왔느냐?', '획 하나에 소리가 달라지는 이치를 알아보자꾸나.'] },
        { id: 'n2', name: '서당 학동', look: 'pupil', x: 19, y: 10, kind: 'quiz', quizzes: Q.m2b,
          talk: ['훈장님 몰래 퀴즈 하나 낼게!', '나도 어제 배운 거야. 맞혀 볼래?'] },
        { id: 'g2', name: '문지기', look: 'guard', x: 24, y: 8, kind: 'gate' }
      ],
      station: { x: 8, y: 12, name: '벼루 조립대' },
      clues: [
        { id: 'm2c1', x: 3, y: 6, text: '소리가 세지면 획을 하나 더 그었대. ㄱ → ㅋ', piece: 'ㅋ' },
        { id: 'm2c2', x: 21, y: 4, text: 'ㄴ → ㄷ → ㅌ, ㅁ → ㅂ → ㅍ 차례로 획이 늘어나.', piece: 'ㅂ' },
        { id: 'm2c3', x: 16, y: 14, text: 'ㅇ 위에 획을 올리면 ㅎ이 된대. ㄹ과 ㅃ도 여기서 찾았어!', piece: 'ㅎ' }
      ],
      quizPieces: { n1: 'ㄹ', n2: 'ㅃ' },
      hints: ['훈장님은 서당 마루 위에 계세요.', '획을 더한다는 건 선을 하나 더 긋는다는 뜻이에요.', 'ㄱ→ㅋ, ㄴ→ㄷ→ㅌ, ㅁ→ㅂ→ㅍ, ㅅ→ㅈ→ㅊ, ㅇ→ㅎ']
    },
    3: {
      id: 3, name: '별 보는 천문대', theme: 'night', build: map3, spawn: [2, 8],
      intro: ['밤하늘을 살피는 천문대야. 별이 참 많다!', '모음은 하늘, 땅, 사람을 본떠 만들었대. 모음 조각을 찾아보자!'],
      npcs: [
        { id: 'n1', name: '천문 관리', look: 'astro', x: 10, y: 9, kind: 'quiz', quizzes: Q.m3a,
          talk: ['쉿, 별을 보는 중이오.', '하늘과 땅과 사람의 이치를 안다면 이 문제를 풀 수 있을 게요.'] },
        { id: 'n2', name: '별지기', look: 'astro2', x: 18, y: 4, kind: 'quiz', quizzes: Q.m3b,
          talk: ['점 하나로 소리가 바뀐다니, 신기하지 않소?', '내 문제를 풀어 보시오.'] },
        { id: 'g3', name: '문지기', look: 'guard', x: 24, y: 14, kind: 'gate' }
      ],
      station: { x: 6, y: 12, name: '혼천의 조립대' },
      clues: [
        { id: 'm3c1', x: 3, y: 3, text: '·는 둥근 하늘, ㅡ는 평평한 땅, ㅣ는 서 있는 사람!', piece: 'ㅡ' },
        { id: 'm3c2', x: 20, y: 9, text: 'ㅣ 오른쪽에 점이 붙으면 ㅏ, 왼쪽이면 ㅓ.', piece: 'ㅏ' },
        { id: 'm3c3', x: 13, y: 15, text: 'ㅡ 위에 점이 있으면 ㅗ, 아래에 있으면 ㅜ.', piece: 'ㅗ' }
      ],
      quizPieces: { n1: 'ㅣ', n2: 'ㅜ' },
      hints: ['천문 관리는 길가에, 별지기는 천문대 오른쪽 위에 있어요.', '모음의 기본은 ·(하늘), ㅡ(땅), ㅣ(사람) 세 가지예요.', '점이 붙는 방향을 잘 보면 모음을 만들 수 있어요.']
    },
    4: {
      id: 4, name: '궁궐 집현전', theme: 'hall', build: map4, spawn: [2, 9],
      intro: ['드디어 집현전! 학자들이 한글을 연구하던 곳이야.', '묵귀가 우리 모둠 글자를 쪽지에 나눠 숨겼어. 탐정이 쪽지를 찾고, 조립왕이 글자를 완성하자!'],
      npcs: [
        { id: 'n1', name: '집현전 학자', look: 'scholar', x: 9, y: 9, kind: 'quiz', quizzes: Q.m4a,
          talk: ['어서 오시오, 한글 수호대.', '전하께서 이 글자를 왜 만드셨는지 아시오?'] },
        { id: 'n2', name: '젊은 학자', look: 'scholar2', x: 17, y: 9, kind: 'quiz', quizzes: Q.m4b,
          talk: ['밤새 글자를 연구했더니 졸리오…', '그래도 문제는 낼 수 있소!'] },
        { id: 'g4', name: '문지기', look: 'guard', x: 24, y: 8, kind: 'gate' }
      ],
      station: { x: 12, y: 14, name: '글자 조립대', syllable: true },
      letterSpots: [[4, 4], [21, 4], [4, 14], [21, 14], [13, 5], [8, 8]],
      hints: ['단서 탐정은 서가 사이의 쪽지를 모두 찾아요.', '쪽지에는 "몇 번째 글자는 ㅇ + ㅇ + ㅇ" 처럼 적혀 있어요.', '조립왕은 첫소리(초성), 가운뎃소리(중성), 받침 순서로 골라요.']
    },
    5: {
      id: 5, name: '궁궐 앞마당', theme: 'palace', build: map5, spawn: [13, 14],
      intro: ['궁궐 앞마당이야. 모든 모둠이 여기로 모여!', '반 친구들 모두가 글자를 되찾으면 묵귀와 싸울 수 있어.'],
      npcs: [], clues: [], hints: []
    }
  };

  /* 맵에서 해야 할 일 목록 (모둠 체크리스트) */
  HS.mapTasks = function (mapId, team) {
    const m = HS.MAPS[mapId], d = (team && team.done) || {};
    if (!m || mapId === 5) return [];
    const tasks = [];
    m.npcs.filter((n) => n.kind === 'quiz').forEach((n) =>
      tasks.push({ key: `m${mapId}_${n.id}`, role: 'quiz', label: `${n.name} 퀴즈`, ok: !!d[`m${mapId}_${n.id}`] }));
    if (mapId === 4) {
      const targets = (team && team.targets) || [];
      targets.forEach((idx, k) => tasks.push({ key: `m4_c${k}`, role: 'detective', label: `쪽지 ${k + 1}`, ok: !!d[`m4_c${k}`] }));
      const letters = (team && team.letters) || {};
      targets.forEach((idx, k) => tasks.push({ key: `L${idx}`, role: 'builder', label: `글자 ${k + 1}`, ok: !!letters[idx] }));
    } else {
      m.clues.forEach((c, k) => tasks.push({ key: c.id, role: 'detective', label: `단서 ${k + 1}`, ok: !!d[c.id] }));
      tasks.push({ key: `m${mapId}_b`, role: 'builder', label: m.station.name, ok: !!d[`m${mapId}_b`] });
    }
    return tasks;
  };
})();
