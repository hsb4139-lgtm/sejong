/* Vercel 배포 때 자동 실행돼요.
   Vercel 환경변수(SUPABASE_URL, SUPABASE_ANON_KEY)를 읽어 dist/js/config.js 를 만들고,
   사이트 파일을 dist 폴더로 복사해요. 내 컴퓨터에서는 실행할 필요 없어요. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');

// Vercel Supabase 연동(Integration)이 자동으로 넣는 이름도 함께 받아요.
const pick = (...names) => { for (const n of names) if (process.env[n]) return process.env[n].trim(); return ''; };
const url = pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL').replace(/\/(rest|auth|realtime)\/.*$/, '').replace(/\/+$/, '');
const key = pick('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

// 비밀 키를 실수로 넣으면 배포를 멈춰요 (학생 화면에 노출되면 안 돼요)
function isSecret(k) {
  if (/^sb_secret_/.test(k)) return true;
  if (/^eyJ/.test(k)) { try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64').toString()).role === 'service_role'; } catch (e) {} }
  return false;
}
if (key && isSecret(key)) {
  console.error('❌ SUPABASE_ANON_KEY 에 비밀 키(service_role / secret)를 넣었어요. 공개용 anon(publishable) 키로 바꿔 주세요.');
  process.exit(1);
}
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.warn('⚠️ SUPABASE_URL 모양이 조금 달라요: ' + url + '  (예: https://abcdefgh.supabase.co — 끝에 /rest/v1 같은 건 빼 주세요)');
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'teacher.html', 'css', 'js']) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}

const config = `/* 배포할 때 Vercel 환경변수로 자동 생성된 파일이에요. */
window.HS = window.HS || {};
window.HS.CONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)}
};
`;
fs.writeFileSync(path.join(out, 'js', 'config.js'), config);

if (url && key) {
  console.log('✅ Supabase 연결 설정 완료: ' + url);
} else {
  console.warn('⚠️ Supabase 환경변수가 비어 있어요. 사이트는 로컬 테스트 모드로 열려요.');
  console.warn('   Vercel → Settings → Environment Variables 에 SUPABASE_URL, SUPABASE_ANON_KEY 를 넣고 Redeploy 해 주세요.');
  if (!url) console.warn('   - SUPABASE_URL 없음');
  if (!key) console.warn('   - SUPABASE_ANON_KEY 없음');
}
