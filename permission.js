const requestBtn = document.getElementById('requestBtn');
const closeBtn = document.getElementById('closeBtn');
const statusEl = document.getElementById('status');
const video = document.getElementById('video');

let stream = null;

function showStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = type;
  statusEl.style.display = 'block';
}

async function requestPermission() {
  requestBtn.disabled = true;
  showStatus('正在请求摄像头权限...', 'info');
  
  try {
    console.log('Requesting camera permission...');
    
    // 请求摄像头权限
    stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });
    
    console.log('Camera permission granted!');
    console.log('Camera:', stream.getVideoTracks()[0].label);
    
    // 显示视频流以保持权限活跃
    video.srcObject = stream;
    video.style.display = 'block';
    video.style.maxWidth = '100%';
    video.style.borderRadius = '6px';
    video.style.marginTop = '20px';
    
    showStatus('✅ 摄像头权限已授予！现在可以关闭此页面了。', 'success');
    
    requestBtn.style.display = 'none';
    closeBtn.style.display = 'inline-block';
    
    // 通知 background script 权限已获得
    try {
      chrome.runtime.sendMessage({ 
        type: 'PERMISSION_GRANTED',
        camera: stream.getVideoTracks()[0].label
      });
    } catch (e) {
      console.warn('Failed to notify background:', e);
    }
    
  } catch (error) {
    console.error('Failed to get camera permission:', error);
    
    let errorMessage = '';
    
    switch (error.name) {
      case 'NotAllowedError':
        errorMessage = '❌ 摄像头权限被拒绝。\n\n请点击地址栏左侧的摄像头图标 🎥，然后选择"始终允许"，最后刷新此页面重试。';
        break;
      case 'NotFoundError':
        errorMessage = '❌ 未找到摄像头设备。\n\n请确保：\n• 摄像头已连接\n• 摄像头驱动已安装\n• 没有被其他应用占用';
        break;
      case 'NotReadableError':
        errorMessage = '❌ 无法读取摄像头。\n\n摄像头可能正被其他应用使用，请关闭其他使用摄像头的应用后重试。';
        break;
      case 'OverconstrainedError':
        errorMessage = '❌ 摄像头配置错误。\n\n您的摄像头不支持请求的配置。';
        break;
      case 'SecurityError':
        errorMessage = '❌ 安全错误。\n\n页面必须通过 HTTPS 或 localhost 访问。';
        break;
      default:
        errorMessage = `❌ 未知错误: ${error.message}`;
    }
    
    showStatus(errorMessage, 'error');
    requestBtn.disabled = false;
  }
}

closeBtn.addEventListener('click', () => {
  // 停止视频流
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  window.close();
});

requestBtn.addEventListener('click', requestPermission);

// 检查是否已有权限
async function checkExistingPermission() {
  try {
    const result = await navigator.permissions.query({ name: 'camera' });
    console.log('Current permission state:', result.state);
    
    if (result.state === 'granted') {
      showStatus('ℹ️ 摄像头权限已存在。点击按钮确认可以正常访问。', 'info');
    } else if (result.state === 'denied') {
      showStatus('⚠️ 摄像头权限已被拒绝。请点击地址栏的摄像头图标修改权限设置。', 'error');
    }
  } catch (e) {
    console.warn('Cannot query permission:', e);
  }
}

checkExistingPermission();