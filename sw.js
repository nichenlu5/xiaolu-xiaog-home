const CACHE_NAME="xiaolu-home-v2.6-shell-4";
const CACHE_PREFIX="xiaolu-home-";
const CORE=["./","./index.html","./study.html","./graduate-journey.html","./css/style.css","./css/study.css","./css/life-module.css","./js/home.js","./js/study-core.js","./js/study.js","./js/pwa.js","./js/exercise-storage.js","./js/timeline-storage.js","./js/notes-storage.js","./js/gifts-storage.js","./js/graduate-journey-core.js","./js/graduate-journey.js","./js/achievement-core.js","./data/wordbooks/manifest.json","./data/wordbooks/kaoyan-complete.json","./data/wordbooks/cet6.json","./data/academic-vocabulary.json","./data/study-practice.json","./manifest.webmanifest","./icons/app-icon.svg","./icons/app-icon-192.png","./icons/app-icon-512.png"];

self.addEventListener("install",event=>{ event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate",event=>{ event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key))))); self.clients.claim(); });
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).then(response=>{ const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)); return response; }).catch(async()=>await caches.match(request)||await caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>{
    const network=fetch(request).then(response=>{ if(response.ok){ const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)); } return response; }).catch(()=>cached||new Response("离线状态下此资源尚未缓存。",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}}));
    return cached||network;
  }));
});
