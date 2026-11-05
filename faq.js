// Q&A text is managed in the copied spreadsheet. No participant data is read.
const FAQ_DEFAULT=[{"表示順":10,"分類":"アプリの使い方","質問":"同じ料理を何度も記録できますか？","回答":"はい。同じ料理でも、同じ日でも、食べた・作ったつど記録を追加できます。日付、子どもの調理参加、食べた量を選んで保存してください。"},{"表示順":20,"分類":"アプリの使い方","質問":"記録はどこで確認・変更できますか？","回答":"下のメニューの「記録」から確認できます。「一覧」と「カレンダー」を切り替えられます。カレンダーの日付を選ぶと、その日の記録が表示されます。各記録の「編集」「削除」から変更できます。"},{"表示順":30,"分類":"アプリの使い方","質問":"食べなかった日も記録できますか？","回答":"はい。食べた量で「食べなかった」を選べます。調理に参加したかどうかも、食べた量とは別に記録できます。"},{"表示順":40,"分類":"アプリの使い方","質問":"メールアドレスの登録は必要ですか？","回答":"レシピ一覧は登録前でも閲覧できます。研究参加のメールアドレスは試食前のアンケートで入力します。設定での再入力は不要です。登録状況の確認や変更は設定から行えます。"},{"表示順":50,"分類":"アプリの使い方","質問":"メールを登録すれば、別のスマホでも記録を見られますか？","回答":"メール登録はアンケート照合用です。ログインや記録の引き継ぎには使えません。記録は、保存した端末の同じブラウザで確認してください。"},{"表示順":60,"分類":"アプリの使い方","質問":"通信できないとき、保存した記録はどうなりますか？","回答":"この端末に保存できた記録は、通信できなくても残ります。管理者への送信ができなかったデータは、通信が戻ったときやアプリを開き直したときに再送します。設定画面からも送信待ちのデータを送れます。"},{"表示順":70,"分類":"野菜と食事について","質問":"朝ごはんに野菜を取り入れるには？","回答":"汁物に加える、前日に用意した野菜のおかずを添えるなど、作りやすい方法から試してみてください。このアプリでは、野菜ごとに3つのレシピを紹介しています。"},{"表示順":80,"分類":"野菜と食事について","質問":"子どもが苦手な野菜は、どうしたらよいですか？","回答":"切り方や加熱の仕方、味付けを変えると食べやすくなることがあります。まずは少量を用意し、無理強いせずに試してみてください。洗う・ちぎるなど、調理に関わることも野菜に触れるきっかけになります。"},{"表示順":90,"分類":"野菜と食事について","質問":"野菜の栄養は、どれも同じですか？","回答":"野菜によって含まれる栄養素や量は異なります。ホーム画面の野菜名の下に、主な特徴を紹介しています。1種類だけに偏らず、いろいろな野菜を組み合わせる目安にしてください。"}];
let appFaqRows=get('settingsFaq',FAQ_DEFAULT),appFaqUpdatedAt=get('settingsFaqUpdatedAt','');
function normalizedFaqRows(rows){
 return (Array.isArray(rows)?rows:[]).filter(r=>r&&String(r['質問']||'').trim()&&String(r['回答']||'').trim()&&(r['公開状態']===undefined||r['公開状態']==='公開')).map(r=>({'表示順':Number(r['表示順'])||0,'分類':String(r['分類']||'その他').trim()||'その他','質問':String(r['質問']).trim(),'回答':String(r['回答']).trim()})).sort((a,b)=>a['表示順']-b['表示順']);
}
window.applyFaqData=function(data){
 if(!Array.isArray(data?.faq))return;
 const incoming=Date.parse(data.updatedAt||''),cached=Date.parse(appFaqUpdatedAt||'');
 if(Number.isFinite(incoming)&&Number.isFinite(cached)&&incoming<cached)return;
 appFaqRows=normalizedFaqRows(data.faq);if(Number.isFinite(incoming))appFaqUpdatedAt=data.updatedAt;
 try{save('settingsFaq',appFaqRows);save('settingsFaqUpdatedAt',appFaqUpdatedAt);}catch(e){}
};
if(window.lastPublishedData)window.applyFaqData(window.lastPublishedData);
function faqHTML(){
 const groups=new Map();for(const row of normalizedFaqRows(appFaqRows)){const category=row['分類'];if(!groups.has(category))groups.set(category,[]);groups.get(category).push(row);}
 if(!groups.size)return '';
 return '<section class="card settingsFAQ"><h2>よくある質問（Q＆A）</h2>'+Array.from(groups,([category,items])=>'<h3>'+escapeHtml(category)+'</h3>'+items.map(row=>'<details><summary>'+escapeHtml(row['質問'])+'</summary><p style="white-space:pre-wrap">'+escapeHtml(row['回答'])+'</p></details>').join('')).join('')+'</section>';
}
