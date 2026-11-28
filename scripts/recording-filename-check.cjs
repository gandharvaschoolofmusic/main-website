const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/recording-filename.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { recordingFilename: name, recordingExtension } = context.exports;
const lesson = { trackingCode: 'S0005-SE004', instrument: 'Keyboard', startsAt: '2026-11-18T23:30:00Z',
  enrollment: { course: { title: 'Electronic Keyboard Foundation' } } };
assert.equal(name(lesson, { part: 1 }), 'S0005-SE004_Electronic_Keyboard_Foundation_2026-11-19_Part-01.mp4');
assert.equal(name(lesson, { part: 2, extension: 'webm' }), 'S0005-SE004_Electronic_Keyboard_Foundation_2026-11-19_Part-02.webm');
assert.equal(name({ ...lesson, trackingCode: null, enrollment: null, trialRequest: { customId: 'TL00019' } }, { part: 1 }), 'TL00019_Keyboard_2026-11-19_Part-01.mp4');
assert.match(name({ ...lesson, trackingCode: null }), /^Session_Electronic/);
const dangerous = name({ ...lesson, trackingCode: '../S0005\r\n', enrollment: { course: { title: '../../Piano: "Foundation"' } } });
assert.ok(!/["/\\\r\n:]/.test(dangerous));
assert.match(name(lesson, { recordedAt: new Date('2026-11-19T01:02:03.004Z') }), /Recorded-20261119T010203004Z.mp4$/);
assert.equal(recordingExtension('old_random.webm?token=x'), 'webm');
assert.equal(recordingExtension('old_random.mp4'), 'mp4');
console.log('PASS session/course names, trial fallback, recording parts, safe filenames, IST date rollover, and video extensions');
