// netlify/functions/site.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function renderPage(row) {
  const services = Array.isArray(row.services) ? row.services : [];
  const reviewHref = row.google_place
    ? (row.google_place.startsWith("http")
        ? row.google_place
        : `https://search.google.com/local/reviews?placeid=${encodeURIComponent(row.google_place)}`)
    : null;

  return `<!doctype html><html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${row.title || "Mijn zaak"} — Vrijeplek</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
<style>
body{margin:0;background:linear-gradient(180deg,#e9f2ff,#f6f9ff);font-family:Poppins,Arial,sans-serif;color:#0a2a4a}
.wrap{max-width:900px;margin:32px auto;padding:0 12px}
.card{padding:16px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.8),rgba(255,255,255,.55));border:1px solid rgba(26,102,255,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 8px 30px rgba(10,27,90,.08)}
.h{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.badge{padding:4px 10px;border-radius:999px;background:#fff;border:1px solid rgba(26,102,255,.28);font-weight:700;font-size:12px;color:#0a2a4a}
.btn{display:inline-block;padding:10px 18px;border-radius:999px;background:linear-gradient(120deg,#1a66ff,#0056ff);color:#fff;text-decoration:none;font-weight:700}
ul{margin:8px 0 0 18px}.footer{margin-top:18px;font-size:12px;color:#5b6b86}
</style></head><body>
<div class="wrap"><div class="card">
  <div class="h"><h1 style="margin:0;font-size:22px;">${row.title || "Mijn zaak"}</h1><span class="badge">Vrijeplek</span></div>
  ${row.tagline ? `<p style="margin:0 0 8px;color:#1f2a44;">${row.tagline}</p>` : ""}
  ${row.about ? `<p style="margin:0 0 12px;color:#1f2a4a;">${row.about.replace(/</g,"&lt;")}</p>` : ""}
  ${services.length ? `<h3 style="margin:10px 0 6px;">Diensten</h3><ul>${services.map(s=>`<li>${String(s).replace(/</g,"&lt;")}</li>`).join("")}</ul>` : ""}
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
    ${row.phone ? `<a class="btn" href="tel:${row.phone}">Bel ons</a>` : ""}
    ${row.website ? `<a class="btn" href="${/^https?:\\/\\//i.test(row.website) ? row.website : "https://"+row.website}" target="_blank" rel="noopener">Website</a>` : ""}
    ${row.show_google_reviews && reviewHref ? `<a class="btn" href="${reviewHref}" target="_blank" rel="noopener">Google reviews</a>` : ""}
  </div>
  <div class="footer">Gemaakt met Vrijeplek — https://www.vrijeplek.be/websitevanklant/${row.slug}</div>
</div></div></body></html>`;
}

export async function handler(event) {
  try {
    const slug = (event.queryStringParameters && event.queryStringParameters.slug) || "";
    if (!slug) return { statusCode: 400, body: "Missing slug" };

    const { data, error } = await supabase
      .from("sites")
      .select("slug,title,tagline,about,services,phone,website,theme,show_google_reviews,google_place,is_public")
      .eq("slug", slug)
      .eq("is_public", true)
      .limit(1)
      .maybeSingle();

    if (error) return { statusCode: 500, body: "DB error" };
    if (!data) return { statusCode: 404, body: "Not found" };

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=120" },
      body: renderPage(data),
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: "Server error" };
  }
}
