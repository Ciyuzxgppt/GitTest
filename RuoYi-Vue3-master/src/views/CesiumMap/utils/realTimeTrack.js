/**
 * 无人机实体类
 * 职责：维护单个无人机数据 + 处理Cesium可视化（依赖上层传入的viewer）
 */
export class RealtimeDrone {
  constructor(id, initialPosition, viewer, maxTrackPoints) {
    this.id = id;
    this.viewer = viewer;
    this.maxTrackPoints = maxTrackPoints;

    // 核心数据：只存实时位置和历史轨迹（无时间采样）
    this.currentPosition = this._formatPosition(initialPosition);
    this.trackPoints = [this.currentPosition]; // 初始轨迹含第一个点

    // 可视化相关：直接用静态坐标（无SampledPositionProperty）
    this.entityId = `drone-main-${this.id}`;
    this.trailEntityId = `drone-trail-${this.id}`;
    this.entity = null;
    this.trailEntity = null;

    // 初始化实体（直接绑定实时坐标）
    this._initCesiumEntities();
  }

  /**
   * 初始化Cesium实体（无时间轴关联）
   * @private
   */
  _initCesiumEntities() {
    // 1. 无人机实体（直接用当前坐标，不依赖时间）
    this.entity = this.viewer.entities.add({
      id: this.entityId,
      name: `无人机${this.id}`,
      // 直接绑定静态Cartesian3坐标（非动态采样）
      position: this._getCurrentCartesian(),
      // 方向：按轨迹方向（简化版，不依赖时间）
      orientation: this._getOrientation(),
      billboard: {
        image: 'https://picsum.photos/id/101/50/50',
        width: 25,
        height: 25,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY, // 避免被遮挡
      },
    });

    // 2. 轨迹线实体（实时更新历史点）
    this.trailEntity = this.viewer.entities.add({
      id: this.trailEntityId,
      polyline: {
        positions: new Cesium.CallbackProperty(() => this._getTrailCartesians(), false),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.RED,
        }),
      },
    });
  }

  /**
   * 更新实时位置（核心方法）
   * @param {Object} newPosition 新实时点位
   */
  updatePosition(newPosition) {
    // 1. 更新当前位置和轨迹
    this.currentPosition = this._formatPosition(newPosition);
    this.trackPoints.push(this.currentPosition);
    if (this.trackPoints.length > this.maxTrackPoints) {
      this.trackPoints.shift(); // 限制轨迹长度
    }

    // 2. 直接更新Cesium实体位置（无时间逻辑）
    this.entity.position = this._getCurrentCartesian();
    this.entity.orientation = this._getOrientation();
  }

  /**
   * 格式化位置数据（补全默认值）
   * @private
   */
  _formatPosition(position) {
    return {
      id: this.id,
      lat: position.lat,
      lng: position.lng,
      alt: position.alt ?? 100,
      timestamp: Date.now(), // 保留时间戳仅用于记录，不关联时间轴
    };
  }

  /**
   * 转换当前位置为Cesium坐标
   * @private
   */
  _getCurrentCartesian() {
    return Cesium.Cartesian3.fromDegrees(
      this.currentPosition.lng,
      this.currentPosition.lat,
      this.currentPosition.alt
    );
  }

  /**
   * 转换轨迹点为Cesium坐标数组
   * @private
   */
  _getTrailCartesians() {
    return this.trackPoints.map((point) =>
      Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.alt)
    );
  }

  /**
   * 简化版方向计算（按最新两个轨迹点的方向）
   * @private
   */
  _getOrientation() {
    if (this.trackPoints.length < 2) {
      // 轨迹点不足时，默认朝向北
      return Cesium.Transforms.headingPitchRollQuaternion(
        this._getCurrentCartesian(),
        new Cesium.HeadingPitchRoll(0, 0, 0)
      );
    }

    // 有历史轨迹时，计算最新两点的方向角（修复核心）
    const lastPoint = this.trackPoints[this.trackPoints.length - 2];
    const currentPoint = this.currentPosition;

    // 1. 计算经纬度差值（弧度）
    const deltaLng = Cesium.Math.toRadians(currentPoint.lng - lastPoint.lng);
    const deltaLat = Cesium.Math.toRadians(currentPoint.lat - lastPoint.lat);

    // 2. 用 Cesium 内置方法计算方位角（替代 atan2）
    // 公式：heading = arctan2(deltaLng * cos(lat), deltaLat)
    const currentLatRad = Cesium.Math.toRadians(currentPoint.lat);
    const headingRad = Math.atan2(
      deltaLng * Math.cos(currentLatRad), // 考虑纬度对经度差的影响
      deltaLat
    );

    // 3. 转换为角度（Cesium 方向角以弧度为单位，范围 [-π, π]）
    return Cesium.Transforms.headingPitchRollQuaternion(
      this._getCurrentCartesian(),
      new Cesium.HeadingPitchRoll(headingRad, 0, 0)
    );
  }

  // 销毁实体（清理资源）
  destroy() {
    this.viewer.entities.remove(this.entity);
    this.viewer.entities.remove(this.trailEntity);
    this.trackPoints = [];
  }

  // 公共方法（获取数据）
  getCurrentPosition() {
    return { ...this.currentPosition };
  }
  getTrackPoints() {
    return [...this.trackPoints];
  }
  getId() {
    return this.id;
  }
}

/**
 * 无人机管理类
 * 职责：仅管理无人机实体的创建、更新、删除，不处理可视化细节
 */
export class RealtimeDroneManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.drones = new Map(); // 管理无人机实例
    this.entityIds = new Set(); // 记录实体ID，防重复
    this.updateListeners = [];
  }

  // 创建/更新无人机（逻辑不变，仅传递实时位置）
  createOrUpdateDrone(id, position, maxTrackPoints = 100) {
    if (this.drones.has(id)) {
      const drone = this.drones.get(id);
      drone.updatePosition(position);
      this._notifyListeners();
      return drone;
    }

    // 检查ID重复（仅管理自身创建的实体）
    const mainEntityId = `drone-main-${id}`;
    const trailEntityId = `drone-trail-${id}`;
    if (this.entityIds.has(mainEntityId)) {
      throw new Error(`无人机ID "${id}" 已存在`);
    }

    // 创建新无人机（仅传递实时位置，无时间采样）
    const drone = new RealtimeDrone(id, position, this.viewer, maxTrackPoints);
    this.drones.set(id, drone);
    this.entityIds.add(mainEntityId);
    this.entityIds.add(trailEntityId);

    this._notifyListeners();
    return drone;
  }

  /**
   * 其他管理方法（仅处理实例协调，不涉及可视化）
   */
  updateDronePosition(id, position) {
    const drone = this.drones.get(id);
    if (!drone) return false;
    drone.updatePosition(position);
    this._notifyListeners();
    return true;
  }

  getAllDrones() {
    return Array.from(this.drones.values());
  }

  getDroneById(id) {
    return this.drones.get(id) || null;
  }

  /**
   * 删除无人机（同步清理注册表）
   * @param {string} id 无人机ID
   * @returns {boolean} 是否删除成功
   */
  removeDrone(id) {
    if (!this.drones.has(id)) return false;

    // 1. 销毁实体
    const drone = this.drones.get(id);
    drone.destroy();

    // 2. 清理注册表
    const entityId = `drone-entity-${id}`;
    const trailEntityId = `drone-trail-${id}`;
    this.entityIds.delete(entityId);
    this.entityIds.delete(trailEntityId);

    // 3. 清理实例Map
    this.drones.delete(id);

    this._notifyListeners();
    return true;
  }

  /**
   * 清空所有无人机（同步清理注册表）
   */
  clearAllDrones() {
    // 1. 销毁所有实体
    this.drones.forEach((drone) => drone.destroy());

    // 2. 清空注册表和实例Map
    this.drones.clear();
    this.entityIds.clear();

    this._notifyListeners();
  }

  // 数据更新订阅
  subscribeToUpdates(listener) {
    this.updateListeners.push(listener);
    return () => {
      this.updateListeners = this.updateListeners.filter((l) => l !== listener);
    };
  }

  _notifyListeners() {
    this.updateListeners.forEach((listener) => {
      try {
        listener(
          this.getAllDrones().map((drone) => ({
            id: drone.getId(),
            currentPosition: drone.getCurrentPosition(),
            trackPoints: drone.getTrackPoints(),
          }))
        );
      } catch (e) {
        console.error('Listener error:', e);
      }
    });
  }
}
