const CACHE_NAME="xiaolu-home-v2.8-shell-2";
const CACHE_PREFIX="xiaolu-home-";
const CORE=["./","./index.html","./study.html","./graduate-journey.html","./css/style.css","./css/study.css","./css/life-module.css","./js/home.js","./js/study-core.js","./js/study.js","./js/pwa.js","./js/exercise-storage.js","./js/timeline-storage.js","./js/notes-storage.js","./js/gifts-storage.js","./js/graduate-journey-core.js","./js/graduate-journey.js","./js/achievement-core.js","./manifest.webmanifest","./icons/app-icon.svg","./icons/app-icon-192.png","./icons/app-icon-512.png"];

async function cached(request){try{return await caches.match(request);}catch{return null;}}
async function remember(request,response){if(response?.ok){try{const cache=await caches.open(CACHE_NAME);await cache.put(request,response.clone());}catch{}}return response;}
async function networkFirst(request){try{return await remember(request,await fetch(request));}catch{return await cached(request)||new Response("离线状态下此资源尚未缓存。",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});}}
async function activateCache(){const keys=await caches.keys(),target=await caches.open(CACHE_NAME);for(const key of keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME)){try{const old=await caches.open(key);for(const request of await old.keys()){if(!new URL(request.url).pathname.includes("/data/")||await target.match(request))continue;const response=await old.match(request);if(response)await target.put(request,response);}}catch{}await caches.delete(key);}}

self.addEventListener("install",event=>{ event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE))); self.skipWaiting(); });
self.addEventListener("activate",event=>{ event.waitUntil(activateCache()); self.clients.claim(); });
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).then(response=>remember(request,response)).catch(async()=>await cached(request)||await cached("./index.html")||new Response("离线状态下页面尚未缓存。",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}})));
    return;
  }
  if(url.pathname.includes("/data/")){event.respondWith(networkFirst(request));return;}
  event.respondWith(cached(request).then(hit=>hit||networkFirst(request)));
});
