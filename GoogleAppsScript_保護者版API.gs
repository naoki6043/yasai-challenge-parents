/** 保護者版コピー専用。記録の読み出しAPIは公開しない。 */
const PARENTS_SHEET_ID = '1mvyWp_CxPcO4_QRbY8bqiXoEWW5XxMpp9ApaH4XdzvM';
const PARENTS_RECORD_HEADERS = ['participant_id','record_id','recipe_id','料理名','野菜名','日付','子どもの調理参加','子どもの摂取量','portion','状態','change_version','event_id','更新日時'];

function parentsSpreadsheet_() {
  return SpreadsheetApp.openById(PARENTS_SHEET_ID);
}

function parentsRowsApi_(ss,name) {
  const sheet=ss.getSheetByName(name);
  if(!sheet)throw new Error(name+' シートがありません');
  const values=sheet.getDataRange().getDisplayValues();
  const headers=(values.shift()||[]).map(v=>String(v).trim());
  return values.filter(row=>row.some(v=>String(v).trim())).map(row=>{
    const result={};headers.forEach((key,i)=>{if(key)result[key]=row[i]||''});return result;
  });
}

function parentsPublicData_() {
  const ss=parentsSpreadsheet_();
  const vegetables=parentsRowsApi_(ss,'野菜情報');
  const byId={};
  vegetables.forEach(v=>{
    const id=String(v.vegetable_id||'').trim();
    if(!/^V\d{2}$/.test(id)||byId[id])throw new Error('野菜情報のIDを確認してください');
    const sentence=String(v['栄養学的特徴']||'').trim();
    if(!sentence)throw new Error(id+' の栄養学的特徴が未入力です');
    byId[id]=sentence;
  });
  const fields=['recipe_id','vegetable_id','season_id','季節','野菜名','表示順','料理名','何人分','調理時間(分)','調理ポイント','子どもへの一言','アレルギー注意','加熱','包丁','調理法','大人と一緒に行う工程','工程写真ファイル名','工程写真URL','工程写真表示','工程写真説明','完成写真URL','エネルギー(kcal)','カルシウム(mg)','鉄(mg)','ビタミンC(mg)','食物繊維(g)','野菜重量(g)'];
  for(let i=1;i<=8;i++)fields.push('材料'+i,'分量'+i);
  for(let i=1;i<=6;i++)fields.push('作り方'+i);
  const recipes=parentsRowsApi_(ss,'レシピ入力').filter(r=>String(r['公開状態']).trim()==='公開').map(row=>{
    const r={};fields.forEach(k=>{if(k in row)r[k]=row[k]});
    r['完成写真ファイル名']=row['完成写真確認状態']==='確認済み'?(row['完成写真ファイル名']||''):'';
    r['栄養学的特徴']=byId[r.vegetable_id]||'';
    if(!r['栄養学的特徴'])throw new Error('野菜情報とレシピの対応を確認してください');
    return r;
  });
  const ids=Array.from({length:30},(_,i)=>'R'+String(i+1).padStart(2,'0'));
  if(recipes.length!==30||ids.some(id=>recipes.filter(r=>r.recipe_id===id).length!==1))throw new Error('公開レシピR01〜R30を確認してください');
  const noticeSheet=ss.getSheetByName('お知らせ');
  let notices=[];
  if(noticeSheet){
    const rows=parentsRowsApi_(ss,'お知らせ');
    notices=rows.filter(r=>r.notice_id&&(!('公開状態' in r)||String(r['公開状態']).trim()==='公開')).map(r=>({notice_id:r.notice_id,'タイトル':r['タイトル']||'','本文':r['本文']||'','更新日':r['更新日']||''}));
  }
  return {ok:true,app:'parents-v1',schema_version:1,recipes,notices,lessons:[],quizzes:[],counts:{recipes:recipes.length,notices:notices.length,lessons:0,quizzes:0},updatedAt:new Date().toISOString()};
}

function parentsJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try{return parentsJson_(parentsPublicData_());}
  catch(error){return parentsJson_({ok:false,error:'公開データを確認できません。管理者にお問い合わせください。'});}
}

function parentsValidateRecord_(event) {
  if(!event||event.app_version!=='parents-v1')throw new Error('invalid_app');
  if(!['record_created','record_updated','record_deleted'].includes(event.type))throw new Error('invalid_type');
  if(!/^P-[A-Za-z0-9-]{8,100}$/.test(event.participant_id||''))throw new Error('invalid_participant');
  if(!/^E-[A-Za-z0-9-]{8,100}$/.test(event.event_id||'')||!/^E-[A-Za-z0-9-]{8,100}$/.test(event.record_id||'')||event.id!==event.record_id)throw new Error('invalid_id');
  if(!/^R(0[1-9]|[12][0-9]|30)$/.test(event.recipe_id||''))throw new Error('invalid_recipe');
  if(!['together','helped','none'].includes(event.participation))throw new Error('invalid_participation');
  if(typeof event.portion!=='number'||![0,0.25,0.5,0.75,1].includes(event.portion))throw new Error('invalid_portion');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(event.date||''))throw new Error('invalid_date');
  const date=new Date(event.date+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==event.date)throw new Error('invalid_date');
  const version=event.change_version===undefined?event.ts:event.change_version;
  if(!Number.isSafeInteger(version)||version<1||version>Date.now()+86400000)throw new Error('invalid_version');
  return version;
}

function parentsRecordSheet_(ss,name) {
  let sheet=ss.getSheetByName(name);
  if(!sheet){sheet=ss.insertSheet(name);sheet.getRange(1,1,1,PARENTS_RECORD_HEADERS.length).setValues([PARENTS_RECORD_HEADERS]);sheet.setFrozenRows(1);}
  const headers=sheet.getRange(1,1,1,PARENTS_RECORD_HEADERS.length).getDisplayValues()[0];
  if(headers.join('\t')!==PARENTS_RECORD_HEADERS.join('\t'))throw new Error('record_schema_mismatch');
  return sheet;
}

function parentsSafeCell_(value) {
  const text=String(value||'');return /^[=+\-@]/.test(text)?"'"+text:text;
}

function parentsSaveRecord_(event) {
  const version=parentsValidateRecord_(event);
  const ss=parentsSpreadsheet_();
  // 接続試験は通常記録へ混在させない。公開APIからシート名は指定できない。
  const name=event.participant_id.startsWith('P-TEST-')?'保護者記録_接続テスト':'保護者記録';
  const sheet=parentsRecordSheet_(ss,name);
  const values=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,PARENTS_RECORD_HEADERS.length).getValues():[];
  const index=values.findIndex(r=>String(r[0])===event.participant_id&&String(r[1])===event.record_id);
  const old=index>=0?values[index]:null;
  if(old&&String(old[11])===event.event_id)return {ok:true,event_id:event.event_id,duplicate:true};
  if(old&&Number(old[10])>=version)return {ok:true,event_id:event.event_id,stale:true};
  const recipe=parentsPublicData_().recipes.find(r=>r.recipe_id===event.recipe_id);
  if(!recipe)throw new Error('unknown_recipe');
  const participation={together:'一緒に作った',helped:'一部を手伝った',none:'参加していない'}[event.participation];
  const portion={1:'全部',0.75:'3/4',0.5:'半分',0.25:'1/4',0:'食べなかった'}[event.portion];
  const row=[event.participant_id,event.record_id,event.recipe_id,parentsSafeCell_(recipe['料理名']),parentsSafeCell_(recipe['野菜名']),event.date,participation,portion,event.portion,event.type==='record_deleted'?'削除済み':'有効',version,event.event_id,new Date().toISOString()];
  // 削除済み行は再送による復活を防ぐため残す。利用画面・公開APIには出さない。
  const range=sheet.getRange(index>=0?index+2:sheet.getLastRow()+1,1,1,row.length);
  range.setNumberFormats([row.map((v,i)=>[8,10].includes(i)?'0.##':'@')]);
  range.setValues([row]);
  SpreadsheetApp.flush();
  return {ok:true,event_id:event.event_id};
}

function doPost(e) {
  let lock;
  try{
    const text=e&&e.postData&&e.postData.contents;
    if(typeof text!=='string'||text.length>8000)throw new Error('invalid_body');
    const event=JSON.parse(text);
    parentsValidateRecord_(event);
    lock=LockService.getScriptLock();lock.waitLock(30000);
    return parentsJson_(parentsSaveRecord_(event));
  }catch(error){return parentsJson_({ok:false,error:'記録を保存できませんでした。端末内の記録は残っています。'});}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}

function testParentsPublicData() {
  const data=parentsPublicData_();
  console.log('保護者版公開データ: レシピ '+data.recipes.length+'件、栄養文 '+new Set(data.recipes.map(r=>r.vegetable_id)).size+'野菜');
}
