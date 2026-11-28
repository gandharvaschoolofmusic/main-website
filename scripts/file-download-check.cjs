const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const context = { exports: {}, URL, Request, Response, Headers, process, ...globals,
    require: name => { if (!(name in dependencies)) throw Error(`Unexpected import ${name}`); return dependencies[name]; } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, context);
  return context.exports;
}

async function main() {
  const helpers = load('src/lib/download.ts');
  const recordingNames = load('src/lib/recording-filename.ts');
  assert.equal(helpers.fileDownloadHref('/api/lessons/one/playback?part=two&resolve=1'), '/api/lessons/one/playback?part=two&download=1');
  const disposition = helpers.attachmentDisposition('../Lesson\r\n"音.mp4');
  assert.ok(disposition.startsWith('attachment;'));
  assert.ok(!disposition.includes('\r') && !disposition.includes('\n'));
  assert.ok(disposition.includes('filename*=UTF-8'));
  let session = { user: { id: 'student', role: 'STUDENT' } };
  let lesson = { studentId: 'student', teacherId: 'teacher', trackingCode: 'S0005-SE004', instrument: 'Keyboard', startsAt: '2026-11-18T15:30:00Z', enrollment: { course: { title: 'Electronic Keyboard Foundation' } }, recordingUrl: 'https://storage.example/file.mp4', recordings: [{ id: 'two', fileUrl: 'https://storage.example/part.mp4', fileName: 'Gandharva_Lesson_random.mp4', storageBackend: 'SUPABASE' }] };
  let downloads = 0, playback = 0;
  const route = load('src/app/api/lessons/[id]/playback/route.ts', {
    '@/lib/auth': { auth: async () => session },
    '@/lib/db': { db: { lesson: { findUnique: async () => lesson }, lessonRecording: { findFirst: async () => ({ id: 'db-part' }) } } },
    '@/lib/supabase-storage': { recordingPlaybackUrl: async () => { playback++; return 'https://storage.example/inline'; } },
    '@/lib/file-download': { storedFileDownload: async (_url, name) => { downloads++; return new Response(null, { status: 307, headers: { Location: 'https://storage.example/download', 'Content-Disposition': helpers.attachmentDisposition(name) } }); } },
    '@/lib/lesson-recording-media': { readLessonRecordingMedia: async () => new Response('video') },
    '@/lib/download': helpers,
    '@/lib/recording-filename': recordingNames,
  });
  const get = query => route.GET(new Request('https://school.example/api/lessons/one/playback' + query), { params: Promise.resolve({ id: 'one' }) });
  const oldDownload = await get('?part=two&download=1');
  assert.equal(oldDownload.status, 307);
  assert.ok(oldDownload.headers.get('content-disposition').includes('S0005-SE004_Electronic_Keyboard_Foundation_2026-11-18_Part-01.mp4'));
  assert.equal(downloads, 1); assert.equal(playback, 0);
  assert.equal((await get('?part=two&resolve=1')).status, 200); assert.equal(playback, 1);
  session = { user: { id: 'outsider', role: 'STUDENT' } };
  assert.equal((await get('?download=1')).status, 404); assert.equal(downloads, 1);
  session = null;
  assert.equal((await get('?download=1')).status, 401);
  session = { user: { id: 'teacher', role: 'TEACHER' } };
  lesson.recordings[0].storageBackend = 'DATABASE';
  const media = await get('?part=two&download=1');
  assert.equal(media.status, 200); assert.ok(media.headers.get('content-disposition').startsWith('attachment;'));
  assert.equal(await media.text(), 'video');
  lesson.recordings.push({ id: 'third', fileUrl: 'https://storage.example/next.webm', fileName: 'old-random.webm', storageBackend: 'DATABASE' });
  const second = await get('?part=third&download=1');
  assert.ok(second.headers.get('content-disposition').includes('Part-02.webm'));
  lesson.recordings = [];
  assert.equal((await get('?part=not-in-lesson&download=1')).status, 404);

  const scopes = [];
  const files = load('src/app/api/files/[kind]/[id]/download/route.ts', {
    '@/lib/auth': { auth: async () => session },
    '@/lib/db': { db: Object.fromEntries(['resource', 'certificate', 'directMessage'].map(kind => [kind, { findFirst: async args => { scopes.push({ kind, where: args.where }); return null; } }])) },
    '@/lib/file-download': { storedFileDownload: async () => { throw Error('Missing/unauthorized file was served'); } },
  });
  for (const kind of ['resource', 'certificate', 'message']) {
    assert.equal((await files.GET(new Request('https://school.example'), { params: Promise.resolve({ kind, id: 'file' }) })).status, 404);
  }
  assert.equal(scopes[0].where.OR[0].teacherId, 'teacher');
  assert.equal(scopes[0].where.OR[1].shares.some.studentId, 'teacher');
  assert.equal(scopes[1].where.studentId, 'teacher');
  assert.equal(scopes[2].where.conversation.OR[0].teacherId, 'teacher');

  let resolved = 0;
  const storage = load('src/lib/file-download.ts', {
    'node:fs': require('node:fs'), 'node:fs/promises': require('node:fs/promises'),
    'node:path': require('node:path'), 'node:stream': require('node:stream'),
    '@/lib/download': helpers,
    '@/lib/supabase-storage': { recordingPlaybackUrl: async (_url, options) => { resolved++; assert.equal(options.download, 'test.mp4'); return 'https://project.supabase.co/signed?download=test.mp4'; } },
  }, { process: { cwd: process.cwd, env: { SUPABASE_URL: 'https://project.supabase.co' } } });
  assert.equal((await storage.storedFileDownload('https://untrusted.example/private', 'test.mp4')).status, 422);
  assert.equal((await storage.storedFileDownload('/uploads/../../.env', 'test.mp4')).status, 422);
  assert.equal(resolved, 0);
  assert.equal((await storage.storedFileDownload('https://project.supabase.co/storage/v1/object/public/recordings/test.mp4', 'test.mp4')).status, 307);
  assert.equal(resolved, 1);
  console.log('PASS attachment headers, part ownership, auth, database media, material/message/certificate scoping, and storage URL/path restrictions');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
