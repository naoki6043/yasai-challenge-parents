// Only caches owned by this copy are touched.
const CACHE_PREFIX='yasai-parents-'+new URL(self.registration.scope).pathname+'-';
const CACHE_NAME=CACHE_PREFIX+'v1';
const SHELL=['./','./index.html','./style.css','./config.js','./recipe-content.js','./app.js','./content.json','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const key=new URL(url);key.search='';
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(key.href,copy)));}
  return response;
 }).catch(()=>caches.match(key.href)));
});
