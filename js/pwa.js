(() => {
  "use strict";
  const installCard=document.querySelector("#install-card"),installButton=document.querySelector("#install-app"),dismissButton=document.querySelector("#dismiss-install"),offlineNote=document.querySelector("#offline-note");
  let installPrompt=null;
  const updateConnection=()=>{ if(offlineNote) offlineNote.hidden=navigator.onLine; };
  updateConnection();
  window.addEventListener("online",updateConnection);
  window.addEventListener("offline",updateConnection);
  window.addEventListener("beforeinstallprompt",event=>{ event.preventDefault(); installPrompt=event; if(installCard) installCard.hidden=false; });
  installButton?.addEventListener("click",async()=>{ if(!installPrompt)return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt=null; if(installCard) installCard.hidden=true; });
  dismissButton?.addEventListener("click",()=>{ if(installCard) installCard.hidden=true; });
  window.addEventListener("appinstalled",()=>{ installPrompt=null; if(installCard) installCard.hidden=true; });
  if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();
