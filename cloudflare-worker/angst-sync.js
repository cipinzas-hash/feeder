// angst-sync -- Cloudflare Worker
//
// Backend-for-frontend chico: el navegador (Angst, 100% cliente, todo su
// JS es visible en la página) no puede tener una credencial fuerte de
// GitHub sin exponerla a cualquiera. Este Worker sí puede -- vive server-
// side, sus secrets (GITHUB_PAT, AUTH_SECRET) nunca se le mandan al
// navegador ni se ven en ningún log.
//
// POST: Angst manda {"payload": {...}, "path": "opcional.json"} con header
// X-Angst-Auth. Si matchea el secret compartido, comitea `payload` a ese
// archivo en Angst-data (default state-backup.json si no se especifica).
//
// GET: Angst pide ?path=archivo.json (mismo header de auth). El Worker lee
// Angst-data con su propio GITHUB_PAT (el navegador no puede -- repo
// privado, raw.githubusercontent.com exige auth que el navegador no tiene)
// y devuelve el contenido ya decodificado. {"found": false} si no existe
// todavía, no es un error.
//
// El parámetro `path` permite reusar el mismo Worker para varios archivos
// en Angst-data (backup general del export de Angst, y más adelante cola
// de pendientes/estado sincronizado de Simkl) sin desplegar un Worker
// nuevo por cada uno.
//
// AUTH_SECRET es "seguridad liviana", no criptográfica -- cualquiera que
// lea el JS de Angst en el navegador podría en teoría verlo si algún día
// se hornea como constante ahí (por ahora no se hornea, se pide en runtime
// -- ver nota en el issue de integración cliente). Alcanza para frenar
// llamadas al azar contra la URL del Worker; no defiende contra alguien
// que específicamente ataque esta app puntual. Consistente con que Angst
// es una app personal de un solo usuario, no un producto multi-tenant.

const REPO = "cipinzas-hash/Angst-data";
const PATH = "state-backup.json";

export default {
  async fetch(request, env) {
    const auth = request.headers.get("X-Angst-Auth");
    if (!auth || auth !== env.AUTH_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const ghHeaders = {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "angst-sync-worker",
    };

    if (request.method === "GET") {
      // Lectura: el navegador no puede leer Angst-data directo (repo
      // privado, raw.githubusercontent.com exige auth) -- el Worker sí,
      // con su propio GITHUB_PAT, y se lo devuelve ya resuelto.
      const url = new URL(request.url);
      const path = url.searchParams.get("path") || PATH;
      const getResp = await fetch(
        `https://api.github.com/repos/${REPO}/contents/${path}`,
        { headers: ghHeaders }
      );
      if (getResp.status === 404) {
        return new Response(JSON.stringify({ found: false }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      if (!getResp.ok) {
        const errText = await getResp.text();
        return new Response(JSON.stringify({ error: "no se pudo leer", detail: errText }), { status: 502 });
      }
      const getData = await getResp.json();
      const decoded = decodeURIComponent(escape(atob(getData.content)));
      return new Response(decoded, {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
    }
    if (!body || typeof body.payload !== "object") {
      return new Response(JSON.stringify({ error: "falta 'payload' en el body" }), { status: 400 });
    }
    const path = body.path || PATH;

    // Necesita el sha actual del archivo para poder actualizarlo (si no
    // existe todavía, sha queda undefined -- GitHub lo crea directo).
    let sha;
    const getResp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      { headers: ghHeaders }
    );
    if (getResp.status === 200) {
      const getData = await getResp.json();
      sha = getData.sha;
    } else if (getResp.status !== 404) {
      const errText = await getResp.text();
      return new Response(JSON.stringify({ error: "no se pudo leer el archivo actual", detail: errText }), { status: 502 });
    }

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(body.payload, null, 2))));
    const putResp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Backup automático ${new Date().toISOString()}`,
          content,
          sha,
        }),
      }
    );

    if (!putResp.ok) {
      const errText = await putResp.text();
      return new Response(JSON.stringify({ error: "no se pudo commitear", detail: errText }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
