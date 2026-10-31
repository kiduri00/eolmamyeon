# 웹 푸시 켜기 (관심 구역 알림)

알림함(머리의 종 버튼)은 지금도 서버 없이 동작한다. 매일 파이프라인이 `public/data/changes.json`을 만들고 앱이 그 파일을 읽는다.
폰 알림(웹 푸시)은 이 폴더의 Worker를 배포해야 켜진다. 배포 전에는 `/api/push/key`가 404를 돌려주므로 '알림 받기' 버튼이 숨겨져 있다.

## 소유자가 할 일 (완료)

1. Cloudflare 대시보드 → **Workers & Pages → KV** → **Create namespace** → 이름 `zippin-push`
2. 만든 네임스페이스의 **ID**를 복사해 Claude에게 알려 준다.

이 단계는 끝났다(ID `97677fe6952f47158d738a96a480f443`, `worker/wrangler.push.jsonc`에 반영됨). 그 밖에 비밀값·계정 설정은 필요 없다.
VAPID 키쌍은 Worker가 처음 `/api/push/key` 요청을 받을 때 만들어 KV(`vapid`)에 저장한다.

## Claude가 바꿀 것 (전환)

1. 루트 `wrangler.jsonc`를 아래 내용으로 바꾼다. 정적 자산 설정(`./public`, `404-page`, `_headers`)은 그대로 두고,
   `/api/push/*` 요청만 Worker로 보낸다. 나머지 주소는 지금처럼 정적 자산이 바로 응답한다.

   ```jsonc
   {
     "name": "eolmamyeon",
     "main": "worker/index.js",
     "compatibility_date": "2025-09-01",
     "assets": {
       "directory": "./public",
       "binding": "ASSETS",
       "not_found_handling": "404-page",
       "run_worker_first": ["/api/push/*"]
     },
     "kv_namespaces": [{ "binding": "PUSH", "id": "97677fe6952f47158d738a96a480f443" }],
     "triggers": { "crons": ["30,40,50 22 * * *", "0,10,20,30 23 * * *"] },
     "observability": { "enabled": true }
   }
   ```

2. main에 푸시하면 Cloudflare Git 연동이 그대로 배포한다(Worker 코드·cron 포함).
3. 배포 직후 `https://jaegaebal.alwaysquestions.kr/api/push/key`를 한 번 열어 VAPID 키를 만든다.
   - JSON `{"key":"B..."}`가 나오면 성공. 같은 주소를 다시 열어도 같은 키가 나와야 한다.
   - 정적 확인: `/`, `/z/<id>`, 없는 주소(404 페이지), `/data/*` 캐시 헤더가 전과 같은지 본다.
4. 폰(안드로이드 크롬, 또는 iOS 16.4+에서 홈 화면에 추가한 앱)으로 핀을 하나 꽂고 종 → '알림 받기'.
   다음 날 07:30(서울)에 새 소식이 있으면 알림이 온다.

되돌리기: 루트 `wrangler.jsonc`를 예전 내용(정적 자산만)으로 되돌려 푸시하면 끝. 앱은 `/api/push/key`가 404가 되면 버튼을 다시 숨긴다.

## 동작

| 주소 | 하는 일 |
|---|---|
| `GET /api/push/key` | VAPID 공개키 `{key}` |
| `POST /api/push/sub` | `{sub, zones, conds}` 저장(KV `sub:<엔드포인트 해시>`). 푸시 서비스 주소(FCM·Mozilla·Apple·Windows)만 받고, 다른 출처(Origin)는 거절 |
| `POST /api/push/unsub` | `{endpoint}` 지움 |
| cron 07:30~08:30(10분마다) | `/data/changes.json`에서 지난번 뒤로 새로 생긴 날의 사건을 골라 구독마다 하루 한 통 보낸다. 핀 구역의 단계·실거래·고시, 조건 핀의 금액 안으로 새로 들어온 구역(`price`, 기본 가정). 404·410이 오면 그 구독은 지운다 |

- 한 번 실행에 최대 45통(`PUSH_BATCH`, 무료 플랜 외부 요청 50개 한도). 구독이 더 많으면 KV `state.pend.after`에 **마지막으로 처리한 구독 키 이름**을 남기고 다음 실행이 그 뒤 키부터 잇는다
  (사이에 새 구독이 끼거나 410으로 지워져도 중복·누락 없음 · 사이클 5 fix A).
- cron은 아침 창 07:30~08:30(서울)에 10분마다 7번 돈다: `["30,40,50 22 * * *", "0,10,20,30 23 * * *"]`(루트 `wrangler.jsonc`가 실제 배포 설정). 그날 창을 다 보내면 `state.day`가 오늘이 되어 남은 실행은 0통 — 구독마다 하루 최대 1통.
  - 무료 플랜: 7번 × 45통 = 아침 315통까지. **구독이 300을 넘기 전에** Workers 유료 플랜으로 바꾸고 `vars`에 `"PUSH_BATCH": "400"`을 넣는다(7번 × 400 = 2,800통).
  - 그날 창을 다 못 보내면, 다음 날 아침 아직 못 받은 구독(키가 `pend.lag` 기록 뒤)에는 어제 창 시작부터 합쳐 한 통을 보낸다(최대 7일 · 하루 1통은 그대로).
  - 실행이 겹치지 않게 `state.run`(시작 시각)이 5분 안이면 그 실행은 쉰다.
- 법원 자료가 3일 넘게 묵은 매각기일(today.json `cts` 법원 수집일 · 줄 끝 마지막 확인일 중 늦은 날)은 D-1을 보내지 않는다(앱 일정 D-day 숨김과 같은 규칙).
- 주 1회 요약은 끈 종류 숫자를 빼고(거래·고시·인가·매각기일), 종류를 모두 껐거나 개인 소식도 받을 관심 구역(끈 구역 뺌)도 없으면 보내지 않는다.

### 배포 방법(소유자 확인)
- 푸시 Worker는 **따로 배포하지 않는다**. 루트 `wrangler.jsonc`(main `worker/index.js` · cron · KV)가 사이트와 한 Worker이고, **main 브랜치에 푸시하면 Cloudflare Git 연동(Workers Builds)이 배포**한다. GitHub Actions(daily.yml)는 데이터만 커밋하고 배포 명령은 없다.
- 그래서 cron 변경은 renew → main 병합·배포 때 함께 적용된다. 배포 뒤 Cloudflare 대시보드 → Workers → eolmamyeon → Settings → Triggers에서 Cron 7개 시각이 보이는지 확인한다(무료 플랜은 계정당 Cron Trigger 5개 한도 — 표현식은 2개라 괜찮다).
- 유료 플랜으로 바꾸면 `wrangler.jsonc`에 `"vars": { "PUSH_BATCH": "400" }`를 더해 main에 푸시한다.
- 데이터 갱신이 07:30 뒤에 끝난 날은 그 소식이 다음 날 아침에 함께 나간다(빠지는 것은 없다).
- 키를 환경 비밀값으로 고정하고 싶으면 `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`(base64url 원시값)·`VAPID_SUBJECT`를 넣으면 KV 키보다 먼저 쓴다. 키를 바꾸면 앱이 다음 방문 때 구독을 새 키로 다시 만든다.

## 시험

- `node worker/test.mjs`: RFC 8291 부록 A 벡터, 독립 구현 복호화 왕복, VAPID JWT 서명 검증, 라우트·검증, cron 매칭·410 정리·이어 보내기.
- 로컬 Worker: `npx wrangler dev -c worker/wrangler.push.jsonc --test-scheduled --var PUSH_TEST_HOSTS:127.0.0.1`
  (`PUSH_TEST_HOSTS`는 로컬 수신기로 보내 보는 시험용이라 배포 설정에는 넣지 않는다.)
  cron 실행: `curl "http://127.0.0.1:8787/cdn-cgi/handler/scheduled?cron=30,40,50+22+*+*+*"`

## 문의 양식(/api/contact) · 운영자 문의함(/admin.html) — 20차

- 방문자 양식(src/contact.js · 정적 페이지는 /cf.js)이 `POST /api/contact`로 보낸다. 메일 주소는 사이트 어디에도 없다.
- Worker(worker/contact.js) 검사: 종류(general·error·idea·etc) · 내용 10~2000자 · 이메일(선택) 꼴 · 허니팟 칸(website) · 같은 출처 · IP당 1시간 5번(IP는 그날 소금과 섞은 SHA-256 해시로만, 1시간 뒤 지워짐 · IP 원문은 저장 안 함).
- 저장: KV(PUSH) `msg:<ISO 시각>:<난수>` = {kind, text, email, zone, url, why, nums, asOf, ua, ts, read} · 180일 뒤 자동 삭제.
- 라우팅: wrangler.jsonc `assets.run_worker_first` = ["/api/push/*", "/api/contact", "/api/contact/*"].

### 운영자 토큰(배포 직후 한 번)
1. `curl https://jaegaebal.alwaysquestions.kr/api/contact/admin/init` → `{"token":"…"}` (KV `admin:tokenhash`가 없을 때 딱 한 번만. 그 뒤로는 늘 403). 토큰 원문은 어디에도 저장되지 않고 KV에는 SHA-256만 남는다.
2. 운영자 기기에서 `/admin.html`(어디에도 링크 없음 · noindex · 사이트맵·서비스 워커 저장 제외)을 열어 토큰을 한 번 넣는다 → 그 기기 localStorage(`zp.adminToken`)에만 저장.
3. 문의함: 최신순 목록(30개씩 · 더 보기) · 종류·시각·구역 링크·화면 숫자 · 이메일이 있으면 "…에 답장"(mailto) · 읽음 · 지우기.
4. "새 문의 알림 받기": 이 기기의 웹 푸시 구독을 KV `admin:sub`에 저장 → 새 문의마다 "새 문의 1건 · <종류>" 알림, 누르면 /admin.html.
- API(헤더 `Authorization: Bearer <토큰>`): GET /api/contact/admin/list?cursor=&limit= · POST /api/contact/admin/read {id} · POST /api/contact/admin/delete {id} · POST /api/contact/admin/sub {sub} · POST /api/contact/admin/unsub · GET /api/contact/admin/key
- 토큰을 잃어버리면: Cloudflare 대시보드 KV에서 `admin:tokenhash`를 지운 뒤 1번을 다시.
