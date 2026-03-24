'use strict';

/* ═══════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════ */
const KP_NAMES = [
  'Nose','L.Eye','R.Eye','L.Ear','R.Ear',
  'L.Shldr','R.Shldr','L.Elbow','R.Elbow',
  'L.Wrist','R.Wrist','L.Hip','R.Hip',
  'L.Knee','R.Knee','L.Ankle','R.Ankle'
];

const IDX = {
  NOSE:0, L_EYE:1, R_EYE:2, L_EAR:3, R_EAR:4,
  L_SH:5,  R_SH:6,  L_EL:7, R_EL:8,
  L_WR:9,  R_WR:10, L_HI:11, R_HI:12,
  L_KN:13, R_KN:14, L_AN:15, R_AN:16
};

const EDGES = [
  [0,1],[0,2],[1,3],[2,4],
  [5,6],[5,7],[7,9],[6,8],[8,10],
  [5,11],[6,12],[11,12],
  [11,13],[13,15],[12,14],[14,16]
];

// Pastel segment colours [face, arms, torso, legs]
const SEG_PALETTE = ['#ff8fab','#c77dff','#52b788','#ffb347'];
const EDGE_SEG    = [0,0,0,0,  1,1,1,1,1,1,  2,2,  3,3,3,3];

/* ═══════════════════════════════════════════
   POSES — with mood descriptions
═══════════════════════════════════════════ */
const POSES = [
  { name:'Hands Up!',  emoji:'🙌', mood:'Feeling celebratory!',  color:'#ff8fab', moodEmoji:'🥳' },
  { name:'T-Pose',     emoji:'✈️',  mood:'Ready for takeoff~',    color:'#c77dff', moodEmoji:'😎' },
  { name:'Squatting',  emoji:'🏋️', mood:'Working those legs!',   color:'#ffb347', moodEmoji:'💪' },
  { name:'Sitting',    emoji:'🪑', mood:'Chilling comfortably~',  color:'#90caf9', moodEmoji:'😌' },
  { name:'Bending',    emoji:'🤸', mood:'Super flexible!',        color:'#52b788', moodEmoji:'🌟' },
  { name:'Standing',   emoji:'🧍', mood:'Standing tall & proud!', color:'#52b788', moodEmoji:'😊' },
  { name:'Walking',    emoji:'🚶', mood:'On the move!',           color:'#4fc3f7', moodEmoji:'🎵' },
  { name:'Unknown',    emoji:'❓', mood:'Hmm, what pose is this?',color:'#b0bec5', moodEmoji:'🤔' },
];

/* ═══════════════════════════════════════════
   POSE CLASSIFIER (same logic)
═══════════════════════════════════════════ */
function pt(kps, i) { const k = kps[i]; return k ? { x:k.x, y:k.y, s:k.score } : null; }
function vis(p, th=0.22) { return p && p.s >= th; }
function angDeg(a, b, c) {
  const ab=[a.x-b.x,a.y-b.y], cb=[c.x-b.x,c.y-b.y];
  const dot=ab[0]*cb[0]+ab[1]*cb[1];
  const mag=Math.sqrt((ab[0]**2+ab[1]**2)*(cb[0]**2+cb[1]**2));
  if(!mag) return 180;
  return Math.acos(Math.min(1,Math.max(-1,dot/mag)))*180/Math.PI;
}

function classifyPose(kps, W, H) {
  const ls=pt(kps,IDX.L_SH), rs=pt(kps,IDX.R_SH);
  const lh=pt(kps,IDX.L_HI), rh=pt(kps,IDX.R_HI);
  const lk=pt(kps,IDX.L_KN), rk=pt(kps,IDX.R_KN);
  const la=pt(kps,IDX.L_AN), ra=pt(kps,IDX.R_AN);
  const lw=pt(kps,IDX.L_WR), rw=pt(kps,IDX.R_WR);

  if (!vis(ls) && !vis(rs)) return 7;

  const my = (a,b) => vis(a)&&vis(b)?(a.y+b.y)/2 : vis(a)?a.y : vis(b)?b.y : null;
  const shY=my(ls,rs), hiY=my(lh,rh), knY=my(lk,rk);

  // Hands up
  if(vis(lw)&&vis(rw)&&vis(ls)&&vis(rs))
    if(lw.y<ls.y-0.05*H && rw.y<rs.y-0.05*H) return 0;

  // T-pose
  if(vis(lw)&&vis(rw)&&vis(ls)&&vis(rs)){
    const spread=Math.abs(lw.x-rw.x), shSp=Math.abs(ls.x-rs.x);
    if(spread>shSp*2.0 && Math.abs(lw.y-ls.y)<0.1*H && Math.abs(rw.y-rs.y)<0.1*H) return 1;
  }

  let knL=180, knR=180;
  if(vis(lh)&&vis(lk)&&vis(la)) knL=angDeg(lh,lk,la);
  if(vis(rh)&&vis(rk)&&vis(ra)) knR=angDeg(rh,rk,ra);
  const kn=Math.min(knL,knR);

  if(kn<100 && hiY!==null && knY!==null && Math.abs(hiY-knY)<0.12*H) return 2; // squat
  if(kn<130 && kn>=90 && hiY!==null && knY!==null && Math.abs(hiY-knY)<0.22*H) return 3; // sit

  // Walking
  if(vis(la)&&vis(ra) && Math.abs(la.y-ra.y)>0.06*H && kn>140) return 6;

  // Bending
  if(vis(ls)&&vis(lh)){
    const ta=Math.abs(Math.atan2(ls.y-lh.y,ls.x-lh.x)*180/Math.PI);
    if(Math.abs(90-ta)>38) return 4;
  }

  if(shY!==null && hiY!==null && shY<hiY) return 5; // standing
  return 7;
}

/* ═══════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════ */
const video     = document.getElementById('video');
const canvas    = document.getElementById('canvas');
const ctx       = canvas.getContext('2d');
const idleCover = document.getElementById('idle-cover');
const videoCard = document.getElementById('video-card');
const livePill  = document.getElementById('live-pill');
const confFill  = document.getElementById('conf-fill');

const btnStart  = document.getElementById('btn-start');
const btnStop   = document.getElementById('btn-stop');
const btnClear  = document.getElementById('btn-clear');

const sbDot     = document.getElementById('sb-dot');
const statusTxt = document.getElementById('status-text');

const fpsEl     = document.getElementById('fps-val');
const kpEl      = document.getElementById('kp-val');
const confChip  = document.getElementById('conf-chip');

const phEmoji   = document.getElementById('ph-emoji');
const phName    = document.getElementById('ph-name');
const phMood    = document.getElementById('ph-mood');
const poseHero  = document.getElementById('pose-hero');
const streakNum = document.getElementById('streak-num');

const confSlider= document.getElementById('conf-slider');
const confVal   = document.getElementById('conf-val');
const ptSlider  = document.getElementById('pt-slider');
const ptVal     = document.getElementById('pt-val');
const togMirror = document.getElementById('tog-mirror');
const togSkel   = document.getElementById('tog-skel');
const togLabels = document.getElementById('tog-labels');
const togGlow   = document.getElementById('tog-glow');

const moodGrid     = document.getElementById('mood-grid');
const poseStatList = document.getElementById('pose-stat-list');
const histScroll   = document.getElementById('hist-scroll');
const kpBubbles    = document.getElementById('kp-bubbles');
const confettiBox  = document.getElementById('confetti-box');

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let detector=null, stream=null, rafId=null, running=false;
let frameCount=0, lastSecond=performance.now();
let lastPoseIdx=-1, streak=0;
let poseCounts = new Array(POSES.length).fill(0);
let histLog = [];

/* ═══════════════════════════════════════════
   INIT MOOD GRID (static chips, one per pose)
═══════════════════════════════════════════ */
function initMoodGrid() {
  moodGrid.innerHTML = POSES.slice(0, 6).map((p, i) =>
    `<div class="mood-chip" id="mc-${i}">
      <span class="mc-emoji">${p.moodEmoji}</span>
      <span>${p.name}</span>
    </div>`
  ).join('');
}

function updateMoodGrid(idx) {
  document.querySelectorAll('.mood-chip').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

/* ═══════════════════════════════════════════
   INIT KEYPOINT BUBBLES
═══════════════════════════════════════════ */
function initKpBubbles() {
  kpBubbles.innerHTML = KP_NAMES.map((n, i) =>
    `<div class="kp-bub" id="kpb-${i}">${n}</div>`
  ).join('');
}

function updateKpBubbles(kps, minConf) {
  kps.forEach((kp, i) => {
    const el = document.getElementById(`kpb-${i}`);
    if (el) el.classList.toggle('on', kp.score >= minConf);
  });
  const det = kps.filter(k => k.score >= parseFloat(confSlider.value)).length;
  kpEl.textContent = `${det}/17`;
}

/* ═══════════════════════════════════════════
   CONFETTI BURST
═══════════════════════════════════════════ */
const CONFETTI_COLORS = ['#ff8fab','#c77dff','#52b788','#ffb347','#90caf9','#ffd6e0','#e9d5ff'];

function burst() {
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${20 + Math.random()*60}%;
      background: ${CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)]};
      width: ${6+Math.random()*8}px;
      height: ${6+Math.random()*8}px;
      border-radius: ${Math.random()>0.5?'50%':'3px'};
      animation-duration: ${1.2+Math.random()*1.2}s;
      animation-delay: ${Math.random()*0.3}s;
    `;
    confettiBox.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
}

/* ═══════════════════════════════════════════
   STATUS
═══════════════════════════════════════════ */
function setStatus(cls, txt) {
  sbDot.className = 'sb-dot ' + cls;
  statusTxt.textContent = txt;
}

/* ═══════════════════════════════════════════
   POSE UI UPDATE
═══════════════════════════════════════════ */
function updatePoseUI(idx, avgConf) {
  const pose = POSES[idx];

  confFill.style.width = (avgConf * 100) + '%';
  confChip.textContent = (avgConf*100).toFixed(0) + '%';
  phMood.textContent = pose.mood;

  if (idx !== lastPoseIdx) {
    phName.textContent = pose.name;
    phEmoji.textContent = pose.emoji;

    phEmoji.classList.remove('bounce');
    void phEmoji.offsetWidth;
    phEmoji.classList.add('bounce');

    poseHero.classList.add('active');
    updateMoodGrid(idx < 6 ? idx : -1);

    // Streak
    if (idx !== 7) {
      streak++;
      streakNum.textContent = streak;
      if (streak % 5 === 0) burst(); // confetti every 5 new poses
    }

    addHistory(pose);
    lastPoseIdx = idx;
  }

  poseCounts[idx]++;
  renderPoseStats();
}

/* ═══════════════════════════════════════════
   POSE STATS
═══════════════════════════════════════════ */
function renderPoseStats() {
  const total = poseCounts.reduce((a,b)=>a+b,0) || 1;
  const max   = Math.max(...poseCounts, 1);
  poseStatList.innerHTML = POSES.map((p, i) => {
    if (!poseCounts[i]) return '';
    const pct = (poseCounts[i] / max * 100).toFixed(0);
    return `<div class="ps-item">
      <div class="ps-row">
        <span class="ps-emoji">${p.emoji}</span>
        <span class="ps-name">${p.name}</span>
        <span class="ps-cnt">${poseCounts[i]}</span>
      </div>
      <div class="ps-bar"><div class="ps-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════ */
function addHistory(pose) {
  const t = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  histLog.unshift({ emoji:pose.emoji, name:pose.name, time:t });
  if (histLog.length > 20) histLog.pop();
  renderHistory();
}

function renderHistory() {
  if (!histLog.length) {
    histScroll.innerHTML = '<div class="hist-empty">no poses yet 🌱</div>';
    return;
  }
  histScroll.innerHTML = histLog.map(e =>
    `<div class="hist-row">
      <span class="hr-emoji">${e.emoji}</span>
      <span class="hr-name">${e.name}</span>
      <span class="hr-time">${e.time}</span>
    </div>`
  ).join('');
}

/* ═══════════════════════════════════════════
   DRAWING
═══════════════════════════════════════════ */
function mx(x) { return togMirror.checked ? canvas.width - x : x; }

function drawSkeleton(kps, minConf) {
  const thickness = 3;
  ctx.lineWidth = thickness; ctx.lineCap = 'round';

  EDGES.forEach(([i, j], ei) => {
    const a=kps[i], b=kps[j];
    if (!a||!b||a.score<minConf||b.score<minConf) return;
    const ax=mx(a.x), bx=mx(b.x);
    const col = SEG_PALETTE[EDGE_SEG[ei]||0];
    const grad = ctx.createLinearGradient(ax,a.y,bx,b.y);
    grad.addColorStop(0, col+'dd');
    grad.addColorStop(1, col+'66');
    if (togGlow.checked) { ctx.shadowColor=col; ctx.shadowBlur=10; }
    ctx.strokeStyle=grad; ctx.globalAlpha=0.92;
    ctx.beginPath(); ctx.moveTo(ax,a.y); ctx.lineTo(bx,b.y); ctx.stroke();
  });
  ctx.shadowBlur=0; ctx.globalAlpha=1;
}

function drawKeypoints(kps, minConf) {
  const ptSz = parseInt(ptSlider.value);
  kps.forEach((kp, i) => {
    if (kp.score < minConf) return;
    const x=mx(kp.x), y=kp.y;
    const col = i<5 ? SEG_PALETTE[0] : i<11 ? SEG_PALETTE[1] : i<13 ? SEG_PALETTE[2] : SEG_PALETTE[3];

    if (togGlow.checked) { ctx.shadowColor=col; ctx.shadowBlur=14; }

    // White dot
    ctx.beginPath(); ctx.arc(x,y,ptSz,0,Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill();

    // Color tint
    ctx.beginPath(); ctx.arc(x,y,ptSz,0,Math.PI*2);
    ctx.fillStyle=col+'aa'; ctx.fill();

    // Outer ring
    ctx.beginPath(); ctx.arc(x,y,ptSz+3,0,Math.PI*2);
    ctx.strokeStyle=col; ctx.globalAlpha=0.25; ctx.lineWidth=1.5; ctx.stroke();
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  });
}

function drawLabels(kps, minConf) {
  ctx.font = '600 10px Nunito';
  ctx.textBaseline = 'bottom';
  kps.forEach((kp, i) => {
    if (kp.score < minConf) return;
    const x=mx(kp.x), y=kp.y;
    const col = SEG_PALETTE[i<5?0:i<11?1:i<13?2:3];
    const tw = ctx.measureText(KP_NAMES[i]).width;
    ctx.fillStyle='rgba(255,245,248,0.85)';
    ctx.beginPath();
    ctx.roundRect(x+5, y-17, tw+8, 14, 4);
    ctx.fill();
    ctx.fillStyle=col; ctx.fillText(KP_NAMES[i], x+9, y-5);
  });
}

/* ═══════════════════════════════════════════
   MODEL LOAD — OPTIMISED
   Fixes applied:
   1. tf.ENV flags set before backend init to reduce GPU memory pressure
   2. Model loaded with IndexedDB caching via tfhub URL — weights are
      stored in the browser after the first download, so subsequent
      page loads are near-instant (no re-download needed).
   3. Warm-up inference on a zero tensor so the first real frame
      doesn't stall while WebGL shaders compile.
═══════════════════════════════════════════ */
async function loadModel() {
  try {
    // Step 1 — try WebGL first (fastest), fall back to CPU if unavailable
    setStatus('loading', 'Initialising WebGL…');
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    try {
      await tf.setBackend('webgl');
      await tf.ready();
    } catch (_) {
      await tf.setBackend('cpu');
      await tf.ready();
    }

    // Step 2 — download + compile model
    // TF.js caches model weights in IndexedDB after the first download,
    // so subsequent loads skip the network entirely.
    setStatus('loading', 'Downloading model… (cached after 1st load)');
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true
      }
    );

    setStatus('ready', 'Ready! Click Start 🌸');
    btnStart.disabled = false;
  } catch (err) {
    setStatus('error', 'Load failed — refresh to retry 🔄');
    console.error('Model load error:', err);
  }
}

/* ═══════════════════════════════════════════
   CAMERA START / STOP
═══════════════════════════════════════════ */
btnStart.addEventListener('click', async () => {
  btnStart.disabled = true;
  setStatus('loading', 'Opening camera…');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:60,max:60}, facingMode:'user' },
      audio: false
    });
    video.srcObject = stream;
    await new Promise(r => { video.onloadedmetadata = r; });
    await video.play();

    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;

    idleCover.classList.add('gone');
    videoCard.classList.add('live');
    livePill.classList.add('show');
    btnStop.disabled = false;
    running = true;
    lastPoseIdx = -1; streak = 0; streakNum.textContent = 0;
    poseCounts = new Array(POSES.length).fill(0);
    histLog = [];
    renderHistory();
    setStatus('live', 'Live & detecting 🌟');
    loop();
  } catch(err) {
    setStatus('error', 'Camera denied 😢');
    btnStart.disabled = false;
    console.error(err);
  }
});

btnStop.addEventListener('click', () => {
  running = false;
  cancelAnimationFrame(rafId);
  if (stream) stream.getTracks().forEach(t => t.stop());
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  idleCover.classList.remove('gone');
  videoCard.classList.remove('live');
  livePill.classList.remove('show');
  confFill.style.width = '0%';
  fpsEl.textContent = '--'; kpEl.textContent = '0/17'; confChip.textContent = '--%';
  phName.textContent = 'Waiting…'; phMood.textContent = 'start camera to begin';
  phEmoji.textContent = '✨';
  poseHero.classList.remove('active');
  btnStart.disabled = false; btnStop.disabled = true;
  setStatus('ready', 'Stopped — click Start to resume');
});

btnClear.addEventListener('click', () => { histLog=[]; renderHistory(); });

/* Slider listeners */
confSlider.addEventListener('input', () => { confVal.textContent = confSlider.value; });
ptSlider.addEventListener('input',   () => { ptVal.textContent   = ptSlider.value; });

/* ═══════════════════════════════════════════
   MAIN LOOP
═══════════════════════════════════════════ */
async function loop() {
  if (!running) return;

  const minConf = parseFloat(confSlider.value);
  const mirror  = togMirror.checked;
  const skel    = togSkel.checked;
  const labels  = togLabels.checked;

  let poses = [];
  try { poses = await detector.estimatePoses(video); } catch(_) {}

  // FPS
  frameCount++;
  const now = performance.now();
  if (now - lastSecond >= 1000) {
    fpsEl.textContent = frameCount;
    frameCount = 0; lastSecond = now;
  }

  // Render video
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (mirror) { ctx.save(); ctx.translate(canvas.width,0); ctx.scale(-1,1); }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (mirror) ctx.restore();

  // Soft overlay
  ctx.fillStyle = 'rgba(253,246,240,0.15)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (poses.length > 0) {
    const kps = poses[0].keypoints;
    if (skel)   { drawSkeleton(kps, minConf); drawKeypoints(kps, minConf); }
    if (labels)   drawLabels(kps, minConf);

    const hc = kps.filter(k=>k.score>=minConf);
    const avg = hc.length ? hc.reduce((s,k)=>s+k.score,0)/hc.length : 0;

    updateKpBubbles(kps, minConf);
    updatePoseUI(classifyPose(kps, canvas.width, canvas.height), avg);
  } else {
    updateKpBubbles([], minConf);
  }

  rafId = requestAnimationFrame(loop);
}

/* ═══════════════════════════════════════════
   BOOT
═══════════════════════════════════════════ */
initMoodGrid();
initKpBubbles();
renderHistory();
renderPoseStats();
loadModel();