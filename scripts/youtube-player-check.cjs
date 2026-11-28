// Test player lifecycle with fake YouTube/DOM boundaries, without external requests.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

async function harness({ delayed = false, failure = false } = {}) {
  const state = [], refs = [], intervals = new Map(), timeouts = new Map();
  let effect, options, created = 0, destroyed = 0, played = -1, resolveApi;
  let stateCursor = 0, refCursor = 0;
  const container = { replaceChildren() {} };
  const player = {
    getPlaylist: () => ['video-one', 'video-two', 'video-one'],
    getPlaylistIndex: () => played < 0 ? 0 : played,
    playVideoAt: index => { played = index; },
    getIframe: () => ({ setAttribute() {} }),
    destroy: () => { destroyed++; },
  };
  const api = { Player: function (_mount, supplied) { created++; options = supplied; return player; } };
  const context = {
    exports: {}, Error, window: { location: { origin: 'https://school.example' } },
    document: { createElement: () => ({}) },
    setInterval: fn => { const id = Symbol(); intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: fn => { const id = Symbol(); timeouts.set(id, fn); return id; },
    clearTimeout: id => timeouts.delete(id),
    require: name => ({
      react: {
        useRef: () => { const index = refCursor++; return refs[index] || (refs[index] = { current: index === 0 ? container : null }); },
        useState: initial => { const index = stateCursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
        useEffect: fn => { effect = fn; },
      },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      '@/lib/youtube-player': {
        loadYoutubeApi: () => failure ? Promise.reject(new Error('offline')) : delayed ? new Promise(resolve => { resolveApi = resolve; }) : Promise.resolve(api),
        youtubePlaybackError: () => 'Embedding disabled',
      },
    })[name],
  };
  vm.runInNewContext(compile('src/components/dashboard/YoutubePlaylistPlayer.tsx'), context);
  const render = () => { stateCursor = 0; refCursor = 0; return context.exports.YoutubePlaylistPlayer({ playlistId: 'PL0123456789', title: 'Course' }); };
  render();
  const cleanup = effect();
  await Promise.resolve(); await Promise.resolve();
  return { render, cleanup, state, intervals, timeouts, player, options: () => options,
    created: () => created, destroyed: () => destroyed, played: () => played,
    resolve: () => resolveApi(api) };
}

async function main() {
  const h = await harness();
  assert.equal(h.options().playerVars.list, 'PL0123456789');
  assert.equal(h.options().playerVars.autoplay, undefined, 'Do not autoplay on course expansion');
  h.options().events.onReady({ target: h.player });
  assert.equal(h.state[0].length, 3, 'Preserve duplicate playlist entries and ordering');
  assert.equal(h.intervals.size, 0, 'Stop polling once playlist loaded');
  assert.equal(h.timeouts.size, 0);
  const tree = h.render();
  const list = tree.props.children.find(child => child?.type === 'ol');
  list.props.children[2].props.children.props.onClick();
  assert.equal(h.played(), 2, 'Lecture selection plays its exact playlist index');
  h.options().events.onError({ target: h.player, data: 150 });
  assert.equal(h.state[3], 'Embedding disabled');
  h.cleanup();
  assert.equal(h.destroyed(), 1, 'Closing/switching courses destroys playback');
  const late = await harness({ delayed: true });
  late.cleanup(); late.resolve(); await Promise.resolve();
  assert.equal(late.created(), 0, 'Unmounted course must not create a delayed player');
  const empty = await harness();
  empty.player.getPlaylist = () => [];
  empty.options().events.onReady({ target: empty.player });
  assert.equal(empty.intervals.size, 1);
  for (const timeout of empty.timeouts.values()) timeout();
  assert.equal(empty.intervals.size, 0, 'Empty or inaccessible playlists must not poll indefinitely');
  assert.match(empty.state[2], /could not load/);
  empty.cleanup();
  const offline = await harness({ failure: true });
  assert.equal(offline.state[3], 'offline');
  assert.equal(offline.timeouts.size, 0);
  offline.cleanup();
  console.log('PASS playlist order, inline lecture selection, bounded polling, errors and course-switch cleanup');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
