const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, URL };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/recordings-navigation.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { resolveRecordingSelection: resolve, recordingsNavigationHref: href } = context.exports;
const courses = [{ id: 'course', students: [
  { id: 'student', enrollmentId: 'enrollment', lessons: [{ id: 'session' }] },
  { id: 'other', enrollmentId: 'another', lessons: [{ id: 'other-session' }] },
] }];
const origin = 'https://school.example';
const history = ['/admin/recordings?filter=all'];
for (const selection of [
  { course: 'course' },
  { course: 'course', student: 'student', enrollment: 'enrollment' },
  { course: 'course', student: 'student', enrollment: 'enrollment', session: 'session' },
]) history.push(href(origin + history.at(-1), selection));
function read(url) { return resolve(courses, new URL(url, origin).searchParams); }
assert.equal(read(history[3]).session.id, 'session', 'Refresh/deep link restores the selected session');
assert.equal(read(history[2]).student.id, 'student');
assert.equal(read(history[2]).session, null);
assert.equal(read(history[1]).course.id, 'course');
assert.equal(read(history[1]).student, null);
assert.equal(read(history[0]).course, null);
assert.equal(read(history[3]).session.id, 'session', 'Forward restores the session');
const backToStudent = href(origin + history[3], { course: 'course', student: 'student', enrollment: 'enrollment' });
assert.equal(new URL(backToStudent, origin).searchParams.has('session'), false);
assert.equal(new URL(backToStudent, origin).searchParams.get('filter'), 'all');
assert.equal(read('/admin/recordings?course=course&student=student&session=other-session').session, null);
assert.equal(read('/admin/recordings?course=course&student=missing&session=session').student, null);
assert.equal(read('/admin/recordings?course=missing&student=student').course, null);
assert.equal(read('/admin/recordings?course=course&student=student&enrollment=another').student, null);
assert.equal(href(origin + history[3], {}), '/admin/recordings?filter=all');
console.log('PASS refresh/deep-link restoration, stepwise Back/Forward states, parent resets and stale/cross-parent selection handling');
