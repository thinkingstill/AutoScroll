(() => {
  const state = { 
    running: false, 
    paused: false, 
    lastDirection: null,
    lastLeftTime: 0,
    leftGestureCount: 0
  };

  console.log('[ASG Content] Script loaded on:', location.hostname);

  async function injectOverlayStyles() {
    const url = chrome.runtime.getURL("styles/overlay.css");
    try {
      const css = await (await fetch(url)).text();
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);
      console.log('[ASG Content] Overlay styles injected');
    } catch (e) {
      console.error('[ASG Content] Failed to inject styles:', e);
    }
  }

  function ensureOverlay() {
    if (document.getElementById("asg-overlay")) return;
    const el = document.createElement("div");
    el.id = "asg-overlay";
    el.innerHTML = `<span id="asg-dot"></span><span id="asg-text"></span>`;
    document.body.appendChild(el);
    console.log('[ASG Content] Overlay created');
    updateOverlay();
  }

  function updateOverlay() {
    const dot = document.getElementById("asg-dot");
    const text = document.getElementById("asg-text");
    if (!dot || !text) return;
    dot.className = state.running ? (state.paused ? "paused" : "running") : "stopped";
    text.textContent = state.running ? (state.paused ? "已暂停" : (state.lastDirection ? `方向: ${state.lastDirection}` : "识别中")) : "未运行";
  }

  function dispatchArrowKey(key) {
    const target = document.activeElement || document.body;
    
    // 构造更完整的键盘事件参数
    const keyCode = {
      'ArrowUp': 38,
      'ArrowDown': 40,
      'ArrowLeft': 37,
      'ArrowRight': 39
    }[key] || 0;
    
    const eventInit = {
      key: key,
      code: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    };
    
    const down = new KeyboardEvent("keydown", eventInit);
    const up = new KeyboardEvent("keyup", eventInit);
    
    // 同时向多个目标发送事件
    target.dispatchEvent(down);
    document.dispatchEvent(down);
    window.dispatchEvent(down);
    
    setTimeout(() => {
      target.dispatchEvent(up);
      document.dispatchEvent(up);
      window.dispatchEvent(up);
    }, 50);
    
    console.log('[ASG Content] Arrow key dispatched:', key, 'keyCode:', keyCode, 'to', target.tagName);
  }

  function smoothScroll(deltaY) {
    try {
      window.scrollBy({ top: deltaY, behavior: "smooth" });
      console.log('[ASG Content] Scroll:', deltaY);
    } catch (_) {
      window.scrollBy(0, deltaY);
    }
  }

  function clickIfExists(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        console.log('[ASG Content] Clicking element:', sel);
        el.click();
        return true;
      }
    }
    return false;
  }

  function trySiteSpecific(direction) {
    const host = location.hostname;
    console.log('[ASG Content] Trying site-specific action for:', host, direction);
    
    // Instagram story/gallery next/prev buttons
    if (host.includes("instagram.com")) {
      if (direction === "left") {
        if (clickIfExists([
          'button[aria-label="Go back"]',
          'button[aria-label*="Previous"]',
          'div[role="button"][aria-label*="Back"]'
        ])) return true;
      } else if (direction === "right") {
        if (clickIfExists([
          'button[aria-label="Go to next"]',
          'button[aria-label*="Next"]',
          'div[role="button"][aria-label*="Next"]'
        ])) return true;
      }
    }

    // Douyin / Kuaishou: try to trigger next/prev by clicking common arrows if present
    if (host.includes("douyin.com") || host.includes("kuaishou.com")) {
      if (direction === "left") {
        if (clickIfExists(['button[aria-label*="上一"]', 'button.prev', '.prev-btn'])) return true;
      } else if (direction === "right") {
        if (clickIfExists(['button[aria-label*="下一"]', 'button.next', '.next-btn'])) return true;
      }
    }
    return false;
  }

  function clickPageCenter() {
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    const target = document.elementFromPoint(x, y) || document.body;
    
    console.log('[ASG Content] Clicking center:', x, y, 'target:', target.tagName);
    
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    });
    target.dispatchEvent(clickEvent);
  }

  function dispatchEscKey() {
    const target = document.activeElement || document.body;
    
    const eventInit = {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    };
    
    const down = new KeyboardEvent("keydown", eventInit);
    const up = new KeyboardEvent("keyup", eventInit);
    
    target.dispatchEvent(down);
    document.dispatchEvent(down);
    window.dispatchEvent(down);
    
    setTimeout(() => {
      target.dispatchEvent(up);
      document.dispatchEvent(up);
      window.dispatchEvent(up);
    }, 50);
    
    console.log('[ASG Content] Escape key dispatched to', target.tagName);
  }

  function handleDirection(direction) {
    console.log('[ASG Content] 🎯 Handling direction:', direction);
    state.lastDirection = direction;
    updateOverlay();
    
    switch (direction) {
      case "up":
        console.log('[ASG Content] UP: Arrow + Scroll');
        dispatchArrowKey("ArrowUp");
        smoothScroll(-Math.round(window.innerHeight * 0.75));
        break;
      case "down":
        console.log('[ASG Content] DOWN: Arrow + Scroll');
        dispatchArrowKey("ArrowDown");
        smoothScroll(Math.round(window.innerHeight * 0.75));
        break;
      case "left":
        const now = Date.now();
        // 如果距离上次向左手势超过2秒，重置计数
        if (now - state.lastLeftTime > 2000) {
          state.leftGestureCount = 0;
        }
        
        state.leftGestureCount++;
        state.lastLeftTime = now;
        
        console.log('[ASG Content] LEFT gesture count:', state.leftGestureCount);
        
        if (state.leftGestureCount >= 2) {
          console.log('[ASG Content] LEFT x2: Browser back');
          window.history.back();
          state.leftGestureCount = 0; // 重置计数
        } else {
          console.log('[ASG Content] LEFT: Need one more (1/2)');
        }
        break;
      case "right":
        console.log('[ASG Content] RIGHT: Site-specific or Arrow');
        if (!trySiteSpecific("right")) dispatchArrowKey("ArrowRight");
        break;
    }
  }

  function handleClick() {
    console.log('[ASG Content] 🖱️ Handling click gesture');
    clickPageCenter();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    console.log('[ASG Content] Message received:', msg);
    
    switch (msg.type) {
      case "GESTURE_STATUS":
        state.running = !!msg.running;
        state.paused = !!msg.paused;
        console.log('[ASG Content] Status updated - running:', state.running, 'paused:', state.paused);
        ensureOverlay();
        updateOverlay();
        break;
      case "GESTURE_DIRECTION":
        if (!state.running || state.paused) {
          console.log('[ASG Content] Direction ignored - not running or paused');
          return;
        }
        ensureOverlay();
        handleDirection(msg.direction);
        break;
      case "GESTURE_CLICK":
        if (!state.running || state.paused) {
          console.log('[ASG Content] Click ignored - not running or paused');
          return;
        }
        ensureOverlay();
        handleClick();
        break;
    }
  });

  // Boot overlay styles
  console.log('[ASG Content] Initializing...');
  injectOverlayStyles().then(() => {
    ensureOverlay();
    console.log('[ASG Content] Initialization complete');
  });
})();
