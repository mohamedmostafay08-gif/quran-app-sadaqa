// البيانات الإضافية (معاني الكلمات، التفسير، صفحات المصحف، الجذور، التجويد):
// لا تُحمَّل مع أول فتح لتوفير الباقة، وتُخزَّن عند أول استخدام، أو كلها مرة واحدة من هنا.
const BASE = new URL('../../', import.meta.url).href;
let manifestP = null;
const manifest = () => (manifestP ||= fetch(BASE + 'public/data/extras.json').then((r) => r.json()));
const cacheName = (v) => 'extras-' + v;

/** { done, total, bytes } */
export async function extrasStatus() {
  const m = await manifest();
  if (!('caches' in self)) return { done: 0, total: m.files.length, bytes: m.bytes };
  const cache = await caches.open(cacheName(m.version));
  const keys = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  const done = m.files.filter((f) => keys.has(new URL(BASE + f).pathname)).length;
  return { done, total: m.files.length, bytes: m.bytes };
}

let running = null;
/** ينزّل كل البيانات الإضافية؛ onProgress(done, total) */
export function downloadExtras(onProgress) {
  if (running) return running;
  running = (async () => {
    const m = await manifest();
    const cache = await caches.open(cacheName(m.version));
    const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
    const todo = m.files.filter((f) => !have.has(new URL(BASE + f).pathname));
    let done = m.files.length - todo.length, i = 0, failed = 0;
    onProgress?.(done, m.files.length);
    const worker = async () => {
      while (i < todo.length) {
        const url = BASE + todo[i++];
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(res.status);
          await cache.put(url, res);
          done++;
        } catch { failed++; }
        onProgress?.(done, m.files.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (failed) throw new Error(`تعذر تنزيل ${failed} ملف`);
    return { done, total: m.files.length };
  })().finally(() => { running = null; });
  return running;
}
