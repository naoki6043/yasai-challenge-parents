/** コピー先専用。フォーム設問は作成後にGoogleフォームで編集できる。 */
const STUDY_APP_URL='https://naoki6043.github.io/yasai-challenge-parents/';
const STUDY_PART_HEADERS=['participant_id','credential_hash','consent_version','consented_at','T0','T1','T2','T3','T4','email','updated_at'];
const STUDY_FORM_HEADERS=['stage','form_id','edit_url','response_url','participant_item_id','ticket_item_id','opens_on','enabled','schema_version'];

function studySheet_(name,headers){
 const ss=parentsSpreadsheet_();let sh=ss.getSheetByName(name);
 if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);}
 if(sh.getRange(1,1,1,headers.length).getDisplayValues()[0].join('\t')!==headers.join('\t'))throw Error('schema_'+name);
 return sh;
}
function studyRows_(sh,width){return sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,width).getValues():[];}
function studyWrite_(sh,row,values){const r=sh.getRange(row,1,1,values.length);r.setNumberFormat('@');r.setValues([values]);}
function studySettings_(){
 const sh=studySheet_('研究設定',['key','value','説明']);const config={};studyRows_(sh,3).forEach(r=>config[String(r[0])]=r[1] instanceof Date?Utilities.formatDate(r[1],'Asia/Tokyo','yyyy-MM-dd'):String(r[1]));return config;
}
function studyOn_(value){return String(value).toLowerCase()==='true';}
function studyForms_(){return studyRows_(studySheet_('調査フォーム',STUDY_FORM_HEADERS),STUDY_FORM_HEADERS.length).map(row=>Object.fromEntries(STUDY_FORM_HEADERS.map((key,i)=>[key,key==='opens_on'?studyDate_(row[i]):row[i]])));}
function studyHash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function studyEqual_(a,b){a=String(a);b=String(b);let diff=a.length^b.length;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return diff===0;}
function studySigningKey_(){const props=PropertiesService.getScriptProperties();let key=props.getProperty('STUDY_SIGNING_KEY');if(!key){key=Utilities.getUuid()+Utilities.getUuid();props.setProperty('STUDY_SIGNING_KEY',key);}return key;}
function studySignature_(value){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value,studySigningKey_())).replace(/=+$/,'');}
function studyTicket_(pid,stage,formId){const value=[pid,stage,formId,Date.now()+14*86400000].join('|');return Utilities.base64EncodeWebSafe(value,Utilities.Charset.UTF_8).replace(/=+$/,'')+'.'+studySignature_(value);}
function studyVerifyTicket_(token,pid,stage,formId,submittedAt=Date.now()){
 try{const parts=String(token).split('.');if(parts.length!==2)return false;const value=Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();const fields=value.split('|');return fields.length===4&&fields[0]===pid&&fields[1]===stage&&fields[2]===formId&&Number(fields[3])>=submittedAt&&studyEqual_(parts[1],studySignature_(value));}catch(e){return false;}
}
function studyParticipant_(event){
 if(!/^P-[A-Za-z0-9-]{8,100}$/.test(event.participant_id||'')||!/^K-[A-Za-z0-9-]{32,100}$/.test(event.credential||''))throw Error('本人確認情報を確認できません。');
 const sh=studySheet_('研究参加者',STUDY_PART_HEADERS),rows=studyRows_(sh,STUDY_PART_HEADERS.length),index=rows.findIndex(r=>r[0]===event.participant_id);
 if(index<0||!studyEqual_(rows[index][1],studyHash_(event.credential)))throw Error('本人確認情報を確認できません。');
 return {sheet:sh,row:index+2,values:rows[index]};
}
function studyStatus_(participant,config){
 const r=participant.values,completed=Object.fromEntries(['T0','T1','T2','T3','T4'].map((s,i)=>[s,String(r[i+4]||'')]));
 const today=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd');
 const forms=studyForms_().map(f=>({stage:f.stage,opens_on:String(f.opens_on||''),available:studyOn_(config.enabled)&&studyOn_(f.enabled)&&(!f.opens_on||today>=String(f.opens_on))&&(['T0','T1','T2','T3','T4'].indexOf(f.stage)===0||!!completed['T'+(['T0','T1','T2','T3','T4'].indexOf(f.stage)-1)])}));
 return {ok:true,participant_id:r[0],completed,forms,gates:{app:!!completed.T1,learn:!!completed.T2,spring:!!completed.T3,report:!!completed.T4&&studyOn_(studyExtensionSettings_().report_enabled)&&today>=studyDate_(studyExtensionSettings_().report_opens_on)},report_opens_on:studyDate_(studyExtensionSettings_().report_opens_on),email_registered:!!r[9]};
}
function studyPublicConfig_(){const c=studySettings_(),enabled=studyOn_(c.enabled)&&studyOn_(c.consent_approved);return {enabled,consent_text:enabled?c.consent_text||'':'',consent_version:enabled?c.consent_version||'':'',contact:enabled?c.contact||'':'',event_date:c.event_date||'2026-11-28',recovery_enabled:enabled&&studyOn_(c.recovery_enabled)};}
function studyHandle_(event){
 if(event.app_version!=='parents-v1')throw Error('アプリのバージョンを確認してください。');
 const config=studySettings_();
 if(!studyOn_(config.enabled)||!studyOn_(config.consent_approved))throw Error('研究用の利用開始は準備中です。');
 if(event.type==='study_enroll'){
  if(!config.consent_text||!config.consent_version||event.consent!==true||event.consent_version!==config.consent_version)throw Error('研究説明と同意内容を確認してください。');
  if(!/^P-[A-Za-z0-9-]{8,100}$/.test(event.participant_id||'')||!/^K-[A-Za-z0-9-]{32,100}$/.test(event.credential||''))throw Error('登録情報を確認できません。');
  const sh=studySheet_('研究参加者',STUDY_PART_HEADERS),rows=studyRows_(sh,STUDY_PART_HEADERS.length),index=rows.findIndex(r=>r[0]===event.participant_id);
  if(index<0){if(rows.length>=500)throw Error('登録上限に達しました。管理者にお問い合わせください。');const now=new Date().toISOString();studyWrite_(sh,sh.getLastRow()+1,[event.participant_id,studyHash_(event.credential),config.consent_version,now,'','','','','','',now]);}
  return studyStatus_(studyParticipant_(event),config);
 }
 if(event.type==='study_recovery_request')return studyRecoveryRequest_(event,config);
 if(event.type==='study_recovery_complete')return studyRecoveryComplete_(event,config);
 const participant=studyParticipant_(event),status=studyStatus_(participant,config);
 if(event.type==='study_status')return status;
 if(event.type==='study_report')return studyReport_(status);
 if(event.type==='study_records'){if(!status.gates.app)throw Error('アンケートの回答状況を確認してください。');return {ok:true,...studyRestoreRecords_(participant.values[0])};}
 if(event.type==='study_email_update'){
  if(!status.completed.T0)throw Error('メールアドレスはT0アンケートで登録してください。');
  const email=String(event.email||'').trim().toLowerCase();
  if(email.length>254||!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email))throw Error('メールアドレスを確認してください。');
  participant.values[9]=parentsSafeCell_(email);participant.values[10]=new Date().toISOString();
  studyWrite_(participant.sheet,participant.row,participant.values);SpreadsheetApp.flush();
  return studyStatus_(participant,config);
 }
 if(event.type==='study_content'){
  const ss=parentsSpreadsheet_(),fields=['lesson_id','学年区分','ステージ','タイトル','導入','学習ポイント1','学習ポイント2','学習ポイント3','やってみよう','まとめ','content_version'];
  const lessons=status.gates.learn?parentsRowsApi_(ss,'学習コンテンツ').filter(r=>r['公開状態']==='公開').map(r=>Object.fromEntries(fields.map(k=>[k,r[k]||'']))):[];
  return {ok:true,lessons,...studyExtensionContent_(status)};
 }
 if(event.type==='study_form'){
  const entry=studyForms_().find(f=>f.stage===event.stage),available=status.forms.find(f=>f.stage===event.stage);
  if(!entry||!available?.available)throw Error('このアンケートは現在回答できません。');
  const form=FormApp.openById(String(entry.form_id));
  if(!form.isAcceptingResponses())form.setAcceptingResponses(true);
  const response=form.createResponse().withItemResponse(form.getItemById(Number(entry.participant_item_id)).asTextItem().createResponse(event.participant_id)).withItemResponse(form.getItemById(Number(entry.ticket_item_id)).asTextItem().createResponse(studyTicket_(event.participant_id,event.stage,String(entry.form_id))));
  return {ok:true,url:response.toPrefilledUrl()};
 }
 throw Error('未対応の操作です。');
}

/** フォームIDと項目IDで判定するため、通常設問の変更・並べ替えでは壊れない。 */
function onStudyFormSubmit(e){
 if(!e?.source||!e.response)throw Error('フォーム送信トリガーから実行してください。');
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{studyAcceptResponse_(e.source,e.response);}finally{lock.releaseLock();}
}
function studyAcceptResponse_(form,response){
 const config=studySettings_();if(!studyOn_(config.enabled))return;
 const entry=studyForms_().find(f=>String(f.form_id)===form.getId());if(!entry)return;
 const answers={};response.getItemResponses().forEach(r=>answers[String(r.getItem().getId())]=r.getResponse());
 const pid=String(answers[String(entry.participant_item_id)]||''),ticket=String(answers[String(entry.ticket_item_id)]||'');
 const log=studySheet_('調査回答照合',['response_id','participant_id','stage','submitted_at','result','schema_version']);
 if(studyRows_(log,6).some(r=>r[0]===response.getId()))return;
 const sh=studySheet_('研究参加者',STUDY_PART_HEADERS),rows=studyRows_(sh,STUDY_PART_HEADERS.length),index=rows.findIndex(r=>r[0]===pid),stageIndex=['T0','T1','T2','T3','T4'].indexOf(entry.stage);
 const today=Utilities.formatDate(response.getTimestamp(),'Asia/Tokyo','yyyy-MM-dd');
 const valid=index>=0&&stageIndex>=0&&studyOn_(entry.enabled)&&(!entry.opens_on||today>=studyDate_(entry.opens_on))&&studyVerifyTicket_(ticket,pid,entry.stage,form.getId(),response.getTimestamp().getTime())&&(stageIndex===0||!!rows[index][stageIndex+3]);
 let result=valid?'照合済み':'照合不可';
 if(valid){
  const row=rows[index],firstStageResponse=!row[stageIndex+4];if(firstStageResponse)row[stageIndex+4]=response.getTimestamp().toISOString();
  if(entry.stage==='T0'&&firstStageResponse){
   const mapping=studyRows_(studySheet_('調査項目対応',['stage','question_key','item_id','title_at_creation']),4).find(r=>r[0]==='T0'&&r[1]==='T0_Q01');
   const email=mapping?String(answers[String(mapping[2])]||'').trim().toLowerCase():'';
   if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))row[9]=parentsSafeCell_(email);
  }
  row[10]=new Date().toISOString();studyWrite_(sh,index+2,row);
 }
 studyWrite_(log,log.getLastRow()+1,[response.getId(),valid?pid:'',entry.stage,response.getTimestamp().toISOString(),result,entry.schema_version]);
 SpreadsheetApp.flush();
}
/** 管理者用。トリガーの遅延・失敗時にフォームの保存済み回答から再照合する。 */
function repairStudyResponses(){for(const f of studyForms_()){const form=FormApp.openById(String(f.form_id));for(const response of form.getResponses())studyAcceptResponse_(form,response);}}

function studyRecoveryComplete_(event,config){
 if(!studyOn_(config.recovery_enabled)||!/^K-[A-Za-z0-9-]{32,100}$/.test(event.credential||''))throw Error('復帰用リンクを確認してください。');
 const sh=studySheet_('メール復帰',['token_hash','participant_id','expires_at','used_at','created_at']),rows=studyRows_(sh,5),index=rows.findIndex(r=>r[0]===studyHash_(String(event.token||'')));
 if(index<0||rows[index][3]||Number(rows[index][2])<Date.now())throw Error('リンクの有効期限が切れているか、使用済みです。');
 const participants=studySheet_('研究参加者',STUDY_PART_HEADERS),people=studyRows_(participants,STUDY_PART_HEADERS.length),pindex=people.findIndex(r=>r[0]===rows[index][1]);
 if(pindex<0)throw Error('参加者情報を確認できません。');
 people[pindex][1]=studyHash_(event.credential);people[pindex][10]=new Date().toISOString();studyWrite_(participants,pindex+2,people[pindex]);
 rows[index][3]=new Date().toISOString();studyWrite_(sh,index+2,rows[index]);
 return {...studyStatus_({values:people[pindex]},config),...studyRestoreRecords_(String(people[pindex][0]))};
}

/** 初回のみ。既存フォームを上書きせず、未作成のT0～T4を非公開の下書きとして作る。 */
function setupStudyDraftForms(){
 const config=studySheet_('研究設定',['key','value','説明']);
 if(config.getLastRow()===1){const rows=[['enabled','false','同意文と連携確認が済むまでfalse'],['consent_version','','承認済み同意文の版'],['consent_text','','承認済み研究説明・同意文'],['contact','','研究問い合わせ先'],['event_date','2026-11-28','イベント開催日'],['recovery_enabled','false','メール復帰の確認後のみtrue'],['consent_approved','false','研究説明・同意文の確定後のみtrue']];config.getRange(2,1,rows.length,3).setValues(rows);}
 studySigningKey_();studySheet_('研究参加者',STUDY_PART_HEADERS);
 const registry=studySheet_('調査フォーム',STUDY_FORM_HEADERS),mapping=studySheet_('調査項目対応',['stage','question_key','item_id','title_at_creation']);
 const saved=studyForms_(),properties=PropertiesService.getScriptProperties();
 const opens={T0:'2026-11-28',T1:'2026-11-28',T2:'2026-12-28',T3:'2027-02-28',T4:'2027-05-28'};
 for(const schema of STUDY_SURVEY_SCHEMA){
  if(saved.some(f=>f.stage===schema.stage))continue;
  let formId=properties.getProperty('STUDY_DRAFT_'+schema.stage),form;
  if(formId){form=FormApp.openById(formId);if(form.getItems().length)throw Error(schema.stage+' は作成途中です。既存項目を確認してから再開してください。');}
  else{form=FormApp.create('【確認用下書き】ときわんこ祭り '+schema.title,false);properties.setProperty('STUDY_DRAFT_'+schema.stage,form.getId());}
  form.setDescription('同じお子さまについて保護者の方がお答えください。'+(schema.stage==='T0'?'調理・試食体験の前にご回答ください。':schema.stage==='T1'?'調理・試食体験の直後にご回答ください。':'身長・体重は今回の調査に合わせて測定した値をお答えください。行動頻度は過去1か月間の平均的な1週間についてお答えください。'));
  form.setCollectEmail(false).setLimitOneResponsePerUser(false).setShowLinkToRespondAgain(false).setPublishingSummary(false).setAllowResponseEdits(false);
  form.setConfirmationMessage('ご回答ありがとうございました。アプリに戻り「回答状況を確認」を押してください。\n'+STUDY_APP_URL);
  form.setDestination(FormApp.DestinationType.SPREADSHEET,PARENTS_SHEET_ID);
  const pid=form.addTextItem().setTitle('参加者ID（自動入力・変更しないでください）').setRequired(true);
  const ticket=form.addTextItem().setTitle('照合コード（自動入力・変更しないでください）').setRequired(true);
  for(const q of schema.questions){
   let item;
   if(q.type==='choice')item=form.addMultipleChoiceItem().setChoiceValues(q.choices);
   else if(q.type==='checkbox'){item=form.addCheckboxItem().setChoiceValues(q.choices);if(q.other)item.showOtherOption(true);}
   else if(q.type==='scale')item=form.addScaleItem().setBounds(q.lower,q.upper).setLabels('まったくそう思わない','とてもそう思う');
   else if(q.type==='paragraph')item=form.addParagraphTextItem();
   else{item=form.addTextItem();let validation=FormApp.createTextValidation();
    if(q.validation==='email')item.setValidation(validation.requireTextIsEmail().build());
    if(q.validation==='integer')item.setValidation(validation.requireTextMatchesPattern('^[0-9]+$').setHelpText('0以上の整数を入力してください。').build());
    if(q.validation==='birth_month')item.setValidation(validation.requireTextMatchesPattern('^(19|20)[0-9]{2}/(0?[1-9]|1[0-2])$').setHelpText('西暦年/月を入力してください。例：2020/04').build());
    if(q.validation==='measurement')item.setValidation(validation.requireTextMatchesPattern('^([0-9]+(\\.[0-9])?|わからない)$').build());
    if(q.validation==='integer_unknown')item.setValidation(validation.requireTextMatchesPattern('^([0-9]+|わからない)$').build());
   }
   item.setTitle('問'+q.number+'　'+q.title).setRequired(q.required);if(q.help)item.setHelpText(q.help);
   studyWrite_(mapping,mapping.getLastRow()+1,[schema.stage,q.key,String(item.getId()),q.title]);
   if(schema.stage==='T0'&&q.number===6)form.addTextItem().setTitle('その他の保護者の続柄（該当する方のみ）').setRequired(false);
  }
  studyWrite_(registry,registry.getLastRow()+1,[schema.stage,form.getId(),form.getEditUrl(),form.getPublishedUrl(),String(pid.getId()),String(ticket.getId()),opens[schema.stage],'false','1']);
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='onStudyFormSubmit'&&t.getTriggerSourceId()===form.getId()))ScriptApp.newTrigger('onStudyFormSubmit').forForm(form).onFormSubmit().create();
 }
 console.log('調査フォームを準備しました。研究設定enabledと各フォームenabledはfalseです。編集URLは「調査フォーム」シートで確認してください。');
}

/** 管理者用。フォームの編集後に、照合に使う2項目が残っているか確認する。 */
function auditStudyForms(){
 const reports=studyForms_().map(entry=>{
  const form=FormApp.openById(String(entry.form_id)),ids=form.getItems().map(item=>String(item.getId()));
  return {stage:entry.stage,questions:form.getItems().length,participant_item_exists:ids.includes(String(entry.participant_item_id)),ticket_item_exists:ids.includes(String(entry.ticket_item_id)),enabled:studyOn_(entry.enabled)};
 });
 console.log(JSON.stringify(reports));
 if(reports.length!==5||reports.some(r=>!r.participant_item_exists||!r.ticket_item_exists))throw Error('調査フォームまたは照合項目を確認してください。');
 return reports;
}

const STUDY_SURVEY_SCHEMA=[{"stage":"T0","title":"T0 イベント参加前","questions":[{"number":1,"title":"メールアドレスをご入力ください。（必須）","source_lines":["回答：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿","メールアドレスは、参加時にご同意いただいたアンケートのご案内、野菜レシピやニュースレター、研究結果のご報告等の連絡と回答データの照合に使用し、適切に管理します。大学からのメールを受信できるよう、受信設定をご確認ください。"],"key":"T0_Q01","required":true,"help":"メールアドレスは、参加時にご同意いただいたアンケートのご案内、野菜レシピやニュースレター、研究結果のご報告等の連絡と回答データの照合に使用し、適切に管理します。大学からのメールを受信できるよう、受信設定をご確認ください。","type":"text","validation":"email"},{"number":2,"title":"お子さまの生年月を教えてください。","source_lines":["回答：西暦＿＿＿＿年＿＿月（1～12月）"],"key":"T0_Q02","required":true,"help":"西暦の年と月を、2020/04 の形式で入力してください。","type":"text","validation":"birth_month"},{"number":3,"title":"お子さまの年齢を教えてください。","source_lines":["回答：満＿＿歳（0以上の整数）"],"key":"T0_Q03","required":true,"help":"満年齢を0以上の整数で入力してください。","type":"text","validation":"integer"},{"number":4,"title":"お子さまの性別を教えてください。（任意）","source_lines":["男子 ／ 女子 ／ 回答しない（1つ選択）"],"key":"T0_Q04","required":false,"help":"","type":"choice","choices":["男子","女子","回答しない"]},{"number":5,"title":"お子さまの学年を教えてください。","source_lines":["小学1年生 ／ 2年生 ／ 3年生 ／ 4年生 ／ 5年生 ／ 6年生 ／ その他（1つ選択）"],"key":"T0_Q05","required":true,"help":"","type":"choice","choices":["小学1年生","2年生","3年生","4年生","5年生","6年生","その他"]},{"number":6,"title":"お子さまとの続柄を教えてください。","source_lines":["母 ／ 父 ／ 祖母 ／ 祖父 ／ その他の保護者（＿＿＿＿）（1つ選択）"],"key":"T0_Q06","required":true,"help":"その他の保護者の場合は、次の任意欄に続柄を記入してください。","type":"choice","choices":["母","父","祖母","祖父","その他の保護者"]},{"number":7,"title":"お子さまの身長を教えてください。","source_lines":["回答：＿＿＿ cm（数値、小数第1位まで） ／ わからない"],"key":"T0_Q07","required":true,"help":"数値（小数第1位まで）または「わからない」を入力してください。単位：cm","type":"text","validation":"measurement"},{"number":8,"title":"お子さまの体重を教えてください。","source_lines":["回答：＿＿＿ kg（数値、小数第1位まで） ／ わからない"],"key":"T0_Q08","required":true,"help":"数値（小数第1位まで）または「わからない」を入力してください。単位：kg","type":"text","validation":"measurement"},{"number":9,"title":"普段、お子さまの朝食に野菜を取り入れる際、難しいと感じることは何ですか。（複数回答可）","source_lines":["朝は時間がない ／ 準備が面倒 ／ 子どもが野菜を嫌い ／ 子どもが朝は野菜を食べられない ／ 野菜料理のレパートリーが少ない ／ 野菜の価格が高い ／ 野菜を常備していない ／ 特に難しいことはない ／ その他（＿＿＿＿）\n「特に難しいことはない」は他の選択肢と同時に選ばないでください。"],"key":"T0_Q09","required":true,"help":"「特に難しいことはない」は他の選択肢と同時に選ばないでください。","type":"checkbox","choices":["朝は時間がない","準備が面倒","子どもが野菜を嫌い","子どもが朝は野菜を食べられない","野菜料理のレパートリーがない","野菜の価格が高い","野菜を常備していない","特に難しいことはない"],"other":true},{"number":10,"title":"過去1か月間に、お子さまが朝食を食べた日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T0_Q10","required":true,"help":"","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":11,"title":"過去1か月間に、お子さまの朝食に野菜を用意した日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T0_Q11","required":true,"help":"","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":12,"title":"過去1か月間に、お子さまが朝食で、用意した野菜の量の半分以上を食べた日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）","野菜を用意しなかった日や朝食を食べなかった日は、野菜を半分以上食べた日には含めません。","以下の文について、現在のお考えに最も近い数字を1つ選んでください。","1 まったくそう思わない ／ 2 あまりそう思わない ／ 3 どちらともいえない\n4 ややそう思う ／ 5 とてもそう思う"],"key":"T0_Q12","required":true,"help":"野菜を用意しなかった日や朝食を食べなかった日は、野菜を半分以上食べた日には含めません。","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":13,"title":"忙しい朝でも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T0_Q13","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":14,"title":"子どもが野菜を好まない場合でも、食べやすい野菜料理を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T0_Q14","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":15,"title":"疲れているときでも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T0_Q15","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":16,"title":"子どもの朝食に野菜を用意する時間を確保することは簡単だと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T0_Q16","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":17,"title":"忙しい朝でも、野菜を用意する方法を自分で選べると思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T0_Q17","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":18,"title":"今後1週間、子どもの朝食に野菜を用意しようと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T0_Q18","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":19,"title":"子どもにとって野菜を食べるといいことがあると思う。","source_lines":["0＝まったくそう思わない、10＝とてもそう思う\n回答：0 ／ 1 ／ 2 ／ 3 ／ 4 ／ 5 ／ 6 ／ 7 ／ 8 ／ 9 ／ 10（1つ選択）"],"key":"T0_Q19","required":true,"help":"0＝まったくそう思わない、10＝とてもそう思う","type":"scale","lower":0,"upper":10},{"number":20,"title":"過去1か月間に、お子さまが朝食の際に挨拶（「いただきます」「ごちそうさま」）をした日は、週に平均何日ありましたか。","source_lines":["手を合わせるなどの仕草も含めてお答えください。\n0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T0_Q20","required":true,"help":"手を合わせるなどの仕草も含めてお答えください。","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":21,"title":"過去7日間に、お子さまの排便（うんち）は合計何回ありましたか。","source_lines":["回答：＿＿＿回（0以上の整数） ／ わからない"],"key":"T0_Q21","required":true,"help":"0以上の整数または「わからない」を入力してください。","type":"text","validation":"integer_unknown"}]},{"stage":"T1","title":"T1 イベント直後","questions":[{"number":1,"title":"忙しい朝でも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T1_Q01","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":2,"title":"子どもが野菜を好まない場合でも、食べやすい野菜料理を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T1_Q02","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":3,"title":"疲れているときでも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T1_Q03","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":4,"title":"子どもの朝食に野菜を用意する時間を確保することは簡単だと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T1_Q04","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":5,"title":"忙しい朝でも、野菜を用意する方法を自分で選べると思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T1_Q05","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":6,"title":"今後1週間、子どもの朝食に野菜を用意しようと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T1_Q06","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":7,"title":"子どもにとって野菜を食べるといいことがあると思う。","source_lines":["0＝まったくそう思わない、10＝とてもそう思う\n回答：0 ／ 1 ／ 2 ／ 3 ／ 4 ／ 5 ／ 6 ／ 7 ／ 8 ／ 9 ／ 10（1つ選択）"],"key":"T1_Q07","required":true,"help":"0＝まったくそう思わない、10＝とてもそう思う","type":"scale","lower":0,"upper":10},{"number":8,"title":"今日体験した野菜料理を、ご家庭でも朝食に取り入れられると思いますか。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5（上記と同じ5段階）"],"key":"T1_Q08","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":9,"title":"最後に、ご意見・ご感想などがございましたら、ご自由にご記入ください。","source_lines":["自由記述（任意）：\n＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿"],"key":"T1_Q09","required":false,"help":"","type":"paragraph"}]},{"stage":"T2","title":"T2 イベントから1か月後","questions":[{"number":1,"title":"お子さまの身長を教えてください。","source_lines":["回答：＿＿＿ cm（数値、小数第1位まで） ／ わからない"],"key":"T2_Q01","required":true,"help":"数値（小数第1位まで）または「わからない」を入力してください。単位：cm","type":"text","validation":"measurement"},{"number":2,"title":"お子さまの体重を教えてください。","source_lines":["回答：＿＿＿ kg（数値、小数第1位まで） ／ わからない","過去1か月間を振り返り、平均的な1週間に何日あったかをお答えください。"],"key":"T2_Q02","required":true,"help":"数値（小数第1位まで）または「わからない」を入力してください。単位：kg","type":"text","validation":"measurement"},{"number":3,"title":"過去1か月間に、お子さまが朝食を食べた日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T2_Q03","required":true,"help":"","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":4,"title":"過去1か月間に、お子さまの朝食に野菜を用意した日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T2_Q04","required":true,"help":"","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":5,"title":"過去1か月間に、お子さまが朝食で、用意した野菜の量の半分以上を食べた日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）","野菜を用意しなかった日や朝食を食べなかった日は、野菜を半分以上食べた日には含めません。","以下の文について、現在のお考えに最も近い数字を1つ選んでください。","1 まったくそう思わない ／ 2 あまりそう思わない ／ 3 どちらともいえない\n4 ややそう思う ／ 5 とてもそう思う"],"key":"T2_Q05","required":true,"help":"野菜を用意しなかった日や朝食を食べなかった日は、野菜を半分以上食べた日には含めません。","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":6,"title":"忙しい朝でも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T2_Q06","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":7,"title":"子どもが野菜を好まない場合でも、食べやすい野菜料理を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T2_Q07","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":8,"title":"疲れているときでも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T2_Q08","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":9,"title":"子どもの朝食に野菜を用意する時間を確保することは簡単だと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T2_Q09","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":10,"title":"忙しい朝でも、野菜を用意する方法を自分で選べると思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T2_Q10","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":11,"title":"今後1週間、子どもの朝食に野菜を用意しようと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T2_Q11","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":12,"title":"子どもにとって野菜を食べるといいことがあると思う。","source_lines":["0＝まったくそう思わない、10＝とてもそう思う\n回答：0 ／ 1 ／ 2 ／ 3 ／ 4 ／ 5 ／ 6 ／ 7 ／ 8 ／ 9 ／ 10（1つ選択）"],"key":"T2_Q12","required":true,"help":"0＝まったくそう思わない、10＝とてもそう思う","type":"scale","lower":0,"upper":10},{"number":13,"title":"過去1か月間に、お子さまが朝食の際に挨拶（「いただきます」「ごちそうさま」）をした日は、週に平均何日ありましたか。","source_lines":["手を合わせるなどの仕草も含めてお答えください。\n0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T2_Q13","required":true,"help":"手を合わせるなどの仕草も含めてお答えください。","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":14,"title":"過去7日間に、お子さまの排便（うんち）は合計何回ありましたか。","source_lines":["回答：＿＿＿回（0以上の整数） ／ わからない"],"key":"T2_Q14","required":true,"help":"0以上の整数または「わからない」を入力してください。","type":"text","validation":"integer_unknown"},{"number":15,"title":"Webアプリ「朝食野菜チャレンジ」を、これまでに利用しましたか。","source_lines":["利用した ／ 利用していない（1つ選択）"],"key":"T2_Q15","required":true,"help":"","type":"choice","choices":["利用した","利用していない"]},{"number":16,"title":"Webアプリ「朝食野菜チャレンジ」は、お子さまの朝食に野菜を取り入れるうえで役立ちましたか。","source_lines":["1 まったく役立たなかった ／ 2 あまり役立たなかった ／ 3 どちらともいえない ／ 4 少し役立った ／ 5 とても役立った ／ 利用していないため評価できない（1つ選択）\n問15で「利用していない」を選んだ方は「利用していないため評価できない」を選んでください。"],"key":"T2_Q16","required":true,"help":"前の質問で「利用していない」を選んだ方は「利用していないため評価できない」を選んでください。","type":"choice","choices":["1 まったく役立たなかった","2 あまり役立たなかった","3 どちらともいえない","4 少し役立った","5 とても役立った","利用していないため評価できない"]},{"number":17,"title":"最後に、ご意見・ご感想などがございましたら、ご自由にご記入ください。","source_lines":["自由記述（任意）：\n＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿"],"key":"T2_Q17","required":false,"help":"","type":"paragraph"}]},{"stage":"T3","title":"T3 イベントから3か月後","questions":[{"number":1,"title":"お子さまの身長を教えてください。","source_lines":["回答：＿＿＿ cm（数値、小数第1位まで） ／ わからない"],"key":"T3_Q01","required":true,"help":"数値（小数第1位まで）または「わからない」を入力してください。単位：cm","type":"text","validation":"measurement"},{"number":2,"title":"お子さまの体重を教えてください。","source_lines":["回答：＿＿＿ kg（数値、小数第1位まで） ／ わからない","過去1か月間を振り返り、平均的な1週間に何日あったかをお答えください。"],"key":"T3_Q02","required":true,"help":"数値（小数第1位まで）または「わからない」を入力してください。単位：kg","type":"text","validation":"measurement"},{"number":3,"title":"過去1か月間に、お子さまが朝食を食べた日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T3_Q03","required":true,"help":"","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":4,"title":"過去1か月間に、お子さまの朝食に野菜を用意した日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T3_Q04","required":true,"help":"","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":5,"title":"過去1か月間に、お子さまが朝食で、用意した野菜の量の半分以上を食べた日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）","野菜を用意しなかった日や朝食を食べなかった日は、野菜を半分以上食べた日には含めません。","以下の文について、現在のお考えに最も近い数字を1つ選んでください。","1 まったくそう思わない ／ 2 あまりそう思わない ／ 3 どちらともいえない\n4 ややそう思う ／ 5 とてもそう思う"],"key":"T3_Q05","required":true,"help":"野菜を用意しなかった日や朝食を食べなかった日は、野菜を半分以上食べた日には含めません。","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":6,"title":"忙しい朝でも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T3_Q06","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":7,"title":"子どもが野菜を好まない場合でも、食べやすい野菜料理を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T3_Q07","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":8,"title":"疲れているときでも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T3_Q08","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":9,"title":"子どもの朝食に野菜を用意する時間を確保することは簡単だと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T3_Q09","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":10,"title":"忙しい朝でも、野菜を用意する方法を自分で選べると思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T3_Q10","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":11,"title":"今後1週間、子どもの朝食に野菜を用意しようと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T3_Q11","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":12,"title":"子どもにとって野菜を食べるといいことがあると思う。","source_lines":["0＝まったくそう思わない、10＝とてもそう思う\n回答：0 ／ 1 ／ 2 ／ 3 ／ 4 ／ 5 ／ 6 ／ 7 ／ 8 ／ 9 ／ 10（1つ選択）"],"key":"T3_Q12","required":true,"help":"0＝まったくそう思わない、10＝とてもそう思う","type":"scale","lower":0,"upper":10},{"number":13,"title":"過去1か月間に、お子さまが朝食の際に挨拶（「いただきます」「ごちそうさま」）をした日は、週に平均何日ありましたか。","source_lines":["手を合わせるなどの仕草も含めてお答えください。\n0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T3_Q13","required":true,"help":"手を合わせるなどの仕草も含めてお答えください。","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":14,"title":"過去7日間に、お子さまの排便（うんち）は合計何回ありましたか。","source_lines":["回答：＿＿＿回（0以上の整数） ／ わからない"],"key":"T3_Q14","required":true,"help":"0以上の整数または「わからない」を入力してください。","type":"text","validation":"integer_unknown"},{"number":15,"title":"Webアプリ「朝食野菜チャレンジ」を、これまでに利用しましたか。","source_lines":["利用した ／ 利用していない（1つ選択）"],"key":"T3_Q15","required":true,"help":"","type":"choice","choices":["利用した","利用していない"]},{"number":16,"title":"Webアプリ「朝食野菜チャレンジ」は、お子さまの朝食に野菜を取り入れるうえで役立ちましたか。","source_lines":["1 まったく役立たなかった ／ 2 あまり役立たなかった ／ 3 どちらともいえない ／ 4 少し役立った ／ 5 とても役立った ／ 利用していないため評価できない（1つ選択）\n問15で「利用していない」を選んだ方は「利用していないため評価できない」を選んでください。"],"key":"T3_Q16","required":true,"help":"前の質問で「利用していない」を選んだ方は「利用していないため評価できない」を選んでください。","type":"choice","choices":["1 まったく役立たなかった","2 あまり役立たなかった","3 どちらともいえない","4 少し役立った","5 とても役立った","利用していないため評価できない"]},{"number":17,"title":"最後に、ご意見・ご感想などがございましたら、ご自由にご記入ください。","source_lines":["自由記述（任意）：\n＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿"],"key":"T3_Q17","required":false,"help":"","type":"paragraph"}]},{"stage":"T4","title":"T4 イベントから6か月後","questions":[{"number":1,"title":"お子さまの身長を教えてください。","source_lines":["回答：＿＿＿ cm（数値、小数第1位まで） ／ わからない"],"key":"T4_Q01","required":true,"help":"数値（小数第1位まで）または「わからない」を入力してください。単位：cm","type":"text","validation":"measurement"},{"number":2,"title":"お子さまの体重を教えてください。","source_lines":["回答：＿＿＿ kg（数値、小数第1位まで） ／ わからない","過去1か月間を振り返り、平均的な1週間に何日あったかをお答えください。"],"key":"T4_Q02","required":true,"help":"数値（小数第1位まで）または「わからない」を入力してください。単位：kg","type":"text","validation":"measurement"},{"number":3,"title":"過去1か月間に、お子さまが朝食を食べた日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T4_Q03","required":true,"help":"","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":4,"title":"過去1か月間に、お子さまの朝食に野菜を用意した日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T4_Q04","required":true,"help":"","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":5,"title":"過去1か月間に、お子さまが朝食で、用意した野菜の量の半分以上を食べた日は、週に平均何日ありましたか。","source_lines":["0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）","野菜を用意しなかった日や朝食を食べなかった日は、野菜を半分以上食べた日には含めません。","以下の文について、現在のお考えに最も近い数字を1つ選んでください。","1 まったくそう思わない ／ 2 あまりそう思わない ／ 3 どちらともいえない\n4 ややそう思う ／ 5 とてもそう思う"],"key":"T4_Q05","required":true,"help":"野菜を用意しなかった日や朝食を食べなかった日は、野菜を半分以上食べた日には含めません。","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":6,"title":"忙しい朝でも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T4_Q06","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":7,"title":"子どもが野菜を好まない場合でも、食べやすい野菜料理を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T4_Q07","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":8,"title":"疲れているときでも、子どもの朝食に野菜を用意できる自信がある。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T4_Q08","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":9,"title":"子どもの朝食に野菜を用意する時間を確保することは簡単だと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T4_Q09","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":10,"title":"忙しい朝でも、野菜を用意する方法を自分で選べると思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T4_Q10","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":11,"title":"今後1週間、子どもの朝食に野菜を用意しようと思う。","source_lines":["回答：1 ／ 2 ／ 3 ／ 4 ／ 5"],"key":"T4_Q11","required":true,"help":"","type":"choice","choices":["1 まったくそう思わない","2 あまりそう思わない","3 どちらともいえない","4 ややそう思う","5 とてもそう思う"]},{"number":12,"title":"子どもにとって野菜を食べるといいことがあると思う。","source_lines":["0＝まったくそう思わない、10＝とてもそう思う\n回答：0 ／ 1 ／ 2 ／ 3 ／ 4 ／ 5 ／ 6 ／ 7 ／ 8 ／ 9 ／ 10（1つ選択）"],"key":"T4_Q12","required":true,"help":"0＝まったくそう思わない、10＝とてもそう思う","type":"scale","lower":0,"upper":10},{"number":13,"title":"過去1か月間に、お子さまが朝食の際に挨拶（「いただきます」「ごちそうさま」）をした日は、週に平均何日ありましたか。","source_lines":["手を合わせるなどの仕草も含めてお答えください。\n0日 ／ 1～2日 ／ 3～4日 ／ 5～6日 ／ 7日 ／ わからない（1つ選択）"],"key":"T4_Q13","required":true,"help":"手を合わせるなどの仕草も含めてお答えください。","type":"choice","choices":["0日","1～2日","3～4日","5～6日","7日","わからない"]},{"number":14,"title":"過去7日間に、お子さまの排便（うんち）は合計何回ありましたか。","source_lines":["回答：＿＿＿回（0以上の整数） ／ わからない"],"key":"T4_Q14","required":true,"help":"0以上の整数または「わからない」を入力してください。","type":"text","validation":"integer_unknown"},{"number":15,"title":"Webアプリ「朝食野菜チャレンジ」を、これまでに利用しましたか。","source_lines":["利用した ／ 利用していない（1つ選択）"],"key":"T4_Q15","required":true,"help":"","type":"choice","choices":["利用した","利用していない"]},{"number":16,"title":"Webアプリ「朝食野菜チャレンジ」は、お子さまの朝食に野菜を取り入れるうえで役立ちましたか。","source_lines":["1 まったく役立たなかった ／ 2 あまり役立たなかった ／ 3 どちらともいえない ／ 4 少し役立った ／ 5 とても役立った ／ 利用していないため評価できない（1つ選択）\n問15で「利用していない」を選んだ方は「利用していないため評価できない」を選んでください。"],"key":"T4_Q16","required":true,"help":"前の質問で「利用していない」を選んだ方は「利用していないため評価できない」を選んでください。","type":"choice","choices":["1 まったく役立たなかった","2 あまり役立たなかった","3 どちらともいえない","4 少し役立った","5 とても役立った","利用していないため評価できない"]},{"number":17,"title":"最後に、ご意見・ご感想などがございましたら、ご自由にご記入ください。","source_lines":["自由記述（任意）：\n＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿"],"key":"T4_Q17","required":false,"help":"","type":"paragraph"}]}];

/** コピー先専用。春夏原稿は確認済みの公開行だけを、回答済み参加者へ返す。 */
function studyDate_(value){
 if(value instanceof Date)return Utilities.formatDate(value,'Asia/Tokyo','yyyy-MM-dd');
 const m=String(value||'').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
 return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):'';
}
function studyToday_(){return Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd');}
function studyExtensionSettings_(){
 const defaults={report_opens_on:'2027-05-29',report_start:'2026-11-28',report_end:'2027-05-28',report_enabled:'true',report_title:'みんなの朝食やさいチャレンジ',report_message:'アンケートと日々の記録へのご協力、ありがとうございます。'};
 const ss=parentsSpreadsheet_();if(!ss.getSheetByName('追加機能設定'))return defaults;
 parentsRowsApi_(ss,'追加機能設定').forEach(r=>{if(Object.prototype.hasOwnProperty.call(defaults,r.key))defaults[r.key]=String(r.value||'');});return defaults;
}
function studySpringRecipes_(ss){
 if(!ss.getSheetByName('春夏レシピ'))return [];
 const fields=['recipe_id','季節','野菜名','料理名','何人分','調理時間(分)','野菜重量(g)','材料','作り方','アレルギー注意','調理ポイント','完成写真URL'];
 const seen=new Set();return parentsRowsApi_(ss,'春夏レシピ').filter(r=>{
  const id=String(r.recipe_id||'');if(!/^SS\d{2,4}$/.test(id)||seen.has(id)||r['公開状態']!=='公開'||!r['料理名']||!(r['材料1']||r['材料'])||!(r['作り方1']||r['作り方'])||!(Number(r['何人分'])>0)||!(Number(r['野菜重量(g)'])>0))return false;
  seen.add(id);return true;
 }).map(r=>{const out=Object.fromEntries(fields.map(k=>[k,String(r[k]||'')]));out['材料']=r['材料1']?Array.from({length:8},(_,i)=>[r['材料'+(i+1)],r['分量'+(i+1)]].filter(Boolean).join(' ')).filter(Boolean).join('\n'):out['材料'];out['作り方']=r['作り方1']?Array.from({length:6},(_,i)=>r['作り方'+(i+1)]).filter(Boolean).join('\n'):out['作り方'];if(!out['完成写真URL']&&/^[A-Za-z0-9_.-]+\.(png|jpe?g|webp)$/i.test(r['完成写真ファイル名']||'')&&r['完成写真確認状態']==='確認済み')out['完成写真URL']='https://naoki6043.github.io/yasai-challenge-parents/images/'+r['完成写真ファイル名'];return out;});
}
function studyExtensionContent_(status){
 const ss=parentsSpreadsheet_(),quizFields=['question_id','lesson_id','学年区分','問題文','選択肢1','選択肢2','選択肢3','選択肢4','正解','正解時解説','不正解時解説','content_version'];
 const quizzes=status.gates.learn?parentsRowsApi_(ss,'クイズ問題').filter(r=>r['公開状態']==='公開'&&/^Q_[A-Z0-9_]+$/.test(r.question_id)&&r['問題文']&&[1,2,3,4].includes(Number(r['正解']))&&r['選択肢'+r['正解']]).map(r=>Object.fromEntries(quizFields.map(k=>[k,String(r[k]||'')]))):[];
 const spring=status.gates.spring?studySpringRecipes_(ss):[];
 return {quizzes,spring_recipes:spring,spring_unlocked:status.gates.spring,spring_ready:spring.length>0};
}
function studyReport_(status){
 const config=studyExtensionSettings_(),opens=studyDate_(config.report_opens_on);
 if(!studyOn_(config.report_enabled)||!status.completed.T4||!opens||studyToday_()<opens)throw Error('アンケート回答確認後、報告開始日からご覧いただけます。');
 const start=studyDate_(config.report_start),end=studyDate_(config.report_end);
 if(!start||!end||end<start)throw Error('研究報告の集計期間を確認してください。');
 const ss=parentsSpreadsheet_(),people=studyRows_(studySheet_('研究参加者',STUDY_PART_HEADERS),STUDY_PART_HEADERS.length);
 const eligible=new Set(people.filter(r=>r[0]&&!String(r[0]).startsWith('P-TEST-')&&r[3]&&r[5]).map(r=>String(r[0])));
 const recipes=[...parentsPublicData_().recipes,...studySpringRecipes_(ss)],weights=new Map(recipes.map(r=>[r.recipe_id,Number(r['野菜重量(g)'])/(Number(r['何人分'])||1)]));
 const source=ss.getSheetByName('保護者記録')?parentsRowsApi_(ss,'保護者記録'):[];
 return studyAggregateReport_(source,eligible,weights,{start,end,title:config.report_title,message:config.report_message,opens});
}
function studyAggregateReport_(rows,eligible,weights,config){
 const latest=new Map();for(const row of rows){if(!eligible.has(row.participant_id))continue;const key=row.participant_id+'|'+row.record_id,prev=latest.get(key);if(!prev||Number(row.change_version)>=Number(prev.change_version))latest.set(key,row);}
 const families=new Set(),recipeSet=new Set(),byMonth=new Map();let count=0,eaten=0,grams=0,estimated=0,excluded=0,fallback=0;
 for(const row of latest.values()){
  const date=studyDate_(row['日付']);if(row['状態']!=='有効'||!date||date<config.start||date>config.end)continue;
  count++;families.add(row.participant_id);recipeSet.add(row.recipe_id);
  const month=date.slice(0,7);if(!byMonth.has(month))byMonth.set(month,{month,records:0,estimated_grams:0,estimated_records:0});const m=byMonth.get(month);m.records++;
  const portion=Number(row.portion);if(String(row.portion)===''||![0,.25,.5,.75,1].includes(portion)){excluded++;continue;}if(portion>0)eaten++;
  const stored=row['野菜重量(g/人)'],weight=String(stored||'').trim()?Number(stored):weights.get(row.recipe_id);
  if(!Number.isFinite(weight)||weight<=0){excluded++;continue;}
  if(!String(stored||'').trim())fallback++;
  const amount=weight*portion;grams+=amount;estimated++;m.estimated_grams+=amount;m.estimated_records++;
 }
 return {ok:true,report:{title:config.title,message:config.message,start:config.start,end:config.end,updated_at:new Date().toISOString(),recording_households:families.size,records:count,recipes:recipeSet.size,eaten_records:eaten,estimated_records:estimated,excluded_records:excluded,current_recipe_fallback_records:fallback,estimated_grams:Math.round(grams*10)/10,months:[...byMonth.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(m=>({...m,estimated_grams:Math.round(m.estimated_grams*10)/10})),method:'1人分の野菜重量×記録した摂取割合を合計。削除済み・試験用・期間外の記録は除外。野菜重量等が不明な記録は摂取量の計算から除外。過去の重量が保存されていない記録は、現在のレシピの野菜重量で補完。',limitation:'アプリに記録された料理だけの推定値です。実際に計量した摂取量や、朝食全体・1日全体の野菜摂取量ではありません。記録のない日は0gとは扱いません。'}};
}
/** 管理者用。公開日まではネイティブフォームの回答受付も閉じる。 */
function syncStudyFormReception(){
 if(parentsSpreadsheet_().getId()!=='1mvyWp_CxPcO4_QRbY8bqiXoEWW5XxMpp9ApaH4XdzvM')throw Error('wrong_sheet');
 const cfg=studySettings_(),today=studyToday_(),result=[];
 for(const entry of studyForms_()){
  const form=FormApp.openById(String(entry.form_id)),open=studyOn_(cfg.enabled)&&studyOn_(cfg.consent_approved)&&studyOn_(entry.enabled)&&!!studyDate_(entry.opens_on)&&today>=studyDate_(entry.opens_on);
  if(typeof form.setPublished==='function'&&!form.isPublished())form.setPublished(true);
  if(form.isAcceptingResponses()!==open)form.setAcceptingResponses(open);
  result.push({stage:entry.stage,date:studyDate_(entry.opens_on),enabled:studyOn_(entry.enabled),accepting:form.isAcceptingResponses()});
 }console.log(JSON.stringify(result));return result;
}
function installStudyReceptionSchedule(){
 const triggers=ScriptApp.getProjectTriggers();if(!triggers.some(t=>t.getHandlerFunction()==='syncStudyFormReception'))ScriptApp.newTrigger('syncStudyFormReception').timeBased().everyDays(1).atHour(0).nearMinute(5).inTimezone('Asia/Tokyo').create();
 return syncStudyFormReception();
}

function studyRestoreRecords_(pid){
 const ss=parentsSpreadsheet_(),rows=ss.getSheetByName('保護者記録')?parentsRowsApi_(ss,'保護者記録'):[],latest=new Map();
 for(const r of rows){if(r.participant_id!==pid||!/^E-[A-Za-z0-9-]{8,100}$/.test(r.record_id||''))continue;const prev=latest.get(r.record_id);if(!prev||Number(r.change_version)>=Number(prev.change_version))latest.set(r.record_id,r);}
 const records=[],deleted_records=[];let last_change_version=0;
 for(const r of latest.values()){
  const version=Number(r.change_version)||0;last_change_version=Math.max(last_change_version,version);
  if(r['状態']==='削除済み'){deleted_records.push({id:r.record_id,change_version:version});continue;}
  const participation={'一緒に作った':'together','一部を手伝った':'helped','参加していない':'none'}[r['子どもの調理参加']],portion=Number(r.portion),date=studyDate_(r['日付']);
  if(r['状態']!=='有効'||!date||!participation||String(r.portion)===''||![0,.25,.5,.75,1].includes(portion)||!/^(R(0[1-9]|[12][0-9]|30)|SS\d{2,4})$/.test(r.recipe_id||''))continue;
  records.push({id:r.record_id,recipe_id:r.recipe_id,recipe:String(r['料理名']||''),veg:String(r['野菜名']||''),date,participation,portion,createdAt:Date.parse(r['更新日時'])||version,updatedAt:version,change_version:version});
 }
 return {records,deleted_records,last_change_version};
}
function studyRecoveryRequest_(event,config){
 if(!studyOn_(config.recovery_enabled))throw Error('メールでの復帰は現在準備中です。');
 const generic={ok:true,message:'登録が確認できる場合は、確認用メールを送信します。メール内のリンクは30分間・1回限り有効です。届かない場合は迷惑メールをご確認ください。'};
 const email=String(event.email||'').trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return generic;
 const hash=studyHash_(email),cache=CacheService.getScriptCache();if(cache.get('recovery-'+hash))return generic;cache.put('recovery-'+hash,'1',300);
 const participants=studyRows_(studySheet_('研究参加者',STUDY_PART_HEADERS),STUDY_PART_HEADERS.length).filter(r=>r[9]===email||r[9]==="'"+email);
 if(!participants.length)return generic;
 const sh=studySheet_('メール復帰',['token_hash','participant_id','expires_at','used_at','created_at']),today=new Date().toISOString().slice(0,10);
 if(studyRows_(sh,5).filter(r=>String(r[4]).startsWith(today)).length>=100||MailApp.getRemainingDailyQuota()<5)return generic;
 const now=Date.now(),links=[];
 for(const p of participants.slice(-10)){
  const token=Utilities.getUuid()+Utilities.getUuid();studyWrite_(sh,sh.getLastRow()+1,[studyHash_(token),p[0],String(now+30*60000),'',new Date(now).toISOString()]);
  const done=[4,5,6,7,8].filter(i=>p[i]).length;links.push('登録日：'+String(p[3]).slice(0,10)+'／アンケート回答確認済み：'+done+'回\n'+STUDY_APP_URL+'#restore='+encodeURIComponent(token));
 }
 MailApp.sendEmail({to:email,subject:'朝食やさいチャレンジ 利用再開の確認',body:'端末の買い替え・ブラウザ変更後も、同じ参加者情報で利用を再開できます。\n下のリンクを新しい端末で開いてください。リンクは30分間・1回限り有効です。\n複数の登録がある場合は、登録日と回答済み回数をご確認のうえ、戻りたい登録のリンクを選んでください。\n\n'+links.join('\n\n')+'\n\nアンケートの回答状況・利用できる機能・管理用シートに送信済みの料理記録を引き継ぎます。未送信の記録は復元できません。\n心当たりがない場合は、このメールを破棄してください。'});
 return generic;
}
