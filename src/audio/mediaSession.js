// أزرار قفل الشاشة وسماعات البلوتوث (Media Session API)
import { getSurahMeta } from '../data.js';

let rec = null, owner = null;
const ICON = new URL('../../public/icons/icon-512.png', import.meta.url).href;

/** يعيد أزرار شاشة القفل للمشغّل بعد أن يستعيرها الأذان */
export function restoreMediaSession() {
  if (!owner) return;
  setupMediaSession(owner);
  updateMediaSession(owner.state());
}

export function setupMediaSession(player) {
  if (!('mediaSession' in navigator)) return;
  owner = player;
  const ms = navigator.mediaSession;
  const safe = (action, fn) => { try { ms.setActionHandler(action, fn); } catch { /* غير مدعوم */ } };
  safe('play', () => player.resume());
  safe('pause', () => player.pause());
  safe('stop', () => player.stop());
  safe('nexttrack', () => player.next());
  safe('previoustrack', () => player.prev());
  safe('seekbackward', () => { player.audio.currentTime = Math.max(0, player.audio.currentTime - 5); });
  safe('seekforward', () => { player.audio.currentTime += 5; });
  import('./player.js').then((m) => { rec = m; });
}

export function updateMediaSession(st) {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  if (st.radio) {
    if (typeof MediaMetadata !== 'undefined' && ms.metadata?.title !== st.radio.name) {
      ms.metadata = new MediaMetadata({ title: st.radio.name, artist: st.radio.ondemand ? (st.radio.sub || '') : 'بث مباشر', album: st.radio.ondemand ? 'رتّل' : 'رتّل — الإذاعة', artwork: [{ src: ICON, sizes: '512x512', type: 'image/png' }] });
    }
    ms.playbackState = st.status === 'playing' ? 'playing' : 'paused';
    return;
  }
  if (!st.surah) { ms.metadata = null; ms.playbackState = 'none'; return; }
  const m = getSurahMeta(st.surah);
  const reciter = rec?.getReciter(st.compare ? st.compare.list[st.compare.idx] : st.reciter);
  const title = st.ayah == null ? `سورة ${m.nameAr}` : st.ayah === 0 ? `سورة ${m.nameAr} – البسملة` : `سورة ${m.nameAr} – الآية ${st.ayah}`;
  if (typeof MediaMetadata !== 'undefined' && (!ms.metadata || ms.metadata.title !== title)) {
    ms.metadata = new MediaMetadata({
      title,
      artist: reciter ? reciter.nameAr : '',
      album: 'رتّل — القرآن الكريم',
      artwork: [{ src: ICON, sizes: '512x512', type: 'image/png' }],
    });
  }
  ms.playbackState = st.status === 'playing' ? 'playing' : 'paused';
}
