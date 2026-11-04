// Research enrollment is disabled until approved consent and Forms are configured.
let researchConfig={enabled:false},researchStatus=null,researchBusy=false,researchError='';
let researchCredentials=get('studyCredentials',null),researchLessons=[],researchLessonId='';
let researchInitialized=false,researchRestoreToken=new URLSearchParams(location.hash.slice(1)).get('restore')||'';
if(researchRestoreToken)history.replaceState(null,'',location.pathname+location.search);
const RESEARCH_STAGE_LABELS={T0:'当日・調理体験前',T1:'当日・調理体験後',T2:'イベント1か月後',T3:'イベント3か月後',T4:'イベント6か月後'};
const originalResearchApply=applyPublishedData;
applyPublishedData=function(data){
 const ok=originalResearchApply(data);
 if(ok&&data.study){researchConfig=data.study;researchInitialized=true;if(researchConfig.enabled&&researchCredentials&&!researchStatus)refreshResearch(false);}
 return ok;
};
async function researchRequest(type,extra={}){
 const response=await fetch(window.ACTION_LOG_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({type,app_version:window.APP_VERSION,...researchCredentials,...extra}),signal:AbortSignal.timeout(30000)});
 const data=await response.json();if(!response.ok||data.ok!==true)throw Error(data.error||'通信できませんでした。時間をおいてお試しください。');return data;
}
function researchCredential(){return 'K-'+crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');}
function researchNav(){nav.innerHTML=[['notice','アンケート'],['settings','設定']].map(([p,label])=>`<button onclick="go('${p}')">${label}</button>`).join('');}
function researchFeedback(){return `<p class="formError" role="alert">${escapeHtml(researchError)}</p>${researchBusy?'<p role="status">確認しています…</p>':''}`;}
function researchConsent(){
 app.innerHTML=head(appTitle(),'研究への参加のご案内')+`<section class="card"><h2>はじめに</h2>${researchConfig.consent_text?`<div class="researchConsentText">${escapeHtml(researchConfig.consent_text)}</div><label class="radioChoice"><input type="checkbox" id="researchConsent">研究の説明を確認し、参加に同意します。</label><button class="primary" onclick="enrollResearch()" ${researchBusy?'disabled':''}>同意してアンケートへ進む</button>`:'<p>研究への参加受付は準備中です。運営者の案内をお待ちください。</p>'}${researchConfig.contact?`<p class="note">お問い合わせ：${escapeHtml(researchConfig.contact)}</p>`:''}${researchFeedback()}</section>${researchConfig.recovery_enabled?researchRecoveryHTML():''}`;researchNav();
}
async function enrollResearch(){
 if(!$('#researchConsent')?.checked){researchError='説明を確認し、同意のチェックを入れてください。';researchConsent();return;}
 if(researchBusy)return;researchBusy=true;researchError='';
 try{
  if(!researchCredentials){researchCredentials={participant_id:getParticipantId(),credential:researchCredential()};save('studyCredentials',researchCredentials);}
  researchStatus=await researchRequest('study_enroll',{consent:true,consent_version:researchConfig.consent_version});page='notice';
 }catch(e){researchError=e.message;}finally{researchBusy=false;render();}
}
function researchSurveyHTML(){
 if(!researchStatus)return '';
 return `<section class="card"><h2>アンケート</h2><p>保護者の方が、同じお子さまについてお答えください。参加者IDは自動入力されるため、入力は不要です。</p><p class="note">回答を送信したら、この画面に戻って回答状況を確認してください。</p>${Object.entries(RESEARCH_STAGE_LABELS).map(([stage,label])=>{const form=researchStatus.forms.find(f=>f.stage===stage),done=researchStatus.completed[stage];return `<div class="researchSurveyRow"><div><b>${stage} ${label}</b><p class="note">${done?'回答確認済み':form?.available?'回答できます':form?.opens_on?escapeHtml(form.opens_on)+'以降に受付予定':'受付準備中'}</p></div>${!done&&form?.available?`<button class="secondary" onclick="openResearchForm('${stage}')" ${researchBusy?'disabled':''}>回答する</button>`:''}</div>`}).join('')}<button class="primary" onclick="refreshResearch()" ${researchBusy?'disabled':''}>回答状況を確認</button>${researchFeedback()}<p class="note">T1回答後にレシピと記録、T2回答後に「まなぶ」、T3回答後に春夏レシピを追加します。回答の確認に時間がかかる場合は、少し待ってから再確認してください。</p></section>`;
}
async function openResearchForm(stage){
 if(researchBusy)return;
 const target=window.open('about:blank','_blank');researchBusy=true;researchError='';
 try{const data=await researchRequest('study_form',{stage});const url=new URL(data.url);if(url.origin!=='https://docs.google.com'||!url.pathname.startsWith('/forms/'))throw Error('アンケートのリンクを確認できません。');if(target){target.opener=null;target.location.href=url.href;}else{location.href=url.href;}}
 catch(e){if(target)target.close();researchError=e.message;}finally{researchBusy=false;render();}
}
async function refreshResearch(showBusy=true){
 if(!researchCredentials||researchBusy)return;researchBusy=true;researchError='';if(showBusy)render();
 try{researchStatus=await researchRequest('study_status');if(researchStatus.gates.learn){const content=await researchRequest('study_content');researchLessons=Array.isArray(content.lessons)?content.lessons:[];} }
 catch(e){researchError=e.message;}finally{researchBusy=false;if(page!=='recordForm')render();if(researchStatus?.gates.app)syncActionLogs();}
}
function researchLearn(){
 if(!researchStatus?.gates.learn){app.innerHTML=head('まなぶ')+'<section class="card">T2アンケートの回答確認後に利用できます。</section>';return;}
 const groups=[...new Set(researchLessons.map(l=>l['学年区分']))];
 app.innerHTML=head('まなぶ','親子で野菜や食事について考えてみましょう')+`${researchLessons.length?'':'<section class="card">学習内容を準備しています。</section>'}${groups.map(group=>`<section class="card"><h2>${escapeHtml(group)}向け</h2>${researchLessons.filter(l=>l['学年区分']===group&&/^L_[A-Z0-9_]+$/.test(l.lesson_id)).sort((a,b)=>Number(a['ステージ'])-Number(b['ステージ'])).map(l=>`<button class="secondary researchLessonLink" onclick="openResearchLesson('${l.lesson_id}')">${escapeHtml(l['タイトル'])}</button>`).join('')}</section>`).join('')}`;
}
function openResearchLesson(id){researchLessonId=id;page='studyLesson';render();scrollTo(0,0);}
function researchLesson(){
 const l=researchLessons.find(l=>l.lesson_id===researchLessonId);if(!researchStatus?.gates.learn||!l){researchLearn();return;}
 app.innerHTML=`<button class="back" onclick="go('learn')">‹ まなぶにもどる</button>${head(l['タイトル'])}<article class="card"><p>${escapeHtml(l['導入'])}</p>${['学習ポイント1','学習ポイント2','学習ポイント3'].filter(k=>l[k]).map(k=>`<p>${escapeHtml(l[k])}</p>`).join('')}<h2>やってみよう</h2><p>${escapeHtml(l['やってみよう'])}</p><h2>まとめ</h2><p>${escapeHtml(l['まとめ'])}</p></article>`;
}
function researchRecoveryHTML(){return `<section class="card"><h2>以前の参加者情報に戻る</h2><p>アンケートに登録したメールアドレスへ、確認用リンクを送ります。参加者IDと回答・開放状況に戻れます。料理の記録は復元されません。</p><label for="researchRecoveryEmail">登録メールアドレス</label><input id="researchRecoveryEmail" type="email" autocomplete="email"><button class="secondary" onclick="requestResearchRecovery()" ${researchBusy?'disabled':''}>確認用メールを送る</button><p id="researchRecoveryMessage" role="status"></p></section>`;}
async function requestResearchRecovery(){
 const email=$('#researchRecoveryEmail')?.value.trim();if(!email||!$('#researchRecoveryEmail').checkValidity()){$('#researchRecoveryMessage').textContent='メールアドレスを確認してください。';return;}
 if(researchBusy)return;researchBusy=true;
 try{const result=await researchRequest('study_recovery_request',{email});$('#researchRecoveryMessage').textContent=result.message;}catch(e){$('#researchRecoveryMessage').textContent=e.message;}finally{researchBusy=false;}
}
async function completeResearchRecovery(){
 if(researchBusy)return;
 if(records.length&&!confirm('別の参加者情報へ戻る場合、この端末の現在の記録は退避し、一覧から外します。料理の記録は復元されません。続けますか？'))return;
 researchBusy=true;researchError='';
 try{
  const credential=researchCredential(),result=await researchRequest('study_recovery_complete',{token:researchRestoreToken,credential});
  const previousId=getParticipantId();
  if(previousId!==result.participant_id){save('beforeRecovery-'+Date.now(),{participant_id:previousId,records,outbox,profile});records=[];outbox=[];profile={email:''};save('state',{records,outbox,lastChangeVersion,profile});}
  researchCredentials={participant_id:result.participant_id,credential};save('participantId',result.participant_id);save('studyCredentials',researchCredentials);researchStatus=result;researchRestoreToken='';page='notice';
 }catch(e){researchError=e.message;}finally{researchBusy=false;render();if(researchStatus?.gates.app)syncActionLogs();}
}
const originalResearchRender=render;
render=function(){
 if(window.STUDY_MODE===true&&!researchInitialized){app.innerHTML=head(appTitle())+'<section class="card"><p>参加案内を確認しています。</p><button class="secondary" onclick="location.reload()">再読み込み</button></section>';nav.innerHTML='';return;}
 if(!researchConfig.enabled){if(window.STUDY_MODE===true){app.innerHTML=head(appTitle())+'<section class="card"><h2>参加受付の準備中です</h2><p>研究への参加受付は、運営者の案内をお待ちください。</p></section>';nav.innerHTML='';}else originalResearchRender();return;}
 if(researchRestoreToken){app.innerHTML=head('参加者情報の復帰')+`<section class="card"><p>メールの確認リンクから、以前の参加者情報へ戻ります。</p><button class="primary" onclick="completeResearchRecovery()" ${researchBusy?'disabled':''}>参加者情報に戻る</button>${researchFeedback()}</section>`;nav.innerHTML='';return;}
 if(!researchStatus){researchConsent();return;}
 if(!researchStatus.gates.app&&page!=='settings'){app.innerHTML=head(appTitle(),'アンケートへのご協力をお願いします')+researchSurveyHTML();researchNav();return;}
 if(page==='learn')researchLearn();else if(page==='studyLesson')researchLesson();else originalResearchRender();
 if(page==='notice')app.insertAdjacentHTML('afterbegin',researchSurveyHTML());
 if(page==='settings'){
  if(!researchStatus.gates.app)$('#profileForm')?.closest('section')?.remove();
  app.insertAdjacentHTML('afterbegin',`<section class="card"><h2>研究への参加</h2><p>参加登録済みです。アンケートの回答状況は「お知らせ」で確認できます。</p></section>`+(researchConfig.recovery_enabled?researchRecoveryHTML():''));
 }
 if(researchStatus.gates.learn){
  nav.innerHTML=[['home','⌂','ホーム'],['learn','📖','まなぶ'],['record','▣','記録'],['notice','🔔','お知らせ'],['settings','⚙','設定']].map(([p,icon,label])=>`<button class="${page===p||page==='studyLesson'&&p==='learn'?'active':''}" onclick="go('${p}')"><b>${icon}</b>${label}</button>`).join('');nav.classList.add('researchFiveNav');
 }
 if(page==='home'&&researchStatus.gates.spring)app.insertAdjacentHTML('afterbegin','<section class="card"><h2>春夏レシピ</h2><p>アンケートの回答を確認しました。春夏レシピの内容は準備中です。</p></section>');
};
window.studyCanSync=()=>researchInitialized&&researchConfig.enabled&&!!researchStatus?.gates.app;
window.studyRecordAuth=event=>researchConfig.enabled&&researchCredentials?.participant_id===event.participant_id?{credential:researchCredentials.credential}:{};
const originalResearchSubmit=submitRecord;
submitRecord=function(event){if(researchConfig.enabled&&!researchStatus?.gates.app){event.preventDefault();researchError='T1の回答状況を確認してください。';page='notice';render();return;}return originalResearchSubmit(event);};
window.addEventListener('focus',()=>{if(researchConfig.enabled&&researchCredentials)refreshResearch(false);});
render();
