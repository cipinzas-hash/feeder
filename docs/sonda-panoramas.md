# Sonda — módulo Panoramas (issue #17)

Generado: 2026-11-13T23:49:38.562Z

Clave del veredicto: **A** API/JSON/ICS · **B** JSON-LD · **C** HTML (scraping) · **✗** no responde.

| Fuente | HTTP | Motor | Veredicto |
|---|---|---|---|
| Red Nacional (SNPC) — artdec.gob.cl | 200 | Drupal 10 (https://www.drupal.org), Drupal | A? · endpoints candidatos en el código JS (ver lista) |
| Santiago Cultura (Municipalidad de Santiago) | 200 | WordPress (wp-content) | A− · API WordPress (revisar si hay tipo de contenido de eventos) |
| Noche de Museos (plataforma nacional) | 200 | Nuxt | A? · endpoints candidatos en el código JS (ver lista) |
| Gobierno de Santiago / Región Metropolitana | 200 | WordPress 7.1.4, WordPress (wp-content) | A/B · ICS o RSS enlazado desde la página |
| Teatro Municipal — ticketera | 200 | Nuxt | C · HTML (scraping) |
| GAM *(URL supuesta)* | 200 | — | C · HTML (scraping) |
| Matucana 100 *(URL supuesta)* | 200 | WordPress 5.5.24, WordPress (wp-content) | A− · API WordPress (revisar si hay tipo de contenido de eventos) |
| Centro Cultural La Moneda *(URL supuesta)* | 200 | WordPress 6.9.11, WordPress (wp-content) | A/B · ICS o RSS enlazado desde la página |
| Municipalidad de Recoleta *(URL supuesta)* | 403 | — | ✗ no responde / URL por descubrir |
| Municipalidad de Providencia *(URL supuesta)* | 200 | — | A? · endpoints candidatos en el código JS (ver lista) |
| Municipalidad de Quinta Normal *(URL supuesta)* | fetch failed | — | ✗ no responde / URL por descubrir |
| SeSale! (agregador) *(URL supuesta)* | 200 | — | A? · endpoints candidatos en el código JS (ver lista) |
| Panoramas.app (agregador) *(URL supuesta)* | 200 | — | A? · endpoints candidatos en el código JS (ver lista) |

## Red Nacional (SNPC) — artdec.gob.cl

- Base: https://www.artdec.gob.cl
- Página `https://www.artdec.gob.cl/cartelera/red-nacional` → 200, 52606 B
- JSON-LD: 0 bloques, tipos [], eventos 0
- Endpoints candidatos en HTML/JS: `https://api.whatsapp.com/send?text=https://www.mnhn.gob.cl/cartelera/mariposas-y-polillas-colores-en-movimiento`, `https://api.whatsapp.com/send?text=https://www.mnba.gob.cl/cartelera/roberto-matta-abrir-la-mirada`, `https://api.whatsapp.com/send?text=https://www.bibliotecanacional.gob.cl/cartelera/exposicion-el-mundo-en-una-biblioteca-cien-anos-de-la-donacion-de-jose-toribio-medina`, `https://api.whatsapp.com/send?text=https://www.bibliotecanacional.gob.cl/cartelera/un-archivo-en-construccion-la-obra-de-tito-vasquez`, `https://api.whatsapp.com/send?text=https://www.mnba.gob.cl/cartelera/145-anos-historias-de-una-coleccion`, `https://api.whatsapp.com/send?text=https://www.mnhn.gob.cl/cartelera/vitrina-colecciones-arqueologicas-y-su-estudio-en-el-mnhn`, `https://api.whatsapp.com/send?text=https://www.mnhn.gob.cl/cartelera/vertebrados-anatomia-evolucion-extincion`, `https://api.whatsapp.com/send?text=https://www.mhnv.gob.cl/cartelera/craneos-esenciales-para-la-vida`, `https://api.whatsapp.com/send?text=https://www.mhn.gob.cl/cartelera/atencion-catalogo-fotografico-previa-cita`, `https://api.whatsapp.com/send?text=https://www.mhn.gob.cl/cartelera/podcast-la-hora-del-museo-del-museo-historico-nacional`
- Formularios: GET /buscar [texto] · GET /cartelera/red-nacional [region, tipo_evento, presencial_o_virtual]
- Probes:
  - wp-json raíz: 404
  - The Events Calendar (API): 404
  - tipos de contenido WP: 404
  - RSS /feed/: 404
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 200 JSON
  - sitemap.xml: 200 sitemap(1 URLs)
  - robots.txt: 200

## Santiago Cultura (Municipalidad de Santiago)

- Base: https://www.santiagocultura.cl
- Página `https://www.santiagocultura.cl/agenda-cultural/` → 200, 75041 B
- JSON-LD: 0 bloques, tipos [], eventos 0
- Enlaces de datos: ICS [] · alternates [{"href":"https://www.santiagocultura.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.santiagocultura.cl%2Fagenda-cultural%2F","type":"application/json+oembed"},{"href":"https://www.santiagocultura.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.santiagocultura.cl%2Fagenda-cultural%2F&#038;format=xml","type":"text/xml+oembed"},{"href":"https://www.santiagocultura.cl/wp-json/wp/v2/pages/40","type":"application/json"}]
- Endpoints candidatos en HTML/JS: `https://www.santiagocultura.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.santiagocultura.cl%2Fagenda-cultural%2F`, `https://www.santiagocultura.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.santiagocultura.cl%2Fagenda-cultural%2F&#038;format=xml`, `https://api.w.org/`, `https://www.santiagocultura.cl/wp-json/`, `https://www.santiagocultura.cl/wp-json/wp/v2/pages/40`, `https://fonts.googleapis.com/css?family=Noto+Sans:400,400italic,700|Poppins:700,800,900&#038;subset=latin%2Clatin-ext&#038;ver=4.9.10`, `https://meet.jit.si/external_api.js?ver=4.9.10`, `https://www.santiagocultura.cl/wp-json/eventon/v1/data?evo-ajax=%%endpoint%%`
- Formularios: GET https://www.santiagocultura.cl/ [s] · GET https://www.santiagocultura.cl/ [s]
- Probes:
  - wp-json raíz: 200 JSON ns=[oembed/1.0,wordfence-login-security/v1,wordfence/v1,eventon/v1,evo-admin,wp/v2]
  - The Events Calendar (API): 404
  - tipos de contenido WP: 200 JSON
  - RSS /feed/: 200 feed(12)
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 404
  - sitemap.xml: 200 sitemap(9 URLs)
  - robots.txt: 200 · robots bloquea todo

## Noche de Museos (plataforma nacional)

- Base: https://www.nochedemuseos.cl
- Página `https://www.nochedemuseos.cl/` → 200 (redirige a https://nochedemuseos.cl/), 216097 B
- JSON-LD: 0 bloques, tipos [], eventos 0
- Endpoints candidatos en HTML/JS: `https://fonts.googleapis.com`, `https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Slab:wght@400;500;700&display=swap`, `https://api.nochedemuseos.cl`
- Probes:
  - wp-json raíz: 404
  - The Events Calendar (API): 404
  - tipos de contenido WP: 404
  - RSS /feed/: 404
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 404
  - sitemap.xml: 404
  - robots.txt: 200

## Gobierno de Santiago / Región Metropolitana

- Base: https://www.gobiernosantiago.cl
- Página `https://www.gobiernosantiago.cl/` → 200, 204437 B
- JSON-LD: 1 bloques, tipos [Person, Organization, WebSite, WebPage, Article], eventos 0
- Enlaces de datos: ICS [] · alternates [{"href":"https://www.gobiernosantiago.cl/feed/","type":"application/rss+xml"},{"href":"https://www.gobiernosantiago.cl/comments/feed/","type":"application/rss+xml"},{"href":"https://www.gobiernosantiago.cl/pagina-de-ejemplo/feed/","type":"application/rss+xml"},{"href":"https://www.gobiernosantiago.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.gobiernosantiago.cl%2F","type":"application/json+oembed"},{"href":"https://www.gobiernosantiago.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.gobiernosantiago.cl%2F&#038;format=xml","type":"text/xml+oembed"},{"href":"https://www.gobiernosantiago.cl/wp-json/wp/v2/pages/2","type":"application/json"}]
- Endpoints candidatos en HTML/JS: `https://www.gobiernosantiago.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.gobiernosantiago.cl%2F`, `https://www.gobiernosantiago.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.gobiernosantiago.cl%2F&#038;format=xml`, `https://api.w.org/`, `https://www.gobiernosantiago.cl/wp-json/`, `https://www.gobiernosantiago.cl/wp-json/wp/v2/pages/2`, `https://fonts.googleapis.com`, `https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap`
- Formularios: GET http://localhost/wordpress [s] · GET https://www.gobiernosantiago.cl/ [s]
- Probes:
  - wp-json raíz: 200 JSON ns=[oembed/1.0,contact-form-7/v1,rankmath/v1,rankmath/v1/setupWizard,string-locator/v1,wpvibe/v1]
  - The Events Calendar (API): 404
  - tipos de contenido WP: 200 JSON
  - RSS /feed/: 200 feed(10)
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 404
  - sitemap.xml: 404
  - robots.txt: 200

## Teatro Municipal — ticketera

- Base: https://ticketera.municipal.cl
- Página `https://ticketera.municipal.cl/entradas` → 200, 2117022 B
- JSON-LD: 0 bloques, tipos [], eventos 0
- Probes:
  - wp-json raíz: 200
  - The Events Calendar (API): 404
  - tipos de contenido WP: 404
  - RSS /feed/: 200
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 200
  - sitemap.xml: 200
  - robots.txt: 404

## GAM

- Base: https://gam.cl
- Página `https://gam.cl/` → 200 (redirige a https://gam.cl/es/), 60863 B
- JSON-LD: 0 bloques, tipos [], eventos 0
- Formularios: POST /es/inscripcion/ [email] · POST /es/inscripcion/ [email]
- Probes:
  - wp-json raíz: 404
  - The Events Calendar (API): 404
  - tipos de contenido WP: 404
  - RSS /feed/: 404
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 404
  - sitemap.xml: 500
  - robots.txt: 200

## Matucana 100

- Base: https://m100.cl
- Página `https://m100.cl/` → 200 (redirige a https://www.m100.cl/), 161451 B
- JSON-LD: 0 bloques, tipos [], eventos 0
- Endpoints candidatos en HTML/JS: `https://fonts.googleapis.com/css?family=Nunito+Sans%3A400%2C400i%2C700%2C700i%7CPoppins%3A400%2C400i%2C500%2C600%2C600i&#038;subset=latin`, `https://api.w.org/`, `https://www.m100.cl/wp-json/`, `https://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js`, `https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js`
- Formularios: GET https://www.m100.cl/ [s]
- Probes:
  - wp-json raíz: 200 JSON ns=[oembed/1.0,contact-form-7/v1,wpdm,social-share/v1,recommend-post-smtp,quadlayers/wp-whatsapp-chat]
  - The Events Calendar (API): 404
  - tipos de contenido WP: 200 JSON
  - RSS /feed/: 404
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 404
  - sitemap.xml: 404
  - robots.txt: 200

## Centro Cultural La Moneda

- Base: https://www.cclm.cl
- Página `https://www.cclm.cl/` → 200, 77451 B
- JSON-LD: 1 bloques, tipos [WebPage, BreadcrumbList, WebSite], eventos 0
- Enlaces de datos: ICS [] · alternates [{"href":"https://www.cclm.cl/feed/","type":"application/rss+xml"},{"href":"https://www.cclm.cl/comments/feed/","type":"application/rss+xml"},{"href":"https://www.cclm.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.cclm.cl%2F","type":"application/json+oembed"},{"href":"https://www.cclm.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.cclm.cl%2F&#038;format=xml","type":"text/xml+oembed"},{"href":"https://www.cclm.cl/wp-json/wp/v2/pages/8","type":"application/json"}]
- Endpoints candidatos en HTML/JS: `https://www.cclm.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.cclm.cl%2F`, `https://www.cclm.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.cclm.cl%2F&#038;format=xml`, `https://api.w.org/`, `https://www.cclm.cl/wp-json/`, `https://www.cclm.cl/wp-json/wp/v2/pages/8`, `https://fonts.googleapis.com/css?family=PT+Serif:400,400i,700,700i&display=swap`, `https://fonts.googleapis.com/css?family=Roboto:300,400,500&display=swap`, `https://fonts.googleapis.com/icon?family=Material+Icons`, `https://www.cclm.cl/wp-json/subscribe/newsletter`, `https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?`
- Formularios: GET / [s] · GET / [s] · POST https://www.cclm.cl/wp-json/subscribe/newsletter [suscription-name, suscription-email]
- Probes:
  - wp-json raíz: 200 JSON ns=[oembed/1.0,simple-history/v1,yoast/v1,duplicate-post/v1,check,format]
  - The Events Calendar (API): 404
  - tipos de contenido WP: 200 JSON
  - RSS /feed/: 200 feed(10)
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 404
  - sitemap.xml: 200 sitemap(24 URLs)
  - robots.txt: 200

## Municipalidad de Recoleta

- Base: https://www.recoleta.cl
- Página `https://www.recoleta.cl/` → 403, 134 B

## Municipalidad de Providencia

- Base: https://www.providencia.cl
- Página `https://www.providencia.cl/` → 200 (redirige a https://providencia.cl/provi/site/edic/base/port/inicio.html), 93207 B
- JSON-LD: 0 bloques, tipos [], eventos 0
- Endpoints candidatos en HTML/JS: `https://fonts.googleapis.com/css?family=Raleway:400,500,700,800,800i&display=swap`, `https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap`
- Formularios: GET /cgi-bin/prontus_search.cgi [search_texto]
- Probes:
  - wp-json raíz: 404
  - The Events Calendar (API): 404
  - tipos de contenido WP: 404
  - RSS /feed/: 404
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 404
  - sitemap.xml: 404
  - robots.txt: 404

## Municipalidad de Quinta Normal

- Base: https://www.muniqn.cl
- Página `https://www.muniqn.cl/` → fetch failed, 0 B

## SeSale! (agregador)

- Base: https://www.sesale.cl
- Página `https://www.sesale.cl/` → 200 (redirige a https://sesale.cl/), 1918 B
- JSON-LD: 0 bloques, tipos [], eventos 0
- Endpoints candidatos en HTML/JS: `https://sesale.cl/api`, `/api/uploads/images/sesale-santander-v2.jpg`, `/api`, `/api${e}`
- Probes:
  - wp-json raíz: 200
  - The Events Calendar (API): 200
  - tipos de contenido WP: 200
  - RSS /feed/: 200
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 200
  - sitemap.xml: 200 sitemap(1 URLs)
  - robots.txt: 200

## Panoramas.app (agregador)

- Base: https://panoramas.app
- Página `https://panoramas.app/` → 200 (redirige a https://www.panoramas.app/), 737057 B
- JSON-LD: 2 bloques, tipos [WebSite, Organization, FAQPage], eventos 0
- Endpoints candidatos en HTML/JS: `https://fonts.googleapis.com`, `https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800;900&amp;family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&amp;display=optional`, `https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800;900`, `https://www.passline.com/imagenes/eventos/terapia-extendida-colectivo-niebla-572492-rec.jpg`, `https://www.passline.com/imagenes/eventos/tributo-silvio-rodriguez-por-tito-tapia-en-mystic-valley-568945-rec.jpg`, `https://www.passline.com/imagenes/eventos/popurrisas-presenta-risoterapia-566502-rec.jpg`, `https://www.passline.com/imagenes/eventos/capitan-memo-en-concierto-507230-rec.jpg`, `https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams`, `https://firebaseinstallations.googleapis.com/v1/projects/${e}/installations`, `https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig`
- Probes:
  - wp-json raíz: 403
  - The Events Calendar (API): 403
  - tipos de contenido WP: 403
  - RSS /feed/: 404
  - ICS The Events Calendar: 200
  - Drupal JSON:API: 404
  - sitemap.xml: 200 sitemap(1274 URLs)
  - robots.txt: 200

## Profundización

```json
{
 "artdec": {
  "filtros": [
   {
    "method": "get",
    "action": "/buscar",
    "campos": [
     {
      "tipo": "input:text",
      "name": "texto"
     }
    ]
   },
   {
    "method": "get",
    "action": "/cartelera/red-nacional",
    "campos": [
     {
      "tipo": "select",
      "name": "region",
      "opciones": [
       {
        "value": "",
        "texto": "- Cualquiera -"
       },
       {
        "value": "AN",
        "texto": "Antofagasta"
       },
       {
        "value": "AR",
        "texto": "Araucanía"
       },
       {
        "value": "AP",
        "texto": "Arica y Parinacota"
       },
       {
        "value": "AT",
        "texto": "Atacama"
       },
       {
        "value": "AI",
        "texto": "Aysén del General Carlos Ibáñez del Campo"
       },
       {
        "value": "BI",
        "texto": "Biobío"
       },
       {
        "value": "CO",
        "texto": "Coquimbo"
       },
       {
        "value": "LI",
        "texto": "Libertador General Bernardo O&#039;Higgins"
       },
       {
        "value": "LL",
        "texto": "Los Lagos"
       },
       {
        "value": "LR",
        "texto": "Los Ríos"
       },
       {
        "value": "MA",
        "texto": "Magallanes y de la Antártica Chilena"
       },
       {
        "value": "ML",
        "texto": "Maule"
       },
       {
        "value": "RM",
        "texto": "Metropolitana de Santiago"
       },
       {
        "value": "NB",
        "texto": "Ñuble"
       },
       {
        "value": "TA",
        "texto": "Tarapacá"
       },
       {
        "value": "VS",
        "texto": "Valparaíso"
       }
      ],
      "totalOpciones": 17
     },
     {
      "tipo": "select",
      "name": "tipo_evento",
      "opciones": [
       {
        "value": "All",
        "texto": "- Cualquiera -"
       },
       {
        "value": "capacitacion",
        "texto": "Capacitación"
       },
       {
        "value": "charla",
        "texto": "Charla"
       },
       {
        "value": "ciclo",
        "texto": "Ciclo"
       },
       {
        "value": "concurso",
        "texto": "Concurso"
       },
       {
        "value": "convocatoria",
        "texto": "Convocatoria"
       },
       {
        "value": "curso",
        "texto": "Curso"
       },
       {
        "value": "encuentro",
        "texto": "Encuentro"
       },
       {
        "value": "evento-especial",
        "texto": "Evento especial"
       },
       {
        "value": "exposicion",
        "texto": "Exposición"
       },
       {
        "value": "inauguracion",
        "texto": "Inauguración"
       },
       {
        "value": "lanzamiento",
        "texto": "Lanzamiento"
       },
       {
        "value": "taller",
        "texto": "Taller"
       },
       {
        "value": "visita-guiada",
        "texto": "Visita guiada"
       },
       {
        "value": "otro",
        "texto": "Otro"
       }
      ],
      "totalOpciones": 15
     },
     {
      "tipo": "select",
      "name": "presencial_o_virtual",
      "opciones": [
       {
        "value": "All",
        "texto": "- Cualquiera -"
       },
       {
        "value": "presencial",
        "texto": "Presencial"
       },
       {
        "value": "virtual",
        "texto": "Virtual"
       }
      ],
      "totalOpciones": 3
     }
    ]
   }
  ],
  "regionParam": {
   "name": "region",
   "value": "RM"
  },
  "paginas": [
   {
    "url": "https://www.artdec.gob.cl/cartelera/red-nacional",
    "viewsRow": 10,
    "hastaEl": 10,
    "eventoVigente": 10
   },
   {
    "url": "https://www.artdec.gob.cl/cartelera/red-nacional?region=RM",
    "status": 200,
    "viewsRow": 10,
    "hastaEl": 10,
    "eventoVigente": 10
   },
   {
    "url": "https://www.artdec.gob.cl/cartelera/red-nacional?region=RM&page=1",
    "status": 200,
    "viewsRow": 10,
    "hastaEl": 10,
    "eventoVigente": 10
   }
  ]
 },
 "santiagocultura": {
  "enlacesDeEventos": [
   "https://www.santiagocultura.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.santiagocultura.cl%2Fagenda-cultural%2F",
   "https://www.santiagocultura.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.santiagocultura.cl%2Fagenda-cultural%2F&#038;format=xml",
   "https://www.santiagocultura.cl/wp-content/plugins/eventon-full-cal/assets/fc_styles.css?ver=2.2.1",
   "https://www.santiagocultura.cl/wp-content/uploads/2024/12/favicon-150x150.png",
   "https://www.santiagocultura.cl/wp-content/uploads/2024/12/favicon-200x200.png"
  ],
  "formularios": [
   {
    "method": "get",
    "action": "https://www.santiagocultura.cl/",
    "campos": [
     {
      "tipo": "input:search",
      "name": "s"
     }
    ]
   },
   {
    "method": "get",
    "action": "https://www.santiagocultura.cl/",
    "campos": [
     {
      "tipo": "input:search",
      "name": "s"
     }
    ]
   }
  ],
  "detalle": {
   "url": "https://www.santiagocultura.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.santiagocultura.cl%2Fagenda-cultural%2F",
   "status": 200,
   "jsonLd": {
    "bloques": 0,
    "tipos": [],
    "eventos": 0,
    "muestra": []
   },
   "motor": [
    "WordPress (wp-content)"
   ]
  },
  "tiposWP": [
   {
    "k": "post",
    "rest_base": "posts",
    "nombre": "Entradas"
   },
   {
    "k": "page",
    "rest_base": "pages",
    "nombre": "Páginas"
   },
   {
    "k": "attachment",
    "rest_base": "media",
    "nombre": "Medios"
   },
   {
    "k": "nav_menu_item",
    "rest_base": "menu-items",
    "nombre": "Elementos del menú de navegación"
   },
   {
    "k": "wp_block",
    "rest_base": "blocks",
    "nombre": "Patrones"
   },
   {
    "k": "wp_template",
    "rest_base": "templates",
    "nombre": "Plantillas"
   },
   {
    "k": "wp_template_part",
    "rest_base": "template-parts",
    "nombre": "Partes de plantilla"
   },
   {
    "k": "wp_global_styles",
    "rest_base": "global-styles",
    "nombre": "Estilos globales"
   },
   {
    "k": "wp_navigation",
    "rest_base": "navigation",
    "nombre": "Menús de navegación"
   },
   {
    "k": "wp_font_family",
    "rest_base": "font-families",
    "nombre": "Familias de fuentes"
   },
   {
    "k": "wp_font_face",
    "rest_base": "font-families/(?P<font_family_id>[\\d]+)/font-faces",
    "nombre": "Fuentes"
   },
   {
    "k": "ajde_events",
    "rest_base": "ajde_events",
    "nombre": "Events"
   },
   {
    "k": "slider",
    "rest_base": "slider",
    "nombre": "Sliders"
   }
  ],
  "tipoEventos": {
   "k": "ajde_events",
   "rest_base": "ajde_events",
   "nombre": "Events",
   "status": 200,
   "muestra": "[{\"id\":20564,\"date\":\"2026-09-29T14:23:00\",\"date_gmt\":\"2026-09-29T17:23:00\",\"guid\":{\"rendered\":\"https:\\/\\/www.santiagocultura.cl\\/?post_type=ajde_events&#038;p=20564\"},\"modified\":\"2026-09-29T14:23:00\",\"modified_gmt\":\"2026-09-29T17:23:00\",\"slug\":\"formas-de-sostener-coco-santibanez-transforma-el-trabajo-domestico-en-obra-de-arte\",\"status\":\"publish\",\"type\":\"ajde_events\",\"link\":\"https:\\/\\/www.santiagocultura.cl\\/events\\/formas-de-sostener-coco-santibanez-transforma-el-trabajo-domestico-en-obra-de-arte\\/\",\"title\":{\"rendered\":\"\\u00abFormas de Sostener\\u00bb: Coc\\u00f3 Santib\\u00e1\\u00f1ez transforma el trabajo dom\\u00e9stico en obra de arte\"},\"content\":{\"rendered\":\"<ul>\\n<li><strong><em>Galer\\u00eda Hifas presenta Formas de Sostener, muestra individual de la artista visual Coc\\u00f3 Santib\\u00e1\\u00f1ez. La exposici\\u00f3n se articula en torno a una imagen que naci\\u00f3 de una frase escuchada al azar: \\u201cUna tarde, mientras se ba\\u00f1aba en una piscina p\\u00fablica, la artista Coc\\u00f3 Santib\\u00e1\\u00f1ez escuch\\u00f3 a una mujer decirle a otra que reci\\u00e9n a las cuatro de la tarde pod\\u00eda sentarse a descansar. Coc\\u00f3 no conoc\\u00eda a esa mujer, pero imagin\\u00f3 que hablaba de las tareas que hac\\u00eda cotidianamente en su casa. La frase qued\\u00f3 rondando en su cabeza hasta transformarse en una imagen. Una imagen imposible: una silla de pelo trenzado que ya no permite sentarse.<\\/em><\\/strong><\\/li>\\n<\\/ul>\\n<p><i><span style=\\\"font-weight: 400;\\\">Desde entonces "
  }
 },
 "redAlameda": {
  "status": 200,
  "enlacesExternos": [
   "https://fonts.googleapis.com",
   "https://fonts.gstatic.com",
   "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
   "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css",
   "https://unpkg.com/flickity@2/dist/flickity.min.css",
   "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css",
   "https://www.portaltransparencia.cl/PortalPdT/web/guest/directorio-de-organismos-regulados?p_p_id=pdtorganismos_WAR_pdtorganismosportlet&#038;orgcode=AB081",
   "https://www.portaltransparencia.cl/PortalPdT/pdtta/-/ta/AB081",
   "https://www.leylobby.gob.cl/instituciones/AB081",
   "http://www.mercadopublico.cl/Portal/FeedOrg.aspx?qs=mSYIhslBRYpLxrWJ5HtCLg==",
   "https://x.com/Gob_Santiago",
   "https://www.tiktok.com/@gobiernosantiago",
   "https://coresantiago.cl/",
   "https://www.flickr.com/photos/193669698@N02/albums/",
   "http://www.redalamedacultural.cl/"
  ],
  "mencionAlameda": [
   "https://www.gobiernosantiago.cl/2026/06/09/gobierno-de-santiago-y-mas-de-50-instituciones-lanzan-red-para-activar-la-eje-alameda-como-corredor-cultural/",
   "https://www.gobiernosantiago.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.gobiernosantiago.cl%2F2026%2F06%2F09%2Fgobierno-de-santiago-y-mas-de-50-instituciones-lanzan-red-para-activar-la-eje-alameda-como-corredor-cultural%2F",
   "https://www.gobiernosantiago.cl/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fwww.gobiernosantiago.cl%2F2026%2F06%2F09%2Fgobierno-de-santiago-y-mas-de-50-instituciones-lanzan-red-para-activar-la-eje-alameda-como-corredor-cultural%2F&#038;format=xml",
   "http://www.redalamedacultural.cl/",
   "https://www.gobiernosantiago.cl/tag/nueva-alameda/"
  ]
 }
}
```
