const CACHE_NAME='cancha-v10-network-data-2026-10-27';
const ASSETS=['./','./index.html','./styles.css','./app-plus.css','./app-interaction.css','./app.js','./app-plus.js','./manifest.json','./bsb-logo.png','./data/club-stats.json','./data/cajasiete-scout.json','./data/santa-cruz-scout.json','./data/felipe-anton-scout.json','./docs/FUENTES_ESTRATEGIA_BALONCESTO.md','./docs/FUENTES_COMUNICACION_FAMILIAS.md','./docs/FUENTES_PSICOLOGIA_DEPORTIVA.md','./docs/FUENTES_FCB.md','./docs/CRITERIOS_AGENTE.md'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  const liveData=url.pathname.includes('/data/') && url.pathname.endsWith('.json');
  if(liveData){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>response).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
    return response;
  })));
});
