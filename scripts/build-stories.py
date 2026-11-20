# يبني ملفات القصص المراجَعة: public/data/library/stories-{sahaba,prophets}.json
# المدخلات: ملفات المراجعة rev-*.json في المجلد المعطى (افتراضيًا /tmp/claude-0/stories)
import json, sys, glob, os
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/stories'
root = os.path.join(os.path.dirname(__file__), '..')
quran = json.load(open(os.path.join(root, 'public/data/quran-uthmani.json')))['ayahs']
def check(st):
    for b in st['blocks']:
        assert b['t'] in ('p', 'h', 'ayah', 'hadith'), b
        if b['t'] == 'ayah':
            s, r = b['ref'].split(':'); x = r.split('-'); s = int(s); f, t = int(x[0]), int(x[-1])
            assert 1 <= s <= 114 and 1 <= f <= t <= len(quran[s - 1]), (st['id'], b['ref'])
        if b['t'] == 'hadith': assert b.get('grade') in ('صحيح', 'حسن'), (st['id'], b.get('grade'))
for kind in ('sahaba', 'prophets'):
    items = []
    for f in sorted(glob.glob(os.path.join(src, f'rev-{kind}-*.json'))):
        items += json.load(open(f))
    for st in items: check(st)
    if kind == 'sahaba': items.sort(key=lambda x: int(x['id'][1:]))
    json.dump(items, open(os.path.join(root, f'public/data/library/stories-{kind}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(kind, len(items))
