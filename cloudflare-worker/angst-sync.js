// angst-sync -- Cloudflare Worker
//
// Backend-for-frontend chico: el navegador (Angst, 100% cliente, todo su
// JS es visible en la página) no puede tener una credencial fuerte de
// GitHub sin exponerla a cualquiera. Este Worker sí puede -- vive server-
// side, sus secrets (GITHUB_PAT, AUTH_SECRET) nunca se le mandan al
// navegador ni se ven en ningún log.
//
// POST: Angst manda {"payload": {...}, "path": "opcional.json",
// "branch": "opcional (default main)", "amend": true/false} con header
// X-Angst-Auth. Si matchea el secret compartido, comitea `payload` a ese
// archivo en Angst-data (default state-backup.json si no se especifica).
//
// GET: Angst pide ?path=archivo.json&branch=opcional (mismo header de
// auth). El Worker lee Angst-data con su propio GITHUB_PAT (el navegador
// no puede -- repo privado, raw.githubusercontent.com exige auth que el
// navegador no tiene) y devuelve el contenido ya decodificado. {"found":
// false} si no existe todavía, no es un error.
//
// El parámetro `path` permite reusar el mismo Worker para varios archivos
// en Angst-data (backup general del export de Angst, cola de pendientes/
// estado sincronizado de Simkl, podcasts-config, pokecripto-pending) sin
// desplegar un Worker nuevo por cada uno.
//
// `branch` (14-sep-2026, sync de estado completo de la app): default
// "main" si se omite -- así ningún caller existente (Simkl, podcasts,
// pokecripto) cambia de comportamiento. Solo lo usa el sync de estado
// completo, en su propia rama `state-sync` -- separada de main a
// propósito, porque main tiene otros escritores (el bot de Pokécripto
// pushea ahí todos los días vía Actions) y el modo amend de abajo hace
// force-push del ref, destructivo si compite con otro escritor.
//
// `amend` (mismo motivo): en vez de crear un commit nuevo cada vez (POST
// normal, vía Contents API), reescribe el commit en la punta de la rama
// con la API de git de bajo nivel (blob->tree->commit->force-push del
// ref), mismo padre de siempre -- cero crecimiento de historial sin
// importar cuántas veces se guarde. GUARDA DE SEGURIDAD: se ignora
// silenciosamente (cae a POST normal) si branch=="main", así no hay forma
// de que un bug de cliente fuerce un push destructivo sobre la rama
// compartida por accidente.
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
const DEFAULT_BRANCH = "main";

// CORS: el navegador llama a este Worker desde un origen distinto
// (cipinzas-hash.github.io -> *.workers.dev). Sin estos headers, el
// navegador bloquea la respuesta ANTES de que el código JS la vea --
// nunca llega a ser "401" ni "200" ni nada, es un fetch() que revienta
// directo con un error de red genérico, sin importar que el
// X-Angst-Auth esté perfecto. El preflight (OPTIONS) también hay que
// contestarlo explícito -- el navegador lo manda solo antes del POST/GET
// real porque van con headers custom (X-Angst-Auth, Content-Type).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "X-Angst-Auth, Content-Type",
};
function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

async function gh(path, ghHeaders, opts) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, { headers: ghHeaders, ...(opts || {}) });
}

// Modo amend real: reescribe el commit en la punta de `branch` en vez de
// apilar uno nuevo. Mismo padre de siempre -- la rama nunca crece.
async function amendCommit(path, branch, payloadStr, ghHeaders) {
  const refResp = await gh(`/git/ref/heads/${branch}`, ghHeaders);
  if (!refResp.ok) return { error: "no se pudo leer el ref de la rama", detail: await refResp.text() };
  const refData = await refResp.json();
  const tipSha = refData.object.sha;

  const commitResp = await gh(`/git/commits/${tipSha}`, ghHeaders);
  if (!commitResp.ok) return { error: "no se pudo leer el commit en la punta", detail: await commitResp.text() };
  const commitData = await commitResp.json();
  const parentSha = commitData.parents?.[0]?.sha; // undefined si es el primer commit de la rama -- ok, commit sin padre
  const baseTreeSha = commitData.tree.sha;

  const blobResp = await gh(`/git/blobs`, ghHeaders, {
    method: "POST",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ content: payloadStr, encoding: "utf-8" }),
  });
  if (!blobResp.ok) return { error: "no se pudo crear el blob", detail: await blobResp.text() };
  const blobSha = (await blobResp.json()).sha;

  const treeResp = await gh(`/git/trees`, ghHeaders, {
    method: "POST",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: [{ path, mode: "100644", type: "blob", sha: blobSha }] }),
  });
  if (!treeResp.ok) return { error: "no se pudo crear el tree", detail: await treeResp.text() };
  const treeSha = (await treeResp.json()).sha;

  const newCommitResp = await gh(`/git/commits`, ghHeaders, {
    method: "POST",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Sync de estado ${new Date().toISOString()}`,
      tree: treeSha,
      parents: parentSha ? [parentSha] : [],
    }),
  });
  if (!newCommitResp.ok) return { error: "no se pudo crear el commit", detail: await newCommitResp.text() };
  const newCommitSha = (await newCommitResp.json()).sha;

  const updateRefResp = await gh(`/git/refs/heads/${branch}`, ghHeaders, {
    method: "PATCH",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ sha: newCommitSha, force: true }),
  });
  if (!updateRefResp.ok) return { error: "no se pudo actualizar el ref (force-push)", detail: await updateRefResp.text() };

  return { ok: true };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const auth = request.headers.get("X-Angst-Auth");
    if (!auth || auth !== env.AUTH_SECRET) {
      return withCors(new Response("Unauthorized", { status: 401 }));
    }

    const ghHeaders = {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "angst-sync-worker",
    };

    if (request.method === "GET") {
      const url = new URL(request.url);
      const path = url.searchParams.get("path") || PATH;
      const branch = url.searchParams.get("branch") || DEFAULT_BRANCH;
      const getResp = await gh(`/contents/${path}?ref=${branch}`, ghHeaders);
      if (getResp.status === 404) {
        return withCors(new Response(JSON.stringify({ found: false }), {
          status: 200, headers: { "Content-Type": "application/json" },
        }));
      }
      if (!getResp.ok) {
        const errText = await getResp.text();
        return withCors(new Response(JSON.stringify({ error: "no se pudo leer", detail: errText }), { status: 502 }));
      }
      const getData = await getResp.json();
      let b64;
      if (getData.encoding === "base64" && getData.content) {
        // Camino rápido -- archivos <1MB (Simkl/podcasts/Pokécripto y la
        // mayoría de las lecturas). Sin cambios de comportamiento acá.
        b64 = getData.content;
      } else {
        // La Contents API omite `content` (encoding:"none") para archivos
        // >1MB -- pasó con angst-full-state.json (2.46MB). La API de git
        // de bajo nivel (ya usada en amendCommit) no tiene ese techo, sirve
        // hasta 100MB: se pide el mismo blob por sha directo.
        const blobResp = await gh(`/git/blobs/${getData.sha}`, ghHeaders);
        if (!blobResp.ok) {
          const errText = await blobResp.text();
          return withCors(new Response(JSON.stringify({ error: "no se pudo leer el blob (archivo grande)", detail: errText }), { status: 502 }));
        }
        b64 = (await blobResp.json()).content;
      }
      // El blob de git viene con saltos de línea cada 60 caracteres --
      // atob() los tolera en runtimes modernos (forgiving-base64), pero
      // se limpian igual por las dudas.
      const decoded = decodeURIComponent(escape(atob(b64.replace(/\s+/g, ""))));
      return withCors(new Response(decoded, {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }

    if (request.method !== "POST") {
      return withCors(new Response("Method not allowed", { status: 405 }));
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return withCors(new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 }));
    }
    if (!body || typeof body.payload !== "object") {
      return withCors(new Response(JSON.stringify({ error: "falta 'payload' en el body" }), { status: 400 }));
    }
    const path = body.path || PATH;
    const branch = body.branch || DEFAULT_BRANCH;
    const payloadStr = JSON.stringify(body.payload, null, 2);

    if (body.amend === true && branch !== DEFAULT_BRANCH) {
      const result = await amendCommit(path, branch, payloadStr, ghHeaders);
      if (result.error) return withCors(new Response(JSON.stringify(result), { status: 502 }));
      return withCors(new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    }

    let sha;
    const getResp = await gh(`/contents/${path}?ref=${branch}`, ghHeaders);
    if (getResp.status === 200) {
      const getData = await getResp.json();
      sha = getData.sha;
    } else if (getResp.status !== 404) {
      const errText = await getResp.text();
      return withCors(new Response(JSON.stringify({ error: "no se pudo leer el archivo actual", detail: errText }), { status: 502 }));
    }

    const content = btoa(unescape(encodeURIComponent(payloadStr)));
    const putResp = await gh(`/contents/${path}`, ghHeaders, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Backup automático ${new Date().toISOString()}`,
        content,
        sha,
        branch,
      }),
    });

    if (!putResp.ok) {
      const errText = await putResp.text();
      return withCors(new Response(JSON.stringify({ error: "no se pudo commitear", detail: errText }), { status: 502 }));
    }

    return withCors(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  },
};
