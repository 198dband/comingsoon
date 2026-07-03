// ═══ SIDE C — Mixtape Maker ═══════════════════════════════════════
// Vanilla JS, no framework. Lazy-loaded on demand by the outer shell.
(function(){
  'use strict';

  var FB_BASE = 'https://d-1a745-default-rtdb.firebaseio.com';
  var MY_TAPE_KEY = '198d_my_mixtape';
  var SLOTS_PER_SIDE = 6;

  // The real setlist — kept in sync by hand with the "16 songs" in the main bundles.
  var CATALOG_SETLIST = [
    { title:"The Middle", artist:"Jimmy Eat World" },
    { title:"Sk8r Boi", artist:"Avril Lavigne" },
    { title:"Dammit", artist:"Blink-182" },
    { title:"Open Road Song", artist:"Eve 6" },
    { title:"Semi-Charmed Life", artist:"Third Eye Blind" },
    { title:"Bound for the Floor", artist:"Local H" },
    { title:"What's Up?", artist:"4 Non Blondes" },
    { title:"Miserable", artist:"Lit" },
    { title:"Zombie", artist:"The Cranberries" },
    { title:"Feel the Pain", artist:"Dinosaur Jr." },
    { title:"Santa Monica", artist:"Everclear" },
    { title:"Brain Stew", artist:"Green Day" },
    { title:"Memory", artist:"Sugarcult" },
    { title:"Kiss Me", artist:"Sixpence None the Richer" },
    { title:"1985", artist:"Bowling for Soup" },
    { title:"Boys of Summer", artist:"The Ataris / Don Henley" },
  ];

  var state = {
    id: null,
    title: '',
    by: '',
    anonymous: false,
    activeSide: 'a',
    aSide: new Array(SLOTS_PER_SIDE).fill(null),
    bSide: new Array(SLOTS_PER_SIDE).fill(null),
  };
  var catalog = CATALOG_SETLIST.slice();
  var built = false;
  var els = {};

  function slugSong(s){ return (s.title || '') + '::' + (s.artist || ''); }

  function totalFilled(){
    return state.aSide.filter(Boolean).length + state.bSide.filter(Boolean).length;
  }

  function fmtTime(seconds){
    var m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ── DOM build ─────────────────────────────────────────────────────
  function build(){
    if(built) return;
    built = true;

    var overlay = document.createElement('div');
    overlay.className = 'mx-overlay mx-hidden';
    overlay.innerHTML =
      '<div class="mx-panel">' +
        '<div class="mx-head">' +
          '<div><h2>SIDE <span>C</span></h2><p>Build your dream setlist</p></div>' +
          '<button class="mx-close" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="mx-body">' +
          '<div class="mx-side-tabs">' +
            '<button class="mx-side-tab on" data-side="a" type="button">A-Side</button>' +
            '<button class="mx-side-tab" data-side="b" type="button">B-Side</button>' +
          '</div>' +
          '<div class="mx-slots"></div>' +
          '<div class="mx-meter">' +
            '<span class="mx-meter-label"></span>' +
            '<div class="mx-meter-bar"><div class="mx-meter-fill"></div></div>' +
          '</div>' +
          '<div class="mx-catalog-label">Tap to add — from the real setlist &amp; the wall</div>' +
          '<div class="mx-catalog"></div>' +
          '<div class="mx-custom-row">' +
            '<input type="text" class="mx-custom-input" placeholder="Write your own — song by artist">' +
            '<button type="button" class="mx-custom-add">Add</button>' +
          '</div>' +
          '<div class="mx-field">' +
            '<label>Tape Title</label>' +
            '<input type="text" class="mx-title-input" placeholder="My Summer 2003 Mix">' +
          '</div>' +
          '<div class="mx-field">' +
            '<label>Your Name</label>' +
            '<input type="text" class="mx-by-input" placeholder="@yourname">' +
          '</div>' +
          '<label class="mx-anon"><input type="checkbox" class="mx-anon-input"> Post anonymously</label>' +
          '<div class="mx-actions">' +
            '<button type="button" class="mx-btn mx-btn-primary mx-save-btn">Save Tape</button>' +
            '<button type="button" class="mx-btn mx-btn-ghost mx-download-btn" style="display:none">Download</button>' +
            '<button type="button" class="mx-btn mx-btn-ghost mx-share-btn" style="display:none">Share</button>' +
          '</div>' +
          '<div class="mx-status"></div>' +
          '<div class="mx-cassette-wrap" style="display:none"><canvas width="700" height="440"></canvas></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    els.overlay = overlay;
    els.slots = overlay.querySelector('.mx-slots');
    els.meterLabel = overlay.querySelector('.mx-meter-label');
    els.meterFill = overlay.querySelector('.mx-meter-fill');
    els.catalog = overlay.querySelector('.mx-catalog');
    els.customInput = overlay.querySelector('.mx-custom-input');
    els.customAdd = overlay.querySelector('.mx-custom-add');
    els.titleInput = overlay.querySelector('.mx-title-input');
    els.byInput = overlay.querySelector('.mx-by-input');
    els.anonInput = overlay.querySelector('.mx-anon-input');
    els.saveBtn = overlay.querySelector('.mx-save-btn');
    els.downloadBtn = overlay.querySelector('.mx-download-btn');
    els.shareBtn = overlay.querySelector('.mx-share-btn');
    els.status = overlay.querySelector('.mx-status');
    els.cassetteWrap = overlay.querySelector('.mx-cassette-wrap');
    els.canvas = overlay.querySelector('canvas');
    els.tabs = overlay.querySelectorAll('.mx-side-tab');

    overlay.querySelector('.mx-close').addEventListener('click', close);
    overlay.addEventListener('click', function(e){ if(e.target === overlay) close(); });

    els.tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        state.activeSide = tab.getAttribute('data-side');
        els.tabs.forEach(function(t){ t.classList.toggle('on', t === tab); });
        renderSlots();
      });
    });

    els.customAdd.addEventListener('click', addCustom);
    els.customInput.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); addCustom(); } });

    els.titleInput.addEventListener('input', function(){ state.title = els.titleInput.value; });
    els.byInput.addEventListener('input', function(){ state.by = els.byInput.value; });
    els.anonInput.addEventListener('change', function(){ state.anonymous = els.anonInput.checked; });

    els.saveBtn.addEventListener('click', save);
    els.downloadBtn.addEventListener('click', function(){ downloadCanvas(); });
    els.shareBtn.addEventListener('click', function(){ shareCanvas(); });
  }

  function addCustom(){
    var v = els.customInput.value.trim();
    if(!v) return;
    var parts = v.split(/\s+by\s+/i);
    var song = parts.length > 1 ? { title: parts[0].trim(), artist: parts.slice(1).join(' by ').trim(), custom:true } : { title: v, artist: '', custom:true };
    addToActiveSide(song);
    els.customInput.value = '';
  }

  function addToActiveSide(song){
    var arr = state.activeSide === 'a' ? state.aSide : state.bSide;
    var idx = arr.indexOf(null);
    if(idx === -1){
      setStatus('This side is full — clear a slot or flip to the other side.', 'error');
      return;
    }
    arr[idx] = song;
    setStatus('', '');
    renderSlots();
    renderMeter();
  }

  function renderSlots(){
    var arr = state.activeSide === 'a' ? state.aSide : state.bSide;
    var html = '';
    arr.forEach(function(song, i){
      if(song){
        html += '<div class="mx-slot filled" data-i="' + i + '">' +
          '<span class="mx-slot-num">' + (i+1) + '.</span>' +
          '<span>' + escapeHtml(song.title) + (song.artist ? ' <span style="opacity:.6">— ' + escapeHtml(song.artist) + '</span>' : '') + '</span>' +
          '<span class="mx-slot-x">&times;</span>' +
        '</div>';
      } else {
        html += '<div class="mx-slot" data-i="' + i + '">' +
          '<span class="mx-slot-num">' + (i+1) + '.</span>' +
          '<span>empty slot</span>' +
        '</div>';
      }
    });
    els.slots.innerHTML = html;
    els.slots.querySelectorAll('.mx-slot').forEach(function(el){
      el.addEventListener('click', function(){
        var i = parseInt(el.getAttribute('data-i'), 10);
        var arr2 = state.activeSide === 'a' ? state.aSide : state.bSide;
        arr2[i] = null;
        renderSlots();
        renderMeter();
      });
    });
  }

  function renderMeter(){
    var filled = totalFilled();
    var total = SLOTS_PER_SIDE * 2;
    var pct = Math.round((filled / total) * 100);
    var seconds = filled * 150; // ~2.5 min/track gag
    els.meterLabel.textContent = 'Tape used: ' + filled + '/' + total + ' tracks (~' + fmtTime(seconds) + ')';
    els.meterFill.style.width = pct + '%';
  }

  function renderCatalog(){
    var html = '';
    catalog.forEach(function(song){
      html += '<div class="mx-cat-item" data-song="' + escapeHtml(JSON.stringify(song)) + '">' +
        '<b>' + escapeHtml(song.title) + '</b>' +
        (song.artist ? '<span>— ' + escapeHtml(song.artist) + '</span>' : '') +
        (song.fromWall ? '<span class="mx-tag">fan pick</span>' : '') +
      '</div>';
    });
    els.catalog.innerHTML = html;
    els.catalog.querySelectorAll('.mx-cat-item').forEach(function(el){
      el.addEventListener('click', function(){
        try {
          var song = JSON.parse(el.getAttribute('data-song').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&'));
          addToActiveSide({ title: song.title, artist: song.artist });
        } catch(e){}
      });
    });
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function setStatus(msg, type){
    els.status.textContent = msg;
    els.status.className = 'mx-status' + (type ? ' ' + type : '');
  }

  // ── Firebase REST (no SDK — this is the outer shell, keep it light) ──
  function fetchWallCatalog(){
    return fetch(FB_BASE + '/wall.json')
      .then(function(r){ return r.ok ? r.json() : {}; })
      .then(function(data){
        if(!data) return [];
        return Object.values(data)
          .filter(function(it){ return it && it.visible !== false; })
          .map(function(it){ return { title: it.song, artist: it.artist, fromWall: true }; });
      })
      .catch(function(){ return []; });
  }

  function loadMyTape(){
    var id = null;
    try { id = localStorage.getItem(MY_TAPE_KEY); } catch(e){}
    if(!id) return Promise.resolve(null);
    return fetch(FB_BASE + '/mixtapes/' + id + '.json')
      .then(function(r){ return r.ok ? r.json() : null; })
      .catch(function(){ return null; })
      .then(function(tape){
        if(!tape) return null;
        state.id = id;
        state.title = tape.title || '';
        state.by = tape.by || '';
        state.anonymous = !!tape.anonymous;
        state.aSide = padSlots(tape.aSide);
        state.bSide = padSlots(tape.bSide);
        return tape;
      });
  }

  function padSlots(arr){
    var out = new Array(SLOTS_PER_SIDE).fill(null);
    if(Array.isArray(arr)){
      for(var i=0; i<SLOTS_PER_SIDE && i<arr.length; i++){ out[i] = arr[i] || null; }
    }
    return out;
  }

  // ── Save ──────────────────────────────────────────────────────────
  function save(){
    if(!state.title.trim()){ setStatus('Name your tape first.', 'error'); return; }
    if(totalFilled() === 0){ setStatus('Add at least one track.', 'error'); return; }

    var payload = {
      title: state.title.trim(),
      by: state.anonymous ? '@anon' : (state.by.trim() || '@anon'),
      submittedBy: state.by.trim() || '@anon',
      anonymous: !!state.anonymous,
      aSide: state.aSide,
      bSide: state.bSide,
      createdAt: Date.now(),
      ua: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    };

    setStatus('Saving…', '');
    els.saveBtn.disabled = true;

    var req = state.id
      ? fetch(FB_BASE + '/mixtapes/' + state.id + '.json', { method:'PATCH', body: JSON.stringify(payload) })
      : fetch(FB_BASE + '/mixtapes.json', { method:'POST', body: JSON.stringify(payload) });

    req.then(function(r){
      if(!r.ok) throw new Error('save failed');
      return r.json();
    }).then(function(res){
      if(res && res.name){
        state.id = res.name;
        try { localStorage.setItem(MY_TAPE_KEY, state.id); } catch(e){}
      }
      setStatus('Saved ✓ — download or share your tape below.', 'ok');
      renderCassette();
    }).catch(function(){
      setStatus('Something went wrong saving — try again in a bit.', 'error');
    }).finally(function(){
      els.saveBtn.disabled = false;
    });
  }

  // ── Cassette canvas render ───────────────────────────────────────
  function renderCassette(){
    var ctx = els.canvas.getContext('2d');
    var W = els.canvas.width, H = els.canvas.height;
    ctx.clearRect(0,0,W,H);

    // body
    ctx.fillStyle = '#0E0D0B';
    roundRect(ctx, 0, 0, W, H, 18); ctx.fill();
    ctx.strokeStyle = '#3a352a'; ctx.lineWidth = 3;
    roundRect(ctx, 4, 4, W-8, H-8, 16); ctx.stroke();

    // label panel
    var padX = 40, labelY = 40, labelH = 220;
    ctx.fillStyle = '#F4EFE6';
    roundRect(ctx, padX, labelY, W - padX*2, labelH, 8); ctx.fill();

    ctx.fillStyle = '#0E0D0B';
    ctx.font = "34px 'Permanent Marker', cursive";
    ctx.fillText(state.title || 'Untitled Mix', padX + 20, labelY + 46);

    ctx.font = "13px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#8B8474';
    var byLine = (state.anonymous ? '@anon' : (state.by.trim() || '@anon')) + '  ·  1980d.com';
    ctx.fillText(byLine, padX + 20, labelY + 68);

    // two columns: A / B side track list
    var colW = (W - padX*2 - 40) / 2;
    drawTrackList(ctx, padX + 20, labelY + 92, colW, 'A', state.aSide);
    drawTrackList(ctx, padX + 20 + colW + 20, labelY + 92, colW, 'B', state.bSide);

    // reels
    var reelY = labelY + labelH + 70;
    drawReel(ctx, W/2 - 110, reelY, 46);
    drawReel(ctx, W/2 + 110, reelY, 46);
    ctx.strokeStyle = 'rgba(244,239,230,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W/2 - 64, reelY); ctx.lineTo(W/2 + 64, reelY); ctx.stroke();

    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#8B8474';
    ctx.textAlign = 'center';
    ctx.fillText('1980D · SIDE C · MAKE YOUR OWN AT 1980D.COM', W/2, H - 24);
    ctx.textAlign = 'left';

    els.cassetteWrap.style.display = 'block';
    els.downloadBtn.style.display = 'inline-block';
    if(navigator.share) els.shareBtn.style.display = 'inline-block';
  }

  function drawTrackList(ctx, x, y, w, label, songs){
    ctx.font = "bold 12px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#FF3D2E';
    ctx.fillText(label + '-SIDE', x, y);
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#0E0D0B';
    var lineH = 16.5;
    songs.forEach(function(s, i){
      var t = s ? (s.title + (s.artist ? ' — ' + s.artist : '')) : '';
      if(!t) return;
      if(t.length > 34) t = t.slice(0,32) + '…';
      ctx.fillText((i+1) + '. ' + t, x, y + 20 + i*lineH);
    });
  }

  function drawReel(ctx, cx, cy, r){
    ctx.fillStyle = '#1A1814';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#3a352a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#0E0D0B';
    ctx.beginPath(); ctx.arc(cx, cy, r*0.35, 0, Math.PI*2); ctx.fill();
    for(var i=0;i<6;i++){
      var a = (i/6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a)*r*0.62, cy + Math.sin(a)*r*0.62, 3, 0, Math.PI*2);
      ctx.fillStyle = '#3a352a'; ctx.fill();
    }
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  function canvasFilename(){
    return '1980D-mixtape-' + (state.title || 'untitled').replace(/[^a-z0-9]+/gi,'-').toLowerCase() + '.png';
  }

  function downloadCanvas(){
    els.canvas.toBlob(function(blob){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = canvasFilename();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    }, 'image/png');
  }

  function shareCanvas(){
    els.canvas.toBlob(function(blob){
      var file = new File([blob], canvasFilename(), { type: 'image/png' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        navigator.share({
          files: [file],
          title: '1980D Mixtape',
          text: (state.title || 'My mixtape') + ' — made at 1980d.com',
        }).catch(function(){});
      } else {
        downloadCanvas();
      }
    }, 'image/png');
  }

  function open_(){
    build();
    els.overlay.classList.remove('mx-hidden');
    document.body.style.overflow = 'hidden';

    if(catalog.length === CATALOG_SETLIST.length){
      fetchWallCatalog().then(function(wallSongs){
        var seen = {}; catalog.forEach(function(s){ seen[slugSong(s)] = true; });
        wallSongs.forEach(function(s){ if(!seen[slugSong(s)]){ catalog.push(s); seen[slugSong(s)] = true; } });
        renderCatalog();
      });
    }
    renderCatalog();
    renderSlots();
    renderMeter();
    els.titleInput.value = state.title;
    els.byInput.value = state.by;
    els.anonInput.checked = state.anonymous;

    loadMyTape().then(function(tape){
      if(tape){
        els.titleInput.value = state.title;
        els.byInput.value = state.by;
        els.anonInput.checked = state.anonymous;
        renderSlots();
        renderMeter();
        setStatus('Loaded your saved tape — edit and re-save anytime.', 'ok');
      }
    });
  }

  function close(){
    if(els.overlay) els.overlay.classList.add('mx-hidden');
    document.body.style.overflow = '';
  }

  window.__openMixtape = open_;
})();
