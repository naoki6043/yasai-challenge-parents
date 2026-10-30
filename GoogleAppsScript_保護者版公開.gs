/**
 * 保護者版専用の追加公開処理。既存のdoGet/doPostや公開処理は変更しない。
 * 下記のコピーしたスプレッドシートのApps Scriptへ追加する。
 * スクリプトプロパティ PARENTS_GITHUB_TOKEN に、新リポジトリのみの
 * Contents: Read and write を持つトークンを設定する。ソースへ書かない。
 */
function publishParentsContent() {
  const expectedSheet = '1mvyWp_CxPcO4_QRbY8bqiXoEWW5XxMpp9ApaH4XdzvM';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== expectedSheet) throw new Error('保護者版コピー以外では実行できません');
  const token = PropertiesService.getScriptProperties().getProperty('PARENTS_GITHUB_TOKEN');
  if (!token) throw new Error('PARENTS_GITHUB_TOKEN が未設定です');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rows = parentsRows_(ss, 'レシピ入力');
    const vegetables = parentsRows_(ss, '野菜情報');
    const nutrition = {};
    vegetables.forEach(v => {
      const id = String(v.vegetable_id || '').trim();
      if (!id || nutrition[id]) throw new Error('野菜情報のIDが空欄または重複しています');
      nutrition[id] = String(v['栄養学的特徴'] || '').trim();
    });
    // 公開用項目だけを出力。入力者・確認者・DriveID・行動ログ等は出力しない。
    const fields = ['recipe_id','vegetable_id','season_id','季節','野菜名','表示順','料理名','何人分','調理時間(分)',
      '調理ポイント','子どもへの一言','アレルギー注意','加熱','包丁','調理法','大人と一緒に行う工程',
      '完成写真ファイル名','完成写真URL','工程写真ファイル名','工程写真URL','工程写真表示','工程写真説明',
      'エネルギー(kcal)','カルシウム(mg)','鉄(mg)','ビタミンC(mg)','食物繊維(g)','野菜重量(g)'];
    for (let i=1;i<=8;i++) fields.push('材料'+i,'分量'+i);
    for (let i=1;i<=6;i++) fields.push('作り方'+i);
    const recipes = rows.filter(r=>r['公開状態']==='公開').map(row=>{
      const result={}; fields.forEach(k=>{if(k in row)result[k]=row[k]});
      result['栄養学的特徴']=nutrition[row.vegetable_id]||'';
      if (!result['栄養学的特徴']) throw new Error(row.vegetable_id+' の栄養学的特徴が未入力です');
      return result;
    });
    const expected = Array.from({length:30},(_,i)=>'R'+String(i+1).padStart(2,'0'));
    if(recipes.length!==30 || expected.some(id=>recipes.filter(r=>r.recipe_id===id).length!==1))
      throw new Error('R01〜R30の公開レシピが各1件必要です。公開ファイルは変更していません');
    const notices=parentsRows_(ss,'お知らせ').filter(r=>r['公開状態']==='公開').map(r=>({
      'タイトル':r['タイトル']||'', '本文':r['本文']||'', '更新日':r['更新日']||''
    }));
    const content={ok:true,recipes,notices,updatedAt:new Date().toISOString(),app:'parents-v1'};
    // 固定のコピー先だけに書き込み、元リポジトリには接続しない。
    const url='https://api.github.com/repos/naoki6043/yasai-challenge-parents/contents/content.json';
    const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
    const current=UrlFetchApp.fetch(url+'?ref=main',{headers,muteHttpExceptions:true});
    if(current.getResponseCode()!==200)throw new Error('コピー先の確認に失敗しました: '+current.getResponseCode());
    const payload={message:'Update parent recipe content from Google Sheets',branch:'main',sha:JSON.parse(current.getContentText()).sha,
      content:Utilities.base64Encode(JSON.stringify(content,null,2)+'\n',Utilities.Charset.UTF_8)};
    const result=UrlFetchApp.fetch(url,{method:'put',headers,contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
    if(result.getResponseCode()!==200)throw new Error('公開に失敗しました: '+result.getResponseCode());
    ss.toast('保護者版のcontent.jsonを更新しました。元アプリは変更していません。','保護者版公開',10);
  } finally { lock.releaseLock(); }
}
function parentsRows_(ss,name) {
  const sh=ss.getSheetByName(name);if(!sh)throw new Error(name+' シートがありません');
  const values=sh.getDataRange().getDisplayValues();
  const headers=values.shift().map(String);
  return values.filter(row=>row.some(v=>String(v).trim())).map(row=>{
    const result={};headers.forEach((h,i)=>{if(h)result[h]=row[i]||''});return result;
  });
}
