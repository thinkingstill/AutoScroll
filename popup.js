const toggleBtn = document.getElementById("toggle");
const pauseBtn = document.getElementById("pause");
const statusEl = document.getElementById("status");
const setupPermissionBtn = document.getElementById("setupPermission");
const permissionWarning = document.getElementById("permissionWarning");

let running = false;
let paused = false;

function render() {
  toggleBtn.textContent = running ? "停止识别" : "启动识别";
  pauseBtn.textContent = paused ? "恢复" : "暂停";
  pauseBtn.disabled = !running;
  statusEl.textContent = running ? (paused ? "已暂停" : "识别中") : "未运行";
}

async function refreshStatus() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "REQUEST_STATUS" });
    running = !!res?.running;
    paused = !!res?.paused;
    render();
  } catch (_) {
    render();
  }
}

// 检查摄像头权限
async function checkCameraPermission() {
  try {
    const result = await navigator.permissions.query({ name: 'camera' });
    console.log('Camera permission:', result.state);
    return result.state === 'granted';
  } catch (e) {
    console.warn('Cannot query camera permission:', e);
    // 如果无法查询权限状态，假设需要设置
    return false;
  }
}

// 打开权限设置页面
function openPermissionPage() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('permission.html')
  });
}

toggleBtn.addEventListener("click", async () => {
  if (!running) {
    // 检查权限
    const hasPermission = await checkCameraPermission();
    
    if (!hasPermission) {
      // 显示警告并提示设置权限
      permissionWarning.style.display = 'block';
      statusEl.textContent = "请先设置摄像头权限";
      return;
    }
    
    statusEl.textContent = "正在启动...";
    await chrome.runtime.sendMessage({ type: "REQUEST_START" });
  } else {
    await chrome.runtime.sendMessage({ type: "REQUEST_STOP" });
  }
  setTimeout(refreshStatus, 100);
});

pauseBtn.addEventListener("click", async () => {
  paused = !paused;
  await chrome.runtime.sendMessage({ type: "GESTURE_TOGGLE_PAUSE", paused });
  setTimeout(refreshStatus, 100);
});

setupPermissionBtn.addEventListener("click", () => {
  openPermissionPage();
});

// 初始化时检查权限
async function init() {
  const hasPermission = await checkCameraPermission();
  if (!hasPermission) {
    permissionWarning.style.display = 'block';
  }
  refreshStatus();
}

init();