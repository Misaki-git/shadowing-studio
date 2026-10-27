(()=>{'use strict';
const SHEET_ID='1GsmBRTIZ-sgMltmiHaUdJYeoaA1AcmK0oaRjQ7nFG1U';
const SCOPE='https://www.googleapis.com/auth/spreadsheets.readonly';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let token='',oauth=null,tabs=[],questions=[],index=0,revealed=false,missed=new Set(),order=[];
const section=document.createElement('section');section.id='compositionSection';
section.innerHTML=`<h2>④ 瞬間英作文</h2><p>日本語を見て英語で答え、正解を確認するモードです。既存のシャドーイング機能とは独立して動作します。</p>
<div id="compStatus" class="notice">「英作文教材を読み込む」を押してください。</div>
<p><button type="button" id="compConnect" class="alt">英作文教材を読み込む</button></p>
<label for="compTab">英作文シリーズ</label><select id="compTab" disabled><option value="">未接続</option></select>
<label for="compLesson">Lesson</label><select id="compLesson" disabled><option value="">シリーズを選択</option></select>
<div id="compPractice" class="hidden">
<p id="compCount" class="info"></p>
<div class="comp-question"><div class="comp-small">日本語を英語にしてください</div><div id="compJapanese"></div></div>
<div id="compAnswer" class="comp-answer hidden"><div class="comp-small">正解例</div><div id="compEnglish"></div></div>
<p><button type="button" id="compReveal">正解を表示</button> <button type="button" id="compMiss" class="alt">苦手に登録</button></p>
<div class="row"><button type="button" id="compPrev" class="alt">前の文</button><button type="button" id="compNext" class="alt">次の文</button><button type="button" id="compRandom" class="alt">ランダム</button><button type="button" id="compRetry" class="alt">苦手だけ復習</button></div>
<p id="compProgress" class="info"></p></div>`;
const style=document.createElement('style');style.textContent=`#compositionSection .comp-question{background:#edf2fa;border-radius:12px;padding:22px 15px;text-align:center;margin:12px 0;line-height:1.7;font-size:19px}#compositionSection .comp-answer{border:1px solid #cbd5e1;border-radius:12px;padding:15px;margin:12px 0;line-height:1.7;font-size:17px}#compositionSection .comp-small{font-size:12px;color:#617088;margin-bottom:8px}#compositionSection button{margin-top:4px}#compositionSection .row{margin-top:12px}`;
document.head.append(style);
const host=$('lesson')?.closest('section');if(host)host.after(section);else document.querySelector('main')?.append(section);
const status=msg=>{$('compStatus').textContent=msg;};
const err=e=>e?.message||String(e);
function fill(id,items,label){const s=$(id);s.replaceChildren(new Option(label,''));items.forEach(x=>s.add(new Option(x.label,x.value)));s.disabled=!items.length;}
async function loadGIS(){if(window.google?.accounts?.oauth2)return;await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=ok;s.onerror=()=>no(Error('Google認証を読み込めません'));document.head.append(s);});}
async function sheets(path){if(!token)throw Error('Google Sheetsへの認証が必要です');const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+path,{headers:{Authorization:'Bearer '+token}});if(!r.ok){const t=await r.text();throw Error('Sheets API '+r.status+' '+t.slice(0,250));}return r.json();}
async function loadTabs(){status('英作文タブを読み込み中…');const data=await sheets('?fields=sheets(properties(title))');tabs=(data.sheets||[]).map(s=>s.properties.title).filter(n=>n.endsWith('_英作文'));fill('compTab',tabs.map(n=>({label:n.replace(/_英作文$/,''),value:n})),'シリーズを選択');fill('compLesson',[],'シリーズを選択');$('compPractice').classList.add('hidden');status(tabs.length?`${tabs.length}シリーズを読み込みました。`:'「100日英語_英作文」など、名前が「_英作文」で終わるタブを作ってください。');}
$('compConnect').onclick=async()=>{try{if(!window.GOOGLE_CLIENT_ID)throw Error('config.jsのClient IDが見つかりません');await loadGIS();oauth??=google.accounts.oauth2.initTokenClient({client_id:window.GOOGLE_CLIENT_ID,scope:SCOPE,callback:()=>{}});oauth.callback=async r=>{if(r.error){status('認証エラー：'+r.error);return;}token=r.access_token;try{await loadTabs();}catch(e){status('読み込みエラー：'+err(e));}};oauth.requestAccessToken({prompt:'consent'});}catch(e){status(err(e));}};
function parseRows(values){if(!values?.length)return [];const heads=values[0].map(x=>String(x).trim().toLowerCase());const col=name=>heads.indexOf(name);const li=col('lesson'),ni=col('no'),ji=col('japanese'),ei=col('english');if([li,ni,ji,ei].some(n=>n<0))throw Error('1行目には lesson / no / japanese / english が必要です');return values.slice(1).map((r,i)=>({lesson:String(r[li]??'').trim(),no:Number(r[ni]),japanese:String(r[ji]??'').trim(),english:String(r[ei]??'').trim(),row:i+2})).filter(q=>q.lesson&&Number.isFinite(q.no)&&q.japanese&&q.english);}
let all=[];
$('compTab').onchange=async()=>{const tab=$('compTab').value;fill('compLesson',[],'読み込み中…');$('compPractice').classList.add('hidden');if(!tab)return;try{status('問題を読み込み中…');const range=encodeURIComponent("'"+tab.replace(/'/g,"''")+"'!A:D");const d=await sheets('/values/'+range+'?valueRenderOption=FORMATTED_VALUE');all=parseRows(d.values||[]);const ids=[...new Set(all.map(q=>q.lesson))].sort((a,b)=>Number(a)-Number(b));fill('compLesson',ids.map(n=>({value:n,label:'Lesson '+n})),'Lessonを選択');status(`${all.length}問・${ids.length}レッスンを読み込みました。`);}catch(e){status('読み込みエラー：'+err(e));}};
function show(){if(!questions.length){$('compPractice').classList.add('hidden');return;}$('compPractice').classList.remove('hidden');const q=questions[order[index]];$('compCount').textContent=`${index+1} / ${order.length}問（Lesson ${q.lesson}・問題 ${q.no}）`;$('compJapanese').textContent=q.japanese;$('compEnglish').textContent=q.english;$('compAnswer').classList.toggle('hidden',!revealed);$('compReveal').textContent=revealed?'正解を隠す':'正解を表示';$('compProgress').textContent=`苦手登録：${missed.size}問`;$('compPrev').disabled=index===0;$('compNext').disabled=index===order.length-1;}
$('compLesson').onchange=()=>{const id=$('compLesson').value;questions=all.filter(q=>q.lesson===id).sort((a,b)=>a.no-b.no);order=questions.map((_,i)=>i);index=0;revealed=false;missed.clear();if(!questions.length)status('このLessonに問題がありません');show();};
$('compReveal').onclick=()=>{revealed=!revealed;show();};
$('compNext').onclick=()=>{if(index<order.length-1){index++;revealed=false;show();}};
$('compPrev').onclick=()=>{if(index>0){index--;revealed=false;show();}};
$('compRandom').onclick=()=>{for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}index=0;revealed=false;show();};
$('compMiss').onclick=()=>{if(!questions.length)return;const q=questions[order[index]];missed.add(q.row);show();};
$('compRetry').onclick=()=>{const subset=questions.map((q,i)=>missed.has(q.row)?i:-1).filter(i=>i>=0);if(!subset.length){status('苦手に登録した問題がまだありません。');return;}order=subset;index=0;revealed=false;show();status('苦手な問題だけを表示しています。');};
})();
