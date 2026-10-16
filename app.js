(()=>{'use strict';const $=x=>document.getElementById(x);let token='',client,folders=[],sheetTabs=[],lessons=[],stream,rec,chunks=[],blob,blobURL,audioURL,timer,startTime;const SCOPE='https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly';const set=(id,msg)=>$(id).textContent=msg;const error=e=>e?.message||String(e);function opts(id,items,placeholder){const e=$(id);e.replaceChildren(new Option(placeholder,''));items.forEach(x=>e.add(new Option(x.name,x.id)));e.disabled=!items.length}
async function gis(){if(window.google?.accounts?.oauth2)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=()=>reject(Error('Google認証を読み込めません'));document.head.append(s)})}
$('login').onclick=async()=>{try{if(!window.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com')||window.GOOGLE_CLIENT_ID.startsWith('REPLACE'))throw Error('config.jsのOAuthクライアントIDを設定してください');await gis();client??=google.accounts.oauth2.initTokenClient({client_id:window.GOOGLE_CLIENT_ID,scope:SCOPE,callback:()=>{}});client.callback=async r=>{if(r.error){set('auth',r.error);return}token=r.access_token;$('logout').disabled=false;$('refresh').disabled=false;await refresh()};client.requestAccessToken({prompt:'consent'})}catch(e){set('auth',error(e))}};
$('logout').onclick=()=>{if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token='';folders=[];sheetTabs=[];lessons=[];$('logout').disabled=true;$('refresh').disabled=true;['root','series','lesson'].forEach(id=>opts(id,[],'未接続'));set('auth','接続を解除しました')};
async function req(path,params={}){if(!token)throw Error('再ログインしてください');const u=new URL('https://www.googleapis.com/drive/v3/'+path);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{headers:{Authorization:'Bearer '+token}});if(!r.ok)throw Error('Drive API '+r.status+' '+(await r.text()).slice(0,200));return r}
async function list(q){let all=[],next='';do{const d=await (await req('files',{q,fields:'nextPageToken,files(id,name,mimeType,parents)',pageSize:'1000',...(next?{pageToken:next}:{})})).json();all.push(...(d.files||[]));next=d.nextPageToken||''}while(next);return all}
const ROOT_FOLDER_ID = '1dz6AvQLtMvzPiFavmXphWrGwfitSFvTk';
const SHEET_ID = '1GsmBRTIZ-sgMltmiHaUdJYeoaA1AcmK0oaRjQ7nFG1U';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const match = name => name.match(/^(?:day|lesson)?[ _-]*0*(\d+)(?:[ _-].*)?\.(txt|mp3|m4a|wav|aac|webm|url)$/i);
async function sheetReq(path) {
  if (!token) throw Error('再ログインしてください');
  const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID + path, {
    headers: {Authorization: 'Bearer ' + token}
  });
  if (!r.ok) throw Error('Sheets API ' + r.status + ' ' + (await r.text()).slice(0,250));
  return r.json();
}
async function refresh() {
  try {
    set('auth', '教材マスターとDriveを読み込み中…');
    const r = await req('files/' + ROOT_FOLDER_ID, {fields:'id,name,mimeType,trashed'});
    const root = await r.json();
    if (root.trashed || root.mimeType !== FOLDER_MIME) throw Error('親フォルダIDを確認してください');
    opts('root', [root], '親フォルダを選択');
    $('root').value = root.id;
    await loadSeries();
  } catch(e) {
    opts('root', [], '親フォルダを取得できません');
    opts('series', [], 'シリーズを選択');
    opts('lesson', [], 'レッスンを選択');
    set('auth', 'Drive接続エラー：' + error(e));
  }
}
$('refresh').onclick = refresh;
async function loadSeries() {
  const rootId = $('root').value;
  opts('series', [], 'シリーズを選択');
  opts('lesson', [], 'レッスンを選択');
  if (!rootId) return;
  try {
    folders = await list("'" + rootId + "' in parents and mimeType = '" + FOLDER_MIME + "' and trashed = false");
    let sheetError = '';
    sheetTabs = [];
    try {
      const data = await sheetReq('?fields=sheets(properties(title,sheetId,hidden))');
      sheetTabs = (data.sheets || []).map(x=>x.properties).filter(x=>!x.hidden);
    } catch(e) { sheetError = error(e); }
    // Sheet tabs are primary; Drive-only folders remain available for migration.
    const options = sheetTabs.map(t=>({id:'sheet:'+t.sheetId,name:t.title}));
    folders.filter(f=>!sheetTabs.some(t=>t.title===f.name)).forEach(f=>options.push({id:'drive:'+f.id,name:f.name+'（従来形式）'}));
    opts('series', options, 'シリーズを選択');
    set('auth', sheetError
      ? 'Driveは接続済み。Sheetsを取得できません：'+sheetError+'。従来形式は利用できます。'
      : `接続済み：シート ${sheetTabs.length} 件／Driveフォルダ ${folders.length} 件`);
  } catch(e) { set('auth', '教材一覧エラー：'+error(e)); }
}
$('root').onchange = loadSeries;
function parseDriveFiles(files) {
  const map = new Map();
  for (const f of files) {
    const m = match(f.name);
    if (!m) continue;
    const day = Number(m[1]);
    if (!map.has(day)) map.set(day, {day});
    const entry = map.get(day), ext=m[2].toLowerCase();
    if (ext==='txt') entry.text=f;
    else if (ext==='url') entry.ted=f;
    else entry.audio ??= f;
  }
  return map;
}
function showLessons(countLabel) {
  lessons.sort((a,b)=>a.day-b.day);
  opts('lesson', lessons.map(l=>({
    id:String(l.day),
    name:`${l.title ? l.title+' · ' : ''}Lesson ${String(l.day).padStart(3,'0')} ${l.scriptText||l.text?'📄':''} ${l.tedURL||l.ted?'🎬 TED':l.audio?'🎧':'音声なし'}`
  })), 'レッスンを選択');
  set('lessonStatus', countLabel+'：'+lessons.length+'レッスンを認識しました。');
}
$('series').onchange = async () => {
  const value=$('series').value;
  if (!value) return;
  lessons=[];
  opts('lesson',[], '読み込み中…');
  set('lessonStatus','教材を読み込み中…');
  try {
    if (value.startsWith('drive:')) {
      const files=await list("'"+value.slice(6)+"' in parents and trashed = false");
      lessons=[...parseDriveFiles(files).values()];
      showLessons('Drive '+files.length+'ファイル');
      return;
    }
    const tab=sheetTabs.find(t=>String(t.sheetId)===value.slice(6));
    if (!tab) throw Error('シートが見つかりません');
    const range=encodeURIComponent("'"+tab.title.replace(/'/g,"''")+"'!A:F");
    const data=await sheetReq('/values/'+range+'?valueRenderOption=FORMATTED_VALUE');
    const rows=data.values||[];
    const heads=(rows[0]||[]).map(s=>String(s).trim().toLowerCase());
    const col=k=>heads.indexOf(k);
    if (col('lesson')<0) throw Error('1行目に lesson 列が必要です');
    const folder=folders.find(f=>f.name===tab.title);
    const files=folder?await list("'"+folder.id+"' in parents and trashed = false"):[];
    const map=parseDriveFiles(files);
    // Additional audio names: "TOEIC 1.mp3", "TOEIC_001.m4a", etc.
    // Match the *complete* tab name followed by a lesson number; never
    // confuse 1 with 11, or TOEIC with TOEIC Advanced.
    const escapeRE = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const seriesRE = new RegExp('^' + escapeRE(tab.title.trim()) + '[\\s_-]+0*(\\d+)(?:[\\s_-].*)?\\.(mp3|m4a|wav|aac|webm)$', 'i');
    const collisions = [];
    for (const f of files) {
      const m = f.name.match(seriesRE);
      if (!m) continue;
      const day = Number(m[1]);
      if (!Number.isSafeInteger(day) || day < 1) continue;
      const item = map.get(day) || {day};
      if (item.audio && item.audio.id !== f.id) {
        collisions.push('Lesson '+day+'：'+item.audio.name+' / '+f.name);
      } else {
        item.audio = f;
      }
      map.set(day, item);
    }
    for(const row of rows.slice(1)) {
      const cell=k=>col(k)<0?'':String(row[col(k)]||'').trim();
      const day=Number(cell('lesson'));
      if(!Number.isSafeInteger(day)||day<1) continue;
      const item=map.get(day)||{day};
      item.title=cell('title');
      item.scriptText=cell('script');
      item.tedURL=cell('url');
      item.type=cell('type').toLowerCase();
      map.set(day,item);
    }
    lessons=[...map.values()];
    showLessons('シート '+Math.max(0,rows.length-1)+'行・Drive '+files.length+'ファイル');
    if (collisions.length) set('lessonStatus', $('lessonStatus').textContent + ' ※同じ番号の音声が複数あります：' + collisions.join('、'));
  } catch(e) {set('lessonStatus','教材読み込みエラー：'+error(e));}
};
function tedURL(raw) {
  const u = new URL(raw.trim());
  if (!['ted.com','www.ted.com','embed.ted.com'].includes(u.hostname.toLowerCase())) throw Error('TED公式URLのみ対応');
  const m = u.pathname.match(/^\/talks\/([a-z0-9_-]+)\/?$/i);
  if (!m) throw Error('TEDのURL形式を確認してください');
  return {page:`https://www.ted.com/talks/${m[1]}`,embed:`https://embed.ted.com/talks/${m[1]}`};
}
$('lesson').onchange = async () => {
  const l = lessons.find(x => x.day === Number($('lesson').value));
  if (!l) return;
  set('lessonStatus','教材を読み込み中…');
  $('script').value = '';
  $('audio').pause(); $('audio').removeAttribute('src');
  if (audioURL) URL.revokeObjectURL(audioURL);
  audioURL = null;
  $('tedFrameHost').replaceChildren();
  $('tedPanel').classList.add('hidden');
  $('audioPanel').classList.remove('hidden');
  $('audioControls').classList.remove('hidden');
  try {
    if (l.scriptText) $('script').value = l.scriptText;
    else if (l.text) $('script').value = await (await req('files/'+l.text.id,{alt:'media'})).text();
    if (l.tedURL || l.ted) {
      const raw = l.tedURL || await (await req('files/'+l.ted.id,{alt:'media'})).text();
      const urls = tedURL(raw);
      const iframe = document.createElement('iframe');
      iframe.src = urls.embed;
      iframe.title = 'TED公式プレイヤー';
      iframe.className = 'ted-frame';
      iframe.allow = 'fullscreen; autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      $('tedFrameHost').replaceChildren(iframe);
      $('tedOpen').href = urls.page;
      $('tedPanel').classList.remove('hidden');
      $('audioPanel').classList.add('hidden');
      $('audioControls').classList.add('hidden');
      set('lessonStatus',`Lesson ${l.day}：TED公式プレイヤーを表示しました。字幕はプレイヤー内で有効にできます。`);
    } else if (l.audio) {
      const b = await (await req('files/'+l.audio.id,{alt:'media'})).blob();
      audioURL = URL.createObjectURL(b);
      $('audio').src = audioURL;
      set('lessonStatus',`Lesson ${l.day}：${l.scriptText||l.text?'英文・':''}音声を読み込みました。`);
    }
  } catch(e) {set('lessonStatus',error(e));}
};

$('back2').onclick=()=>{$('audio').currentTime=Math.max(0,$('audio').currentTime-2)};$('back5').onclick=()=>{$('audio').currentTime=Math.max(0,$('audio').currentTime-5)};$('speed').onchange=()=>{$('audio').playbackRate=Number($('speed').value)};
$('mic').onclick=async()=>{try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});$('start').disabled=false;set('recordStatus','マイク準備完了。イヤホンの出力先を確認してください。')}catch(e){set('recordStatus','マイクを利用できません: '+error(e))}};
$('start').onclick=async()=>{try{if(!stream)throw Error('先にマイクを準備してください');if(!window.MediaRecorder)throw Error('このSafariはMediaRecorderに対応していません');const formats=['audio/mp4','audio/webm;codecs=opus','audio/webm'];const mime=formats.find(x=>MediaRecorder.isTypeSupported(x));rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=()=>{blob=new Blob(chunks,{type:rec.mimeType||'audio/mp4'});if(blobURL)URL.revokeObjectURL(blobURL);blobURL=URL.createObjectURL(blob);$('recorded').src=blobURL;const ext=blob.type.includes('mp4')?'m4a':'webm';const series=$('series').selectedOptions[0]?.textContent||'Shadowing';const day=$('lesson').value||'practice';$('save').download=`${series.replace(/[^a-z0-9_-]/gi,'_')}_Day${day}.${ext}`;$('save').href=blobURL;$('result').classList.remove('hidden');set('recordStatus','録音完了。再生・保存・共有できます。')};$('result').classList.add('hidden');rec.start(250);startTime=Date.now();timer=setInterval(()=>{const n=Math.floor((Date.now()-startTime)/1000);set('clock',`録音時間 ${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`)},300);$('start').disabled=true;$('stop').disabled=false;set('recordStatus',$('tedPanel').classList.contains('hidden')?'録音中…':'録音中。TED公式プレイヤーは手動で再生・停止してください。');const a=$('audio');if(a.src){a.currentTime=0;a.playbackRate=Number($('speed').value);try{await a.play()}catch(e){set('recordStatus','録音中。お手本音声の自動再生に失敗しました: '+error(e))}}}catch(e){set('recordStatus',error(e));if(rec?.state==='recording')rec.stop();$('start').disabled=false;$('stop').disabled=true}};
$('stop').onclick=()=>{if(rec?.state==='recording')rec.stop();$('audio').pause();clearInterval(timer);$('start').disabled=false;$('stop').disabled=true};
$('share').onclick=async()=>{if(!blob)return;const ext=blob.type.includes('mp4')?'m4a':'webm';const filename=`Shadowing_${($('series').selectedOptions[0]?.textContent||'series').replace(/[^a-zA-Z0-9_-]/g,'_')}_Day${$('lesson').value||'practice'}.${ext}`;const f=new File([blob],filename,{type:blob.type});try{if(navigator.canShare?.({files:[f]})){await navigator.share({files:[f],title:filename,text:`${$('series').selectedOptions[0]?.textContent||'教材'} Day ${$('lesson').value} の録音です`})}else{set('recordStatus','このブラウザでは音声ファイル共有ができません。「録音を保存」からファイルを保存し、ChatGPTに添付してください。')}}catch(e){if(e.name!=='AbortError')set('recordStatus',error(e))}};
})();
