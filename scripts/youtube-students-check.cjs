const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies) {
  const ctx = { exports: {}, require: name => {
    if (!(name in dependencies)) throw Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, ctx);
  return ctx.exports;
}
async function main() {
  let total = 41;
  const queries = [], cache = [];
  const course = (id, url) => ({ id, status: 'ACTIVE', startedAt: new Date('2026-11-01'), youtubePlaylistUrl: url, course: { title: `Course ${id}`, instrument: 'Piano', level: 'Foundation' } });
  const { getAdminPlaylistStudents: read } = load('src/lib/admin-youtube.ts', {
    '@prisma/client': { Role: { STUDENT: 'STUDENT' } },
    'next/cache': { unstable_cache: (fn, keys, options) => { cache.push(options); return fn; } },
    '@/lib/db': { db: { user: { count: async () => total, findMany: async args => {
      queries.push(args);
      return [{ id: 'student', name: 'Student', customId: 'S0001', enrollments: [course('piano', null), course('guitar', 'https://www.youtube.com/playlist?list=PLother')] }];
    } } } },
  });
  let data = await read('Piano', 'missing', 2);
  assert.equal(data.page, 2); assert.equal(data.pages, 3); assert.equal(data.total, 41);
  assert.equal(data.students[0].courses.length, 2, 'All courses stay with their student, including ones that did not match the filter');
  assert.equal(queries[0].take, 20); assert.equal(queries[0].skip, 20);
  assert.equal(queries[0].where.role, 'STUDENT');
  assert.equal(queries[0].where.enrollments.some.youtubePlaylistUrl, null);
  assert.equal(queries[0].select.enrollments.where.youtubePlaylistUrl, undefined);
  assert.equal(queries[0].select.enrollments.where.status.not, 'CANCELLED');
  assert.equal(queries[0].where.OR[2].enrollments.some.course.title.contains, 'Piano');
  assert.equal(data.students[0].courses[0].id, 'piano');
  assert.equal(data.students[0].courses[1].id, 'guitar');
  assert.equal(cache[0].revalidate, 30); assert.ok(cache[0].tags.includes('youtube-playlists'));
  total = 0;
  data = await read('', 'all', 100);
  assert.equal(data.page, 1); assert.equal(data.pages, 1);
  assert.equal(queries.at(-1).skip, 0, 'Out-of-range pages clamp to a valid student page');
  let allowed = false, reads = 0;
  const jsx = (type, props) => ({ type, props });
  const { default: page } = load('src/app/admin/youtube/page.tsx', {
    '@prisma/client': { Role: { ADMIN: 'ADMIN' } },
    '@/lib/auth-helpers': { requireRole: async role => { assert.equal(role, 'ADMIN'); if (!allowed) throw Error('Unauthorized'); } },
    '@/lib/admin-youtube': { getAdminPlaylistStudents: async (q, filter, page) => { reads++; assert.equal(q.length, 100); assert.equal(filter, 'all'); assert.equal(page, 1); return { students: [], total: 0, page: 1, pages: 1 }; } },
    './AdminYoutubeManager': { AdminYoutubeManager: () => null },
    'react/jsx-runtime': { jsx, jsxs: jsx },
  });
  const params = { searchParams: Promise.resolve({ q: 'x'.repeat(200), filter: 'invalid', page: '-2' }) };
  await assert.rejects(page(params)); assert.equal(reads, 0, 'Authentication runs before cached student data is read');
  allowed = true; await page(params); assert.equal(reads, 1);
  console.log('PASS student-based paging, complete multi-course groups, filter/search semantics, stable enrollment IDs, cache invalidation tag, page bounds and admin authorization');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
