// Run the real playlist validator, action and library with isolated auth/database boundaries.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const context = { exports: {}, URL, require: name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(compiled, context);
  return context.exports;
}

async function main() {
  const { normalizeYoutubePlaylist: normalize } = load('src/lib/youtube-playlist.ts');
  const id = 'PL0123456789abcdef';
  const canonical = `https://www.youtube.com/playlist?list=${id}`;
  assert.equal(normalize(`https://www.youtube.com/watch?v=abc&list=${id}&index=2`), canonical);
  assert.equal(normalize(`https://youtu.be/abc?list=${id}`), canonical);
  assert.equal(normalize('   '), null);
  for (const invalid of [
    'javascript:alert(1)', `https://youtube.com.evil.test/playlist?list=${id}`,
    `https://user@youtube.com/playlist?list=${id}`, 'https://youtube.com/watch?v=abc',
    `https://youtube.com/playlist?list=foo&list=${id}`, `http://youtube.com/playlist?list=${id}`,
  ]) assert.throws(() => normalize(invalid));

  let allowed = false;
  let saved = null;
  let writes = 0;
  const revalidated = [];
  const { saveEnrollmentPlaylist: save } = load('src/actions/youtube-playlists.ts', {
    '@prisma/client': { Role: { ADMIN: 'ADMIN' } },
    'next/cache': { revalidatePath: path => revalidated.push(path) },
    '@/lib/auth-helpers': { requireRole: async role => {
      assert.equal(role, 'ADMIN');
      if (!allowed) throw new Error('Unauthorized');
    } },
    '@/lib/db': { db: { enrollment: { updateMany: async ({ where, data }) => {
      assert.equal(where.status.not, 'CANCELLED');
      if (where.id !== 'enrollment-1' || saved !== where.youtubePlaylistUrl) return { count: 0 };
      saved = data.youtubePlaylistUrl;
      writes++;
      return { count: 1 };
    } } } },
    '@/lib/youtube-playlist': { normalizeYoutubePlaylist: normalize },
  });
  await assert.rejects(save({ enrollmentId: 'enrollment-1', url: canonical, expectedUrl: null }));
  assert.equal(writes, 0);
  allowed = true;
  assert.equal((await save({ enrollmentId: 'enrollment-1', url: 'https://evil.test', expectedUrl: null })).success, false);
  assert.equal(writes, 0);
  assert.equal((await save({ enrollmentId: 'enrollment-1', url: canonical, expectedUrl: null })).success, true);
  assert.equal(saved, canonical);
  assert.equal((await save({ enrollmentId: 'enrollment-1', url: '', expectedUrl: null })).success, false);
  assert.equal(saved, canonical, 'A stale editor must not overwrite the new playlist');
  assert.equal((await save({ enrollmentId: 'another-enrollment', url: '', expectedUrl: canonical })).success, false);
  assert.equal((await save({ enrollmentId: 'enrollment-1', url: '', expectedUrl: canonical })).success, true);
  assert.equal(saved, null);
  assert.deepEqual([...new Set(revalidated)].sort(), [
    '/admin/youtube', '/student/dashboard/youtube', '/teacher/dashboard/youtube',
  ]);

  const scopes = [];
  const jsx = (type, props) => ({ type, props });
  const { YoutubeCourseLibrary: library } = load('src/components/dashboard/YoutubeCourseLibrary.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@prisma/client': { Role: { STUDENT: 'STUDENT', TEACHER: 'TEACHER' } },
    '@/lib/auth-helpers': { requireRole: async role => ({ id: role === 'STUDENT' ? 'student-1' : 'teacher-1' }) },
    '@/lib/db': { db: { enrollment: { findMany: async args => { scopes.push(args.where); return []; } } } },
    '@/lib/youtube-playlist': { normalizeYoutubePlaylist: normalize },
  });
  await library({ role: 'STUDENT' });
  await library({ role: 'TEACHER' });
  assert.equal(scopes[0].studentId, 'student-1');
  assert.equal(scopes[1].teacherId, 'teacher-1');
  assert.ok(scopes.every(where => where.status.not === 'CANCELLED'));
  console.log('PASS playlist validation, admin-only updates, stale-edit protection, removal, and role-scoped libraries');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
