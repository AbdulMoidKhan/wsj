#!/usr/bin/env bash
# ==============================================================================
# Workspace Junction - production smoke test / acceptance gate (run ON the VPS)
#
#   bash scripts/devops/smoke-test.sh baseline <dir>   # BEFORE any change (legacy release)
#   bash scripts/devops/smoke-test.sh verify   <dir>   # AFTER each switch; compares with baseline
#
# Side effects: none on data. Everything is a GET except
#   - POST /api/public/catalog/quote   (server-side price quote, no record is created)
#   - POST /api/webhooks/stripe        (unsigned -> must be rejected with 400)
#   - POST /api/inquiries with {}      (throttle probe; rejected before validation/insert)
# Never prints secrets or tokens. Exit 1 if any hard check FAILS.
#
# Env: PUBLIC_URL (https://wp.workspacejunction.com)  LOCAL_WEB (http://127.0.0.1:3600)
#      LOCAL_API (http://127.0.0.1:4000)  PG_CONTAINER (wsj-app-postgres-1)  N (30 samples)
#      Staging-only overrides: WSJ_WEB_PORT / WSJ_API_PORT (loopback check), PG_DB (database name)
# ==============================================================================
set -Euo pipefail
MODE="${1:-}"; DIR="${2:-}"
PUBLIC_URL="${PUBLIC_URL:-https://wp.workspacejunction.com}"
LOCAL_WEB="${LOCAL_WEB:-http://127.0.0.1:3600}"
LOCAL_API="${LOCAL_API:-http://127.0.0.1:4000}"
PG_CONTAINER="${PG_CONTAINER:-wsj-app-postgres-1}"
N="${N:-30}"
[ "${MODE}" = baseline ] || [ "${MODE}" = verify ] || { echo "usage: $0 <baseline|verify> <dir>"; exit 2; }
[ -n "${DIR}" ] || { echo "usage: $0 <baseline|verify> <dir>"; exit 2; }
mkdir -p "${DIR}"; chmod 700 "${DIR}"
OUT="${DIR}/${MODE}"; mkdir -p "${OUT}"
FAILS=0; WARNS=0
pass(){ echo "PASS  $*"; }
fail(){ echo "FAIL  $*"; FAILS=$((FAILS+1)); }
warn(){ echo "WARN  $*"; WARNS=$((WARNS+1)); }
info(){ echo "INFO  $*"; }
code(){ curl -s -o /dev/null -m 30 -w '%{http_code}' "$@"; }
pct(){ sort -n | awk '{a[NR]=$1} END{if(!NR){print "n/a";exit} i=int(NR*0.95); if(i<1)i=1; printf "p50=%.0fms p95=%.0fms max=%.0fms n=%d", a[int((NR+1)/2)]*1000, a[i]*1000, a[NR]*1000, NR}'; }
sample(){ local url="$1" field="$2" n="$3"; for _ in $(seq 1 "${n}"); do curl -s -o /dev/null -m 30 -H 'Accept-Encoding: gzip' -w "%{${field}}\n" "${url}"; done | pct; }

echo "== ${MODE} $(date -u +%Y-%m-%dT%H:%M:%SZ) public=${PUBLIC_URL}"

# --- 1. pages (public through Nginx) ------------------------------------------
for p in / /coworking/ /meeting-rooms/ /podcast-studio/ /dedicated/ /virtual-office/ /memberships/ /use-cases/ /services/ /contact-us/ /account/ /admin/; do
  c=$(code "${PUBLIC_URL}${p}"); [ "${c}" = 200 ] && pass "page ${p} 200" || fail "page ${p} returned ${c}"
done
curl -s -m 30 "${PUBLIC_URL}/" | grep -qi '<html' && pass "homepage renders HTML" || fail "homepage has no <html"

# --- 2. API availability + settings payload ------------------------------------
curl -s -m 10 "${PUBLIC_URL}/api/health" | grep -q '"status":"ok"' && pass "api/health via Nginx" || fail "api/health via Nginx"
curl -s -m 10 "${LOCAL_API}/api/health" | grep -q '"status":"ok"' && pass "api/health loopback" || fail "api/health loopback"
c=$(code "${PUBLIC_URL}/api/public/plans"); [ "${c}" = 200 ] && pass "public/plans 200" || fail "public/plans ${c}"
SVC_JSON="$(curl -s -m 30 "${PUBLIC_URL}/api/public/catalog/services")"
echo "${SVC_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);process.exit(o.source==="CATALOG"&&o.items.length===13?0:1)})' \
  && pass "catalog services: source CATALOG, 13 services" || fail "catalog services shape/source changed"
SETTINGS_BYTES=$(curl -s -o "${OUT}/settings.json" -m 60 -w '%{size_download}' "${PUBLIC_URL}/api/public/settings")
SETTINGS_GZ=$(curl -s -o /dev/null -m 60 -H 'Accept-Encoding: gzip' -w '%{size_download}' "${PUBLIC_URL}/api/public/settings")
LINKS=$(node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=JSON.stringify(o);console.log(/"links":\[/.test(s)?"present":"absent")' "${OUT}/settings.json" 2>/dev/null || echo unknown)
info "settings payload bytes=${SETTINGS_BYTES} gzip_bytes=${SETTINGS_GZ} scraped_links=${LINKS}"
echo "${SETTINGS_BYTES}" > "${OUT}/settings.bytes"
if [ "${MODE}" = verify ]; then
  [ "${SETTINGS_BYTES}" -lt 200000 ] && [ "${LINKS}" = absent ] && pass "settings payload reduced (${SETTINGS_BYTES} B, links absent)" || fail "settings payload not reduced (${SETTINGS_BYTES} B, links ${LINKS})"
fi

# --- 3. latency: API p50/p95 (public + loopback) and TTFB for service routes ----
: > "${OUT}/latency.txt"
for p in /api/health /api/public/settings /api/public/plans "/api/public/blog?limit=10&page=1" /api/public/catalog/services; do
  echo "api ${p} public $(sample "${PUBLIC_URL}${p}" time_total "${N}") | loopback $(sample "${LOCAL_API}${p}" time_total "${N}")" | tee -a "${OUT}/latency.txt" | sed 's/^/INFO  /'
done
for p in / /podcast-studio/ /meeting-rooms/ /coworking/ /dedicated/ /virtual-office/; do
  echo "ttfb ${p} public $(sample "${PUBLIC_URL}${p}" time_starttransfer $((N/2))) | loopback $(sample "${LOCAL_WEB}${p}" time_starttransfer $((N/2)))" | tee -a "${OUT}/latency.txt" | sed 's/^/INFO  /'
done
if [ "${MODE}" = verify ] && [ -f "${DIR}/baseline/latency.txt" ]; then
  # Regression guard on SERVER-SIDE (loopback) p95 only: public numbers include client network time.
  paste -d'|' "${DIR}/baseline/latency.txt" "${OUT}/latency.txt" | while IFS='|' read -r b a; do
    name=$(echo "${a}" | awk '{print $1" "$2}')
    bp=$(echo "${b}" | sed -n 's/.*loopback p50=[0-9]*ms p95=\([0-9]*\)ms.*/\1/p'); ap=$(echo "${a}" | sed -n 's/.*loopback p50=[0-9]*ms p95=\([0-9]*\)ms.*/\1/p')
    [ -n "${bp}" ] && [ -n "${ap}" ] || continue
    if [ "${ap}" -gt $(( bp * 3 / 2 + 50 )) ]; then echo "REGRESSION ${name} loopback p95 ${bp}ms -> ${ap}ms"; else echo "OK ${name} loopback p95 ${bp}ms -> ${ap}ms"; fi
  done | tee "${OUT}/latency-compare.txt" | sed 's/^/INFO  /'
  grep -q '^REGRESSION' "${OUT}/latency-compare.txt" && fail "server-side p95 regression (see latency-compare.txt)" || pass "no server-side p95 regression vs baseline"
fi

# --- 4. booking / Stripe: price fingerprint + server-side quotes ---------------
echo "${SVC_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const i of JSON.parse(s).items)console.log(i.slug)})' > "${OUT}/services.txt"
: > "${OUT}/prices.jsonl"
while read -r slug; do curl -s -m 30 "${PUBLIC_URL}/api/public/catalog/services/${slug}" | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);
  const plans=(o.plans||[]).map(p=>({slug:p.slug,cents:p.unitAmountCents,unit:p.billingUnit,type:p.billingType,interval:p.interval,min:p.minQuantity,max:p.maxQuantity,addOns:(p.addOns||[]).map(a=>[a.slug,a.unitAmountCents,a.billingUnit]).sort()}));
  console.log(JSON.stringify({service:o.slug,priceFromCents:o.priceFromCents,addOns:(o.addOns||[]).map(a=>[a.slug,a.unitAmountCents,a.billingUnit]).sort(),plans:plans.sort((a,b)=>a.slug<b.slug?-1:1)}))})' >> "${OUT}/prices.jsonl"; done < "${OUT}/services.txt"
PRICE_SHA=$(sha256sum < "${OUT}/prices.jsonl" | cut -c1-16)
: > "${OUT}/quotes.txt"
node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").split("\n").filter(Boolean))for(const p of JSON.parse(l).plans)console.log(p.slug+" "+(p.min||1))' "${OUT}/prices.jsonl" | head -40 | while read -r plan qty; do
  curl -s -m 30 -o "${OUT}/quote.json" -w '%{http_code}' -H 'Content-Type: application/json' \
       -d "{\"planSlug\":\"${plan}\",\"quantity\":${qty}}" "${PUBLIC_URL}/api/public/catalog/quote" > "${OUT}/quote.code" || true
  # Keep only money fields (*Cents / *Amount, any depth) so volatile ids/timestamps do not affect the fingerprint.
  echo "${plan} HTTP$(cat "${OUT}/quote.code") $(node -e 'const out=[];const w=(v,p)=>{if(Array.isArray(v))v.forEach((x,i)=>w(x,p+"["+i+"]"));else if(v&&typeof v==="object")for(const[k,x]of Object.entries(v))w(x,p+"."+k);else if(/(Cents|Amount)$/.test(p)&&typeof v==="number")out.push(p+"="+v)};try{w(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")),"")}catch{};console.log(out.sort().join(" "))' "${OUT}/quote.json")" >> "${OUT}/quotes.txt"
  sleep 1.1   # stay under the 60/min quote throttle
done
QUOTE_SHA=$(sha256sum < "${OUT}/quotes.txt" | cut -c1-16)
info "price fingerprint=${PRICE_SHA} quotes fingerprint=${QUOTE_SHA} ($(wc -l < "${OUT}/quotes.txt") quotes)"
if [ "${MODE}" = verify ] && [ -f "${DIR}/baseline/prices.jsonl" ]; then
  cmp -s "${DIR}/baseline/prices.jsonl" "${OUT}/prices.jsonl" && pass "catalog prices identical to baseline" || fail "catalog prices differ from baseline (diff ${DIR}/baseline/prices.jsonl ${OUT}/prices.jsonl)"
  cmp -s "${DIR}/baseline/quotes.txt" "${OUT}/quotes.txt" && pass "server-side quotes identical to baseline" || fail "server-side quotes differ from baseline"
fi
c=$(code -X POST -H 'Content-Type: application/json' -d '{"id":"evt_smoke","type":"ping"}' "${PUBLIC_URL}/api/webhooks/stripe"); [ "${c}" = 400 ] && pass "unsigned Stripe webhook rejected (400)" || fail "unsigned Stripe webhook returned ${c}"
# Checkout must be unchanged: the Payment Element routes (/api/public/payments/*) are NOT part of this release.
c=$(code "${PUBLIC_URL}/api/public/payments/config"); echo "${c}" > "${OUT}/payments-config.code"
if [ "${MODE}" = verify ] && [ -f "${DIR}/baseline/payments-config.code" ]; then [ "${c}" = "$(cat "${DIR}/baseline/payments-config.code")" ] && pass "payments route unchanged (${c})" || fail "payments route changed: baseline $(cat "${DIR}/baseline/payments-config.code") -> ${c}"; else info "payments config route -> ${c}"; fi

# --- 5. authentication / authorization ----------------------------------------
c=$(code "${PUBLIC_URL}/api/admin/inquiries"); [ "${c}" = 401 ] && pass "admin API without token -> 401" || fail "admin API without token -> ${c}"
c=$(code "${PUBLIC_URL}/api/admin/catalog/services"); { [ "${c}" = 401 ] || [ "${c}" = 404 ]; } && pass "admin catalog without token -> ${c}" || fail "admin catalog without token -> ${c}"
c=$(code "${PUBLIC_URL}/api/billing/portal?token=smoke-invalid"); [ "${c}" = 401 ] && pass "portal query-string token rejected (401)" || { [ "${MODE}" = baseline ] && info "portal query token -> ${c} (legacy)" || fail "portal query-string token -> ${c}"; }

# --- 6. rate limiting (in-memory; single process per app in this release) ---
FIRST429=0
for i in $(seq 1 16); do c=$(code -X POST -H 'Content-Type: application/json' -d '{}' "${PUBLIC_URL}/api/inquiries"); [ "${c}" = 429 ] && { FIRST429=${i}; break; }; done
[ "${FIRST429}" -gt 0 ] && pass "rate limit enforced on POST /api/inquiries (first 429 at request ${FIRST429}; limit 5/min)" || fail "no 429 after 16 requests to POST /api/inquiries"

# --- 7. Nginx routing + direct port exposure ----------------------------------
curl -sI -m 10 "${PUBLIC_URL}/" | grep -qi '^server: nginx' && pass "public traffic served through Nginx" || warn "no 'Server: nginx' header"
for port in "${WSJ_WEB_PORT:-3600}" "${WSJ_API_PORT:-4000}"; do
  L=$(ss -ltnH "sport = :${port}" | awk '{print $4}' | sort -u | tr '\n' ' ')
  if [ "${MODE}" = verify ]; then echo "${L}" | grep -qvE '^(127\.0\.0\.1:[0-9]+ ?)+$' && fail "port ${port} listens on non-loopback: ${L}" || pass "port ${port} loopback only (${L})"; else info "port ${port} listeners: ${L}"; fi
done

# --- 8. database health -------------------------------------------------------
[ "$(docker inspect -f '{{.State.Health.Status}}' "${PG_CONTAINER}" 2>/dev/null)" = healthy ] && pass "postgres container healthy" || fail "postgres container not healthy"
DBU=$(docker exec "${PG_CONTAINER}" printenv POSTGRES_USER </dev/null); DBN="${PG_DB:-$(docker exec "${PG_CONTAINER}" printenv POSTGRES_DB </dev/null)}"
MIG=$(docker exec "${PG_CONTAINER}" psql -U "${DBU}" -d "${DBN}" -XAtc "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null" </dev/null)
BAD=$(docker exec "${PG_CONTAINER}" psql -U "${DBU}" -d "${DBN}" -XAtc "select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null" </dev/null)
CONN=$(docker exec "${PG_CONTAINER}" psql -U "${DBU}" -d "${DBN}" -XAtc "select count(*) from pg_stat_activity where datname=current_database()" </dev/null)
info "migrations applied=${MIG} unfinished=${BAD} connections=${CONN}"
[ "${BAD}" = 0 ] && pass "no failed migrations" || fail "${BAD} failed migration records"
[ "${MODE}" = verify ] && { [ "${MIG}" = "${EXPECT_MIGRATIONS:-5}" ] && pass "${MIG} migrations applied" || fail "expected ${EXPECT_MIGRATIONS:-5} migrations, found ${MIG}"; }
docker exec "${PG_CONTAINER}" psql -U "${DBU}" -d "${DBN}" -XAt -F'|' </dev/null -c "select 'Booking',count(*),coalesce(round(sum(\"totalPrice\")::numeric,2),0) from \"Booking\" union all select 'Order',count(*),coalesce(sum(\"totalAmount\"),0) from \"Order\" union all select 'Customer',count(*),0 from \"Customer\" union all select 'Content',count(*),0 from \"Content\"" > "${OUT}/records.txt"
info "records $(tr '\n' ' ' < "${OUT}/records.txt")"
if [ "${MODE}" = verify ] && [ -f "${DIR}/baseline/records.txt" ]; then
  # Counts may only grow (new customer activity); totals of existing rows must never shrink.
  paste -d'|' "${DIR}/baseline/records.txt" "${OUT}/records.txt" | awk -F'|' '{ if ($5 < $2) { print "FAIL " $1 " count decreased " $2 " -> " $5; bad=1 } } END { exit bad }' && pass "no record counts decreased" || fail "record counts decreased"
fi

# --- 9. PM2 worker health ------------------------------------------------------
pm2 jlist 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s.slice(s.indexOf("["))).filter(p=>p.name==="wsj-web"||p.name==="wsj-backend");
  for(const n of ["wsj-web","wsj-backend"]){const w=a.filter(p=>p.name===n);console.log(n,w.length,[...new Set(w.map(p=>p.pm2_env.exec_mode))].join(","),w.filter(p=>p.pm2_env.status==="online").length,w.reduce((t,p)=>t+p.pm2_env.restart_time,0),w.map(p=>Math.round(p.monit.memory/1048576)).join("/"))}})' > "${OUT}/pm2.txt"
while read -r n cnt mode online restarts mem; do
  info "pm2 ${n}: processes=${cnt} mode=${mode} online=${online} restarts=${restarts} rss_mb=${mem}"
  if [ "${MODE}" = verify ]; then { [ "${mode}" = "${EXPECT_MODE:-fork_mode}" ] && [ "${cnt}" = "${WSJ_INSTANCES:-1}" ] && [ "${online}" = "${WSJ_INSTANCES:-1}" ]; } && pass "${n} ${online} ${mode} process(es) online" || fail "${n} not ${WSJ_INSTANCES:-1} online ${EXPECT_MODE:-fork_mode} process(es)"; fi
done < "${OUT}/pm2.txt"
info "host MemAvailable=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo)MB"

# --- 10. logs -----------------------------------------------------------------
for n in wsj-web wsj-backend; do
  E=$(pm2 logs "${n}" --nostream --lines 300 2>/dev/null | grep -ciE 'unhandled|ECONNREFUSED|EADDRINUSE|PrismaClient.*Error|P20[0-9]{2}|FATAL' || true)
  [ "${E}" = 0 ] && pass "${n} last 300 log lines: no fatal patterns" || warn "${n}: ${E} fatal-pattern lines in last 300 (inspect pm2 logs ${n})"
done
UP=$(grep -c "workspacejunction" /var/log/nginx/error.log 2>/dev/null || true); UP=${UP:-0}; info "nginx error.log lines mentioning workspacejunction: ${UP} (compare with baseline)"
echo "${UP}" > "${OUT}/nginx_errors.count"

echo "== RESULT ${MODE}: ${FAILS} FAIL, ${WARNS} WARN  (artifacts: ${OUT})"
[ "${FAILS}" = 0 ]
