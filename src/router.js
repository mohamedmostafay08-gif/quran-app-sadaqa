// hash router بسيط: #/surah/2/255 ، #/search?q=...
const routes = [];
let current = null;   // { cleanup }
let onChange = null;

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:(\w+)(\?)?/g, (_, k, opt) => { keys.push(k); return opt ? '(?:/([^/]+))?' : '/([^/]+)'; }) + '/?$');
  routes.push({ re, keys, handler });
}

export function parse(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { if (m[i + 1] !== undefined) params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params, query, path };
    }
  }
  return null;
}

export function navigate(to, { replace = false } = {}) {
  const hash = to.startsWith('#') ? to : '#' + to;
  if (replace) { history.replaceState(null, '', hash); resolve(); }
  else if (location.hash === hash) resolve();
  else location.hash = hash;
}

let seq = 0;
async function resolve() {
  const my = ++seq;
  const match = parse() || parse('#/');
  if (current?.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  current = null;
  onChange?.(match);
  const result = await match.route.handler(match.params, match.query, () => my !== seq);
  if (my !== seq) { result?.cleanup?.(); return; }
  current = result || null;
}

export function start(cb) {
  onChange = cb;
  addEventListener('hashchange', resolve);
  resolve();
}
