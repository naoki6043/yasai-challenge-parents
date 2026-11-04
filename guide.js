// Public user guide. Text and image paths are managed in the copied Sheet.
const GUIDE_DEFAULT=[{"guide_id":"INTRO","表示順":0,"タイトル":"アプリの使い方","本文":"料理の選び方から記録・カレンダーまで、画面付きで確認できます。","画像URLまたはファイル名":"","画像説明":"","公開状態":"公開"},{"guide_id":"START","表示順":10,"タイトル":"はじめに：参加案内とアンケート","本文":"「参加案内・アンケート」から研究説明を確認し、同意して進みます。\nイベント試食前・試食後のアンケートに、それぞれ回答します。メールアドレスは試食前に1回だけ入力します。\n送信後は同じブラウザのアプリへ戻り、「回答状況を確認」を押します。参加者ID・照合コードは自動入力のまま変更しません。\n試食後の回答を確認できると、レシピ詳細と記録を利用できます。","画像URLまたはファイル名":"","画像説明":"","公開状態":"公開"},{"guide_id":"HOME","表示順":20,"タイトル":"1. 料理を選ぶ","本文":"ホームのレシピ一覧は、同意・アンケート回答前でも見られます。気になる料理の写真を選ぶと詳しい作り方へ進みます。","画像URLまたはファイル名":"guide-screen-home.webp","画像説明":"料理を選ぶ操作の説明用画面イメージ","公開状態":"公開"},{"guide_id":"DETAIL","表示順":30,"タイトル":"2. 作り方を確認する","本文":"試食後のアンケートの回答確認後に、材料・作り方・調理時間・アレルギー情報を確認できます。作ったら「記録を追加」を押します。","画像URLまたはファイル名":"guide-screen-recipe.webp","画像説明":"作り方を確認し記録へ進む操作の説明用画面イメージ","公開状態":"公開"},{"guide_id":"RECORD","表示順":40,"タイトル":"3. 日付・調理参加・食べた量を記録する","本文":"日付を確認し、調理参加と食べた量を選んで「記録を保存」を押します。同じ料理も、そのつど何度でも記録できます。\n調理参加：一緒に作った／一部を手伝った／参加していない\n食べた量：全部／3/4／半分／1/4／食べなかった","画像URLまたはファイル名":"guide-screen-form.webp","画像説明":"日付と調理参加と食べた量を選び保存する説明用画面イメージ","公開状態":"公開"},{"guide_id":"HISTORY","表示順":50,"タイトル":"4. 履歴・カレンダーを見る","本文":"下の「記録」から一覧やカレンダーを開きます。日付を選ぶとその日の記録を確認でき、各記録の「編集」「削除」から変更できます。","画像URLまたはファイル名":"guide-screen-calendar.webp","画像説明":"記録のカレンダーと編集と削除の説明用画面イメージ","公開状態":"公開"},{"guide_id":"INSTALL","表示順":60,"タイトル":"ホーム画面に追加する","本文":"iPhone（Safari）は「共有」から、Android（Chrome）は右上のメニューから「ホーム画面に追加」を選びます。","画像URLまたはファイル名":"","画像説明":"","公開状態":"公開"},{"guide_id":"STORAGE","表示順":70,"タイトル":"記録の保存について","本文":"料理の記録は、この端末の同じブラウザで確認できます。ブラウザのデータを消すと確認できなくなるため、必要な内容は事前に控えてください。利用記録は管理者へ送信されます。","画像URLまたはファイル名":"","画像説明":"","公開状態":"公開"},{"guide_id":"EMAIL","表示順":80,"タイトル":"メールアドレスについて","本文":"設定ではメールアドレスの登録状況を確認でき、「変更する」を押したときだけ変更欄が開きます。通常の再入力は不要です。","画像URLまたはファイル名":"","画像説明":"","公開状態":"公開"},{"guide_id":"NOTICE","表示順":90,"タイトル":"画面について","本文":"画面は現行アプリの項目・レシピ写真をもとにした説明用の表示例です。実際の参加者の記録は使用していません。表示は更新により変わる場合があります。","画像URLまたはファイル名":"","画像説明":"","公開状態":"公開"},{"guide_id":"CONTACT","表示順":100,"タイトル":"お問い合わせ","本文":"東海学園大学 健康栄養学部\nアプリに関するお問い合わせ：takayanagi-n@tokaigakuen-u.ac.jp","画像URLまたはファイル名":"","画像説明":"","公開状態":"公開"}];
let appGuideSections=get('usageGuide',GUIDE_DEFAULT);
function normalizedGuideRows(rows){
 const seen=new Set();
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&/^[A-Z][A-Z0-9_]{0,39}$/.test(String(r.guide_id||''))&&String(r['タイトル']||'').trim()&&(r['公開状態']===undefined||String(r['公開状態']).trim()==='公開')&&!seen.has(r.guide_id)&&!!seen.add(r.guide_id)).sort((a,b)=>(Number(a['表示順'])||0)-(Number(b['表示順'])||0));
}
window.applyGuideData=function(data){
 if(!Array.isArray(data?.usage_guide))return;
 appGuideSections=normalizedGuideRows(data.usage_guide);
 try{save('usageGuide',appGuideSections);}catch(e){}
};
if(window.lastPublishedData)window.applyGuideData(window.lastPublishedData);
function guideImageURL(value){
 const raw=String(value||'').trim();if(!raw)return '';
 if(Object.prototype.hasOwnProperty.call(window.GUIDE_BUILTIN_IMAGES||{},raw))return window.GUIDE_BUILTIN_IMAGES[raw];
 try{
  const url=new URL(raw,location.href);
  if(/^https:\/\//i.test(raw)&&url.protocol==='https:'&&!url.username&&!url.password)return url.href;
  if(/^(?:(?:images|guide-images)\/)?[A-Za-z0-9_.-]+\.(?:webp|png|jpe?g)$/i.test(raw)&&url.origin===new URL(location.href).origin)return url.href;
 }catch(e){}
 return '';
}
function guideInfo(){const rows=normalizedGuideRows(appGuideSections);return {rows,intro:rows.find(r=>r.guide_id==='INTRO')};}
function guideEntryHTML(){
 const {intro}=guideInfo();
 return '<section class="card guideEntry"><h2>'+escapeHtml(intro?.['タイトル']||'アプリの使い方')+'</h2><p>'+escapeHtml(intro?.['本文']||'レシピの見方、記録、カレンダーの使い方を画面付きで確認できます。')+'</p><button class="primary" onclick="go(\'guide\')">使い方を見る</button></section>';
}
function appGuide(){
 const {rows,intro}=guideInfo(),sections=rows.filter(r=>r.guide_id!=='INTRO');
 app.innerHTML='<div id="appGuideTop"></div><button class="back" onclick="go(\'settings\')">‹ 設定にもどる</button>'+head(intro?.['タイトル']||'アプリの使い方')+'<div class="appGuidePage">'+(intro?'<p class="guideBody">'+escapeHtml(intro['本文']||'')+'</p>':'')+(sections.length?sections.map(r=>{
  const image=guideImageURL(r['画像URLまたはファイル名']);
  return '<section class="card appGuideSection" id="guide-'+r.guide_id+'"><h2>'+escapeHtml(r['タイトル'])+'</h2><p class="guideBody">'+escapeHtml(r['本文']||'')+'</p>'+(image?'<figure class="guideFigure"><div class="guidePhone"><img src="'+escapeHtml(image)+'" alt="'+escapeHtml(r['画像説明']||r['タイトル'])+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest(\'figure\').classList.add(\'guideImageFailed\')"></div><p class="guideImageFallback">画面画像を読み込めませんでした。本文をご確認ください。</p><figcaption>'+escapeHtml(r['画像説明']||'説明用の表示例')+'</figcaption></figure>':'')+'</section>';
 }).join(''):'<section class="card"><p>使い方を準備しています。時間をおいて再読み込みしてください。</p></section>')+'<p><a class="guideTopLink" href="#appGuideTop">上へ戻る</a></p></div>';
}
function publicGuideSettings(){
 app.innerHTML=head('設定')+guideEntryHTML()+'<section class="card"><h2>研究への参加</h2><p>'+(typeof researchConfig!=='undefined'&&researchConfig.enabled?'研究説明と同意、アンケートは参加案内から確認できます。':'研究への参加受付は準備中です。アプリの使い方は、受付前でもご覧いただけます。')+'</p><button class="secondary" onclick="go(\'notice\')">参加案内・アンケート</button></section>';
}
if(new URL(location.href).searchParams.get('page')==='guide'){page='guide';render();}

