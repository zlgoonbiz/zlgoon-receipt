function genId() {
  return Math.random().toString(36).slice(2, 8);
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  let getStore;
  try {
    ({ getStore } = require("@netlify/blobs"));
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "blobs_module_missing", detail: e.message }) };
  }

  const siteID =
    process.env.NETLIFY_SITE_ID ||
    process.env.SITE_ID ||
    process.env.NETLIFY_SITE_ID_OVERRIDE;
  const token =
    process.env.NETLIFY_API_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN ||
    process.env.NETLIFY_TOKEN;

  let store;
  if (siteID && token) {
    try {
      store = getStore({ name: "zlgoon-receipts", siteID: siteID, token: token });
    } catch (e2) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "blobs_manual_init_failed", detail: String(e2 && e2.message || e2) }),
      };
    }
  } else {
    try {
      store = getStore("zlgoon-receipts");
    } catch (e1) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "blobs_env_missing",
          detail:
            "자동 컨텍스트 실패 + NETLIFY_SITE_ID/NETLIFY_API_TOKEN 환경변수도 없음: " +
            String(e1 && e1.message || e1),
        }),
      };
    }
  }

  const path = event.path.replace("/.netlify/functions/receipts", "").replace("/api/receipts", "");
  const id = path.replace(/^\//, "").trim();

  try {
    if (event.httpMethod === "GET" && id) {
      const data = await store.get(id, { type: "json" });
      if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: "not_found" }) };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === "GET" && !id) {
      const { blobs } = await store.list();
      const items = await Promise.all(
        blobs.map(async (b) => await store.get(b.key, { type: "json" }))
      );
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { statusCode: 200, headers, body: JSON.stringify(items) };
    }

    if (event.httpMethod === "POST" && !id) {
      const body = JSON.parse(event.body || "{}");
      const newId = genId();
      const rec = { ...body, id: newId, status: "pending", createdAt: new Date().toISOString() };
      await store.setJSON(newId, rec);
      return { statusCode: 200, headers, body: JSON.stringify(rec) };
    }

    if (event.httpMethod === "POST" && id) {
      const existing = await store.get(id, { type: "json" });
      if (!existing) return { statusCode: 404, headers, body: JSON.stringify({ error: "not_found" }) };
      const body = JSON.parse(event.body || "{}");
      const updated = {
        ...existing,
        ...body,
        status: "signed",
        signedAt: new Date().toISOString(),
      };
      await store.setJSON(id, updated);
      return { statusCode: 200, headers, body: JSON.stringify(updated) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "method_not_allowed" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
