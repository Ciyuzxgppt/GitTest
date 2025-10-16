/**
 * 无人机实体类
 * 职责：仅维护单个无人机的基础信息、当前位置和历史轨迹
 * 无任何模拟/业务逻辑，纯数据处理层
 */
export class RealtimeDrone {
  /**
   * 构造函数
   * @param {string} id 无人机唯一ID
   * @param {Object} initialPosition 初始位置数据
   * @param {number} initialPosition.lat 纬度（必填）
   * @param {number} initialPosition.lng 经度（必填）
   * @param {number} [initialPosition.alt=100] 高度（默认100米）
   * @param {number} [initialPosition.speed=5] 速度（默认5米/秒）
   * @param {number} [initialPosition.timestamp=Date.now()] 时间戳
   * @param {number} maxTrackPoints 最大轨迹点数量（超出自动删除最旧）
   */
  constructor(id, initialPosition, maxTrackPoints) {
    // 基础属性
    this.id = id;
    this.maxTrackPoints = maxTrackPoints;
    
    // 轨迹与位置数据初始化
    this.trackPoints = [];
    this.currentPosition = this._formatPosition(initialPosition);
    
    // 初始位置加入轨迹
    this.trackPoints.push(this.currentPosition);
  }

  /**
   * 更新无人机位置，同步维护轨迹
   * @param {Object} newPosition 新位置数据（含lat/lng）
   */
  updatePosition(newPosition) {
    const formattedPos = this._formatPosition(newPosition);
    this.currentPosition = formattedPos;
    this.trackPoints.push(formattedPos);
    
    // 超出轨迹上限时，删除最旧的点
    if (this.trackPoints.length > this.maxTrackPoints) {
      this.trackPoints.shift();
    }
  }

  /**
   * 获取当前位置（返回副本，避免外部直接修改内部数据）
   * @returns {Object} 格式化后的位置数据
   */
  getCurrentPosition() {
    return { ...this.currentPosition };
  }

  /**
   * 获取历史轨迹（返回副本，避免外部篡改）
   * @returns {Array<Object>} 轨迹点数组
   */
  getTrackPoints() {
    return [...this.trackPoints];
  }

  /**
   * 获取无人机ID
   * @returns {string} 无人机唯一ID
   */
  getId() {
    return this.id;
  }

  /**
   * 私有方法：格式化位置数据（统一格式+补全默认值）
   * @param {Object} position 原始位置数据
   * @returns {Object} 格式化后的位置数据
   */
  _formatPosition(position) {
    return {
      id: this.id,
      lat: position.lat, // 必传字段，不设默认（确保数据有效性）
      lng: position.lng, // 必传字段，不设默认
      alt: position.alt ?? 100,
      speed: position.speed ?? 5,
      timestamp: position.timestamp ?? Date.now()
    };
  }
}

/**
 * 无人机管理类
 * 职责：管理多个无人机实体的CRUD，提供数据更新订阅能力
 * 不包含模拟数据、WebSocket等业务逻辑，仅做实体协调
 */
export class RealtimeDroneManager {
  constructor() {
    // 存储无人机实体：key=无人机ID，value=RealtimeDrone实例
    this.drones = new Map();
    // 数据更新监听器（供外部订阅数据变化）
    this.updateListeners = [];
  }

  /**
   * 创建或更新无人机
   * @param {string} id 无人机ID
   * @param {Object} position 位置数据（含lat/lng）
   * @param {number} maxTrackPoints 最大轨迹点数量
   * @returns {RealtimeDrone} 无人机实体实例
   */
  createOrUpdateDrone(id, position, maxTrackPoints = 100) {
    let drone = this.drones.get(id);
    
    if (drone) {
      // 已存在：更新位置
      drone.updatePosition(position);
    } else {
      // 不存在：创建新实体
      drone = new RealtimeDrone(id, position, maxTrackPoints);
      this.drones.set(id, drone);
    }
    
    // 通知外部数据更新
    this._notifyListeners();
    return drone;
  }

  /**
   * 单独更新无人机位置
   * @param {string} id 无人机ID
   * @param {Object} position 新位置数据
   * @returns {boolean} 更新成功返回true，失败返回false
   */
  updateDronePosition(id, position) {
    const drone = this.drones.get(id);
    if (!drone) return false;
    
    drone.updatePosition(position);
    this._notifyListeners();
    return true;
  }

  /**
   * 获取所有无人机实体
   * @returns {Array<RealtimeDrone>} 无人机实例数组
   */
  getAllDrones() {
    return Array.from(this.drones.values());
  }

  /**
   * 根据ID获取单个无人机
   * @param {string} id 无人机ID
   * @returns {RealtimeDrone|null} 无人机实例（不存在则返回null）
   */
  getDroneById(id) {
    return this.drones.get(id) || null;
  }

  /**
   * 删除指定无人机
   * @param {string} id 无人机ID
   * @returns {boolean} 删除成功返回true，失败返回false
   */
  removeDrone(id) {
    const success = this.drones.delete(id);
    if (success) this._notifyListeners();
    return success;
  }

  /**
   * 清空所有无人机
   */
  clearAllDrones() {
    this.drones.clear();
    this._notifyListeners();
  }

  /**
   * 订阅数据更新（外部可监听无人机数据变化）
   * @param {Function} listener 数据更新回调函数
   * @returns {Function} 取消订阅的函数
   */
  subscribeToUpdates(listener) {
    this.updateListeners.push(listener);
    // 返回取消订阅方法
    return () => {
      this.updateListeners = this.updateListeners.filter(l => l !== listener);
    };
  }

  /**
   * 私有方法：通知所有订阅者数据更新
   */
  _notifyListeners() {
    this.updateListeners.forEach(listener => {
      try {
        listener(this.getAllDrones().map(drone => ({
          id: drone.getId(),
          currentPosition: drone.getCurrentPosition(),
          trackPoints: drone.getTrackPoints()
        })));
      } catch (error) {
        console.error('无人机数据更新回调执行失败:', error);
      }
    });
  }
}