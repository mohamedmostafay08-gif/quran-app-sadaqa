// تنزيل تلقائي للسورة التالية أثناء الاستماع (مع احترام "الواي فاي فقط")
import * as settings from '../state.js';
import { player } from '../audio/player.js';
import { enqueue, isQueued } from './downloader.js';
import { downloadsFor } from './storage.js';

function connectionOk() {
  if (!navigator.onLine) return false;
  if (!settings.get('wifiOnly')) return true;
  const c = navigator.connection;
  if (!c) return true; // لا يمكن المعرفة (Safari) — نسمح
  if (c.saveData) return false;
  if (c.type) return c.type === 'wifi' || c.type === 'ethernet';
  return true;
}

let lastKey = null;
export function initAutoDownload() {
  player.subscribe(async (st) => {
    if (!settings.get('autoDownloadNext') || st.status !== 'playing' || !st.surah) return;
    const key = `${st.reciter}:${st.surah}`;
    if (key === lastKey) return;
    lastKey = key;
    if (!connectionOk()) return;
    const done = await downloadsFor(st.reciter);
    const targets = [st.surah, st.surah + 1].filter((s) => s <= 114 && done.get(s)?.status !== 'done' && !isQueued(st.reciter, s));
    if (targets.length) enqueue(st.reciter, targets);
  });
}
