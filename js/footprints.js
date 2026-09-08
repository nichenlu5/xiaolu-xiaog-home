(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const CATEGORIES = [
    ["urban","城市交通","🏙️"],["railway","铁路","🚆"],["road","公路","🛣️"],
    ["air","航空","✈️"],["water","水上","⛴️"],["special","特色交通","🎡"],["future","未来探索","🔭"]
  ];
  const BUILTIN = [
    ["bus","公交车","🚌","urban"],["subway","地铁","🚇","urban"],["light-rail","轻轨","🚈","urban"],["taxi","出租车 / 网约车","🚕","urban"],["bicycle","自行车","🚲","urban"],["e-bike","电动车","🛵","urban"],
    ["train","普通火车","🚆","railway"],["hard-seat","硬座","💺","railway"],["hard-sleeper","硬卧","🛏️","railway"],["soft-sleeper","软卧","🌙","railway"],["high-speed-rail","高铁","🚄","railway"],["emu","动车","🚅","railway"],["intercity","城际铁路","🚉","railway"],
    ["coach","长途汽车","🚍","road"],["self-drive","自驾","🚙","road"],["motorcycle","摩托车","🏍️","road"],
    ["plane","客机","✈️","air"],["ferry","轮渡","⛴️","water"],["tour-boat","游船","🛥️","water"],["cruise","邮轮","🛳️","water"],
    ["maglev","磁悬浮","🚝","special"],["tram","有轨电车","🚋","special"],["cable-car","缆车","🚠","special"],["ropeway","索道","🚡","special"],["sightseeing-train","观光小火车","🚂","special"]
  ].map(([id,name,icon,category]) => ({ id,name,icon,category,builtin:true }));
  const STATUS = { visited:"✓ 已去过", wanted:"♡ 想去", special:"★ 特别回忆" };
  const TRANSPORT_STATE = { locked:"🔒 未解锁", experienced:"✨ 已体验", special:"⭐ 特别体验" };
  const validDate = value => value && !Number.isNaN(new Date(value).getTime()) ? String(value).slice(0,10) : "";
  const makeId = prefix => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const text = (value,max=300) => String(value ?? "").trim().slice(0,max);

  function normalizePlace(raw) {
    if (!raw || typeof raw !== "object" || !text(raw.name,60)) return null;
    const now = new Date().toISOString(), status = Object.hasOwn(STATUS,raw.status) ? raw.status : "wanted";
    return { id:text(raw.id,100)||makeId("place"), name:text(raw.name,60), date:validDate(raw.date), status, memory:text(raw.memory), tags:Array.isArray(raw.tags)?raw.tags.map(x=>text(x,30)).filter(Boolean).slice(0,12):[], hasPhoto:Boolean(raw.hasPhoto), source:raw.source==="sample"?"sample":"user", links:raw.links&&typeof raw.links==="object"?raw.links:{ photoIds:[],timelineEventIds:[],wishIds:[],transportIds:[] }, createdAt:validDate(raw.createdAt)||now, updatedAt:validDate(raw.updatedAt)||now };
  }
  function normalizeTransport(raw={}) {
    const state = Object.hasOwn(TRANSPORT_STATE,raw.state) ? raw.state : "locked";
    return { state, firstDate:validDate(raw.firstDate), firstPlace:text(raw.firstPlace,60), story:text(raw.story), times:Number.isFinite(Number(raw.times))&&Number(raw.times)>=0?Math.min(9999,Math.round(Number(raw.times))):null, links:raw.links&&typeof raw.links==="object"?raw.links:{ tripIds:[],timelineEventIds:[] }, updatedAt:validDate(raw.updatedAt)||null };
  }
  let travelData = FootprintsStorage.travel();
  let places = travelData.records.map(normalizePlace).filter(Boolean);
  let transportData = FootprintsStorage.transport();
  let activeFilter = "all";

  function allTransports() {
    const custom = transportData.custom.map(item => {
      if (!item || typeof item !== "object" || !text(item.name,40)) return null;
      return { id:text(item.id,100)||makeId("transport"),name:text(item.name,40),icon:text(item.icon,8)||"🚐",category:CATEGORIES.some(x=>x[0]===item.category)?item.category:"future",builtin:false };
    }).filter(Boolean);
    return [...BUILTIN,...custom];
  }
  function entry(id) { return normalizeTransport(transportData.entries[id]); }
  function persistPlaces() { travelData.records=places; FootprintsStorage.saveTravel(travelData); }
  function persistTransport() { FootprintsStorage.saveTransport(transportData); }
  function formatDate(value) { if(!value)return ""; const date=new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"long",day:"numeric"}).format(date); }

  function renderPlaces() {
    const counts = { visited:0,wanted:0,special:0 };
    places.forEach(item=>counts[item.status]++);
    $("#visited-count").textContent=counts.visited+counts.special;
    $("#wanted-count").textContent=counts.wanted;
    $("#memory-count").textContent=places.filter(x=>x.memory).length;
    const grid=$("#place-grid"); grid.replaceChildren();
    const visible=places.filter(x=>activeFilter==="all"||x.status===activeFilter).sort((a,b)=>String(b.date||b.updatedAt).localeCompare(String(a.date||a.updatedAt)));
    if(!visible.length){const empty=document.createElement("div");empty.className="empty-footprint";empty.innerHTML=`<span aria-hidden="true">${places.length?"🔎":"🧳"}</span><p>${places.length?"当前筛选下还没有地点。":"地图还是空白的。写下第一个想去或去过的地方吧。"}</p>`;grid.append(empty)}
    visible.forEach(item=>{
      const card=document.createElement("article");card.className="place-card";card.dataset.id=item.id;card.dataset.status=item.status;
      const head=document.createElement("div");head.className="place-card-head";const h=document.createElement("h3");h.textContent=item.name;const chip=document.createElement("span");chip.className="status-chip";chip.textContent=STATUS[item.status];head.append(h,chip);card.append(head);
      if(item.memory){const p=document.createElement("p");p.className="place-memory";p.textContent=item.memory;card.append(p)}
      if(item.tags.length){const tags=document.createElement("div");tags.className="tag-row";item.tags.forEach(value=>{const s=document.createElement("span");s.textContent=value;tags.append(s)});card.append(tags)}
      const meta=document.createElement("p");meta.className="place-meta";meta.textContent=[formatDate(item.date),item.hasPhoto?"📷 有照片":""].filter(Boolean).join(" · ")||"还没有补充日期与照片";card.append(meta);
      const actions=document.createElement("div");actions.className="card-actions";actions.innerHTML='<button type="button" data-action="memory">写进回忆</button><button type="button" data-action="edit">✎ 编辑</button><button type="button" class="delete-action" data-action="delete">删除</button>';card.append(actions);grid.append(card);
    });
    renderPins();
  }
  function renderPins(){const wrap=$("#map-pins");wrap.replaceChildren();places.slice(0,12).forEach((item,index)=>{const pin=document.createElement("span");pin.className=`map-pin ${item.status}`;pin.style.left=`${60+(index*37)%34}%`;pin.style.top=`${14+(index*29)%62}%`;pin.innerHTML=`<span>${index+1}</span>`;wrap.append(pin)})}

  const placeDialog=$("#place-dialog"),placeForm=$("#place-form");
  function openPlace(item=null){placeForm.reset();$("#place-id").value=item?.id||"";$("#place-name").value=item?.name||"";$("#place-date").value=item?.date||"";$("#place-status").value=item?.status||"wanted";$("#place-memory").value=item?.memory||"";$("#place-tags").value=item?.tags?.join("，")||"";$("#place-photo").checked=Boolean(item?.hasPhoto);$("#place-dialog-title").textContent=item?"编辑这个地点":"新增地点";placeDialog.showModal();requestAnimationFrame(()=>$("#place-name").focus())}

  function transportAchievements(catalog=allTransports()) {
    const unlocked=catalog.filter(x=>entry(x.id).state!=="locked"),ids=new Set(unlocked.map(x=>x.id)),railCount=unlocked.filter(x=>x.category==="railway").length,percent=catalog.length?Math.round(unlocked.length/catalog.length*100):0;
    return [
      ["transport-urban","🚇","城市探索者","体验地铁或轻轨",ids.has("subway")||ids.has("light-rail")],
      ["transport-rail","🚆","铁路旅行者","体验三种铁路交通",railCount>=3],
      ["transport-air","✈️","第一次飞向天空","点亮客机",ids.has("plane")],
      ["transport-water","⛴️","水上旅行者","体验任意水上交通",unlocked.some(x=>x.category==="water")],
      ["transport-collector","🎒","交通收藏家","解锁十种交通工具",unlocked.length>=10],
      ["transport-master","🏆","交通大师","图鉴完成度达到 80%",percent>=80]
    ].map(([id,icon,name,description,isUnlocked])=>({id,icon,name,description,unlocked:isUnlocked}));
  }
  function renderTransports(){
    const catalog=allTransports(),unlocked=catalog.filter(x=>entry(x.id).state!=="locked").length,percent=catalog.length?Math.round(unlocked/catalog.length*100):0;
    $("#transport-count").textContent=`已解锁 ${unlocked} / 总计 ${catalog.length}`;$("#transport-percent").textContent=`${percent}%`;$("#transport-progress-bar").style.width=`${percent}%`;$(".catalog-progress").setAttribute("aria-valuenow",String(percent));
    const achievements=transportAchievements(catalog);transportData.achievementDates=FootprintsStorage.saveTransportAchievementDates(achievements.filter(x=>x.unlocked).map(x=>x.id));const achievementGrid=$("#transport-achievement-grid");achievementGrid.replaceChildren();achievements.forEach(item=>{const el=document.createElement("div");el.className=`mini-achievement ${item.unlocked?"unlocked":"locked"}`;el.title=item.description;el.innerHTML=`<span aria-hidden="true">${item.unlocked?item.icon:"🔒"}</span><strong>${item.name}</strong>`;achievementGrid.append(el)});
    const groups=$("#transport-groups");groups.replaceChildren();CATEGORIES.forEach(([category,label,icon])=>{const items=catalog.filter(x=>x.category===category);if(!items.length&&category!=="future")return;const section=document.createElement("section");section.className="transport-section";const heading=document.createElement("h3");heading.innerHTML=`${icon} ${label} <span>${items.length?items.length+" 种":"自定义工具会出现在这里"}</span>`;section.append(heading);const grid=document.createElement("div");grid.className="transport-grid";items.forEach(item=>{const data=entry(item.id),card=document.createElement("article");card.className=`transport-card ${data.state!=="locked"?"unlocked":""} ${data.state==="special"?"special":""}`;card.dataset.id=item.id;const open=document.createElement("button");open.type="button";open.className="transport-open";open.dataset.action="transport-edit";open.setAttribute("aria-label",`查看或编辑${item.name}`);open.innerHTML=`<span class="transport-icon" aria-hidden="true">${item.icon}</span><strong>${item.name}</strong><small>${TRANSPORT_STATE[data.state]}</small>`;const toggle=document.createElement("button");toggle.type="button";toggle.className="transport-toggle";toggle.dataset.action="transport-toggle";toggle.textContent=data.state==="locked"?"点亮":"取消点亮";card.append(open,toggle);grid.append(card)});section.append(grid);groups.append(section)});
  }

  const transportDialog=$("#transport-dialog"),transportForm=$("#transport-form");
  CATEGORIES.forEach(([id,label])=>{const option=document.createElement("option");option.value=id;option.textContent=label;$("#transport-category").append(option)});
  function openTransport(item=null,isNew=false){transportForm.reset();const custom=isNew||Boolean(item&&!item.builtin),data=item?entry(item.id):normalizeTransport();$("#transport-id").value=item?.id||"";$("#transport-custom").value=custom?"1":"0";$("#transport-name").value=item?.name||"";$("#transport-icon").value=item?.icon||"🚐";$("#transport-category").value=item?.category||"future";$("#transport-state").value=isNew?"experienced":data.state;$("#transport-date").value=data.firstDate;$("#transport-place").value=data.firstPlace;$("#transport-story").value=data.story;$("#transport-times").value=data.times??"";document.querySelectorAll(".custom-transport-fields").forEach(el=>el.hidden=!custom);$("#transport-name").required=custom;$("#delete-custom-transport").hidden=!custom||isNew;$("#transport-dialog-title").textContent=isNew?"新增自定义交通工具":`${item.icon} ${item.name}`;transportDialog.showModal();requestAnimationFrame(()=>$(custom?"#transport-name":"#transport-state").focus())}

  document.querySelectorAll(".footprint-tabs button").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll(".footprint-tabs button").forEach(x=>x.setAttribute("aria-selected",String(x===button)));document.querySelectorAll(".footprint-view").forEach(view=>view.hidden=view.id!==`${button.dataset.view}-view`)}));
  $("#add-place").addEventListener("click",()=>openPlace());
  document.querySelectorAll(".status-filters button").forEach(button=>button.addEventListener("click",()=>{activeFilter=button.dataset.filter;document.querySelectorAll(".status-filters button").forEach(x=>x.setAttribute("aria-pressed",String(x===button)));renderPlaces()}));
  $("#place-grid").addEventListener("click",event=>{const control=event.target.closest("[data-action]"),card=event.target.closest(".place-card");if(!control||!card)return;const item=places.find(x=>x.id===card.dataset.id);if(!item)return;if(control.dataset.action==="memory"){const params=new URLSearchParams({source:"footprints",sourceId:item.id,sourceLabel:item.name,title:item.name,body:item.memory||"",place:item.name,date:item.date||""});location.href=`./timeline.html?${params}`;}else if(control.dataset.action==="edit")openPlace(item);else if(control.dataset.action==="delete"&&confirm(`确定删除“${item.name}”吗？这条记录将无法恢复。`)){places=places.filter(x=>x.id!==item.id);persistPlaces();renderPlaces()}});
  placeForm.addEventListener("submit",event=>{event.preventDefault();const name=text($("#place-name").value,60);if(!name)return;const now=new Date().toISOString(),values={name,date:$("#place-date").value,status:$("#place-status").value,memory:text($("#place-memory").value),tags:$("#place-tags").value.split(/[，,]/).map(x=>text(x,30)).filter(Boolean).slice(0,12),hasPhoto:$("#place-photo").checked,updatedAt:now};const old=places.find(x=>x.id===$("#place-id").value);if(old)Object.assign(old,values);else places.unshift(normalizePlace({id:makeId("place"),...values,source:"user",createdAt:now}));persistPlaces();renderPlaces();placeDialog.close()});
  function randomNext(){const wanted=places.filter(x=>x.status==="wanted");$("#next-title").textContent=wanted.length?wanted[Math.floor(Math.random()*wanted.length)].name:"还没有想去的地方";$("#next-note").textContent=wanted.length?"也许下一次，就从这里出发。":"先新增一个地点并标记为“想去”，再来抽下一站吧。";$("#next-dialog").showModal()}
  $("#random-next").addEventListener("click",randomNext);$("#random-again").addEventListener("click",randomNext);$("#next-dialog .random-close").addEventListener("click",()=>$("#next-dialog").close());
  $("#add-transport").addEventListener("click",()=>openTransport(null,true));
  $("#transport-groups").addEventListener("click",event=>{const control=event.target.closest("[data-action]"),card=event.target.closest(".transport-card");if(!control||!card)return;const item=allTransports().find(x=>x.id===card.dataset.id);if(!item)return;if(control.dataset.action==="transport-edit")openTransport(item);else{const data=entry(item.id);data.state=data.state==="locked"?"experienced":"locked";data.updatedAt=new Date().toISOString();transportData.entries[item.id]=data;persistTransport();renderTransports()}});
  transportForm.addEventListener("submit",event=>{event.preventDefault();const custom=$("#transport-custom").value==="1";let id=$("#transport-id").value;if(custom&&!text($("#transport-name").value,40))return;if(!id){id=makeId("transport");transportData.custom.push({id,name:text($("#transport-name").value,40),icon:text($("#transport-icon").value,8)||"🚐",category:$("#transport-category").value,createdAt:new Date().toISOString()})}else if(custom){const item=transportData.custom.find(x=>x.id===id);if(item)Object.assign(item,{name:text($("#transport-name").value,40),icon:text($("#transport-icon").value,8)||"🚐",category:$("#transport-category").value})}transportData.entries[id]=normalizeTransport({state:$("#transport-state").value,firstDate:$("#transport-date").value,firstPlace:$("#transport-place").value,story:$("#transport-story").value,times:$("#transport-times").value===""?null:Number($("#transport-times").value),links:entry(id).links,updatedAt:new Date().toISOString()});persistTransport();renderTransports();transportDialog.close()});
  $("#delete-custom-transport").addEventListener("click",()=>{const id=$("#transport-id").value,item=transportData.custom.find(x=>x.id===id);if(!item||!confirm(`确定删除自定义图鉴“${item.name}”吗？这条记录将无法恢复。`))return;transportData.custom=transportData.custom.filter(x=>x.id!==id);delete transportData.entries[id];persistTransport();renderTransports();transportDialog.close()});
  document.querySelectorAll(".footprint-dialog").forEach(dialog=>{dialog.querySelectorAll(".dialog-close,.cancel-button").forEach(button=>button.addEventListener("click",()=>dialog.close()));dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()})});
  $("#next-dialog").addEventListener("click",event=>{if(event.target===$("#next-dialog"))$("#next-dialog").close()});
  function timelineMemories(){try{const value=JSON.parse(localStorage.getItem("xiaoluXiaogTimelineV1")||"{}");return Array.isArray(value.memories)?value.memories:[]}catch{return[]}}
  function decorateMemoryLinks(){document.querySelectorAll(".place-card").forEach(card=>{const related=timelineMemories().filter(memory=>["footprint","footprints"].includes(memory?.source?.module)&&String(memory.source.itemId)===card.dataset.id),actions=card.querySelector(".card-actions"),create=actions?.querySelector('[data-action="memory"]'),createLabel=related.length?"再写一条回忆":"写进回忆";if(create&&create.textContent!==createLabel)create.textContent=createLabel;let view=actions?.querySelector('[data-action="view-memory"]');if(related.length&&!view){view=document.createElement("button");view.type="button";view.dataset.action="view-memory";actions.prepend(view)}if(view){const label="查看回忆（"+related.length+"）";if(view.textContent!==label)view.textContent=label;view.dataset.memoryId=related[0]?.id||"";view.hidden=!related.length}})}
  new MutationObserver(decorateMemoryLinks).observe($("#place-grid"),{childList:true,subtree:true});
  $("#place-grid").addEventListener("click",event=>{const control=event.target.closest('[data-action="view-memory"]');if(!control)return;event.preventDefault();event.stopImmediatePropagation();location.href="./timeline.html?memoryId="+encodeURIComponent(control.dataset.memoryId)},true);
  renderPlaces();renderTransports();decorateMemoryLinks();const targetId=new URLSearchParams(location.search).get("placeId");if(targetId)requestAnimationFrame(()=>{const card=document.querySelector('.place-card[data-id="'+CSS.escape(targetId)+'"]');if(card){card.classList.add("source-highlight");card.scrollIntoView({block:"center"})}});
})();
