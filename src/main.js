// نقطة البداية: تجهيز البيانات، الإعدادات، الراوتر، والـ Service Worker
import { initData } from './data.js';
import { loadSettings } from './state.js';
import { route, start } from './router.js';
import { loadReciters } from './audio/player.js';
import { mountPlayerBar } from './audio/playerBar.js';
import { initAutoDownload } from './offline/autoDownload.js';
import { renderHome } from './views/home.js';
import { renderReader } from './views/reader.js';
import { renderSearch } from './views/search.js';
import { renderBookmarks } from './views/bookmarks.js';
import { renderSettings } from './views/settings.js';
import { renderDownloads } from './views/downloads.js';
import { renderAbout } from './views/about.js';
import { h } from './lib/dom.js';
import { toast } from './ui.js';

const TAB_FOR = { '/': 'home', '/surah': 'home', '/search': 'search', '/bookmarks': 'bookmarks', '/downloads': 'downloads', '/settings': 'settings', '/about': 'settings' };

async function boot() {
  const status = document.querySelector('.boot p');
  try {
    await loadSettings();
    await Promise.all([initData((msg) => { if (status) status.textContent = msg; }), loadReciters()]);
  } catch (e) {
    console.error(e);
    document.getElementById('main').replaceChildren(h('div.boot',
      h('p', 'تعذر تحميل المصحف. تأكد من الاتصال بالإنترنت لأول مرة ثم أعد المحاولة.'),
      h('button.btn', { type: 'button', onclick: () => location.reload() }, 'إعادة المحاولة'),
    ));
    return;
  }

  route('/', renderHome);
  route('/surah/:surah/:ayah?', renderReader);
  route('/search', renderSearch);
  route('/bookmarks', renderBookmarks);
  route('/downloads', renderDownloads);
  route('/settings', renderSettings);
  route('/about', renderAbout);

  mountPlayerBar();
  initAutoDownload();

  start((m) => {
    const base = '/' + (m.path.split('/')[1] || '');
    const tab = TAB_FOR[base] || 'home';
    for (const a of document.querySelectorAll('.tabbar a')) {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    document.body.dataset.route = base.slice(1) || 'home';
  });
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('يوجد تحديث جديد — أعد فتح التطبيق لتطبيقه', 5000);
      });
    });
  }).catch((e) => console.warn('SW registration failed', e));
}

addEventListener('online', () => toast('عاد الاتصال بالإنترنت'));
addEventListener('offline', () => toast('أنت الآن بدون إنترنت — النص متاح بالكامل'));

boot();
registerSW();
