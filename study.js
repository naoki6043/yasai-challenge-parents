// Research enrollment is disabled until approved consent and Forms are configured.
let researchConfig={enabled:false},researchStatus=null,researchBusy=false,researchError='';
let researchCredentials=get('studyCredentials',null),researchLessons=[],researchLessonId='';
let researchInitialized=false,researchRestoreToken=new URLSearchParams(location.hash.slice(1)).get('restore')||'';
let researchEmailEditing=false,researchEmailMessage='';
if(researchRestoreToken)history.replaceState(null,'',location.pathname+location.search);
const RESEARCH_STAGE_LABELS={T0:'当日・調理試食前',T1:'当日・調理試食後',T2:'イベント1か月後',T3:'イベント3か月後',T4:'イベント6か月後'};
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
function researchNav(){nav.innerHTML=[['home','ホーム'],['notice','アンケート'],['settings','設定']].map(([p,label])=>`<button class="${page===p?'active':''}" onclick="go('${p}')">${label}</button>`).join('');}
function researchPreviewHome(){
 originalResearchRender();
 app.insertAdjacentHTML('afterbegin','<section class="card"><p>レシピ一覧はアンケート回答前でもご覧いただけます。詳しい作り方・記録は、当日のT1アンケート回答後に利用できます。</p><button class="secondary" onclick="go(\'notice\')">参加案内・アンケート</button></section>');
 researchNav();
}
function researchHold(){app.innerHTML=head(appTitle())+'<section class="card"><h2>参加受付の準備中です</h2><p>レシピ一覧はホームからご覧いただけます。研究への参加受付は、運営者の案内をお待ちください。</p><button class="secondary" onclick="go(\'home\')">レシピ一覧へ</button></section>';researchNav();}
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
 return `<section class="card"><h2>アンケート</h2><p>保護者の方が、同じお子さまについてお答えください。参加者IDは自動入力されるため、入力は不要です。</p><p class="note">回答を送信したら、この画面に戻って回答状況を確認してください。</p>${Object.entries(RESEARCH_STAGE_LABELS).map(([stage,label])=>{const form=researchStatus.forms.find(f=>f.stage===stage),done=researchStatus.completed[stage];return `<div class="researchSurveyRow"><div><b>${label}</b><p class="note">${done?'回答確認済み':form?.available?'回答できます':form?.opens_on?escapeHtml(form.opens_on)+'以降に受付予定':'受付準備中'}</p></div>${!done&&form?.available?`<button class="secondary" onclick="openResearchForm('${stage}')" ${researchBusy?'disabled':''}>回答する</button>`:''}</div>`}).join('')}<button class="primary" onclick="refreshResearch()" ${researchBusy?'disabled':''}>回答状況を確認</button>${researchFeedback()}<p class="note">レシピ一覧は回答前から閲覧できます。試食後の回答確認後にレシピ詳細と記録、1か月後に「まなぶ・クイズ」、3か月後に春夏レシピ、6か月後に参加者全体の利用状況・推定野菜摂取量の報告をご覧いただけます。春夏レシピは確認済みのものから公開します。回答の確認に時間がかかる場合は、少し待ってから再確認してください。</p>${researchStatus.gates.report?'<button class="primary" onclick="openResearchReport()">みんなの利用状況・推定野菜摂取量を見る</button>':'<p class="note">全体報告：'+escapeHtml(researchStatus.report_opens_on||'2027-05-29')+'から、6か月後の回答確認後にご覧いただけます。</p>'}</section>`;
}
async function openResearchForm(stage){
 if(researchBusy)return;
 const target=window.open('about:blank','_blank');researchBusy=true;researchError='';
 try{const data=await researchRequest('study_form',{stage});const url=new URL(data.url);if(url.origin!=='https://docs.google.com'||!url.pathname.startsWith('/forms/'))throw Error('アンケートのリンクを確認できません。');if(target){target.opener=null;target.location.href=url.href;}else{location.href=url.href;}}
 catch(e){if(target)target.close();researchError=e.message;}finally{researchBusy=false;render();}
}
async function refreshResearch(showBusy=true){
 if(!researchCredentials||researchBusy)return;researchBusy=true;researchError='';if(showBusy)render();
 try{researchStatus=await researchRequest('study_status');if(researchStatus.gates.learn){const content=await researchRequest('study_content');researchLessons=Array.isArray(content.lessons)?content.lessons:[];researchApplyExtension(content);} }
 catch(e){researchError=e.message;}finally{researchBusy=false;if(page!=='recordForm')render();if(researchStatus?.gates.app)syncActionLogs();}
}
function researchLearn(){
 if(!researchStatus?.gates.learn){app.innerHTML=head('まなぶ')+'<section class="card">T2アンケートの回答確認後に利用できます。</section>';return;}
 const groups=[...new Set(researchLessons.map(l=>l['学年区分']))];
 app.innerHTML=head('まなぶ・クイズ','親子で野菜や食事を楽しく学ぼう')+`${researchLessons.length?'':'<section class="card">学習内容を準備しています。</section>'}${groups.map(group=>`<section class="card"><h2>${escapeHtml(group)}向け</h2>${researchLessons.filter(l=>l['学年区分']===group&&/^L_[A-Z0-9_]+$/.test(l.lesson_id)).sort((a,b)=>Number(a['ステージ'])-Number(b['ステージ'])).map(l=>`<button class="secondary researchLessonLink" onclick="openResearchLesson('${l.lesson_id}')">${escapeHtml(l['タイトル'])}</button>${researchQuizzes.some(q=>q.lesson_id===l.lesson_id)?`<button class="secondary" onclick="startResearchQuiz('${l.lesson_id}')">クイズにちょうせん</button>`:''}`).join('')}</section>`).join('')}`;
}
function openResearchLesson(id){researchLessonId=id;page='studyLesson';render();scrollTo(0,0);}
function researchLesson(){
 const l=researchLessons.find(l=>l.lesson_id===researchLessonId);if(!researchStatus?.gates.learn||!l){researchLearn();return;}
 app.innerHTML=`<button class="back" onclick="go('learn')">‹ まなぶにもどる</button>${head(l['タイトル'])}<article class="card"><p>${escapeHtml(l['導入'])}</p>${['学習ポイント1','学習ポイント2','学習ポイント3'].filter(k=>l[k]).map(k=>`<p>${escapeHtml(l[k])}</p>`).join('')}<h2>やってみよう</h2><p>${escapeHtml(l['やってみよう'])}</p><h2>まとめ</h2><p>${escapeHtml(l['まとめ'])}</p>${researchQuizzes.some(q=>q.lesson_id===l.lesson_id)?`<button class="primary" onclick="startResearchQuiz('${l.lesson_id}')">クイズにちょうせん</button>`:''}</article>`;
}
function researchRecoveryHTML(){return `<section class="card"><h2>以前の参加者情報に戻る</h2><p>アンケートに登録したメールアドレスへ、確認用リンクを送ります。参加者IDと回答・開放状況に戻れます。料理の記録は復元されません。</p><label for="researchRecoveryEmail">登録メールアドレス</label><input id="researchRecoveryEmail" type="email" autocomplete="email"><button class="secondary" onclick="requestResearchRecovery()" ${researchBusy?'disabled':''}>確認用メールを送る</button><p id="researchRecoveryMessage" role="status"></p></section>`;}
const originalResearchProfileFormHTML=profileFormHTML;
profileFormHTML=function(){
 if(window.STUDY_MODE!==true&&!researchConfig.enabled)return originalResearchProfileFormHTML();
 const registered=!!researchStatus?.email_registered,completed=!!researchStatus?.completed.T0;
 return `<section class="card"><h2>メールアドレス</h2><p>${registered?'登録済みです。設定での再入力は不要です。':'T0アンケートで入力したメールアドレスを使用します。設定での入力は不要です。'}</p><p class="note">アンケートと利用記録は参加者IDで結びつけます。</p>${completed?researchEmailEditing?`<label for="researchEmailChange">新しいメールアドレス</label><input id="researchEmailChange" type="email" autocomplete="email" maxlength="254"><p class="note">今後の連絡・参加者情報の復帰に使うメールアドレスを変更します。送信済みアンケートの回答は書き換えません。</p><button class="primary" onclick="updateResearchEmail()" ${researchBusy?'disabled':''}>変更を保存</button><button class="secondary" onclick="researchEmailEditing=false;researchEmailMessage='';render()" ${researchBusy?'disabled':''}>キャンセル</button>`:`<button class="secondary" onclick="researchEmailEditing=true;researchEmailMessage='';render()">変更する</button>`:'<button class="secondary" onclick="go(\'notice\')">アンケートを確認</button>'}<p role="status">${escapeHtml(researchEmailMessage)}</p></section>`;
};
async function updateResearchEmail(){
 const input=$('#researchEmailChange'),email=input?.value.trim();
 if(!email||!input.checkValidity()){researchEmailMessage='メールアドレスを確認してください。';render();return;}
 if(researchBusy)return;researchBusy=true;
 try{researchStatus=await researchRequest('study_email_update',{email});researchEmailEditing=false;researchEmailMessage='メールアドレスを変更しました。';}
 catch(e){researchEmailMessage=e.message;}finally{researchBusy=false;render();}
}
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
function researchFiveNav(){
 nav.innerHTML=[['home','⌂','ホーム'],['learn','📖','まなぶ'],['record','▣','記録'],['notice','🔔','お知らせ'],['settings','⚙','設定']].map(([p,icon,label])=>`<button class="${page===p||['studyLesson','studyQuiz'].includes(page)&&p==='learn'||page==='guide'&&p==='settings'?'active':''}" onclick="go('${p}')"><b>${icon}</b>${label}</button>`).join('');nav.classList.add('researchFiveNav');
}
render=function(){
 if(page==='guide'&&typeof appGuide==='function'){originalResearchRender();if(researchStatus?.gates.learn)researchFiveNav();else if(!researchStatus?.gates.app)researchNav();return;}
 if(page==='settings'&&(window.STUDY_MODE===true||researchConfig.enabled)&&(!researchConfig.enabled||!researchStatus)&&typeof publicGuideSettings==='function'){publicGuideSettings();researchNav();return;}
 if(page==='home'&&!researchRestoreToken&&(window.STUDY_MODE===true||researchConfig.enabled)&&!researchStatus?.gates.app){researchPreviewHome();return;}
 if(window.STUDY_MODE===true&&!researchInitialized){app.innerHTML=head(appTitle())+'<section class="card"><p>参加案内を確認しています。</p><button class="secondary" onclick="location.reload()">再読み込み</button></section>';researchNav();return;}
 if(!researchConfig.enabled){if(window.STUDY_MODE===true)researchHold();else originalResearchRender();return;}
 if(researchRestoreToken){app.innerHTML=head('参加者情報の復帰')+`<section class="card"><p>メールの確認リンクから、以前の参加者情報へ戻ります。</p><button class="primary" onclick="completeResearchRecovery()" ${researchBusy?'disabled':''}>参加者情報に戻る</button>${researchFeedback()}</section>`;nav.innerHTML='';return;}
 if(!researchStatus){researchConsent();return;}
 if(!researchStatus.gates.app&&page!=='settings'){app.innerHTML=head(appTitle(),'アンケートへのご協力をお願いします')+researchSurveyHTML();researchNav();return;}
 if(page==='studyQuiz')researchQuiz();else if(page==='spring')researchSpring();else if(page==='springRecipe')springRecipe();else if(page==='studyReport')researchReportPage();else if(page==='learn')researchLearn();else if(page==='studyLesson')researchLesson();else originalResearchRender();
 if(page==='notice')app.insertAdjacentHTML('afterbegin',researchSurveyHTML());
 if(page==='settings'){
  app.insertAdjacentHTML('afterbegin',`<section class="card"><h2>研究への参加</h2><p>参加登録済みです。アンケートの回答状況は「お知らせ」で確認できます。</p></section>`+(researchConfig.recovery_enabled?researchRecoveryHTML():''));
 }
 if(researchStatus.gates.learn){
  researchFiveNav();
 }
 if(page==='home'){app.insertAdjacentHTML('afterbegin',researchReminderHTML());if(researchStatus.gates.spring)app.insertAdjacentHTML('beforeend','<section class="card"><h2>春夏レシピ</h2><p>朝食に取り入れやすい春夏の野菜料理をご紹介します。</p><button class="primary" onclick="go(\'spring\')">春夏レシピを見る</button></section>');}
};
window.studyCanSync=()=>researchInitialized&&researchConfig.enabled&&!!researchStatus?.gates.app;
window.studyRecordAuth=event=>researchConfig.enabled&&researchCredentials?.participant_id===event.participant_id?{credential:researchCredentials.credential}:{};
const originalResearchSubmit=submitRecord;
submitRecord=function(event){if((window.STUDY_MODE===true||researchConfig.enabled)&&!researchStatus?.gates.app){event.preventDefault();researchError='T1の回答状況を確認してください。';page='notice';render();return;}return originalResearchSubmit(event);};
window.addEventListener('focus',()=>{if(researchConfig.enabled&&researchCredentials)refreshResearch(false);});
render();

// Quiz progress stays in this browser; aggregate reports contain no participant identifiers.
let researchQuizzes=[],researchSpringRecipes=[],researchQuizLesson='',researchQuizIndex=0,researchQuizAnswers=[],researchQuizChoice='',researchQuizChecked=false,researchReport=null,researchReportLoading=false;
function researchApplyExtension(content){
 researchQuizzes=Array.isArray(content.quizzes)?content.quizzes:[];
 researchSpringRecipes=Array.isArray(content.spring_recipes)?content.spring_recipes:[];
 for(const r of researchSpringRecipes){if(/^SS\d{2,4}$/.test(r.recipe_id))recipeIds[r['料理名']]=r.recipe_id;}
}
function researchQuizItems(){return researchQuizzes.filter(q=>q.lesson_id===researchQuizLesson&&/^Q_[A-Z0-9_]+$/.test(q.question_id));}
function startResearchQuiz(id){
 if(!researchStatus?.gates.learn)return;researchQuizLesson=id;researchQuizIndex=0;researchQuizAnswers=[];researchQuizChoice='';researchQuizChecked=false;page='studyQuiz';render();scrollTo(0,0);
}
function researchQuiz(){
 if(!researchStatus?.gates.learn){researchLearn();return;}
 const items=researchQuizItems(),q=items[researchQuizIndex],lesson=researchLessons.find(l=>l.lesson_id===researchQuizLesson);
 const back='<button class="back" onclick="go(\'learn\')">‹ まなぶ・クイズにもどる</button>';
 if(!items.length){app.innerHTML=back+head('クイズ')+'<section class="card"><p>このテーマのクイズは準備中です。</p></section>';return;}
 if(!q){const score=researchQuizAnswers.filter(Boolean).length;app.innerHTML=back+head('クイズ できたね！')+'<section class="card"><h2>'+items.length+'問中 '+score+'問正解！</h2><p>ちょうせんしてくれて、ありがとう。まちがえた問題も、解説を読んでまたやってみよう。</p><button class="primary" onclick="startResearchQuiz(\''+researchQuizLesson+'\')">もう一度ちょうせん</button></section>';return;}
 const opts=[1,2,3,4].filter(i=>String(q['選択肢'+i]||'').trim()),correct=Number(q['正解'])===Number(researchQuizChoice);
 app.innerHTML=back+head(lesson?.['タイトル']||'やさいクイズ')+'<section class="card"><p>'+(researchQuizIndex+1)+' / '+items.length+'問</p><h2>'+escapeHtml(q['問題文'])+'</h2><fieldset style="border:0;padding:0"><legend>答えを1つえらぼう</legend>'+opts.map(i=>'<label class="radioChoice"><input type="radio" name="quizChoice" value="'+i+'" '+(researchQuizChoice===String(i)?'checked ':'')+(researchQuizChecked?'disabled':'')+' onchange="researchQuizChoice=this.value">'+escapeHtml(q['選択肢'+i])+'</label>').join('')+'</fieldset>'+(researchQuizChecked?'<div role="status"><h3>'+(correct?'せいかい！':'おしい！')+'</h3><p style="white-space:pre-wrap">'+escapeHtml(q[correct?'正解時解説':'不正解時解説']||('正解は「'+q['選択肢'+q['正解']]+'」です。'))+'</p><button class="primary" onclick="nextResearchQuiz()">'+(researchQuizIndex===items.length-1?'結果を見る':'次の問題へ')+'</button></div>':'<p id="quizError" role="alert"></p><button class="primary" onclick="checkResearchQuiz()">答え合わせ</button>')+'</section>';
}
function checkResearchQuiz(){if(!researchQuizChoice){document.getElementById('quizError').textContent='答えを1つえらんでね。';return;}if(researchQuizChecked)return;researchQuizChecked=true;researchQuizAnswers.push(Number(researchQuizItems()[researchQuizIndex]['正解'])===Number(researchQuizChoice));render();}
function nextResearchQuiz(){if(!researchQuizChecked)return;researchQuizIndex++;researchQuizChoice='';researchQuizChecked=false;render();scrollTo(0,0);}
function researchSpring(){
 if(!researchStatus?.gates.spring){app.innerHTML=head('春夏レシピ')+'<section class="card"><p>3か月後のアンケート回答確認後に利用できます。</p></section>';return;}
 app.innerHTML='<button class="back" onclick="go(\'home\')">‹ ホームにもどる</button>'+head('春夏の時短レシピ')+(researchSpringRecipes.length?researchSpringRecipes.map(r=>'<section class="card"><p>'+escapeHtml(r['野菜名'])+'・'+escapeHtml(r['調理時間(分)'])+'分</p><h2>'+escapeHtml(r['料理名'])+'</h2><button class="primary" onclick="openSpringRecipe(\''+r.recipe_id+'\')">作り方を見る</button></section>').join(''):'<section class="card"><p>春夏レシピは内容を確認中です。公開までお待ちください。</p></section>');
}
function openSpringRecipe(id){const r=researchSpringRecipes.find(r=>r.recipe_id===id);if(!researchStatus?.gates.spring||!r)return;recipeSel={recipe_id:r.recipe_id,name:r['料理名'],veg:r['野菜名']};page='springRecipe';render();scrollTo(0,0);}
function springRecipe(){
 const r=researchSpringRecipes.find(r=>r.recipe_id===recipeSel?.recipe_id);if(!researchStatus?.gates.spring||!r){researchSpring();return;}
 let image='';try{const u=new URL(r['完成写真URL']);if(u.protocol==='https:'&&!u.username&&!u.password)image=u.href;}catch(e){}
 app.innerHTML='<button class="back" onclick="go(\'spring\')">‹ 春夏レシピにもどる</button>'+head(r['料理名'],r['野菜名'])+(image?'<img style="width:100%;border-radius:16px" src="'+escapeHtml(image)+'" alt="'+escapeHtml(r['料理名'])+'">':'')+'<section class="card"><p>'+escapeHtml(r['何人分'])+'人分・約'+escapeHtml(r['調理時間(分)'])+'分</p><h2>材料</h2><p style="white-space:pre-wrap">'+escapeHtml(r['材料'])+'</p><h2>作り方</h2><ol>'+String(r['作り方']).split('\n').filter(Boolean).map(s=>'<li>'+escapeHtml(s)+'</li>').join('')+'</ol><h3>調理のポイント</h3><p>'+escapeHtml(r['調理ポイント']||'加熱後の熱さに気をつけて、大人と一緒に調理してください。')+'</p><h3>アレルギー注意</h3><p>'+escapeHtml(r['アレルギー注意'])+'</p><p class="note">使用する商品の表示もご確認ください。</p></section><section class="card"><p>朝食で用意した料理を記録しましょう。</p><button class="primary" onclick="openRecordForm(null,\'springRecipe\')">記録を追加</button></section>';
}
function researchReminderHTML(){
 const next=researchStatus?.forms?.find(f=>!researchStatus.completed[f.stage]);if(!next)return '';
 const label=RESEARCH_STAGE_LABELS[next.stage]||'次回';return '<section class="card"><h2>'+(next.available?'アンケートのお願い':'次回のアンケート')+'</h2><p>'+escapeHtml(label)+(next.available?'のアンケートに回答できます。':next.opens_on?'：'+escapeHtml(next.opens_on)+'から受付予定です。':'の受付準備中です。')+'</p><button class="'+(next.available?'primary':'secondary')+'" onclick="go(\'notice\')">お知らせ・アンケートを見る</button></section>';
}
async function openResearchReport(){
 if(researchReportLoading)return;researchReportLoading=true;researchError='';page='studyReport';render();
 try{const data=await researchRequest('study_report');researchReport=data.report;}catch(e){researchError=e.message;}finally{researchReportLoading=false;render();scrollTo(0,0);}
}
function researchReportPage(){
 const back='<button class="back" onclick="go(\'notice\')">‹ お知らせにもどる</button>';
 if(!researchStatus?.gates.report){app.innerHTML=back+head('みんなの利用状況')+'<section class="card"><p>6か月後のアンケート回答確認後、報告開始日からご覧いただけます。</p></section>';return;}
 if(!researchReport){app.innerHTML=back+head('みんなの利用状況')+'<section class="card"><p role="status">'+(researchReportLoading?'集計しています…':escapeHtml(researchError||'集計結果を読み込んでください。'))+'</p><button class="primary" onclick="openResearchReport()" '+(researchReportLoading?'disabled':'')+'>再読み込み</button></section>';return;}
 const r=researchReport;app.innerHTML=back+head(r.title)+'<section class="card"><p>'+escapeHtml(r.message)+'</p><p>集計期間：'+escapeHtml(r.start)+' ～ '+escapeHtml(r.end)+'</p><p>記録のあったご家庭：<b>'+r.recording_households+'組</b></p><p>レシピの利用記録：<b>'+r.records+'件</b>（延べ）</p><p>利用された料理：<b>'+r.recipes+'種類</b></p><p>記録からの推定野菜摂取量の合計：<b>'+r.estimated_grams.toLocaleString('ja-JP')+'g</b></p><p>摂取量を計算できた記録：'+r.estimated_records+'件／計算対象外：'+r.excluded_records+'件</p><h2>月ごとの記録</h2>'+r.months.map(m=>'<p>'+escapeHtml(m.month)+'：'+m.records+'件・推定'+m.estimated_grams.toLocaleString('ja-JP')+'g</p>').join('')+'<h2>集計方法</h2><p>'+escapeHtml(r.method)+'</p><p>現在の野菜重量で補完した過去の記録：'+r.current_recipe_fallback_records+'件</p><h2>数値の見方</h2><p>'+escapeHtml(r.limitation)+'</p><p class="note">集計更新：'+escapeHtml(r.updated_at.slice(0,10))+'</p></section>';
}
