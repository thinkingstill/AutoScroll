const TARGET_URLS = [
  "https://douyin.com/*",
  "https://www.douyin.com/*",
  "https://www.kuaishou.com/*",
  "https://*.instagram.com/*",
  "https://*.tiktok.com/*",
  "https://*.youtube.com/*",
  "https://*.xiaohongshu.com/*",
];

let isRunning = false;
let offscreenCreated = false;
let isPaused = false;

console.log('[ASG Background] Service worker started');

async function getEligibleTabs() {
  const tabs = await chrome.tabs.query({ url: TARGET_URLS });
  console.log('[ASG Background] Eligible tabs:', tabs.length, tabs.map(t => t.url));
  return tabs;
}

async function broadcastToEligibleTabs(message) {
  const tabs = await getEligibleTabs();
  console.log('[ASG Background] Broadcasting to', tabs.length, 'tabs:', message);
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    } catch (_) {}
  }
}

async function ensureOffscreen() {
  if (offscreenCreated) {
    console.log('[ASG Background] Offscreen already created');
    return;
  }
  console.log('[ASG Background] Creating offscreen document...');
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons:["USER_MEDIA"],
    justification: "Run camera-based hand gesture recognition",
  });
  offscreenCreated = true;
  console.log('[ASG Background] Offscreen document created');
}

async function injectContentScriptToTab(tabId) {
  try {
    // 先测试是否已经注入
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    console.log('[ASG Background] Content script already loaded in tab', tabId);
  } catch (e) {
    // 未加载，需要注入
    try {
      console.log('[ASG Background] Injecting content script to tab', tabId);
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log('[ASG Background] ✅ Content script injected to tab', tabId);
      // 等待一下让content script初始化
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error('[ASG Background] ❌ Failed to inject content script:', err);
    }
  }
}

async function startRecognition() {
  if (isRunning) {
    console.log('[ASG Background] Already running');
    return;
  }
  console.log('[ASG Background] Starting recognition...');
  
  // 先注入content script到所有符合条件的标签页
  const tabs = await getEligibleTabs();
  console.log('[ASG Background] Injecting content scripts to', tabs.length, 'tabs');
  for (const tab of tabs) {
    await injectContentScriptToTab(tab.id);
  }
  
  await ensureOffscreen();
  isRunning = true;
  isPaused = false;
  
  // 等待一小段时间确保offscreen文档完全加载
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('[ASG Background] Sending OFFSCREEN_START');
  try {
    await chrome.runtime.sendMessage({ type: "OFFSCREEN_START" });
  } catch (e) {
    console.warn('[ASG Background] Error sending to offscreen:', e.message);
  }
  
  await broadcastToEligibleTabs({ type: "GESTURE_STATUS", running: true, paused: false });
  console.log('[ASG Background] Recognition started');
}

async function stopRecognition() {
  if (!isRunning) {
    console.log('[ASG Background] Already stopped');
    return;
  }
  console.log('[ASG Background] Stopping recognition...');
  
  try {
    await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" });
  } catch (e) {
    console.warn('[ASG Background] Error sending to offscreen:', e.message);
  }
  
  try {
    await chrome.offscreen.closeDocument();
    console.log('[ASG Background] Offscreen document closed');
  } catch (e) {
    console.warn('[ASG Background] Error closing offscreen:', e);
  }
  offscreenCreated = false;
  isRunning = false;
  isPaused = false;
  await broadcastToEligibleTabs({ type: "GESTURE_STATUS", running: false, paused: false });
  console.log('[ASG Background] Recognition stopped');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[ASG Background] Message received:', msg.type, 'from:', sender.url || 'extension');
  
  switch (msg.type) {
    case "REQUEST_START":
      startRecognition();
      break;
    case "REQUEST_STOP":
      stopRecognition();
      break;
    case "REQUEST_STATUS":
      const status = { running: isRunning, paused: isPaused };
      console.log('[ASG Background] Sending status:', status);
      sendResponse(status);
      break;
    case "GESTURE_DIRECTION":
      console.log('[ASG Background] 🎯 Gesture direction received:', msg.direction);
      // Relay direction to content scripts in eligible tabs
      if (isRunning && !isPaused) {
        console.log('[ASG Background] Relaying to content scripts');
        broadcastToEligibleTabs({ type: "GESTURE_DIRECTION", direction: msg.direction });
      } else {
        console.log('[ASG Background] Not relaying - running:', isRunning, 'paused:', isPaused);
      }
      break;
    case "GESTURE_CLICK":
      console.log('[ASG Background] 🖱️ Gesture click received');
      if (isRunning) {
        broadcastToEligibleTabs({ type: "GESTURE_CLICK" });
      }
      break;
    case "GESTURE_TOGGLE_PAUSE":
      isPaused = !!msg.paused;
      console.log('[ASG Background] Pause toggled:', isPaused);
      broadcastToEligibleTabs({ type: "GESTURE_STATUS", running: isRunning, paused: isPaused });
      break;
    case "PERMISSION_GRANTED":
      console.log('[ASG Background] Permission granted for camera:', msg.camera);
      break;
  }
});

// Optional: keep popup badge in sync
async function updateActionBadge() {
  const text = isRunning ? (isPaused ? "⏸" : "▶") : "■";
  await chrome.action.setBadgeText({ text });
}

setInterval(updateActionBadge, 1000);
console.log('[ASG Background] Badge update interval started');
