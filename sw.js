/* Service Worker — القرآن الكريم
 * - Precache لواجهة التطبيق وبيانات المصحف (app-*)
 * - الصوت: كاش أولًا من audio-v1 مع دعم Range requests (مهم لـ iOS Safari)
 * يُحدَّث VERSION و ASSETS تلقائيًا بواسطة scripts/stamp-sw.js
 */
const VERSION = '2387e134bc';
const APP_CACHE = 'app-' + VERSION;
const AUDIO_CACHE = 'audio-v1';
const TIMING_CACHE = 'timing-v1';
// البيانات الإضافية (الكلمات، التفسير، الصفحات، الترجمات…) تُخزَّن عند أول استخدام في كاش مستقل
const EXTRAS_VERSION = '70a41247c2';
const EXTRAS_CACHE = 'extras-' + EXTRAS_VERSION;
const isExtra = (path) => /\/public\/data\/(words|tafsir|tafsir-saadi|mushaf|trans|library)\//.test(path) || /\/public\/data\/(roots|tajweed|tajweed-qpc)\.json$/.test(path);
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/audio/mediaSession.js',
  'src/audio/player.js',
  'src/audio/playerBar.js',
  'src/audio/sleepTimer.js',
  'src/data.js',
  'src/db.js',
  'src/features/activity.js',
  'src/features/adhan.js',
  'src/features/adhkarLog.js',
  'src/features/appBadge.js',
  'src/features/backup.js',
  'src/features/badges.js',
  'src/features/bookmarks.js',
  'src/features/extra.js',
  'src/features/focus.js',
  'src/features/globalSearch.js',
  'src/features/group.js',
  'src/features/imageCard.js',
  'src/features/immersive.js',
  'src/features/install.js',
  'src/features/khatma.js',
  'src/features/native.js',
  'src/features/notes.js',
  'src/features/prayer.js',
  'src/features/prayerLog.js',
  'src/features/progressCharts.js',
  'src/features/push.js',
  'src/features/shareAudio.js',
  'src/features/shareCard.js',
  'src/features/srs.js',
  'src/features/stats.js',
  'src/features/story.js',
  'src/features/sync.js',
  'src/features/weekly.js',
  'src/features/whatsNew.js',
  'src/lib/arabic.js',
  'src/lib/dom.js',
  'src/main.js',
  'src/offline/autoDownload.js',
  'src/offline/downloader.js',
  'src/offline/extras.js',
  'src/offline/storage.js',
  'src/router.js',
  'src/state.js',
  'src/styles/base.css',
  'src/styles/classic.css',
  'src/styles/components.css',
  'src/styles/desktop.css',
  'src/styles/features.css',
  'src/styles/modern.css',
  'src/styles/themes.css',
  'src/ui.js',
  'src/views/about.js',
  'src/views/bookmarks.js',
  'src/views/calendar.js',
  'src/views/car.js',
  'src/views/downloads.js',
  'src/views/duas.js',
  'src/views/elder.js',
  'src/views/fasting.js',
  'src/views/greetings.js',
  'src/views/group.js',
  'src/views/help.js',
  'src/views/hifz.js',
  'src/views/home.js',
  'src/views/khatma.js',
  'src/views/kids.js',
  'src/views/lessons.js',
  'src/views/library.js',
  'src/views/listen.js',
  'src/views/memorize.js',
  'src/views/miracles.js',
  'src/views/mushaf.js',
  'src/views/nawawi.js',
  'src/views/notifyCard.js',
  'src/views/prayer.js',
  'src/views/prophets.js',
  'src/views/qada.js',
  'src/views/quiz.js',
  'src/views/radio.js',
  'src/views/ramadan.js',
  'src/views/reader.js',
  'src/views/search.js',
  'src/views/settings.js',
  'src/views/sleep.js',
  'src/views/stats.js',
  'src/views/tajweed.js',
  'src/views/tasbih.js',
  'src/views/today.js',
  'src/views/wallpaper.js',
  'src/views/welcome.js',
  'src/views/zakat.js',
  'public/data/adhkar.json',
  'public/data/asbab.json',
  'public/data/daily-ayahs.json',
  'public/data/extra-notice.json',
  'public/data/lessons.json',
  'public/data/quran-meta.json',
  'public/data/quran-simple.json',
  'public/data/quran-uthmani.json',
  'public/data/radios.json',
  'public/data/reciters.json',
  'public/data/selections.json',
  'public/data/shaarawy.json',
  'public/data/surahs.json',
  'public/data/whats-new.json',
  'public/fonts/amiri-quran.woff2',
  'public/fonts/plex-arabic-400.woff2',
  'public/fonts/plex-arabic-500.woff2',
  'public/fonts/plex-arabic-600.woff2',
  'public/fonts/plex-arabic-700.woff2',
  'public/fonts/plex-latin-400.woff2',
  'public/fonts/plex-latin-600.woff2',
  'public/fonts/uthmanic-hafs.woff2',
  'public/icons/badge-96.png',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/maskable-512.png',
  'public/img/miracles/dawud-iron.svg',
  'public/img/miracles/ibrahim-birds.svg',
  'public/img/miracles/ibrahim-fire.svg',
  'public/img/miracles/isa-birds.svg',
  'public/img/miracles/isa-table.svg',
  'public/img/miracles/muhammad-moon.svg',
  'public/img/miracles/musa-sea.svg',
  'public/img/miracles/musa-springs.svg',
  'public/img/miracles/musa-staff.svg',
  'public/img/miracles/noah-ark.svg',
  'public/img/miracles/salih-camel.svg',
  'public/img/miracles/sulayman-ants.svg',
  'public/img/miracles/sulayman-wind.svg',
  'public/img/miracles/yunus-whale.svg',
  'public/lib/adhan.esm.js',
  'public/lib/boot-theme.js',
  'public/data/extras.json',
];

// بصمة كل ملف (يملؤها stamp-sw.js)
const HASHES = {
  'index.html': '9a7f4152acb0',
  'manifest.webmanifest': '27a0f985d0e6',
  'src/audio/mediaSession.js': 'f1513cd68f40',
  'src/audio/player.js': '55a7203e9466',
  'src/audio/playerBar.js': 'f7ebe1bd2bc6',
  'src/audio/sleepTimer.js': '90fcf68aa6b5',
  'src/data.js': 'a7b5318c359e',
  'src/db.js': '16fe43098aa5',
  'src/features/activity.js': '8e563f5c2b7b',
  'src/features/adhan.js': '5a9fb0a777f9',
  'src/features/adhkarLog.js': '8f20ac38a7c6',
  'src/features/appBadge.js': '002142665800',
  'src/features/backup.js': 'c724a193a273',
  'src/features/badges.js': 'ec2434ffb060',
  'src/features/bookmarks.js': '2767e39c331b',
  'src/features/extra.js': '695dbfa4c93c',
  'src/features/focus.js': '323db1e9b585',
  'src/features/globalSearch.js': '475c7dac9267',
  'src/features/group.js': 'a90415eb6211',
  'src/features/imageCard.js': '83ca53432225',
  'src/features/immersive.js': 'ae65fa1b199f',
  'src/features/install.js': '230a60003539',
  'src/features/khatma.js': 'c060e8d822d0',
  'src/features/native.js': '14819900398c',
  'src/features/notes.js': 'd3ccbec4d8f2',
  'src/features/prayer.js': 'a15d2a6bf359',
  'src/features/prayerLog.js': 'edbf2eca0125',
  'src/features/progressCharts.js': '54adecb86133',
  'src/features/push.js': '346597d42faf',
  'src/features/shareAudio.js': '80b7e2189c68',
  'src/features/shareCard.js': 'cfec99a457ea',
  'src/features/srs.js': 'ee66c677c98e',
  'src/features/stats.js': 'edb52610f21f',
  'src/features/story.js': 'd102d76e42b1',
  'src/features/sync.js': '3dff26474b4f',
  'src/features/weekly.js': '41719a7ad274',
  'src/features/whatsNew.js': '9fd34bd06cc4',
  'src/lib/arabic.js': 'd267b2704314',
  'src/lib/dom.js': '4c3bfb175b38',
  'src/main.js': '17c49baed384',
  'src/offline/autoDownload.js': 'd6ef7206644e',
  'src/offline/downloader.js': 'c28423c1cb18',
  'src/offline/extras.js': 'd589a0716900',
  'src/offline/storage.js': '8bc123b06cb7',
  'src/router.js': 'ead1cba011d9',
  'src/state.js': '990021ebd503',
  'src/styles/base.css': 'b75afe71b90a',
  'src/styles/classic.css': '6a0aa81dbc24',
  'src/styles/components.css': '018ad94a009d',
  'src/styles/desktop.css': '3af1ce9de67a',
  'src/styles/features.css': '8cdea6bd1193',
  'src/styles/modern.css': 'd467efa02de0',
  'src/styles/themes.css': '60b63673d983',
  'src/ui.js': '8bc2cd16fa60',
  'src/views/about.js': '86e0ef77f8f7',
  'src/views/bookmarks.js': '9b4629bc105d',
  'src/views/calendar.js': '16587710d22d',
  'src/views/car.js': '685946a6c0d0',
  'src/views/downloads.js': '7638d5def9d3',
  'src/views/duas.js': '61877a14505b',
  'src/views/elder.js': '3ff4305ade7e',
  'src/views/fasting.js': '7ce6be9a1117',
  'src/views/greetings.js': 'ac2783444be8',
  'src/views/group.js': 'aca60e8ab7df',
  'src/views/help.js': 'a7842b14b008',
  'src/views/hifz.js': '8ad417e78763',
  'src/views/home.js': '02950c8a4220',
  'src/views/khatma.js': 'ff8d33008d12',
  'src/views/kids.js': '54318c1650fc',
  'src/views/lessons.js': '785784deb138',
  'src/views/library.js': 'afb9e1b11fc5',
  'src/views/listen.js': 'f61c694f3d99',
  'src/views/memorize.js': '9af230554a1a',
  'src/views/miracles.js': '453726161f1f',
  'src/views/mushaf.js': '7f697b8e84d0',
  'src/views/nawawi.js': '7d04424076db',
  'src/views/notifyCard.js': '8c977b92b2e5',
  'src/views/prayer.js': 'f08a7c3efaad',
  'src/views/prophets.js': 'ee784061bc39',
  'src/views/qada.js': '652fd8767eb0',
  'src/views/quiz.js': 'a49311c7b275',
  'src/views/radio.js': '3031137a5aae',
  'src/views/ramadan.js': 'bfc1d73a78d2',
  'src/views/reader.js': '53b0bb07c217',
  'src/views/search.js': 'fddad38f5daa',
  'src/views/settings.js': '25365410769f',
  'src/views/sleep.js': '1b8eed9aedee',
  'src/views/stats.js': '45ff1ed1d1a6',
  'src/views/tajweed.js': 'dab2daaebacb',
  'src/views/tasbih.js': '3dccb3bf14e0',
  'src/views/today.js': 'bbd30d89de9d',
  'src/views/wallpaper.js': 'a178eac6b736',
  'src/views/welcome.js': 'a9540562b54c',
  'src/views/zakat.js': '547a57e2ce82',
  'public/data/adhkar.json': '5c3256d080dd',
  'public/data/asbab.json': '0dfc6cd3c61e',
  'public/data/daily-ayahs.json': 'e8b6b7581489',
  'public/data/extra-notice.json': '5fe788558370',
  'public/data/lessons.json': '25366cf161e8',
  'public/data/quran-meta.json': 'bf2dfcb9451f',
  'public/data/quran-simple.json': 'e7fd4267b921',
  'public/data/quran-uthmani.json': '383e2cb53d6b',
  'public/data/radios.json': '7d10e08b677f',
  'public/data/reciters.json': 'c55c642263e2',
  'public/data/selections.json': '7ea140a7d8cd',
  'public/data/shaarawy.json': '355e9fc2e289',
  'public/data/surahs.json': '1ea1c8f42fbd',
  'public/data/whats-new.json': 'b25b1e756495',
  'public/fonts/amiri-quran.woff2': '35f4f02bbde8',
  'public/fonts/plex-arabic-400.woff2': '6010e7fd0dce',
  'public/fonts/plex-arabic-500.woff2': '90aef64fea97',
  'public/fonts/plex-arabic-600.woff2': '16734a5adb27',
  'public/fonts/plex-arabic-700.woff2': '04c730b42927',
  'public/fonts/plex-latin-400.woff2': '9ed8dcb02e6c',
  'public/fonts/plex-latin-600.woff2': '63f4757271e4',
  'public/fonts/uthmanic-hafs.woff2': '8c00e7a7d5f7',
  'public/icons/badge-96.png': 'adac2bc1f297',
  'public/icons/icon-192.png': 'acc6964103a7',
  'public/icons/icon-512.png': '762cc969ad33',
  'public/icons/maskable-512.png': 'ac28b2124181',
  'public/img/miracles/dawud-iron.svg': 'fe9dd899e4a3',
  'public/img/miracles/ibrahim-birds.svg': 'af22f2e1e9f5',
  'public/img/miracles/ibrahim-fire.svg': '85d840307c67',
  'public/img/miracles/isa-birds.svg': '97ca7ccba83d',
  'public/img/miracles/isa-table.svg': '56fc5a75480a',
  'public/img/miracles/muhammad-moon.svg': '1ba965e990f9',
  'public/img/miracles/musa-sea.svg': '5781de0c6ccb',
  'public/img/miracles/musa-springs.svg': '945b1106a722',
  'public/img/miracles/musa-staff.svg': 'd6a1c4e256fb',
  'public/img/miracles/noah-ark.svg': '107d52719cd6',
  'public/img/miracles/salih-camel.svg': 'db22d6d9f360',
  'public/img/miracles/sulayman-ants.svg': '83258011d87f',
  'public/img/miracles/sulayman-wind.svg': '51a8f7dce425',
  'public/img/miracles/yunus-whale.svg': '7dc4417a060a',
  'public/lib/adhan.esm.js': '951ca9423c16',
  'public/lib/boot-theme.js': '42c1148aef40',
  'public/data/extras.json': '433f3b8a0a82',
};
const EXTRA_HASHES = {
  'public/data/library/akhlaq.json': 'ef2be19e0583',
  'public/data/library/dua.json': '531044d59f81',
  'public/data/library/fiqh.json': 'b2793208328f',
  'public/data/library/ilm.json': 'd221b174b27f',
  'public/data/library/index.json': 'a7add950d8e0',
  'public/data/library/miracles.json': 'ba666cf96376',
  'public/data/library/nawawi.json': 'b45be5a625ee',
  'public/data/library/qisas.json': 'a70475cdd11e',
  'public/data/library/quran.json': 'c1977ba795e5',
  'public/data/library/sabr.json': 'f6a7cfdfaa7a',
  'public/data/library/sahaba.json': 'aec0af0e2e58',
  'public/data/library/sahabi.json': 'e14c75ea940f',
  'public/data/library/salah.json': '5e45c2773183',
  'public/data/library/stories-prophets.json': '2568c075adb6',
  'public/data/library/stories-sahaba.json': '1ae0c15d1e37',
  'public/data/library/wudu.json': 'af14ac1f399b',
  'public/data/mushaf/1.json': '9f6a97f7c378',
  'public/data/mushaf/10.json': '57bb78d8c39c',
  'public/data/mushaf/11.json': '132e2c27b130',
  'public/data/mushaf/12.json': 'a2822ae14e9d',
  'public/data/mushaf/13.json': 'dfe838fb720f',
  'public/data/mushaf/14.json': '41d0eea63d85',
  'public/data/mushaf/15.json': '21dbfb499f88',
  'public/data/mushaf/16.json': 'dd918bbd557a',
  'public/data/mushaf/17.json': '047240e5aa52',
  'public/data/mushaf/18.json': '985b3058ab01',
  'public/data/mushaf/19.json': '5d9c9bfe7dde',
  'public/data/mushaf/2.json': '5f8d7fe27704',
  'public/data/mushaf/20.json': '058e69c59c82',
  'public/data/mushaf/21.json': 'f5414ff9dd7d',
  'public/data/mushaf/22.json': 'e7921a8bbd15',
  'public/data/mushaf/23.json': '492ff3241857',
  'public/data/mushaf/24.json': '2dcce74b959c',
  'public/data/mushaf/25.json': 'feefb79b517f',
  'public/data/mushaf/26.json': 'a3fcfea65c63',
  'public/data/mushaf/27.json': '17de9002e2c8',
  'public/data/mushaf/28.json': 'c1294acb6498',
  'public/data/mushaf/29.json': '49606f17ffe4',
  'public/data/mushaf/3.json': 'de29527e3c65',
  'public/data/mushaf/30.json': 'e50cffeb23ea',
  'public/data/mushaf/4.json': '873911dd60e2',
  'public/data/mushaf/5.json': '457eb69d15bf',
  'public/data/mushaf/6.json': 'f298050be69a',
  'public/data/mushaf/7.json': '92bf813dbe6e',
  'public/data/mushaf/8.json': '6a03a62eea14',
  'public/data/mushaf/9.json': 'e2debd86d869',
  'public/data/mushaf/index.json': 'c71a71df2a48',
  'public/data/roots.json': '7d4a156ac515',
  'public/data/tafsir/1.json': '6405596df82b',
  'public/data/tafsir/10.json': '8f328452d6c4',
  'public/data/tafsir/100.json': 'c6f86c47fcae',
  'public/data/tafsir/101.json': 'de48309b93db',
  'public/data/tafsir/102.json': '9e3cc76203da',
  'public/data/tafsir/103.json': '53bb4ea89606',
  'public/data/tafsir/104.json': 'de162312b4bf',
  'public/data/tafsir/105.json': '993460be9b77',
  'public/data/tafsir/106.json': '23b7178a8a67',
  'public/data/tafsir/107.json': 'afff574b257f',
  'public/data/tafsir/108.json': '6d873def2485',
  'public/data/tafsir/109.json': '1f0799d1ac1f',
  'public/data/tafsir/11.json': '3f5537b7aa54',
  'public/data/tafsir/110.json': '3403b583091c',
  'public/data/tafsir/111.json': 'f27bab987854',
  'public/data/tafsir/112.json': 'a813232c740b',
  'public/data/tafsir/113.json': '0a27b567acac',
  'public/data/tafsir/114.json': '936cc13ba1d8',
  'public/data/tafsir/12.json': 'fe68201b3514',
  'public/data/tafsir/13.json': 'a98a50195b8f',
  'public/data/tafsir/14.json': 'ee5508132d6d',
  'public/data/tafsir/15.json': '8752c2b0d5ac',
  'public/data/tafsir/16.json': '4cbed9781c56',
  'public/data/tafsir/17.json': 'bafca820cc96',
  'public/data/tafsir/18.json': '8e445944cb5c',
  'public/data/tafsir/19.json': '1c0f9c4f405e',
  'public/data/tafsir/2.json': '4eb5936c087f',
  'public/data/tafsir/20.json': '1024191f29be',
  'public/data/tafsir/21.json': 'c1ca484c1b79',
  'public/data/tafsir/22.json': '9b4f1b98825d',
  'public/data/tafsir/23.json': '98c96a9adc27',
  'public/data/tafsir/24.json': 'df8083d1ba55',
  'public/data/tafsir/25.json': '19cca848de73',
  'public/data/tafsir/26.json': 'e24282fefb74',
  'public/data/tafsir/27.json': '7774f6eedd7e',
  'public/data/tafsir/28.json': '4b9d94c51407',
  'public/data/tafsir/29.json': 'f58436a2f7a8',
  'public/data/tafsir/3.json': '840509f824c1',
  'public/data/tafsir/30.json': '0f045d0cbd68',
  'public/data/tafsir/31.json': '6be1d2f7fe25',
  'public/data/tafsir/32.json': 'a3b070404851',
  'public/data/tafsir/33.json': 'd38ecee9314d',
  'public/data/tafsir/34.json': 'b4b4454a2071',
  'public/data/tafsir/35.json': 'a19e42723bb4',
  'public/data/tafsir/36.json': 'c0838cae309c',
  'public/data/tafsir/37.json': 'c9225d2b35aa',
  'public/data/tafsir/38.json': '15ec3476c892',
  'public/data/tafsir/39.json': '90f04d9c438a',
  'public/data/tafsir/4.json': 'a3bd63c11ce2',
  'public/data/tafsir/40.json': '4eeda26d8afe',
  'public/data/tafsir/41.json': '2eaab0fe62b2',
  'public/data/tafsir/42.json': '7104eda684cc',
  'public/data/tafsir/43.json': '8de1be6072a2',
  'public/data/tafsir/44.json': '06ea021069bd',
  'public/data/tafsir/45.json': 'e30579e021e6',
  'public/data/tafsir/46.json': '4ad908782e82',
  'public/data/tafsir/47.json': 'bf23b1b20f60',
  'public/data/tafsir/48.json': '359ee5288528',
  'public/data/tafsir/49.json': '05456193533e',
  'public/data/tafsir/5.json': '453a8840c0b9',
  'public/data/tafsir/50.json': '4e2b6b813ab9',
  'public/data/tafsir/51.json': '346af8861d18',
  'public/data/tafsir/52.json': '6443d7e114d4',
  'public/data/tafsir/53.json': '129e7e5671df',
  'public/data/tafsir/54.json': '7b1784304f34',
  'public/data/tafsir/55.json': 'b7c141975f6d',
  'public/data/tafsir/56.json': 'be531dba521e',
  'public/data/tafsir/57.json': 'f6b154c17a09',
  'public/data/tafsir/58.json': '74617ef2be99',
  'public/data/tafsir/59.json': 'f96e52a20b2c',
  'public/data/tafsir/6.json': '6c79d41e0e7f',
  'public/data/tafsir/60.json': 'f87c185cb98d',
  'public/data/tafsir/61.json': 'beaea2662ae6',
  'public/data/tafsir/62.json': '5434ef727b74',
  'public/data/tafsir/63.json': '94bcead5f220',
  'public/data/tafsir/64.json': 'e4939127cbf3',
  'public/data/tafsir/65.json': '5a9c7258fe5e',
  'public/data/tafsir/66.json': 'b116dbe437c6',
  'public/data/tafsir/67.json': 'ed2c2cd7ada0',
  'public/data/tafsir/68.json': 'eecd11e64ddc',
  'public/data/tafsir/69.json': 'fd0f199ea301',
  'public/data/tafsir/7.json': '162a9c613bd9',
  'public/data/tafsir/70.json': 'c8c380542c17',
  'public/data/tafsir/71.json': '012684d5b83f',
  'public/data/tafsir/72.json': 'db8aec18039b',
  'public/data/tafsir/73.json': '5eaf765b691d',
  'public/data/tafsir/74.json': 'cb3b8dfb87f2',
  'public/data/tafsir/75.json': 'f5086df709b4',
  'public/data/tafsir/76.json': '90c2d4037087',
  'public/data/tafsir/77.json': 'a83b8e363c22',
  'public/data/tafsir/78.json': 'ca0212a3103e',
  'public/data/tafsir/79.json': '562e248bac4d',
  'public/data/tafsir/8.json': 'c0ab55685a6f',
  'public/data/tafsir/80.json': 'f3acfc47661a',
  'public/data/tafsir/81.json': '9c7436e4740f',
  'public/data/tafsir/82.json': '15467184b42b',
  'public/data/tafsir/83.json': '56a480d0d5bd',
  'public/data/tafsir/84.json': '455b7ebae43f',
  'public/data/tafsir/85.json': 'a9965dae85d5',
  'public/data/tafsir/86.json': 'fd6377c3c767',
  'public/data/tafsir/87.json': 'af7849fab5f9',
  'public/data/tafsir/88.json': '12dfd72bc540',
  'public/data/tafsir/89.json': '1ead76b7d024',
  'public/data/tafsir/9.json': 'f3840a2efe0c',
  'public/data/tafsir/90.json': '88016c1822e7',
  'public/data/tafsir/91.json': 'b40b5c99f5ef',
  'public/data/tafsir/92.json': 'b82dfff77815',
  'public/data/tafsir/93.json': '34872fe96a96',
  'public/data/tafsir/94.json': 'd84224fa37e4',
  'public/data/tafsir/95.json': '9d27a5b559f7',
  'public/data/tafsir/96.json': '3476652cc22f',
  'public/data/tafsir/97.json': 'd64111b3891d',
  'public/data/tafsir/98.json': 'a69b94aa8b50',
  'public/data/tafsir/99.json': 'aee0dae728f7',
  'public/data/tafsir-saadi/1.json': '2e0563ca88b2',
  'public/data/tafsir-saadi/10.json': 'ac9273ed4211',
  'public/data/tafsir-saadi/100.json': 'da6300087a46',
  'public/data/tafsir-saadi/101.json': '498128a8f420',
  'public/data/tafsir-saadi/102.json': '8479fe356b7e',
  'public/data/tafsir-saadi/103.json': '605e4fd9f84f',
  'public/data/tafsir-saadi/104.json': '128310f9175b',
  'public/data/tafsir-saadi/105.json': 'c5477e271e74',
  'public/data/tafsir-saadi/106.json': 'a4af078bd2dd',
  'public/data/tafsir-saadi/107.json': '938f598f0132',
  'public/data/tafsir-saadi/108.json': '343c18a100c1',
  'public/data/tafsir-saadi/109.json': 'b33cde5fe329',
  'public/data/tafsir-saadi/11.json': '470beb32fff7',
  'public/data/tafsir-saadi/110.json': '9a22237a2ff5',
  'public/data/tafsir-saadi/111.json': '1540e0ac3c65',
  'public/data/tafsir-saadi/112.json': '1d2d50b61f50',
  'public/data/tafsir-saadi/113.json': 'f2ca2d43bc80',
  'public/data/tafsir-saadi/114.json': 'ed2ad81d4b22',
  'public/data/tafsir-saadi/12.json': 'f8c74a20de8a',
  'public/data/tafsir-saadi/13.json': 'fdf47094c7bd',
  'public/data/tafsir-saadi/14.json': '6adc8be60bf6',
  'public/data/tafsir-saadi/15.json': '8f4b104f637f',
  'public/data/tafsir-saadi/16.json': 'b651a2899d20',
  'public/data/tafsir-saadi/17.json': '28a86df59750',
  'public/data/tafsir-saadi/18.json': '28553485040b',
  'public/data/tafsir-saadi/19.json': '9b6d5ea980eb',
  'public/data/tafsir-saadi/2.json': '60eba9258650',
  'public/data/tafsir-saadi/20.json': '8fe318c95f86',
  'public/data/tafsir-saadi/21.json': '68bc86060e7d',
  'public/data/tafsir-saadi/22.json': '9cb8935c7374',
  'public/data/tafsir-saadi/23.json': 'ec2fa41bad42',
  'public/data/tafsir-saadi/24.json': 'f938e371b3cd',
  'public/data/tafsir-saadi/25.json': 'c1fd2ac6422d',
  'public/data/tafsir-saadi/26.json': '54b45da74b21',
  'public/data/tafsir-saadi/27.json': 'eb38a33b956e',
  'public/data/tafsir-saadi/28.json': '7422b206ddee',
  'public/data/tafsir-saadi/29.json': '7047cff36b80',
  'public/data/tafsir-saadi/3.json': '53a0d3171115',
  'public/data/tafsir-saadi/30.json': '6b667943e524',
  'public/data/tafsir-saadi/31.json': '4642ae3b6d8f',
  'public/data/tafsir-saadi/32.json': '536b3368b134',
  'public/data/tafsir-saadi/33.json': 'ba15c6f7f732',
  'public/data/tafsir-saadi/34.json': 'c5cbc3e53a50',
  'public/data/tafsir-saadi/35.json': '91a26357519f',
  'public/data/tafsir-saadi/36.json': 'be230f19a7d3',
  'public/data/tafsir-saadi/37.json': '803891e72b70',
  'public/data/tafsir-saadi/38.json': '9e801ec4edc0',
  'public/data/tafsir-saadi/39.json': '43134f93e9ef',
  'public/data/tafsir-saadi/4.json': '0cebc9153f17',
  'public/data/tafsir-saadi/40.json': 'c21104522c13',
  'public/data/tafsir-saadi/41.json': '5af377ed4893',
  'public/data/tafsir-saadi/42.json': '227be336ee04',
  'public/data/tafsir-saadi/43.json': '75ef673c8d4f',
  'public/data/tafsir-saadi/44.json': '41735e3deb20',
  'public/data/tafsir-saadi/45.json': '4f983ff168d2',
  'public/data/tafsir-saadi/46.json': '550fc5355c71',
  'public/data/tafsir-saadi/47.json': '374b7a24c5c9',
  'public/data/tafsir-saadi/48.json': '95dc273a9c79',
  'public/data/tafsir-saadi/49.json': '27d5da98f980',
  'public/data/tafsir-saadi/5.json': '9089ef54974f',
  'public/data/tafsir-saadi/50.json': '2b0da190f1d2',
  'public/data/tafsir-saadi/51.json': '6a8e71179300',
  'public/data/tafsir-saadi/52.json': '370bc6c3d5a2',
  'public/data/tafsir-saadi/53.json': 'da36c99ca42c',
  'public/data/tafsir-saadi/54.json': '41b41c22c42c',
  'public/data/tafsir-saadi/55.json': '3a63316abc17',
  'public/data/tafsir-saadi/56.json': '95909f200022',
  'public/data/tafsir-saadi/57.json': '0afc1af54700',
  'public/data/tafsir-saadi/58.json': 'b01f085b81bd',
  'public/data/tafsir-saadi/59.json': 'db7ea61213ba',
  'public/data/tafsir-saadi/6.json': 'ebf100207119',
  'public/data/tafsir-saadi/60.json': 'cdd51d0a688f',
  'public/data/tafsir-saadi/61.json': '8d5867c992e5',
  'public/data/tafsir-saadi/62.json': '7460f49c22f5',
  'public/data/tafsir-saadi/63.json': '99fa48517c91',
  'public/data/tafsir-saadi/64.json': '16e4a76ea062',
  'public/data/tafsir-saadi/65.json': '43ed70559a14',
  'public/data/tafsir-saadi/66.json': '09ce04bbf2ec',
  'public/data/tafsir-saadi/67.json': '70f8d8e7115b',
  'public/data/tafsir-saadi/68.json': '45f565bdfe2a',
  'public/data/tafsir-saadi/69.json': 'd7d61edb95d9',
  'public/data/tafsir-saadi/7.json': 'b4adedd04afd',
  'public/data/tafsir-saadi/70.json': '2059ed1e3ab5',
  'public/data/tafsir-saadi/71.json': '04f663152a41',
  'public/data/tafsir-saadi/72.json': '63ad73ec984a',
  'public/data/tafsir-saadi/73.json': 'cbe9ced81be5',
  'public/data/tafsir-saadi/74.json': '95bf7fee7db4',
  'public/data/tafsir-saadi/75.json': 'ff66d7899c35',
  'public/data/tafsir-saadi/76.json': 'c3850a7593bb',
  'public/data/tafsir-saadi/77.json': '020de3dddcda',
  'public/data/tafsir-saadi/78.json': 'c3c55e5b958d',
  'public/data/tafsir-saadi/79.json': 'a79d3407b0db',
  'public/data/tafsir-saadi/8.json': 'e500ecd98c16',
  'public/data/tafsir-saadi/80.json': '98d00c65b379',
  'public/data/tafsir-saadi/81.json': '6ed61b4ac357',
  'public/data/tafsir-saadi/82.json': 'a2343a4ab2a5',
  'public/data/tafsir-saadi/83.json': '3f4adaf666e9',
  'public/data/tafsir-saadi/84.json': '82a988f78a8f',
  'public/data/tafsir-saadi/85.json': 'c2ff27c0675e',
  'public/data/tafsir-saadi/86.json': 'faa43df3823b',
  'public/data/tafsir-saadi/87.json': '40db4a6fbf6a',
  'public/data/tafsir-saadi/88.json': 'ed31b81cd001',
  'public/data/tafsir-saadi/89.json': '0b1f1af321b5',
  'public/data/tafsir-saadi/9.json': '2b275c202dcf',
  'public/data/tafsir-saadi/90.json': 'ff2a9e856f3f',
  'public/data/tafsir-saadi/91.json': '92838e3c5d1c',
  'public/data/tafsir-saadi/92.json': '5c86e891542b',
  'public/data/tafsir-saadi/93.json': '30f134041a4d',
  'public/data/tafsir-saadi/94.json': 'b37cb3df81f4',
  'public/data/tafsir-saadi/95.json': '69bd2a6f34bc',
  'public/data/tafsir-saadi/96.json': '22fe330265d2',
  'public/data/tafsir-saadi/97.json': 'ad5c6364b77d',
  'public/data/tafsir-saadi/98.json': 'ffcce2f66ba3',
  'public/data/tafsir-saadi/99.json': '4e5af46e212b',
  'public/data/tajweed-qpc.json': '48b94c4b4397',
  'public/data/tajweed.json': '1e09d7e49211',
  'public/data/words/1.json': 'b90ef4834164',
  'public/data/words/10.json': 'd4e006edeabc',
  'public/data/words/100.json': 'f556eca82f93',
  'public/data/words/101.json': '9df735ef29e6',
  'public/data/words/102.json': 'c147e2a55ec3',
  'public/data/words/103.json': '141b294d7638',
  'public/data/words/104.json': 'b6ca2db71a9c',
  'public/data/words/105.json': 'f445e257d239',
  'public/data/words/106.json': '520f9bdd6858',
  'public/data/words/107.json': '50dd568bdb6c',
  'public/data/words/108.json': '45b91b26207f',
  'public/data/words/109.json': 'f89a9e195ea1',
  'public/data/words/11.json': '79d81e198aa4',
  'public/data/words/110.json': '640c87db4b5f',
  'public/data/words/111.json': '4f7d856de48d',
  'public/data/words/112.json': '8f6a38732c4f',
  'public/data/words/113.json': '05c544997945',
  'public/data/words/114.json': '5f5b7c38abee',
  'public/data/words/12.json': '4b0b211e25fc',
  'public/data/words/13.json': 'e39301741bc5',
  'public/data/words/14.json': 'b0dd718fdd43',
  'public/data/words/15.json': '4f81f2bb91fa',
  'public/data/words/16.json': 'f3e6e2225dc1',
  'public/data/words/17.json': '81af9d39bcf8',
  'public/data/words/18.json': 'b0ab8f246484',
  'public/data/words/19.json': '9aa4be43636d',
  'public/data/words/2.json': '9ad03293432a',
  'public/data/words/20.json': '36045456d075',
  'public/data/words/21.json': 'e3b71ffb64ae',
  'public/data/words/22.json': '024378fc2691',
  'public/data/words/23.json': '1ccefd56f4c9',
  'public/data/words/24.json': '627bbd99c9e3',
  'public/data/words/25.json': 'e03123cf7525',
  'public/data/words/26.json': '018c87266dd3',
  'public/data/words/27.json': '499dc22f629e',
  'public/data/words/28.json': '4e825174ef09',
  'public/data/words/29.json': '4df23e91ae52',
  'public/data/words/3.json': 'b1afeeef77b1',
  'public/data/words/30.json': 'abf6a1203f3d',
  'public/data/words/31.json': '7775bb76b08a',
  'public/data/words/32.json': 'db37435ddf69',
  'public/data/words/33.json': '603d229c6304',
  'public/data/words/34.json': '97fc159dd735',
  'public/data/words/35.json': '7ebfc7e93b6a',
  'public/data/words/36.json': 'f9f96bea67b4',
  'public/data/words/37.json': '287ef9bba83c',
  'public/data/words/38.json': 'ffcd9868d298',
  'public/data/words/39.json': 'b51ef94aefe7',
  'public/data/words/4.json': 'c1a99e1a5ce1',
  'public/data/words/40.json': 'da64c90d4b6b',
  'public/data/words/41.json': '3c955b1d4fef',
  'public/data/words/42.json': '6ec5816a255b',
  'public/data/words/43.json': 'a12897704abd',
  'public/data/words/44.json': 'c718a93ff6a9',
  'public/data/words/45.json': 'b04ccc838f9e',
  'public/data/words/46.json': '5adc000ed3d2',
  'public/data/words/47.json': 'e6a29c46e02e',
  'public/data/words/48.json': '680ad7d9a453',
  'public/data/words/49.json': 'd5108e0cae6f',
  'public/data/words/5.json': 'c03150fbd8d1',
  'public/data/words/50.json': 'ece449e6b681',
  'public/data/words/51.json': 'c8f3695666a6',
  'public/data/words/52.json': '9882e45be167',
  'public/data/words/53.json': '2b861993becc',
  'public/data/words/54.json': '8019ff964e8f',
  'public/data/words/55.json': '5c2ab851fd44',
  'public/data/words/56.json': '393989cc631a',
  'public/data/words/57.json': '5df767d81623',
  'public/data/words/58.json': '81fcb7fe72ca',
  'public/data/words/59.json': '6e628cfbdfca',
  'public/data/words/6.json': 'c48d71e8251d',
  'public/data/words/60.json': 'a4cd8d810ebe',
  'public/data/words/61.json': '604f7d10c249',
  'public/data/words/62.json': '691d7c267235',
  'public/data/words/63.json': '14227acb036b',
  'public/data/words/64.json': 'beb9daac2601',
  'public/data/words/65.json': '22cc3e5052f9',
  'public/data/words/66.json': '042ac5c885ed',
  'public/data/words/67.json': 'e6a3f17631dc',
  'public/data/words/68.json': '4c7c846fc4d8',
  'public/data/words/69.json': '58ddce7118a3',
  'public/data/words/7.json': 'f1bb6360320a',
  'public/data/words/70.json': 'e05c4a25f007',
  'public/data/words/71.json': '3fe865664173',
  'public/data/words/72.json': 'cff1e6df1933',
  'public/data/words/73.json': '0146cd7453d0',
  'public/data/words/74.json': '8cddbb76292f',
  'public/data/words/75.json': '68017df4d34e',
  'public/data/words/76.json': 'c65c2c00af53',
  'public/data/words/77.json': '9fd01bf666ca',
  'public/data/words/78.json': 'c671542ac535',
  'public/data/words/79.json': '49c75d5a0986',
  'public/data/words/8.json': '59298be895fe',
  'public/data/words/80.json': 'b912287300cf',
  'public/data/words/81.json': 'dfbaeb138cd6',
  'public/data/words/82.json': '051f52c88e4e',
  'public/data/words/83.json': '100a576a4c5b',
  'public/data/words/84.json': '897a5c341879',
  'public/data/words/85.json': '46e57b348155',
  'public/data/words/86.json': '0bce1bdbc86a',
  'public/data/words/87.json': 'b5e0d3c8ed3d',
  'public/data/words/88.json': 'be4b26234199',
  'public/data/words/89.json': 'eaf3aaf9047d',
  'public/data/words/9.json': 'a7d3aa053f7c',
  'public/data/words/90.json': 'ac709c10cbd5',
  'public/data/words/91.json': '3ea620a44d5f',
  'public/data/words/92.json': '1b1dc7f0df07',
  'public/data/words/93.json': '7c6c408c3bac',
  'public/data/words/94.json': '496f1552869b',
  'public/data/words/95.json': '6457ef7971e6',
  'public/data/words/96.json': '51d6034ea059',
  'public/data/words/97.json': 'd8f9e4ead015',
  'public/data/words/98.json': '459c68f419e3',
  'public/data/words/99.json': 'a6fe4463b36e',
  'public/data/words/labels.json': '109f01e5bc38',
};

// سجل بصمات الكاش: يُكتب آخرًا بعد اكتمال تعبئته، فلا نثق إلا في كاش مكتمل
const HASH_KEY = '__asset-hashes__';
const assetKey = (p) => (p === './' ? 'index.html' : p);

/** أحدث كاش سابق مكتمل لنفس النوع وبصماته */
async function previousCache(prefix, current) {
  for (const name of (await caches.keys()).filter((k) => k.startsWith(prefix) && k !== current).reverse()) {
    const c = await caches.open(name);
    const r = await c.match(HASH_KEY);
    if (r) return { cache: c, hashes: await r.json().catch(() => ({})) };
  }
  return null;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const putHashes = (cache, hashes) => cache.put(HASH_KEY, new Response(JSON.stringify(hashes), { headers: { 'Content-Type': 'application/json' } }));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // الملفات الأساسية: ننسخ غير المتغيّر من الكاش السابق، وننزّل المتغيّر والجديد فقط
    const cache = await caches.open(APP_CACHE);
    const prev = await previousCache('app-', APP_CACHE);
    let copied = 0, fetched = 0;
    await pool(ASSETS, 8, async (p) => {
      const h = HASHES[assetKey(p)];
      if (prev && h && prev.hashes[assetKey(p)] === h) {
        const hit = await prev.cache.match(p);
        if (hit) { await cache.put(p, hit); copied++; return; }
      }
      const res = await fetch(new Request(p, { cache: 'reload' }));
      if (!res.ok) throw new Error(`${p}: ${res.status}`);
      await cache.put(p, res);
      fetched++;
    });
    await putHashes(cache, HASHES);

    // البيانات الإضافية التي نزّلها المستخدم: تُنقل للكاش الجديد إن لم تتغير، بدل حذفها
    const exCache = await caches.open(EXTRAS_CACHE);
    const prevEx = await previousCache('extras-', EXTRAS_CACHE);
    if (prevEx) {
      const keep = (await prevEx.cache.keys()).filter((r) => {
        const p = new URL(r.url).pathname.slice(new URL(self.registration.scope).pathname.length);
        return EXTRA_HASHES[p] && prevEx.hashes[p] === EXTRA_HASHES[p];
      });
      await pool(keep, 8, async (r) => { const hit = await prevEx.cache.match(r); if (hit) await exCache.put(r, hit); });
    }
    await putHashes(exCache, EXTRA_HASHES);
    console.info(`[sw] ${VERSION}: ${fetched} ملف من الشبكة، ${copied} من الكاش السابق`);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => (k.startsWith('app-') && k !== APP_CACHE) || (k.startsWith('extras-') && k !== EXTRAS_CACHE)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ===== Background Fetch (التنزيل في الخلفية) =====
// id format: "dl_{reciter}_{surah}_{variant}"
self.addEventListener('backgroundfetchsuccess', (event) => {
  const bgf = event.registration;
  event.waitUntil((async () => {
    const cache = await caches.open(AUDIO_CACHE);
    const records = await bgf.matchAll();
    let done = 0, bytes = 0;
    for (const r of records) {
      const res = await r.responseReady.catch(() => null);
      if (res?.ok) {
        const blob = await res.clone().blob().catch(() => null);
        if (blob) bytes += blob.size;
        await cache.put(r.request, res);
        done++;
      }
    }
    await bgf.updateUI({ title: 'تم التنزيل' }).catch(() => {});
    const parts = bgf.id.split('_'); // ['dl', reciter, surah, variant]
    const msg = { type: 'bgfetch-done', reciter: parts[1], surah: +parts[2], variant: parts[3], done, failed: records.length - done, bytes, total: records.length };
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) c.postMessage(msg);
  })());
});
self.addEventListener('backgroundfetchfail', (event) => {
  const bgf = event.registration;
  event.waitUntil((async () => {
    await bgf.updateUI({ title: 'فشل التنزيل' }).catch(() => {});
    const parts = bgf.id.split('_');
    const msg = { type: 'bgfetch-done', reciter: parts[1], surah: +parts[2], variant: parts[3], done: 0, failed: 1, bytes: 0, total: 1 };
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) c.postMessage(msg);
  })());
});
self.addEventListener('backgroundfetchabort', () => {});
self.addEventListener('backgroundfetchclick', (event) => {
  event.waitUntil(self.clients.openWindow(self.registration.scope));
});

// ===== الإشعارات =====
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'رتّل', body: event.data?.text() || '' }; }
  const opts = {
    body: d.body || '', tag: d.tag || 'rattil', renotify: true, lang: 'ar', dir: 'rtl',
    icon: 'public/icons/icon-192.png', badge: 'public/icons/badge-96.png', data: { url: d.url || '' },
  };
  if (d.adhan) {
    // تنبيه الأذان: يبقى ظاهرًا حتى يُغلق، باهتزاز طويل، وزر لتشغيل الأذان كاملًا
    // (أنظمة الهواتف لا تسمح للمواقع بصوت تنبيه مخصص، فالأذان يُشغَّل عند فتح التنبيه)
    Object.assign(opts, { requireInteraction: true, silent: false, vibrate: [600, 200, 600, 200, 900, 400, 600, 200, 600],
      actions: [{ action: 'adhan', title: 'تشغيل الأذان' }, { action: 'dismiss', title: 'إغلاق' }] });
  }
  event.waitUntil(self.registration.showNotification(d.title || 'رتّل', opts));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const target = new URL(self.registration.scope).href + (event.notification.data?.url || '');
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (!w.url.startsWith(self.registration.scope)) continue;
      await w.focus();
      // التطبيق مفتوح: نطلب منه تشغيل الأذان مباشرة دون إعادة تحميل الصفحة
      const adhan = /[?&]adhan=(\w+)/.exec(event.notification.data?.url || '');
      if (adhan) { w.postMessage({ type: 'adhan', key: adhan[1] }); return; }
      return w.navigate(target).catch(() => {});
    }
    // التطبيق مغلق: يقرأ main.js معامل adhan من الرابط ويشغّل الأذان
    return self.clients.openWindow(target);
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // الصوت
  if ((url.hostname.endsWith('mp3quran.net') || url.hostname === 'download.quranicaudio.com' || url.hostname === 'everyayah.com') && url.pathname.endsWith('.mp3')) {
    event.respondWith(audioResponse(req));
    return;
  }

  // توقيت الآيات: كاش أولًا (صغير، يُحفظ عند أول تشغيل ليعمل التظليل بدون إنترنت)
  if ((url.hostname.endsWith('mp3quran.net') && url.pathname.includes('/ayat_timing')) || (url.hostname === 'api.quran.com' && url.pathname.includes('/chapter_recitations/'))) {
    event.respondWith((async () => {
      const hit = await caches.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(TIMING_CACHE)).put(req.url, res.clone());
      return res;
    })());
    return;
  }

  // التفاسير الإضافية (jsDelivr): كاش أولًا لتعمل بدون إنترنت بعد أول فتح
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/tafsir_api')) {
    event.respondWith((async () => {
      const cache = await caches.open('tafsir-remote-v1');
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;
  // طلبات الصوت الجزئية (Range) تذهب للشبكة مباشرة؛ ملف الأذان يُخزَّن كاملًا عبر الطلب العادي
  if (req.headers.has('range')) return;
  // أصوات الأذان: كاش الصوت الدائم (لا يُمسح مع التحديثات)
  if (url.pathname.includes('/public/audio/')) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.status === 200) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // التنقل: index.html من الكاش (التطبيق يعمل بدون نت)
  if (req.mode === 'navigate') {
    const scope = new URL(self.registration.scope);
    const isShell = url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
    if (isShell) {
      // واجهة التطبيق: من الكاش (يعمل بدون إنترنت)
      event.respondWith((async () => {
        const cache = await caches.open(APP_CACHE);
        return (await cache.match('index.html')) || (await cache.match('./')) || fetch(req);
      })().catch(() => fetch(req)));
    } else {
      // صفحات السور الثابتة وغيرها: الشبكة أولًا ثم الكاش
      event.respondWith((async () => {
        const cache = await caches.open('pages-v1');
        try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
        catch { return (await cache.match(req)) || Response.error(); }
      })());
    }
    return;
  }

  // باقي الملفات: كاش أولًا ثم الشبكة (البيانات الإضافية في كاشها المستقل)
  event.respondWith((async () => {
    const cache = await caches.open(isExtra(url.pathname) ? EXTRAS_CACHE : APP_CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  })());
});

async function audioResponse(req) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(req.url);
  if (!cached) {
    try { return await fetch(req); }
    catch (e) { return new Response('', { status: 504, statusText: 'Offline' }); }
  }
  const range = req.headers.get('range');
  if (!range) return cached;
  const blob = await cached.blob();
  const size = blob.size;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  if (start >= size || end >= size || start > end) {
    return new Response('', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
