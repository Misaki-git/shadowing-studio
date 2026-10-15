
(() => {
  'use strict';

  // ==========================================
  // Shadowing Studio - Google Drive Edition
  // ==========================================

  const ROOT_FOLDER_ID =
    '1dz6AvQLtMvzPiFavmXphWrGwfitSFvTk';

  const SCOPE =
    'https://www.googleapis.com/auth/drive.readonly';

  const $ = id => document.getElementById(id);

  let token = '';
  let client;
  let folders = [];
  let lessons = [];
  let stream;
  let rec;
  let chunks = [];
  let blob;
  let blobURL;
  let audioURL;
  let timer;
  let startTime;

  const set = (id, msg) => {
    const el = $(id);
    if (el) el.textContent = msg;
  };

  const error = e => e?.message || String(e);

  function opts(id, items, placeholder) {
    const el = $(id);
    el.replaceChildren(new Option(placeholder, ''));

    items.forEach(item => {
      el.add(new Option(item.name, item.id));
    });

    el.disabled = !items.length;
  }

  // ==========================================
  // Google認証
  // ==========================================

  async function gis() {
    if (window.google?.accounts?.oauth2) return;

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.src =
        'https://accounts.google.com/gsi/client';

      script.onload = resolve;

      script.onerror = () => {
        reject(Error('Google認証を読み込めません'));
      };

      document.head.append(script);
    });
  }

  $('login').onclick = async () => {
    try {
      const id = window.GOOGLE_CLIENT_ID;

      if (
        !id?.endsWith('.apps.googleusercontent.com') ||
        id.startsWith('REPLACE')
      ) {
        throw Error(
          'config.jsのOAuthクライアントIDを設定してください'
        );
      }

      await gis();

      client ??= google.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: SCOPE,
        callback: () => {}
      });

      client.callback = async response => {
        if (response.error) {
          set('auth', response.error);
          return;
        }

        token = response.access_token;

        $('logout').disabled = false;
        $('refresh').disabled = false;

        await refresh();
      };

      client.requestAccessToken({
        prompt: 'consent'
      });

    } catch (e) {
      set('auth', error(e));
    }
  };

  $('logout').onclick = () => {
    if (token && window.google?.accounts?.oauth2) {
      google.accounts.oauth2.revoke(token, () => {});
    }

    token = '';
    folders = [];
    lessons = [];

    $('logout').disabled = true;
    $('refresh').disabled = true;

    ['root', 'series', 'lesson'].forEach(id => {
      opts(id, [], '未接続');
    });

    set('auth', '接続を解除しました');
  };

  // ==========================================
  // Google Drive API
  // ==========================================

  async function req(path, params = {}) {
    if (!token) {
      throw Error('再ログインしてください');
    }

    const url = new URL(
      'https://www.googleapis.com/drive/v3/' + path
    );

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + token
      }
    });

    if (!response.ok) {
      const detail = await response.text();

      throw Error(
        'Drive API ' +
        response.status +
        ': ' +
        detail.slice(0, 300)
      );
    }

    return response;
  }

  async function list(query) {
    let all = [];
    let next = '';

    do {
      const response = await req('files', {
        q: query,
        fields:
          'nextPageToken,files(id,name,mimeType,parents)',
        pageSize: '1000',
        ...(next ? { pageToken: next } : {})
      });

      const data = await response.json();

      all.push(...(data.files || []));
      next = data.nextPageToken || '';

    } while (next);

    return all;
  }

  // ==========================================
  // 親フォルダをIDから直接取得
  // ==========================================

  async function refresh() {
    try {
      set('auth', 'Google Driveに接続中…');

      const response = await req(
        'files/' + ROOT_FOLDER_ID,
        {
          fields: 'id,name,mimeType,trashed'
        }
      );

      const root = await response.json();

      if (
        root.trashed ||
        root.mimeType !==
          'application/vnd.google-apps.folder'
      ) {
        throw Error(
          '指定したIDは有効なフォルダではありません'
        );
      }

      opts(
        'root',
        [root],
        '親フォルダを選択'
      );

      $('root').value = root.id;

      set(
        'auth',
        '接続済み：' + root.name
      );

      await loadSeries();

    } catch (e) {
      opts(
        'root',
        [],
        '親フォルダを取得できません'
      );

      opts('series', [], 'シリーズを選択');
      opts('lesson', [], 'Dayを選択');

      set(
        'auth',
        'フォルダ取得エラー：' + error(e)
      );
    }
  }

  $('refresh').onclick = refresh;

  // ==========================================
  // 教材シリーズを読み込む
  // ==========================================

  async function loadSeries() {
    const rootId = $('root').value;

    opts('series', [], '読み込み中…');
    opts('lesson', [], 'Dayを選択');

    if (!rootId) return;

    try {
      folders = await list(
        "'" + rootId + "' in parents and " +
        "mimeType = 'application/vnd.google-apps.folder' " +
        "and trashed = false"
      );

      opts(
        'series',
        folders,
        'シリーズを選択'
      );

      if (folders.length === 0) {
        set(
          'auth',
          '接続済み。ただし教材シリーズが見つかりません'
        );
      } else {
        set(
          'auth',
          '接続済み：教材シリーズ ' +
          folders.length +
          ' 件'
        );
      }

    } catch (e) {
      set(
        'auth',
        'シリーズ取得エラー：' + error(e)
      );
    }
  }

  $('root').onchange = loadSeries;

  // ==========================================
  // Day番号をファイル名から認識
  // ==========================================

  const match = name => name.match(
    /^(?:day|lesson)?[ _-]*0*(\d+)(?:[ _-].*)?\.(txt|mp3|m4a|wav|aac|webm)$/i
  );

  $('series').onchange = async () => {
    try {
      const id = $('series').value;

      if (!id) return;

      set(
        'lessonStatus',
        '教材一覧を読み込み中…'
      );

      const files = await list(
        "'" + id + "' in parents and trashed = false"
      );

      const map = new Map();

      for (const file of files) {
        const result = match(file.name);

        if (!result) continue;

        const day = Number(result[1]);
        const ext = result[2].toLowerCase();

        if (!map.has(day)) {
          map.set(day, { day });
        }

        const entry = map.get(day);

        if (ext === 'txt') {
          entry.text = file;
        } else {
          entry.audio ??= file;
        }
      }

      lessons = [...map.values()].sort(
        (a, b) => a.day - b.day
      );

      opts(
        'lesson',
        lessons.map(lesson => ({
          id: String(lesson.day),
          name:
            'Day ' +
            String(lesson.day).padStart(3, '0') +
            ' ' +
            (lesson.text ? '📄' : '本文なし') +
            ' ' +
            (lesson.audio ? '🎧' : '音声なし')
        })),
        'Dayを選択'
      );

      set(
        'lessonStatus',
        files.length +
        ' ファイルから ' +
        lessons.length +
        ' レッスンを認識しました。'
      );

    } catch (e) {
      set('lessonStatus', error(e));
    }
  };

  // ==========================================
  // 英文とお手本音声を読み込む
  // ==========================================

  $('lesson').onchange = async () => {
    const lesson = lessons.find(
      x => x.day === Number($('lesson').value)
    );

    if (!lesson) return;

    set('lessonStatus', '教材を読み込み中…');

    $('script').value = '';
    $('audio').pause();
    $('audio').removeAttribute('src');

    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      audioURL = null;
    }

    try {
      if (lesson.text) {
        const response = await req(
          'files/' + lesson.text.id,
          { alt: 'media' }
        );

        $('script').value = await response.text();
      }

      if (lesson.audio) {
        const response = await req(
          'files/' + lesson.audio.id,
          { alt: 'media' }
        );

        const audioBlob = await response.blob();

        audioURL = URL.createObjectURL(audioBlob);

        $('audio').src = audioURL;
      }

      set(
        'lessonStatus',
        'Day ' +
        lesson.day +
        '：' +
        (lesson.text ? '英文あり' : '英文なし') +
        '／' +
        (lesson.audio ? '音声あり' : '音声なし')
      );

    } catch (e) {
      set('lessonStatus', error(e));
    }
  };

  // ==========================================
  // 音声プレイヤー
  // ==========================================

  $('back2').onclick = () => {
    const audio = $('audio');

    audio.currentTime = Math.max(
      0,
      audio.currentTime - 2
    );
  };

  $('back5').onclick = () => {
    const audio = $('audio');

    audio.currentTime = Math.max(
      0,
      audio.currentTime - 5
    );
  };

  $('speed').onchange = () => {
    $('audio').playbackRate = Number(
      $('speed').value
    );
  };

  // ==========================================
  // マイク準備
  // ==========================================

  $('mic').onclick = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
        });
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      $('start').disabled = false;

      set(
        'recordStatus',
        'マイク準備完了。AirPodsの接続を確認してください。'
      );

    } catch (e) {
      set(
        'recordStatus',
        'マイクを利用できません：' + error(e)
      );
    }
  };

  // ==========================================
  // 録音開始＋お手本再生
  // ==========================================

  $('start').onclick = async () => {
    try {
      if (!stream) {
        throw Error(
          '先にマイクを準備してください'
        );
      }

      if (!window.MediaRecorder) {
        throw Error(
          'このブラウザはMediaRecorderに対応していません'
        );
      }

      const formats = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm'
      ];

      const mime = formats.find(format =>
        MediaRecorder.isTypeSupported(format)
      );

      rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined
      );

      chunks = [];
      blob = null;

      rec.ondataavailable = event => {
        if (event.data.size) {
          chunks.push(event.data);
        }
      };

      rec.onstop = () => {
        blob = new Blob(chunks, {
          type: rec.mimeType || 'audio/mp4'
        });

        if (blobURL) {
          URL.revokeObjectURL(blobURL);
        }

        blobURL = URL.createObjectURL(blob);

        $('recorded').src = blobURL;

        const ext = blob.type.includes('mp4')
          ? 'm4a'
          : 'webm';

        const series =
          $('series').selectedOptions[0]?.textContent ||
          'Shadowing';

        const day =
          $('lesson').value || 'practice';

        const filename =
          series.replace(/[^a-z0-9_-]/gi, '_') +
          '_Day' +
          day +
          '.' +
          ext;

        $('save').download = filename;
        $('save').href = blobURL;

        $('result').classList.remove('hidden');

        set(
          'recordStatus',
          '録音完了。再生・保存・共有できます。'
        );
      };

      $('result').classList.add('hidden');

      rec.start(250);

      startTime = Date.now();

      timer = setInterval(() => {
        const seconds = Math.floor(
          (Date.now() - startTime) / 1000
        );

        const minutes = String(
          Math.floor(seconds / 60)
        ).padStart(2, '0');

        const remaining = String(
          seconds % 60
        ).padStart(2, '0');

        set(
          'clock',
          '録音時間 ' + minutes + ':' + remaining
        );
      }, 300);

      $('start').disabled = true;
      $('stop').disabled = false;

      set('recordStatus', '録音中…');

      const audio = $('audio');

      if (audio.src) {
        audio.currentTime = 0;

        audio.playbackRate = Number(
          $('speed').value
        );

        try {
          await audio.play();
        } catch (e) {
          set(
            'recordStatus',
            '録音中。お手本の再生に失敗：' + error(e)
          );
        }
      }

    } catch (e) {
      set('recordStatus', error(e));

      if (rec?.state === 'recording') {
        rec.stop();
      }

      clearInterval(timer);

      $('start').disabled = false;
      $('stop').disabled = true;
    }
  };

  // ==========================================
  // 録音停止
  // ==========================================

  $('stop').onclick = () => {
    if (rec?.state === 'recording') {
      rec.stop();
    }

    $('audio').pause();

    clearInterval(timer);

    $('start').disabled = false;
    $('stop').disabled = true;
  };

  // ==========================================
  // ChatGPTへ共有
  // ==========================================

  $('share').onclick = async () => {
    if (!blob) return;

    const ext = blob.type.includes('mp4')
      ? 'm4a'
      : 'webm';

    const day =
      $('lesson').value || 'practice';

    const series =
      $('series').selectedOptions[0]?.textContent ||
      '教材';

    const filename =
      'Shadowing_Day' +
      day +
      '.' +
      ext;

    const file = new File(
      [blob],
      filename,
      { type: blob.type }
    );

    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text:
            series +
            ' Day ' +
            day +
            ' の録音です'
        });

      } else {
        set(
          'recordStatus',
          'このブラウザでは直接共有できません。録音を保存してChatGPTに添付してください。'
        );
      }

    } catch (e) {
      if (e.name !== 'AbortError') {
        set('recordStatus', error(e));
      }
    }
  };

})();
