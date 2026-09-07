import fs from "node:fs";import vm from "node:vm";
const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync("js/literature-data.js","utf8"),c);vm.runInContext(fs.readFileSync("js/speed-quiz-data.js","utf8"),c);const {LiteratureData:L,SpeedQuizData:S}=c.window;
const books=["红楼梦","西游记","三国演义","水浒传"],cats=["地理","历史","文学","科学","数学基础","自然","生活常识","文化艺术","科技常识","综合常识"],errors=[];
const duplicate=(arr,key,label)=>{const seen=new Set;for(const x of arr){const k=key(x);if(seen.has(k))errors.push(`${label}重复：${k}`);seen.add(k)}};
duplicate(L.classics,x=>x.q,"名著题干");duplicate(L.poetry,x=>`${x.before}|${x.after}`,"诗词");duplicate(L.matching,x=>`${x.author}|${x.work}`,"作者作品");duplicate(S,x=>x.id,"快答 ID");duplicate(S,x=>x.question,"快答题干");
for(const x of L.classics){if(!books.includes(x.book))errors.push(`book 无效：${x.q}`);if(x.o.length!==4||new Set(x.o).size!==4||!x.o.includes(x.a))errors.push(`名著选项无效：${x.q}`)}
for(const x of L.poetry)if(x.before===x.after)errors.push(`诗词上下句相同：${x.before}`);
for(const x of S)if(!cats.includes(x.category)||x.options.length!==4||new Set(x.options).size!==4||!x.options.includes(x.answer))errors.push(`快答字段无效：${x.question}`);
const norm=s=>s.replace(/[，。！？、“”‘’\s]/g,"");let similar=0;for(let i=0;i<S.length;i++)for(let j=i+1;j<S.length;j++){const a=norm(S[i].question),b=norm(S[j].question);if(a.includes(b)||b.includes(a)){if(Math.min(a.length,b.length)/Math.max(a.length,b.length)>.82)similar++}}
const counts={books:Object.fromEntries(books.map(b=>[b,L.classics.filter(x=>x.book===b).length])),classics:L.classics.length,poetry:L.poetry.length,matching:L.matching.length,speed:S.length,categories:Object.fromEntries(cats.map(k=>[k,S.filter(x=>x.category===k).length])),similar};console.log(JSON.stringify(counts,null,2));if(errors.length){console.error(errors.slice(0,30).join("\n"));process.exit(1)}console.log("PASS structural data checks");
