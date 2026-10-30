function currentVegetables(){

  // 野菜の分類別・五十音順
  const vegOrder = [
    '小松菜',
    '青梗菜',
    '白菜',
    'ほうれん草',
    'カリフラワー',
    'ブロッコリー',
    'かぶ',
    'ごぼう',
    '大根',
    '人参'
  ];

  // 公開データからレシピのエネルギー量を取得
  function getEnergy(name){

    const id = recipeIds[name] || '';
    const recipe = remoteById(id);

    if(!recipe){
      return Infinity;
    }

    const value = String(
      recipe['エネルギー(kcal)'] ?? ''
    ).trim();

    if(value === ''){
      return Infinity;
    }

    const energy = Number(value);

    return Number.isFinite(energy)
      ? energy
      : Infinity;
  }

  return vegetables
    .map(v => {

      // 元の配列を変更せず、レシピだけ並び替える
      const sortedRecipes = [...v[2]].sort((a,b) => {

        const energyA = getEnergy(a);
        const energyB = getEnergy(b);

        if(energyA !== energyB){
          return energyA - energyB;
        }

        // 同じエネルギー量の場合はrecipe_id順
        return (recipeIds[a] || '')
          .localeCompare(recipeIds[b] || '');
      });

      return [v[0], v[1], sortedRecipes];

    })
    .sort((a,b) => {

      const orderA = vegOrder.indexOf(a[0]);
      const orderB = vegOrder.indexOf(b[0]);

      return (
        (orderA === -1 ? 999 : orderA) -
        (orderB === -1 ? 999 : orderB)
      );

    });
}

function recipePhoto(name, explicitId=''){

  const id=
    explicitId ||
    recipeIds[name] ||
    '';

  const r=
    remoteById(id) ||
    remoteByName(name);


  if(r && r['完成写真URL']){
    return r['完成写真URL'];
  }


  if(r && r['完成写真ファイル名']){
    return 'images/'+r['完成写真ファイル名'];
  }


  // 移行期間中の旧画像
  return recipeImages[name] || '';
}
function recipeDetailHTML(name, explicitId=''){

  const id=
    explicitId ||
    recipeIds[name] ||
    '';

  const r=
    remoteById(id) ||
    remoteByName(name);

  if(!r){
    return `
      <p class="note">
        このレシピの材料・作り方は現在準備中です。
      </p>
    `;
  }


  // -----------------------------
  // 材料
  // -----------------------------

  const mats=[];

  for(let i=1;i<=8;i++){

    const ingredient=
      String(r['材料'+i]||'').trim();

    const amount=
      String(r['分量'+i]||'').trim();

    if(ingredient){

      mats.push(`
        <li>
          <span>${ingredient}</span>
          ${amount
            ? `<strong>${amount}</strong>`
            : ''
          }
        </li>
      `);
    }
  }


  // -----------------------------
  // 作り方
  // -----------------------------

  const steps=[];

  for(let i=1;i<=6;i++){

    const step=
      String(r['作り方'+i]||'').trim();

    if(step){
      steps.push(`<li>${step}</li>`);
    }
  }


  // -----------------------------
  // 人数表示
  // -----------------------------

  const servings=
    String(r['何人分']||'').trim();

  let servingsText='';

  if(servings){

    servingsText=
      servings.includes('人')
        ? `（${servings}）`
        : `（${servings}人分）`;
  }


  // -----------------------------
  // 調理時間
  // -----------------------------

  const cookingTime=
    String(r['調理時間(分)']||'').trim();


  // -----------------------------
  // 栄養情報
  // 入力されている項目だけ表示
  // -----------------------------

  const nutritionItems=[];

  const energy=
    String(r['エネルギー(kcal)']||'').trim();

  const calcium=
    String(r['カルシウム(mg)']||'').trim();

  const iron=
    String(r['鉄(mg)']||'').trim();

  const vitaminC=
    String(r['ビタミンC(mg)']||'').trim();

  const fiber=
    String(r['食物繊維(g)']||'').trim();

  const vegetableWeight=
    String(r['野菜重量(g)']||'').trim();


  if(energy){
    nutritionItems.push(`
      <li>
        <span>エネルギー</span>
        <strong>${energy} kcal</strong>
      </li>
    `);
  }

  if(calcium){
    nutritionItems.push(`
      <li>
        <span>カルシウム</span>
        <strong>${calcium} mg</strong>
      </li>
    `);
  }

  if(iron){
    nutritionItems.push(`
      <li>
        <span>鉄</span>
        <strong>${iron} mg</strong>
      </li>
    `);
  }

  if(vitaminC){
    nutritionItems.push(`
      <li>
        <span>ビタミンC</span>
        <strong>${vitaminC} mg</strong>
      </li>
    `);
  }

  if(fiber){
    nutritionItems.push(`
      <li>
        <span>食物繊維</span>
        <strong>${fiber} g</strong>
      </li>
    `);
  }

  if(vegetableWeight){
    nutritionItems.push(`
      <li>
        <span>野菜</span>
        <strong>${vegetableWeight} g</strong>
      </li>
    `);
  }


  // -----------------------------
  // HTML
  // -----------------------------

  return `

    ${cookingTime
      ? `
        <div class="recipeMeta">
          ⏱ 調理時間の目安：${cookingTime}分
        </div>
      `
      : ''
    }

    ${mats.length
  ? `
      <h3>材料${servingsText}</h3>

      <ul class="ingredientList">
        ${mats.join('')}
      </ul>
    `
  : ''
}

${String(r['アレルギー注意'] || '').trim()
  ? `
    <div class="recipeAllergy">
      <strong>アレルギー情報：</strong>
      ${escapeHtml(String(r['アレルギー注意']).trim())}
      <p>
        使用する調味料・加工食品の原材料表示も
        必ず確認してください。
      </p>
    </div>
  `
  : ''
}

    ${steps.length
      ? `
        <h3>作り方</h3>

        <ol class="recipeSteps">
          ${steps.join('')}
        </ol>
      `
      : ''
    }

            ${(r['調理ポイント'] || r['工程写真ファイル名'] || r['工程写真URL'])
      ? `
        <div class="lessonBox">
          <strong>調理のポイント</strong>

          ${(r['工程写真URL'] || r['工程写真ファイル名'])
            ? `
              <div class="stepPhotoRow">

                <img
                  class="stepPhoto"
                  src="${r['工程写真URL'] || 'images/' + r['工程写真ファイル名']}"
                  alt="調理工程の写真"
                  loading="lazy"
                >

                <div class="stepPhotoText">
                  ${r['工程写真説明'] || r['調理ポイント']
                    ? `<p>${r['工程写真説明'] || r['調理ポイント']}</p>`
                    : ''
                  }

                  ${(r['調理ポイント'] &&
                     r['工程写真説明'] &&
                     r['調理ポイント'].trim() !== r['工程写真説明'].trim())
                    ? `<p>${r['調理ポイント']}</p>`
                    : ''
                  }
                </div>

              </div>
            `
            : `
              ${r['調理ポイント']
                ? `<p>${r['調理ポイント']}</p>`
                : ''
              }
            `
          }

        </div>
      `
      : ''
    }

    ${nutritionItems.length
      ? `
        <h3>栄養情報（1人分）</h3>

        <ul class="ingredientList nutritionList">
          ${nutritionItems.join('')}
        </ul>
      `
      : ''
    }

    ${r['子どもへの一言']
      ? `
        <div class="lessonBox">
          <strong>やさいの豆知識</strong>
          <p>${r['子どもへの一言']}</p>
        </div>
      `
      : ''
    }

    ${r['大人と一緒に行う工程']
      ? `
        <div class="lessonBox">
          <strong>安全に作ろう</strong>
          <p>${r['大人と一緒に行う工程']}</p>
        </div>
      `
      : ''
    }

  `;
}

const recipeIds={
  '小松菜お浸し':'R01',
  '小松菜アーモンドフィッシュ炒め':'R02',
  '小松菜クリーム煮':'R03',

  'ほうれん草ショウガお浸し':'R04',
  'ほうれん草エノキサラダ':'R05',
  'ほうれん草ベーコンバター炒め':'R06',

  'やみつきブロッコリー塩昆布':'R07',
  'ブロッコリーハムケチャップ炒め':'R08',
  'ブロッコリーとカニカマのポン酢和え':'R09',

  '塩昆布とカリフラワーの和え物':'R10',
  'カリフラワーのマスタード和え':'R11',
  'カリフラワーのオイル焼き':'R12',

  'キャロットラペ':'R13',
  'にんじんしりしり':'R14',
  'にんじんもやしナムル':'R15',

  '大根ツナポン':'R16',
  '大根みそ':'R17',
  '大根明太マヨ':'R18',

  '白菜の和風おかか和え':'R19',
  '白菜とベーコンのミルフィーユ蒸し':'R20',
  '白菜のツナチーズ焼き':'R21',

  '青梗菜のしらす和え':'R22',
  '青梗菜中華胡麻和え':'R23',
  '青梗菜とちくわのごま和え':'R24',

  'かぶとツナの和え物':'R25',
  'かぶの味噌田楽':'R26',
  'かぶとベーコンのチーズ炒め':'R27',

  'きんぴらごぼう':'R28',
  'ごぼうと卵の炒め物':'R29',
  'ごぼうとアーモンドの甘辛炒め':'R30'
};
const vegetables=[
['小松菜','🥬',['小松菜お浸し','小松菜アーモンドフィッシュ炒め','小松菜クリーム煮']],
['ほうれん草','🌿',['ほうれん草ショウガお浸し','ほうれん草エノキサラダ','ほうれん草ベーコンバター炒め']],
['ブロッコリー','🥦',['やみつきブロッコリー塩昆布','ブロッコリーハムケチャップ炒め','ブロッコリーとカニカマのポン酢和え']],
['カリフラワー','☁️',['塩昆布とカリフラワーの和え物','カリフラワーのマスタード和え','カリフラワーのオイル焼き']],
['人参','🥕',['キャロットラペ','にんじんしりしり','にんじんもやしナムル']],
['大根','🤍',['大根ツナポン','大根みそ','大根明太マヨ']],
['白菜','🥬',['白菜の和風おかか和え','白菜とベーコンのミルフィーユ蒸し','白菜のツナチーズ焼き']],
['青梗菜','🌱',['青梗菜のしらす和え','青梗菜中華胡麻和え','青梗菜とちくわのごま和え']],
['かぶ','⚪',['かぶとツナの和え物','かぶの味噌田楽','かぶとベーコンのチーズ炒め']],
['ごぼう','🟤',['きんぴらごぼう','ごぼうと卵の炒め物','ごぼうとアーモンドの甘辛炒め']]
];

function openRecipeHome(vegName,i){
  vegSel=currentVegetables().find(v=>v[0]===vegName);

  const name=vegSel[2][i];
  const recipeId=recipeIds[name]||'';
  const remote=remoteById(recipeId);

  recipeSel={
  recipe_id:recipeId,

  season_id:
    remote?.['season_id'] ||
    'AW',

  veg:
    remote?.['野菜名'] ||
    vegName,

  name:
    remote?.['料理名'] ||
    name
};

  log('recipe_open',{
  recipe_id:recipeSel.recipe_id,
  season_id:recipeSel.season_id,
  veg:recipeSel.veg,
  recipe:recipeSel.name
});

    page='recipe';
  render();
  window.scrollTo(0, 0);
}


function recipeEnergyNav(){

  if(!vegSel || !recipeSel) return '';

  const names = vegSel[2];

  return `
    <section class="energyNav">
      <div class="energyNavTitle">
        3つの料理のエネルギー量
        <small>1人分・少ない順</small>
      </div>

      <div class="energyNavBar">
        ${names.map((name, i) => {

          const id = recipeIds[name] || '';
          const r = remoteById(id);
          const value = String(
            r?.['エネルギー(kcal)'] ?? ''
          ).trim();

          const active = id === recipeSel.recipe_id;

          return `
            <button
              type="button"
              class="energyNavItem ${active ? 'selected' : ''}"
              onclick="selectRecipeFromNav(${i})"
              aria-pressed="${active}"
              aria-label="${value ? value + 'キロカロリー' : 'エネルギー未登録'}の料理を表示"
            >
              <strong>${value || '—'}</strong>
              <span>kcal</span>
            </button>
          `;

        }).join('')}
      </div>

      <p class="energyNavNote">
        数字をタップすると、別の料理を見ることができます。
      </p>
    </section>
  `;
}

function selectRecipeFromNav(index){

  if(!vegSel || !vegSel[2][index]) return;

  const name = vegSel[2][index];
  const id = recipeIds[name] || '';

  if(!id || id === recipeSel.recipe_id) return;

  const remote = remoteById(id);

  recipeSel = {
    recipe_id: id,
    season_id: remote?.['season_id'] || 'AW',
    veg: remote?.['野菜名'] || vegSel[0],
    name: remote?.['料理名'] || name
  };

  log('recipe_open',{
    recipe_id: recipeSel.recipe_id,
    season_id: recipeSel.season_id,
    veg: recipeSel.veg,
    recipe: recipeSel.name
  });

  render();
  window.scrollTo(0,0);
}


function setupRecipeSwipe(){

  const area = document.querySelector('#recipeSwipeArea');
  if(!area) return;

  let startX = 0;
  let startY = 0;

  area.addEventListener('touchstart', e => {
    if(e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, {passive:true});

  area.addEventListener('touchend', e => {
    if(e.changedTouches.length !== 1) return;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // 縦スクロールや小さな指の動きでは切り替えない
    if(Math.abs(dx) < 65) return;
    if(Math.abs(dx) < Math.abs(dy) * 1.5) return;

    if(!vegSel || !recipeSel) return;

    const index = vegSel[2].findIndex(
      name => recipeIds[name] === recipeSel.recipe_id
    );

    if(index < 0) return;

    const nextIndex = dx < 0 ? index + 1 : index - 1;

    if(nextIndex < 0 || nextIndex >= vegSel[2].length) return;

    selectRecipeFromNav(nextIndex);

  }, {passive:true});
}



function notice(){

  // 更新日の新しい順に並べる
  const notices=[...remoteNotices].sort((a,b)=>{
    const da=String(a['更新日']||'');
    const db=String(b['更新日']||'');
    return db.localeCompare(da);
  });

  let body='';

  if(notices.length===0){

    body=`
      <div class="card">
        <p>現在、お知らせはありません。</p>
      </div>
    `;

  }else{

    body=notices.map(n=>{

      const title=n['タイトル']||'お知らせ';
      const text=n['本文']||'';
      const date=n['更新日']||'';

      return `
        <article class="card noticeCard">

          <div class="noticeDate">
            ${date ? `更新日：${date}` : ''}
          </div>

          <h2>${title}</h2>

          <div class="noticeText">
            ${String(text).replace(/\n/g,'<br>')}
          </div>

        </article>
      `;

    }).join('');

  }

  app.innerHTML=
    head(
      'お知らせ',
      '新しい情報をチェックしよう'
    )+
    `
      <div class="noticeList">
        ${body}
      </div>
    `;
}
