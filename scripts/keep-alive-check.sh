#!/usr/bin/env bash
# فحص صحة خادم «رتّل» على Supabase، ويُبقي المشروع المجاني نشطًا (يتوقف بعد ٧ أيام بلا طلبات).
# يُستدعى من .github/workflows/keep-alive.yml، ويمكن تشغيله محليًا: bash scripts/keep-alive-check.sh
# يخرج بـ 0 إذا كان كل شيء يعمل، وإلا يطبع السبب ويخرج بـ 1. يعيد المحاولة ٣ مرات قبل الحكم بالفشل.
set -u
BASE='https://lskfbmkesxxgqytjsftk.supabase.co'
KEY='sb_publishable_4yIAdvDsyTja323tcEVUvQ_KLxQYg7P'   # مفتاح عام (موجود في كود التطبيق نفسه)

check() {
  # ١) قاعدة البيانات وواجهة REST: دالة عامة للقراءة فقط
  db=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$BASE/rest/v1/rpc/khatma_get" \
    -H "apikey: $KEY" -H 'Content-Type: application/json' -d '{"p_id":"keepalive","p_device":"keepalive"}')
  # ٢) دالة الإشعارات منشورة وتستجيب: بلا مفتاح يجب أن ترفض بـ 403 (لا 404 ولا 5xx)
  fn=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$BASE/functions/v1/push-tick" \
    -H 'Content-Type: application/json' -d '{}')
  echo "REST rpc: HTTP $db | push-tick: HTTP $fn"
  [[ "$db" == 200 || "$db" == 204 ]] && [[ "$fn" == 403 ]]
}

for attempt in 1 2 3; do
  if check; then echo 'OK'; exit 0; fi
  [[ $attempt -lt 3 ]] && sleep $((attempt * 30))
done
echo 'FAILED: الخادم لا يستجيب كما يجب بعد ٣ محاولات' >&2
exit 1
