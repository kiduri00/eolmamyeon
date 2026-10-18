// 집핀 Worker: /api/push/* · /api/contact* 만 여기로 온다(assets.run_worker_first). 그 밖은 정적 자산이 먼저 응답하고,
// 혹시 여기로 와도 env.ASSETS.fetch로 그대로 넘긴다 → 정적 서비스는 지금과 같다.
import { handleFetch, runCron } from "./push.js";
import { handleContact } from "./contact.js";

export default {
  async fetch(req, env, ctx) {
    try {
      const p = new URL(req.url).pathname;
      if (p === "/api/contact" || p === "/api/contact/" || p.startsWith("/api/contact/")) return await handleContact(req, env, ctx);   // 사이트 안 문의 양식(worker/contact.js)
      return await handleFetch(req, env);
    }
    catch (e) { return new Response(JSON.stringify({ error: "server" }), { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
  },
  async scheduled(ev, env, ctx) {
    ctx.waitUntil(runCron(env).then((r) => console.log("push cron", JSON.stringify(r))).catch((e) => console.error("push cron failed", e && e.message)));
  },
};
