const CACHE='urungano-static-v2';
const ASSETS=['/urungano','/urungano.html','/urungano-design.css','/site-shell.js','/chat.html','/pharmacy.html','/account.html','/auth.html','/urungano-logo.jpeg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).catch(()=>{}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const req=event.request;
  const requestUrl=new URL(req.url);
  if(req.method!=='GET'||requestUrl.origin!==self.location.origin||requestUrl.pathname.startsWith('/api/'))return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(req);
        if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
        return response;
      }catch{return (await caches.match(req))||caches.match('/urungano.html');}
    })());
    return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(req);if(cached)return cached;
    const response=await fetch(req);
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
    return response;
  })());
});
