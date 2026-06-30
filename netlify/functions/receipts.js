const { getStore } = require("@netlify/blobs");

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

  const store = getStore("zlgoon-receipts");
  const path = event.path.replace("/.netlify/functions/receipts", "").replace("/api/receipts", "");
  const id = path.replace("/", "").trim();

  try {
    // ── GET 단건 조회 ──
    if (event.httpMethod === "GET" && id) {
      const data = await store.get(id, { type: "json" });
      if (!data) return { statusCode: 404, headers, body: JSON.stringify({ error: "not_found" }) };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // ── GET 전체 목록 ──
    if (event.httpMethod === "GET" && !id) {
      const { blobs } = await store.list();
      const items = await Promise.all(
        blobs.map(async (b) => await store.get(b.key, { type: "json" }))
      );
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { statusCode: 200, headers, body: JSON.stringify(items) };
    }

    // ── POST 신규 생성 ──
    if (event.httpMethod === "POST" && !id) {
      const body = JSON.parse(event.body || "{}");
      const newId = genId();
      const rec = { ...body, id: newId, status: "pending", createdAt: new Date().toISOString() };
      await store.setJSON(newId, rec);
      return { statusCode: 200, headers, body: JSON.stringify(rec) };
    }

    // ── PUT/POST 서명 업데이트 ──
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
