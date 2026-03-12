/* ═══════════════════════════════════════════
   NoteParse — app.js
   ═══════════════════════════════════════════ */

// ── Config ────────────────────────────────────────────
const API_KEY        = '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';
const FREE_PAGE_LIMIT = 20;
const FREE_CHAT_LIMIT = 5;

// ── State ─────────────────────────────────────────────
let files       = [];
let dataURLs    = [];
let parsedMD    = '';
let pdfInstance = null;
let shuffleIdx  = 0;
let shuffleTmr  = null;
let isPro       = false;
let chatMsgs    = [];
let chatCount   = 0;

// ═══════════════════════════════════════════════════════
// PAGE ROUTING
// ═══════════════════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'chat' && !parsedMD) {
    showError('No notes yet', 'Convert some notes first, then come back to chat about them!');
    showPage('home');
    return;
  }
}

// ═══════════════════════════════════════════════════════
// PRO — demo activation (swap confirm for Stripe in prod)
// ═══════════════════════════════════════════════════════
function activatePro() {
  const confirmed = confirm('This would open a Stripe checkout for $5/month.\n\nFor demo purposes, click OK to activate Pro mode now.');
  if (confirmed) {
    isPro = true;
    sessionStorage.setItem('np_pro', '1');
    const btn = document.querySelector('.btn-gopro');
    btn.textContent = '✦ Pro Active';
    btn.style.background = 'linear-gradient(135deg,#00c9a7,#00a879)';
    updateChatUI();
    updateLimitNote();
    alert('🎉 Pro activated! Unlimited pages and AI chat unlocked.');
    showPage('home');
  }
}

function loadProState() {
  if (sessionStorage.getItem('np_pro') === '1') {
    isPro = true;
    const btn = document.querySelector('.btn-gopro');
    btn.textContent = '✦ Pro Active';
    btn.style.background = 'linear-gradient(135deg,#00c9a7,#00a879)';
  }
}

function updateLimitNote() {
  const el = document.getElementById('limitNote');
  if (isPro) {
    el.innerHTML = '✦ Pro — <strong>Unlimited pages</strong>';
    el.style.color = '#00a879';
  } else {
    el.innerHTML = 'Free plan: up to <strong>20 pages</strong> per conversion · <a onclick="showPage(\'pro\')">Go Pro for unlimited ✦</a>';
  }
}

// ═══════════════════════════════════════════════════════
// TOAST / ERROR
// ═══════════════════════════════════════════════════════
function showError(title, msg) {
  document.getElementById('errorTitle').textContent = '⚠️ ' + title;
  document.getElementById('errorMsg').innerHTML = msg;
  document.getElementById('errorToast').style.display = 'block';
  setTimeout(closeError, 6000);
}
function closeError() {
  document.getElementById('errorToast').style.display = 'none';
}

// ═══════════════════════════════════════════════════════
// FILE HANDLING
// ═══════════════════════════════════════════════════════
function triggerFile() { document.getElementById('fileInput').click(); }
function onDragOver(e) { e.preventDefault(); document.getElementById('dropzone').classList.add('drag-over'); }
function onDragLeave()  { document.getElementById('dropzone').classList.remove('drag-over'); }
function onDrop(e)      { e.preventDefault(); document.getElementById('dropzone').classList.remove('drag-over'); addFiles([...e.dataTransfer.files]); }
function onFileChange(e){ addFiles([...e.target.files]); e.target.value = ''; }

function addFiles(newFs) {
  const limit = isPro ? Infinity : FREE_PAGE_LIMIT;
  const ok = /\.(jpg|jpeg|png|webp|heic|pdf)$/i;
  newFs.filter(f => ok.test(f.name)).forEach(f => {
    if (files.length < limit) {
      files.push(f);
    } else {
      showError('Page limit reached', `Free plan supports up to ${FREE_PAGE_LIMIT} pages. <a onclick="showPage('pro')" style="color:#a78bff;font-weight:700">Go Pro for unlimited ✦</a>`);
    }
  });
  renderThumbs();
}

function renderThumbs() {
  const strip = document.getElementById('thumbStrip');
  const count = document.getElementById('thumbCount');
  dataURLs = new Array(files.length).fill(null);
  strip.innerHTML = '';

  if (!files.length) {
    count.textContent = '';
    document.getElementById('dropTitle').textContent = 'Drop your notes here';
    document.getElementById('dropSub').style.display = '';
    return;
  }

  document.getElementById('dropTitle').textContent = files.length + ' file' + (files.length > 1 ? 's' : '') + ' selected';
  document.getElementById('dropSub').style.display = 'none';
  count.textContent = files.length + ' image' + (files.length > 1 ? 's' : '') + ' ready to convert';

  files.forEach((f, i) => {
    const reader = new FileReader();
    reader.onload = ev => {
      dataURLs[i] = ev.target.result;
      const div = document.createElement('div');
      div.className = 'thumb-item';
      const img = document.createElement('img');
      img.src = ev.target.result; img.alt = 'note';
      const btn = document.createElement('button');
      btn.className = 'thumb-remove'; btn.textContent = '×';
      btn.onclick = e => { e.stopPropagation(); removeFile(i); };
      div.append(img, btn);
      strip.appendChild(div);
    };
    reader.readAsDataURL(f);
  });
}

function removeFile(i) { files.splice(i, 1); renderThumbs(); }

// ═══════════════════════════════════════════════════════
// SHUFFLE ANIMATION
// ═══════════════════════════════════════════════════════
function buildShuffle() {
  const v = document.getElementById('shuffleViewer');
  v.innerHTML = '';
  dataURLs.forEach((src, i) => {
    const card = document.createElement('div');
    card.className = 'shuffle-card ' + (i === 0 ? 'sc-front' : i === 1 ? 'sc-behind' : 'sc-third');
    card.id = 'sc_' + i;
    const img = document.createElement('img');
    img.src = src;
    card.appendChild(img);
    v.appendChild(card);
  });
  shuffleIdx = 0;
}

function advanceShuffle() {
  const total = dataURLs.length;
  if (total < 2) return;
  const cards = document.querySelectorAll('.shuffle-card');
  cards[shuffleIdx].className = 'shuffle-card sc-exit';
  setTimeout(() => { if (cards[shuffleIdx]) cards[shuffleIdx].className = 'shuffle-card sc-third'; }, 550);
  shuffleIdx = (shuffleIdx + 1) % total;
  cards[shuffleIdx].className = 'shuffle-card sc-front';
  cards[(shuffleIdx + 1) % total].className = 'shuffle-card sc-behind';
}

function startShuffle() { if (dataURLs.length > 1) shuffleTmr = setInterval(advanceShuffle, 1700); }
function stopShuffle()  { clearInterval(shuffleTmr); shuffleTmr = null; }

// ═══════════════════════════════════════════════════════
// PROGRESS HELPERS
// ═══════════════════════════════════════════════════════
function setPct(p) { document.getElementById('progressBar').style.width = p + '%'; }

function setStepState(n, state) {
  const txt = document.getElementById('st' + n);
  const row = document.getElementById('sr' + n);
  row.querySelector('.step-spinner')?.remove();
  row.querySelector('.step-check')?.remove();
  txt.className = 'step-text';
  if (state === 'active') {
    txt.className = 'step-text step-active';
    row.classList.add('active-row');
    const s = document.createElement('div'); s.className = 'step-spinner'; row.appendChild(s);
  } else if (state === 'done') {
    txt.className = 'step-text step-done';
    row.classList.remove('active-row');
    const c = document.createElement('span'); c.className = 'step-check'; c.textContent = '✓'; row.appendChild(c);
  }
}

function setLabel(main, sub) {
  document.getElementById('loadingLabel').textContent = main;
  document.getElementById('loadingSub').textContent = sub;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════
// MAIN CONVERT
// ═══════════════════════════════════════════════════════
async function doConvert() {
  if (!files.length) {
    document.getElementById('upload-card').style.animation = 'shake .4s ease';
    setTimeout(() => document.getElementById('upload-card').style.animation = '', 400);
    return;
  }
  // Wait for all FileReaders
  await new Promise(resolve => {
    const check = () => dataURLs.every(d => d !== null) ? resolve() : setTimeout(check, 50);
    check();
  });

  document.getElementById('loadingOverlay').classList.add('active');
  buildShuffle(); startShuffle(); setPct(5);

  try {
    setStepState(1, 'active');
    setLabel('Preparing images…', 'Encoding ' + files.length + ' image' + (files.length > 1 ? 's' : ''));
    await sleep(400);
    setStepState(1, 'done'); setPct(18);

    setStepState(2, 'active');
    setLabel('Claude is reading your notes…', 'Analysing handwriting, diagrams & equations');
    parsedMD = await callClaudeVision();
    setStepState(2, 'done'); setPct(65);

    setStepState(3, 'active');
    setLabel('Structuring notes…', 'Organising headings and formatting');
    await sleep(400);
    setStepState(3, 'done'); setPct(82);

    setStepState(4, 'active');
    setLabel('Building your PDF…', 'Almost done!');
    await sleep(200);
    pdfInstance = makePDF(parsedMD);
    setStepState(4, 'done'); setPct(100);

    // Reset chat for new notes
    chatMsgs = []; chatCount = 0; updateChatUI();

    await sleep(700);
    stopShuffle();
    document.getElementById('loadingOverlay').classList.remove('active');
    showResult();
  } catch (err) {
    stopShuffle();
    document.getElementById('loadingOverlay').classList.remove('active');
    const raw = err.message || '';
    if (raw.includes('overloaded') || raw.includes('529')) {
      showError('Claude is busy', 'Too many requests right now. Wait a moment and try again.');
    } else if (raw.includes('401') || raw.includes('invalid')) {
      showError('Auth error', 'API key issue. Contact support.');
    } else {
      showError('Conversion failed', raw.slice(0, 200));
    }
  }
}

// ═══════════════════════════════════════════════════════
// CLAUDE VISION — NOTE PARSING
// ═══════════════════════════════════════════════════════
const NOTE_PROMPT = `You are an expert note transcription AI. Perfectly mirror ALL content from these handwritten/typed notes into clean structured Markdown.

RULES:
1. Transcribe EVERYTHING visible — every word, number, symbol, no matter how small or messy.
2. Structure: # for main headings, ## subheadings, ### sub-subheadings.
3. Bullets as - items, numbered as 1. 2. 3.
4. Math: x^2 + 2x - 3 = 0, integral(f(x)dx), sum(i=1 to n), fractions as a/b.
5. Diagrams/figures: [Diagram: detailed description of what is shown]
6. Tables: recreate as | col | col | markdown tables with header row.
7. Multiple images = sequential pages, separate with ---
8. Fix obvious misspellings silently, preserve all meaning.
9. Start IMMEDIATELY with content — zero preamble.
10. Chemistry: H2O, CO2, C6H12O6 etc. Code: backtick fences.
11. Preserve emphasis: **bold** for underlined/circled/highlighted words.

Output only the clean Markdown now:`;

async function callClaudeVision() {
  const content = [];
  dataURLs.forEach((durl, i) => {
    const [hdr, b64] = durl.split(',');
    let mime = (hdr.match(/data:([^;]+);/) || [])[1] || 'image/jpeg';
    if (mime === 'image/heic' || mime === 'image/heif') mime = 'image/jpeg';
    if (mime === 'application/pdf') { content.push({ type: 'text', text: `[Page ${i+1}: PDF]` }); return; }
    content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
    if (dataURLs.length > 1) content.push({ type: 'text', text: `[Image ${i+1} of ${dataURLs.length}]` });
  });
  content.push({ type: 'text', text: NOTE_PROMPT });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content }]
    })
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error?.message || 'API error ' + res.status);
  }
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim();
}

// ═══════════════════════════════════════════════════════
// SHOW RESULT
// ═══════════════════════════════════════════════════════
function showResult() {
  const area = document.getElementById('pdf-preview-area');
  area.innerHTML = '';

  const dataUri = pdfInstance.output('datauristring');
  const embed = document.createElement('embed');
  embed.src = dataUri;
  embed.type = 'application/pdf';
  embed.style.cssText = 'width:100%;min-height:520px;border:none;display:block;';
  area.appendChild(embed);

  // Fallback plain text view
  const fb = document.createElement('div');
  fb.className = 'parsed-text-view';
  fb.id = 'parsedTextView';
  fb.textContent = parsedMD;
  fb.style.display = 'none';
  area.appendChild(fb);

  setTimeout(() => {
    try { if (!embed.offsetHeight || embed.offsetHeight < 10) { embed.style.display = 'none'; fb.style.display = 'block'; } }
    catch(e) { fb.style.display = 'block'; }
  }, 1200);

  document.getElementById('downloadBtn').onclick = () => pdfInstance.save('noteparse-notes.pdf');

  const rs = document.getElementById('result-section');
  rs.classList.add('visible');
  rs.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function doCopy() {
  navigator.clipboard.writeText(parsedMD).then(() => {
    const b = document.querySelector('.btn-action.secondary');
    const o = b.textContent; b.textContent = '✅ Copied!';
    setTimeout(() => b.textContent = o, 2000);
  }).catch(() => showError('Copy failed', 'Try selecting the text manually.'));
}

function resetAll() {
  files = []; dataURLs = []; parsedMD = ''; pdfInstance = null;
  document.getElementById('thumbStrip').innerHTML = '';
  document.getElementById('thumbCount').textContent = '';
  document.getElementById('dropTitle').textContent = 'Drop your notes here';
  document.getElementById('dropSub').style.display = '';
  document.getElementById('result-section').classList.remove('visible');
  document.getElementById('pdf-preview-area').innerHTML = '';
  for (let n = 1; n <= 4; n++) {
    const row = document.getElementById('sr' + n);
    row.querySelector('.step-spinner')?.remove();
    row.querySelector('.step-check')?.remove();
    row.classList.remove('active-row');
    document.getElementById('st' + n).className = 'step-text';
  }
  setPct(0);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════
// PDF GENERATION
// ═══════════════════════════════════════════════════════
function makePDF(md) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 50, MR = 50, MT = 68, MB = 40;
  const CW = W - ML - MR;
  let y = MT, pageNum = 1;

  function header() {
    doc.setFillColor(91,75,255);  doc.rect(0, 0, W*0.55, 7, 'F');
    doc.setFillColor(176,107,255); doc.rect(W*0.55, 0, W*0.45, 7, 'F');
    doc.setFillColor(91,75,255);  doc.roundedRect(ML, 14, 116, 24, 5, 5, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255);
    doc.text('NoteParse', ML+14, 30);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(180,170,200);
    doc.text('Page ' + pageNum, W-MR, 30, { align: 'right' });
    doc.setDrawColor(220,215,240); doc.setLineWidth(0.5); doc.line(ML, 46, W-MR, 46);
  }

  function footer() {
    doc.setFillColor(248,246,244); doc.rect(0, H-26, W, 26, 'F');
    doc.setDrawColor(230,225,245); doc.setLineWidth(0.4); doc.line(ML, H-26, W-MR, H-26);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(185,175,205);
    doc.text('Generated by NoteParse · AI-powered transcription', ML, H-10);
    doc.text(new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}), W-MR, H-10, { align: 'right' });
  }

  function newPage() { doc.addPage(); pageNum++; header(); footer(); y = MT; }
  function chk(need) { if (y + need > H - MB - 26) newPage(); }

  header(); footer();
  const lines = md.split('\n');

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trimEnd();
    if (line.trim() === '') { y += 7; continue; }

    // Page divider
    if (line.trim() === '---') {
      chk(16);
      doc.setDrawColor(210,200,240); doc.setLineWidth(0.8); doc.line(ML, y+6, W-MR, y+6);
      doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(190,180,215);
      doc.text('— continued —', W/2, y+6, { align: 'center', baseline: 'middle' });
      y += 20; continue;
    }

    // H1
    if (line.startsWith('# ')) {
      const txt = line.slice(2).trim(); chk(48); y += 10;
      doc.setFillColor(242,240,255); doc.roundedRect(ML, y, CW, 28, 5, 5, 'F');
      doc.setFillColor(91,75,255);   doc.roundedRect(ML, y, 5, 28, 2, 2, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(26,21,35);
      doc.text(txt, ML+14, y+19); y += 40; continue;
    }

    // H2
    if (line.startsWith('## ')) {
      const txt = line.slice(3).trim(); chk(36); y += 8;
      doc.setFillColor(176,107,255); doc.roundedRect(ML, y+2, 4, 18, 2, 2, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(60,40,100);
      doc.text(txt, ML+12, y+15); y += 28; continue;
    }

    // H3
    if (line.startsWith('### ')) {
      const txt = line.slice(4).trim(); chk(24); y += 4;
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(91,75,255);
      doc.text(txt, ML, y+11); y += 18; continue;
    }

    // Diagram box
    const diagMatch = line.match(/^\[Diagram:\s*(.*?)\]?$/i);
    if (diagMatch) {
      const desc = diagMatch[1];
      const dL = doc.splitTextToSize(desc, CW-28);
      const bH = Math.max(52, dL.length * 12 + 28); chk(bH+10); y += 4;
      doc.setFillColor(238,235,255); doc.setDrawColor(195,182,255); doc.setLineWidth(1);
      doc.roundedRect(ML, y, CW, bH, 7, 7, 'FD');
      doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(139,91,255);
      doc.text('📊  DIAGRAM / FIGURE', ML+12, y+14);
      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(100,80,140);
      dL.forEach((dl, di) => doc.text(dl, ML+12, y+26+di*12));
      y += bH+12; continue;
    }

    // Table row
    if (line.startsWith('|')) {
      const cells = line.split('|').filter((_,i,a) => i > 0 && i < a.length-1).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      const colW = Math.floor(CW / cells.length); chk(18);
      const isHdr = li > 0 && !lines[li-1]?.trim().startsWith('|');
      if (isHdr) { doc.setFillColor(91,75,255); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); }
      else        { doc.setFillColor(248,246,252); doc.setTextColor(50,40,70);  doc.setFont('helvetica','normal'); }
      doc.setFontSize(9);
      doc.rect(ML, y, CW, 16, 'F');
      doc.setDrawColor(210,202,240); doc.setLineWidth(0.3); doc.rect(ML, y, CW, 16, 'D');
      cells.forEach((cell, ci) => {
        const cx = ML + ci * colW;
        doc.rect(cx, y, colW, 16, 'D');
        doc.text(doc.splitTextToSize(cell, colW-6)[0], cx+4, y+11);
      });
      y += 16; continue;
    }

    // Bullet
    const bm = line.match(/^(\s*)([-*•])\s+(.*)/);
    if (bm) {
      const ind = Math.floor(bm[1].length/2) * 12, txt = bm[3];
      const wr = doc.splitTextToSize(txt, CW-18-ind); chk(wr.length*13+4);
      doc.setFillColor(91,75,255); doc.circle(ML+ind+5, y+5.5, 2.5, 'F');
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(50,40,70);
      wr.forEach((wl, wi) => doc.text(wl, ML+ind+13, y+8+wi*13));
      y += wr.length*13+4; continue;
    }

    // Numbered list
    const nm = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (nm) {
      const ind = Math.floor(nm[1].length/2) * 12, num = nm[2], txt = nm[3];
      const wr = doc.splitTextToSize(txt, CW-22-ind); chk(wr.length*13+4);
      doc.setFillColor(91,75,255); doc.roundedRect(ML+ind, y, 17, 14, 3, 3, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(255,255,255);
      doc.text(num, ML+ind+8.5, y+10, { align: 'center' });
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(50,40,70);
      wr.forEach((wl, wi) => doc.text(wl, ML+ind+22, y+10+wi*13));
      y += wr.length*13+4; continue;
    }

    // Bold line
    if (line.startsWith('**') && line.endsWith('**')) {
      const txt = line.slice(2,-2);
      const wr = doc.splitTextToSize(txt, CW); chk(wr.length*13+2);
      doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(26,21,35);
      wr.forEach((wl, wi) => doc.text(wl, ML, y+10+wi*13));
      y += wr.length*13+2; continue;
    }

    // Equation or plain text
    const isEq = /[=^*/\\]/.test(line) && line.length < 120 && !/[a-zA-Z]{8,}/.test(line);
    const wr = doc.splitTextToSize(line, isEq ? CW-20 : CW);
    chk(wr.length*13+3);
    if (isEq) {
      doc.setFillColor(252,250,255); doc.setDrawColor(215,205,248); doc.setLineWidth(0.4);
      doc.roundedRect(ML, y-1, CW, wr.length*13+8, 4, 4, 'FD');
      doc.setFont('courier','normal'); doc.setFontSize(10); doc.setTextColor(91,75,255);
      wr.forEach((wl, wi) => doc.text(wl, ML+10, y+9+wi*13));
      y += wr.length*13+12;
    } else {
      doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(50,40,70);
      wr.forEach((wl, wi) => doc.text(wl, ML, y+9+wi*13));
      y += wr.length*13+4;
    }
  }

  return doc;
}

// ═══════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════
function updateChatUI() {
  const isMaxed = !isPro && chatCount >= FREE_CHAT_LIMIT;
  document.getElementById('chatUpgradeWall').style.display = isMaxed ? 'block' : 'none';
  document.getElementById('chatInputRow').style.display   = isMaxed ? 'none'  : 'flex';

  for (let i = 1; i <= 5; i++) {
    const dot = document.getElementById('ld' + i);
    if (dot) dot.classList.toggle('used', i <= chatCount);
  }

  const el = document.getElementById('msgsLeft');
  if (el) el.textContent = isPro ? '∞' : Math.max(0, FREE_CHAT_LIMIT - chatCount);

  const bar = document.getElementById('chatLimitBar');
  if (isPro && bar) bar.style.display = 'none';
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  if (!isPro && chatCount >= FREE_CHAT_LIMIT) return;

  input.value = ''; input.style.height = '48px';
  addChatBubble('user', text);
  document.getElementById('chatSendBtn').disabled = true;

  const systemPrompt = `You are a helpful study assistant. The user has converted their handwritten notes into the following text, and you are answering questions about it. Be concise, helpful, and smart. Here are their notes:\n\n---\n${parsedMD}\n---`;

  chatMsgs.push({ role: 'user', content: text });

  const thinkId = 'think_' + Date.now();
  addChatBubble('ai', '…', thinkId, true);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: chatMsgs
      })
    });

    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || 'API error'); }
    const data = await res.json();
    const reply = data.content?.[0]?.text || "Sorry, I couldn't get a response.";
    chatMsgs.push({ role: 'assistant', content: reply });

    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) { thinkEl.innerHTML = formatChatText(reply); thinkEl.classList.remove('thinking'); }
  } catch(err) {
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.textContent = 'Error: ' + err.message;
  }

  chatCount++;
  updateChatUI();
  document.getElementById('chatSendBtn').disabled = false;
  scrollChat();
}

function formatChatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/, '<p>$1</p>');
}

function addChatBubble(role, text, id = '', thinking = false) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div'); div.className = 'chat-msg ' + role;
  const avatar = document.createElement('div'); avatar.className = 'msg-avatar ' + role;
  avatar.textContent = role === 'ai' ? '🤖' : '👤';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble ' + role + (thinking ? ' thinking' : '');
  if (id) bubble.id = id;
  if (thinking) bubble.textContent = '…';
  else bubble.innerHTML = formatChatText(text);
  div.append(avatar, bubble);
  msgs.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const msgs = document.getElementById('chatMessages');
  msgs.scrollTop = msgs.scrollHeight;
}

function chatKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }
function autoResize(el) { el.style.height = '48px'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

// ═══════════════════════════════════════════════════════
// FAQ
// ═══════════════════════════════════════════════════════
function toggleFaq(el) { el.classList.toggle('open'); }

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadProState();
  updateLimitNote();
  updateChatUI();
});
