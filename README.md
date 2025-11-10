# AutoScroll Gestures - 手势识别Chrome扩展

通过摄像头识别手势，模拟键盘方向键，用于控制抖音、快手、Instagram等视频网站。

## 🎯 功能

- **向上/向下手势** → 模拟 ArrowUp/ArrowDown 键 + 页面滚动
- **向左/向右手势** → 模拟 ArrowLeft/ArrowRight 键
- **握拳** → 暂停/恢复手势识别

## 📋 使用方法

1. **安装扩展**
   - 打开 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择本项目文件夹

2. **访问支持的网站**
   - 抖音：https://www.douyin.com/
   - 快手：https://www.kuaishou.com/
   - Instagram：https://www.instagram.com/

3. **启动手势识别**
   - 点击浏览器工具栏中的扩展图标
   - 点击"开始"按钮
   - 允许摄像头权限

4. **使用手势**
   - **张开手掌**：至少伸展3根手指（食指、中指、无名指、小指）
   - **手掌朝向摄像头**，手指朝上
   - **距离摄像头30-60cm**，光线充足
   - **慢慢移动**手掌进行上下左右操作
   - **握拳**可以暂停/恢复

## 🔍 调试

1. 按 F12 打开开发者工具
2. 切换到 Console（控制台）标签
3. 在右上角下拉菜单选择 **"offscreen"** 上下文
4. 查看手势识别日志

成功启动后会看到：
```
=== Gesture recognition started successfully ===
👋 Now show your hand to the camera with palm open
```

检测到手势时会看到：
```
✓ Hand detected via multiHandLandmarks
Palm open: true
🎯 Gesture detected: [方向]
```

## ⚙️ 技术栈

- **MediaPipe Hands** - Google的手部追踪库（从CDN加载）
- **Chrome Extension Manifest V3**
- **Offscreen Document** - 后台摄像头访问

## 📁 项目结构

```
AutoScroll/
├── manifest.json           # 扩展配置
├── background.js          # 后台服务
├── content.js             # 内容脚本
├── offscreen.html         # Offscreen文档
├── offscreen.js           # 手势识别逻辑
├── popup.html/js          # 扩展弹窗
├── permission.html/js     # 权限页面
├── styles/                # 样式文件
├── test.html              # 测试页面
└── standalone_test.html   # 独立测试页面
```

## 🧪 测试

### 独立测试页面
直接在浏览器中打开 `standalone_test.html`，可以独立测试手势识别功能，无需安装扩展。

### 扩展测试
1. 加载扩展
2. 访问支持的网站
3. 启动手势识别
4. 查看offscreen控制台日志

## 📝 配置参数

在 `offscreen.js` 中可调整：

- `cooldownMs: 700` - 手势触发冷却时间（毫秒）
- `bufferMs: 450` - 移动轨迹缓冲时间（毫秒）
- `thX: 0.08` - 水平移动阈值（8%）
- `thY: 0.08` - 垂直移动阈值（8%）
- `minDetectionConfidence: 0.5` - MediaPipe检测置信度
- `minTrackingConfidence: 0.5` - MediaPipe追踪置信度

## 🐛 故障排除

### 问题：扩展无法加载
- 确保manifest.json格式正确
- 检查Chrome版本是否支持Manifest V3

### 问题：无法访问摄像头
- 检查摄像头权限是否授予
- 确保摄像头未被其他应用占用
- 尝试重启浏览器

### 问题：检测不到手势
- 确保光线充足
- 手掌完全张开（至少3根手指伸展）
- 增大移动幅度
- 查看offscreen控制台是否有"Hand detected"日志

### 问题：手势响应延迟
- 正常冷却时间为700ms
- 确保网络连接正常（CDN加载MediaPipe）

## 📄 许可证

MIT License

## 🙏 致谢

- [MediaPipe](https://google.github.io/mediapipe/) - Google的机器学习框架
- Chrome Extension API
