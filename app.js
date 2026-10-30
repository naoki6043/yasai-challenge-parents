const $=s=>document.querySelector(s);
const app=$('#app'), nav=$('#nav');
// GitHub Pages shares an origin across repositories: never touch the old app keys.
const PREFIX='yasai-parents-v1-';
const get=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(PREFIX+key))??fallback}catch{return fallback}};
const save=(key,value)=>localStorage.setItem(PREFIX+key,JSON.stringify(value));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const recipeImages={'小松菜お浸し':'images/recipe_01.jpeg'};
let remoteRecipes=[],remoteNotices=[],remoteLoaded=false,loadError='';
let page='home',vegSel=null,recipeSel=null,editId=null,returnPage='recipe',flash='';
let historyRecipe='',historyMonth='';
let records=get('records',[]),outbox=get('outbox',[]);
if(!Array.isArray(records))records=[];
if(!Array.isArray(outbox))outbox=[];
function createEventId(){return 'E-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
function getParticipantId(){let id=get('participantId','');if(!id){id='P-'+createEventId();save('participantId',id)}return id;}
function appTitle(){return '朝食やさいチャレンジ';}
function head(title,subtitle=''){return `<div class="top"><div><div class="brand">${escapeHtml(title)}</div><div class="sub">${escapeHtml(subtitle)}</div></div><span>🥦</span></div>`;}
function remoteById(id){return remoteRecipes.find(r=>String(r.recipe_id)===String(id));}
function remoteByName(name){return remoteRecipes.find(r=>r['料理名']===name);}
function recipeDisplayName(name){return remoteById(recipeIds[name])?.['料理名']||name;}
function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function applyPublishedData(data){
 if(data?.ok!==true||!Array.isArray(data.recipes)||data.recipes.length===0)return false;
 const ids=new Set(data.recipes.map(r=>r.recipe_id));
 if(!Object.values(recipeIds).every(id=>ids.has(id)))return false;
 remoteRecipes=data.recipes;remoteNotices=Array.isArray(data.notices)?data.notices:[];remoteLoaded=true;return true;
}
async function loadPublishedRecipes(){
 try{
  const url=new URL(window.CONTENT_URL||'./content.json',location.href);url.searchParams.set('_',Date.now());
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok||!applyPublishedData(await response.json()))throw Error('公開データを確認できません');
  loadError='';
 }catch(error){loadError='レシピ情報を読み込めませんでした。通信状態を確認して再読み込みしてください。';}
}
function nutritionFor(veg){return remoteRecipes.find(r=>r['野菜名']===veg&&String(r['栄養学的特徴']||'').trim())?.['栄養学的特徴']||'栄養学的特徴は準備中です。';}
function home(){
 const eaten=records.filter(r=>r.portion>0);
 const together=records.filter(r=>r.participation!=='none');
 app.innerHTML=head(appTitle(),'保護者のための野菜レシピ')+`<div class="hero"><b>🥦 朝ごはんに、やさいをプラス！</b></div>
 <div class="stats"><div class="card"><b>${records.length}</b><span class="note">記録した回数</span></div><div class="card"><b>${new Set(eaten.map(r=>r.recipe_id)).size}</b><span class="note">食べた料理</span></div><div class="card"><b>${together.length}</b><span class="note">調理に参加した回数</span></div></div>
 ${loadError?`<p class="card loadError" role="alert">${escapeHtml(loadError)}</p>`:''}
 <h2>秋冬の野菜レシピ</h2><div class="homeRows">${currentVegetables().map(homeRecipeRow).join('')}</div>`;
}
function homeRecipeRow(v){return `<section class="homeRow"><div class="vegTitle"><span>${v[1]}</span><b>${escapeHtml(v[0])}</b><p class="vegNutrition">${escapeHtml(nutritionFor(v[0]))}</p></div><div class="threeRecipes">${v[2].map((name,i)=>{
 const count=records.filter(r=>r.recipe_id===recipeIds[name]).length;
 return `<button class="homeRecipe" onclick="openRecipeHome('${v[0]}',${i})">${recipePhoto(name)?`<img class="recipePhoto" src="${escapeHtml(recipePhoto(name))}" alt="${escapeHtml(recipeDisplayName(name))}" loading="lazy">`:`<div class="photoPlaceholder">${v[1]}</div>`}<b>${escapeHtml(recipeDisplayName(name))}</b><div class="recordCount">${count?`記録 ${count}回`:'記録なし'}</div></button>`;
 }).join('')}</div></section>`;}
function recipe(){
 if(!recipeSel){page='home';home();return;}
 const r=remoteById(recipeSel.recipe_id),name=r?.['料理名']||recipeSel.name;
 app.innerHTML=`<button class="back" onclick="go('home')">‹ ホームにもどる</button>${head(name,recipeSel.veg)}${r?.['調理法']?`<p class="recipeCookingMethod">調理法：${escapeHtml(r['調理法'])}</p>`:''}${recipeEnergyNav()}<div id="recipeSwipeArea">${recipePhoto(recipeSel.name,recipeSel.recipe_id)?`<div class="card recipePhotoCard"><img class="detailRecipePhoto" src="${escapeHtml(recipePhoto(recipeSel.name,recipeSel.recipe_id))}" alt="${escapeHtml(name)}"></div>`:''}<div class="card">${recipeDetailHTML(recipeSel.name,recipeSel.recipe_id)}</div></div><div class="card"><h3>お子さんの様子を記録</h3><p class="note">同じ料理も、そのつど何度でも記録できます。</p><button class="primary" onclick="openRecordForm()">記録を追加</button></div><h2>この料理の記録</h2>${recordList(records.filter(x=>x.recipe_id===recipeSel.recipe_id),'recipe')}`;
}
const PARTICIPATION=[['together','一緒に作った'],['helped','一部を手伝った'],['none','参加していない']];
const PORTIONS=[[1,'全部'],[0.75,'3/4'],[0.5,'半分'],[0.25,'1/4'],[0,'食べなかった']];
function openRecordForm(id=null,from='recipe'){
 editId=id;returnPage=from;
 if(id){const r=records.find(x=>x.id===id);if(!r)return;recipeSel={recipe_id:r.recipe_id,name:r.recipe,veg:r.veg};}
 page='recordForm';render();scrollTo(0,0);
}
function recordForm(){
 const r=records.find(x=>x.id===editId);
 app.innerHTML=`<button class="back" onclick="go('${returnPage}')">‹ もどる</button>${head(editId?'記録を編集':'記録を追加',recipeSel.name)}<form id="recordForm" class="card recordForm"><label for="recordDate">日付</label><input id="recordDate" type="date" required value="${escapeHtml(r?.date||localDate())}"><fieldset><legend>子どもの調理参加</legend>${PARTICIPATION.map(([value,label])=>`<label class="radioChoice"><input type="radio" name="participation" value="${value}" required ${r?.participation===value?'checked':''}>${label}</label>`).join('')}</fieldset><fieldset><legend>子どもの摂取量</legend>${PORTIONS.map(([value,label])=>`<label class="radioChoice"><input type="radio" name="portion" value="${value}" required ${r&&r.portion===value?'checked':''}>${label}</label>`).join('')}</fieldset><p id="formError" class="formError" role="alert"></p><button type="submit" class="primary">${editId?'変更を保存':'記録を保存'}</button><p class="note">記録はこの端末・ブラウザに保存されます。ブラウザのデータを消すと記録も消えます。</p></form>`;
 $('#recordForm').addEventListener('submit',submitRecord);
}
function validRecordDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;const d=new Date(date+'T12:00:00');return !Number.isNaN(d.getTime())&&localDate(d)===date;}
function persistRecordChange(next,operation,record){
 // Save data and the retry queue together so a failed write never reports success.
 const nextOutbox=[...outbox,{event_id:createEventId(),record_id:record.id,type:operation,participant_id:getParticipantId(),app_version:window.APP_VERSION,ts:Date.now(),...record}];
 try{save('state',{records:next,outbox:nextOutbox});}catch(error){throw Error('保存できませんでした。ブラウザの保存容量や設定を確認してください。');}
 records=next;outbox=nextOutbox;syncActionLogs();
}
function submitRecord(event){
 event.preventDefault();
 const form=event.currentTarget;
 const date=$('#recordDate').value,participation=form.elements.participation.value,portionText=form.elements.portion.value;
 if(!validRecordDate(date)||!PARTICIPATION.some(x=>x[0]===participation)||portionText===''||!PORTIONS.some(x=>x[0]===Number(portionText))){$('#formError').textContent='日付・調理参加・摂取量を選択してください。';return;}
 const old=records.find(x=>x.id===editId);
 const record={id:old?.id||createEventId(),recipe_id:recipeSel.recipe_id,recipe:recipeSel.name,veg:recipeSel.veg,date,participation,portion:Number(portionText),createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};
 try{persistRecordChange(old?records.map(x=>x.id===old.id?record:x):[...records,record],old?'record_updated':'record_created',record);}catch(error){$('#formError').textContent=error.message;return;}
 flash=old?'記録を更新しました。':'記録を保存しました。';page=returnPage;editId=null;render();
}
function deleteRecord(id){
 const record=records.find(x=>x.id===id);if(!record)return;
 if(!confirm(`${record.date}「${record.recipe}」の記録を削除しますか？`))return;
 try{persistRecordChange(records.filter(x=>x.id!==id),'record_deleted',record);}catch(error){alert(error.message);return;}
 flash='記録を削除しました。';render();
}
function recordList(list,from='record'){
 if(!list.length)return '<div class="card emptyState">記録はまだありません。レシピ詳細の「記録を追加」から登録できます。</div>';
 return [...list].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).map(r=>`<article class="card historyItem"><p class="note">${escapeHtml(r.date)} ・ ${escapeHtml(r.veg)}</p><h3>${escapeHtml(r.recipe)}</h3><p>調理参加：${PARTICIPATION.find(x=>x[0]===r.participation)?.[1]||'未記録'}<br>摂取量：${PORTIONS.find(x=>x[0]===r.portion)?.[1]||'未記録'}</p><div class="historyActions"><button class="secondary" onclick="openRecordForm('${r.id}','${from}')">編集</button><button class="secondary danger" onclick="deleteRecord('${r.id}')">削除</button></div></article>`).join('');
}
function record(){
 const filtered=records.filter(r=>(!historyRecipe||r.recipe_id===historyRecipe)&&(!historyMonth||r.date.startsWith(historyMonth)));
 app.innerHTML=head('記録','お子さんの調理参加と食べた量')+`<div class="card historyFilters"><label for="historyRecipe">料理で絞り込み</label><select id="historyRecipe"><option value="">すべての料理</option>${Object.entries(recipeIds).map(([name,id])=>`<option value="${id}" ${historyRecipe===id?'selected':''}>${escapeHtml(recipeDisplayName(name))}</option>`).join('')}</select><label for="historyMonth">月で絞り込み</label><input id="historyMonth" type="month" value="${escapeHtml(historyMonth)}"><button class="secondary" onclick="historyRecipe='';historyMonth='';record()">絞り込みを解除</button></div><p class="note">${filtered.length}件の記録</p>${recordList(filtered)}`;
 $('#historyRecipe').addEventListener('change',e=>{historyRecipe=e.target.value;record()});$('#historyMonth').addEventListener('change',e=>{historyMonth=e.target.value;record()});
}
function settings(){app.innerHTML=head('設定','保護者版')+`<div class="card"><h2>記録の保存について</h2><p>記録はこの端末・ブラウザに保存されます。元のアプリの記録とは別に管理しています。</p><p class="note">別の端末との共有や復元はできません。ブラウザのデータを消す前に、必要な記録を控えてください。</p><p>${window.ACTION_LOG_API_URL?'管理者用の記録連携が設定されています。':'外部への記録送信は設定されていません。'}</p></div>`;}
// Recipe browsing remains local. New record events use a dedicated optional endpoint only.
function log(){}
let syncing=false;
async function syncActionLogs(){
 if(syncing||!window.ACTION_LOG_API_URL||!outbox.length)return;
 syncing=true;
 try{
  for(const event of [...outbox]){
   const response=await fetch(window.ACTION_LOG_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(event),signal:AbortSignal.timeout(15000)});
   if(!response.ok||(await response.json()).ok!==true)break;
   const next=outbox.filter(x=>x.event_id!==event.event_id);save('state',{records,outbox:next});outbox=next;
  }
 }catch(error){console.warn('記録は端末内に保存されています。連携は次回再試行します。');}finally{syncing=false;}
}
function go(next){page=next;render();scrollTo(0,0);}
function render(){
 ({home,recipe,record,recordForm,notice,settings}[page]||home)();
 if(flash){const p=document.createElement('p');p.className='saveNotice';p.setAttribute('role','status');p.textContent=flash;app.prepend(p);flash='';}
 if(page==='recipe')setupRecipeSwipe();
 const active=page==='recipe'?'home':page==='recordForm'?(returnPage==='recipe'?'home':'record'):page;
 nav.innerHTML=[['home','⌂','ホーム'],['record','▣','記録'],['notice','🔔','お知らせ'],['settings','⚙','設定']].map(([p,icon,label])=>`<button class="${active===p?'active':''}" onclick="go('${p}')"><b>${icon}</b>${label}</button>`).join('');
}
const savedState=get('state',null);
if(savedState&&Array.isArray(savedState.records)&&Array.isArray(savedState.outbox)){records=savedState.records;outbox=savedState.outbox;}
window.addEventListener('online',syncActionLogs);
render();
loadPublishedRecipes().finally(render);
syncActionLogs();
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});}
