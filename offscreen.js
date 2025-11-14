// 简化测试版 - 先验证基本功能
console.log('========================================');
console.log('[OFFSCREEN] Script loaded!');
console.log('========================================');

const state = {
  running: false,
  paused: false,
  lastTrigger: 0,
  cooldownMs: 700,
  lastClickTrigger: 0,
  clickCooldownMs: 2000,  // 握拳点击冷却时间2秒
  lastPalmState: null,  // 记录上一次手掌状态: 'open' 或 'closed'
  positions: [],
  bufferMs: 450,
  videoW: 640,
  videoH: 480,
  camera: null,
  hands: null,
};

function now() { return performance.now(); }

function palmCenter(landmarks) {
  let sx = 0, sy = 0;
  for (const p of landmarks) { sx += p.x; sy += p.y; }
  const n = landmarks.length || 1;
  return { x: sx / n, y: sy / n };
}

function isFingerExtended(lm, tipIdx, mcpIdx) {
  const wrist = lm[0];
  const tip = lm[tipIdx];
  const mcp = lm[mcpIdx];
  const dTip = Math.sqrt((tip.x - wrist.x) ** 2 + (tip.y - wrist.y) ** 2);
  const dMcp = Math.sqrt((mcp.x - wrist.x) ** 2 + (mcp.y - wrist.y) ** 2);
  // 降低阈值，更容易识别为伸展
  return dTip > dMcp * 1.02;
}

function isOpenPalm(lm) {
  const fingers = [
    isFingerExtended(lm, 8, 5),   // 食指
    isFingerExtended(lm, 12, 9),  // 中指
    isFingerExtended(lm, 16, 13), // 无名指
    isFingerExtended(lm, 20, 17)  // 小指
  ];
  const extendedCount = fingers.filter(Boolean).length;
  
  // 降低要求：只需2根手指伸展即可（更宽松）
  const result = extendedCount >= 2;
  
  if (result) {
    console.log('[OFFSCREEN] ✋ Open palm detected! Extended fingers:', extendedCount, fingers);
  }
  
  return result;
}

function isClosedFist(lm) {
  const pairs = [ [8,5], [12,9], [16,13], [20,17] ];
  let score = 0;
  for (const [tip, mcp] of pairs) {
    const d = Math.sqrt((lm[tip].x - lm[mcp].x) ** 2 + (lm[tip].y - lm[mcp].y) ** 2);
    score += d;
  }
  return score < 0.25;
}

function pushPosition(center) {
  const t = now();
  state.positions.push({ t, c: center });
  while (state.positions.length && (t - state.positions[0].t) > state.bufferMs) {
    state.positions.shift();
  }
}

function tryEmitDirection() {
  const t = now();
  if ((t - state.lastTrigger) < state.cooldownMs) {
    console.log('[OFFSCREEN] ⏳ Cooldown active');
    return;
  }
  if (state.positions.length < 3) {
    console.log('[OFFSCREEN] 📊 Not enough samples:', state.positions.length);
    return;
  }
  
  // 只使用最近300ms的位置数据来判断最终方向
  const finalWindowMs = 300;
  const recentT = t - finalWindowMs;
  const finalPositions = state.positions.filter(p => p.t >= recentT);
  
  if (finalPositions.length < 2) {
    console.log('[OFFSCREEN] 📊 Not enough recent samples for final direction');
    return;
  }
  
  // 使用最近的位置来确定最终方向
  const first = finalPositions[0].c;
  const last = finalPositions[finalPositions.length - 1].c;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  
  console.log('[OFFSCREEN] 📏 Final movement (last 300ms,', finalPositions.length, 'samples):', {
    dx: dx.toFixed(3),
    dy: dy.toFixed(3)
  });
  
  // 降低移动阈值，更容易触发
  const thX = 0.03;
  const thY = 0.03;
  let direction = null;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    if (Math.abs(dx) > thX) {
      direction = dx > 0 ? "right" : "left";
    }
  } else {
    if (Math.abs(dy) > thY) {
      direction = dy > 0 ? "down" : "up";
    }
  }
  
  if (direction) {
    console.log('[OFFSCREEN] 🎯🎯🎯 GESTURE DETECTED:', direction);
    state.lastTrigger = t;
    state.positions = []; // 清空位置缓存，避免重复检测
    chrome.runtime.sendMessage({ type: "GESTURE_DIRECTION", direction })
      .then(() => console.log('[OFFSCREEN] ✅ Message sent to background'))
      .catch(e => console.error('[OFFSCREEN] ❌ Failed to send message:', e));
  } else {
    console.log('[OFFSCREEN] 📉 Movement too small');
  }
}

function onResults(results) {
  if (!state.running) return;
  
  const lms = results.multiHandLandmarks?.[0];
  if (!lms) {
    return; // 不打印太多 "no hand" 日志
  }
  
  console.log('[OFFSCREEN] ✋ Hand detected!');
  
  // 判断当前状态
  const isFist = isClosedFist(lms);
  const isPalmOpen = isOpenPalm(lms);
  
  let currentState = null;
  if (isFist) {
    currentState = 'closed';
  } else if (isPalmOpen) {
    currentState = 'open';
  }
  
  // 检测状态变化
  if (currentState && state.lastPalmState && currentState !== state.lastPalmState) {
    const t = now();
    if ((t - state.lastClickTrigger) >= state.clickCooldownMs) {
      console.log('[OFFSCREEN] 🔄 Palm state changed:', state.lastPalmState, '→', currentState);
      console.log('[OFFSCREEN] 👆 Sending click command');
      chrome.runtime.sendMessage({ type: "GESTURE_CLICK" });
      state.lastClickTrigger = t;
    } else {
      console.log('[OFFSCREEN] ⏳ Click cooldown active');
    }
  }
  
  // 更新状态
  state.lastPalmState = currentState;
  
  console.log('[OFFSCREEN] 🖐️ Palm open:', isPalmOpen);
  
  if (!isPalmOpen) return;
  
  const center = palmCenter(lms);
  console.log('[OFFSCREEN] 📍 Palm center:', center.x.toFixed(3), center.y.toFixed(3));
  
  pushPosition(center);
  tryEmitDirection();
}

async function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureMediaPipe() {
  console.log('[OFFSCREEN] 📚 Loading MediaPipe...');
  if (typeof Hands !== 'undefined' && typeof Camera !== 'undefined') {
    console.log('[OFFSCREEN] ✅ MediaPipe already loaded');
    return true;
  }
  try {
    const libBase = chrome.runtime.getURL('vendor/mediapipe/');
    console.log('[OFFSCREEN] Loading from:', libBase);
    await loadScript(`${libBase}camera_utils.js`);
    await loadScript(`${libBase}hands.js`);
    const ok = (typeof Hands !== 'undefined' && typeof Camera !== 'undefined');
    console.log('[OFFSCREEN] MediaPipe loaded:', ok);
    return ok;
  } catch (e) {
    console.error('[OFFSCREEN] ❌ MediaPipe load failed:', e);
    return false;
  }
}

async function setupHands(video) {
  console.log('[OFFSCREEN] 🤖 Setting up Hands...');
  const hands = new Hands({
    locateFile: (file) => {
      const url = chrome.runtime.getURL(`vendor/mediapipe/${file}`);
      console.log('[OFFSCREEN] Locating file:', file, '→', url);
      return url;
    },
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  hands.onResults(onResults);
  
  // 必须先初始化MediaPipe模型
  console.log('[OFFSCREEN] 🔄 Initializing MediaPipe model...');
  await hands.initialize();
  console.log('[OFFSCREEN] ✅ MediaPipe model initialized');

  // Camera类在offscreen中不工作，使用手动interval
  console.log('[OFFSCREEN] 📹 Using manual setInterval (Camera class doesnt work in offscreen)');
  
  let frameCount = 0;
  let lastLog = Date.now();
  let intervalId = null;
  
  const processFrame = async () => {
    frameCount++;
    const now = Date.now();
    if (now - lastLog > 5000) {
      console.log('[OFFSCREEN] 📹 processFrame called', frameCount, 'times in last 5s');
      frameCount = 0;
      lastLog = now;
    }
    
    if (state.running) {
      try {
        await hands.send({ image: video });
      } catch (e) {
        console.error('[OFFSCREEN] ❌ Error in hands.send:', e);
      }
    }
  };
  
  // 创建伪Camera对象
  state.camera = {
    start: async () => {
      console.log('[OFFSCREEN] 🎬 Starting manual frame loop (33ms interval, ~30fps)...');
      intervalId = setInterval(processFrame, 33);
      console.log('[OFFSCREEN] ✅ Interval started, ID:', intervalId);
    },
    stop: () => {
      console.log('[OFFSCREEN] ⏹ Stopping interval...');
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    h: { srcObject: video.srcObject }
  };
  
  state.hands = hands;
  console.log('[OFFSCREEN] ✅ Hands setup complete (using manual interval)');
}

async function start() {
  console.log('[OFFSCREEN] ========================================');
  console.log('[OFFSCREEN] 🚀 START called');
  console.log('[OFFSCREEN] ========================================');
  
  if (state.running) {
    console.log('[OFFSCREEN] ⚠️ Already running');
    return;
  }
  
  state.running = true;
  state.paused = false;
  state.positions = [];
  
  try {
    const ok = await ensureMediaPipe();
    if (!ok) {
      console.error('[OFFSCREEN] ❌ MediaPipe not available');
      state.running = false;
      return;
    }
    
    console.log('[OFFSCREEN] 📹 Requesting camera...');
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true,
      audio: false 
    });
    
    const videoTrack = stream.getVideoTracks()[0];
    console.log('[OFFSCREEN] ✅ Camera obtained:', videoTrack.label);
    
    const video = document.createElement("video");
    video.style.display = "none";
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.srcObject = stream;
    document.body.appendChild(video);
    
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });
    
    await video.play();
    console.log('[OFFSCREEN] ▶️ Video playing');
    
    await setupHands(video);
    
    console.log('[OFFSCREEN] 🎬 Starting camera loop...');
    await state.camera.start();
    
    console.log('[OFFSCREEN] ========================================');
    console.log('[OFFSCREEN] ✅✅✅ RECOGNITION ACTIVE ✅✅✅');
    console.log('[OFFSCREEN] ========================================');
    
  } catch (e) {
    console.error('[OFFSCREEN] ========================================');
    console.error('[OFFSCREEN] ❌❌❌ START FAILED ❌❌❌');
    console.error('[OFFSCREEN]', e.name, ':', e.message);
    console.error('[OFFSCREEN] ========================================');
    state.running = false;
  }
}

async function stop() {
  console.log('[OFFSCREEN] 🛑 STOP called');
  if (!state.running) return;
  
  state.running = false;
  state.paused = false;
  
  try { 
    if (state.camera?.h?.srcObject) {
      state.camera.h.srcObject.getTracks().forEach(track => track.stop());
    }
    state.camera?.stop(); 
  } catch (e) {
    console.warn('[OFFSCREEN] Error stopping camera:', e);
  }
  
  try { state.hands?.close(); } catch (e) {}
  
  state.camera = null;
  state.hands = null;
  state.positions = [];
  
  console.log('[OFFSCREEN] ✅ Stopped');
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[OFFSCREEN] 📨 Message received:', msg.type);
  
  switch (msg.type) {
    case "OFFSCREEN_START":
      start();
      break;
    case "OFFSCREEN_STOP":
      stop();
      break;
  }
});

console.log('[OFFSCREEN] 👂 Message listener registered');
console.log('[OFFSCREEN] Ready and waiting for commands...');
