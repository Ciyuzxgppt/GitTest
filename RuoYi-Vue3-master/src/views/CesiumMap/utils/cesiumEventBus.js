// src/utils/cesiumEventBus.js
class CesiumEventBus {
  constructor() {
    this.eventMap = new Map(); // 存储事件回调
    this.viewer = null; // 缓存 viewer 实例
    this.isReady = false; // 标记 viewer 是否就绪
    this.drawerTool = null; //绘制实例
  }

  // 监听事件
  on(eventName, callback) {
    if (!this.eventMap.has(eventName)) {
      this.eventMap.set(eventName, []);
    }
    this.eventMap.get(eventName).push(callback);
  }

  // 触发事件
  emit(eventName, ...args) {
    const callbacks = this.eventMap.get(eventName);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }

  // 移除事件监听
  off(eventName, callback) {
    const callbacks = this.eventMap.get(eventName);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 存储 viewer 实例并触发就绪事件
  setViewer(options) {
    if (options.viewer && !this.isReady) {
      this.viewer = options.viewer;
      this.isReady = true;
      const args = Object.values(options);
      this.emit('viewerReady', ...args); // 触发就绪事件
    }
  }

  // 获取 viewer 实例
  getViewer() {
    return this.viewer;
  }
}

// 导出单例实例（全局唯一）
const cesiumBus = new CesiumEventBus()
export default cesiumBus;