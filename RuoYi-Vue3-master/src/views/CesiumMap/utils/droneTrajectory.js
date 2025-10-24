/**
 * 无人机实体类 - 仅负责自身状态和行为
 */
class Drone {
  constructor(options) {
    // 必要参数验证
    if (!options.viewer) throw new Error('必须提供Cesium Viewer');
    if (!options.id) throw new Error('必须指定无人机ID');
    if (!options.manager) throw new Error('必须提供DroneManager实例');

    // 基础属性
    this.id = options.id;
    this.name = options.name || `无人机${options.id}`;
    this.viewer = options.viewer;
    this.manager = options.manager; // 存储管理器引用
    this.speed = options.speed || 1.0;
    this.color = options.color || Cesium.Color.fromRandom({ alpha: 1.0 });

    // 状态属性
    this.isPlaying = false;
    this.trailData = [];
    this.startTime = null;
    this.endTime = null;

    // Cesium实体
    this.entity = null;
    this.trailEntity = null;
    this.sampledPosition = null;

    // 事件回调
    this.onStateChange = null;

    // 跟随状态属性（仅记录跟踪状态）
    this.isFollowing = false;

    // 初始化
    this._initTrailData();
    this._createEntities();
    this._setupEventListeners();
  }

  // 生成轨迹数据
  _initTrailData() {
    const data = [];
    const startTime = Cesium.JulianDate.addSeconds(
      this.viewer.clock.startTime || Cesium.JulianDate.fromDate(new Date()),
      0,
      new Cesium.JulianDate()
    );

    // 生成示例轨迹（可替换为实际数据）
    for (let i = 0; i < 100; i++) {
      const time = Cesium.JulianDate.addSeconds(startTime, i * 10, new Cesium.JulianDate());
      const angle = (i / 10) * Math.PI;
      const radius = 500 + i * 5;
      const height = 100 + i * 5;

      // 基于北京附近坐标
      const position = Cesium.Cartesian3.fromDegrees(
        116.4074 + (radius * Math.cos(angle)) / 111319,
        39.9042 + (radius * Math.sin(angle)) / 111319,
        height
      );

      data.push({ time, position });
    }

    this.trailData = data;
    this.startTime = data[0].time;
    this.endTime = data[data.length - 1].time;
  }

  // 创建Cesium实体
  _createEntities() {
    // 位置采样属性
    this.sampledPosition = new Cesium.SampledPositionProperty();
    this.trailData.forEach((point) => {
      this.sampledPosition.addSample(point.time, point.position);
    });

    // 无人机实体
    this.entity = this.viewer.entities.add({
      id: `drone-${this.id}`,
      name: this.name,
      position: this.sampledPosition,
      orientation: new Cesium.VelocityOrientationProperty(this.sampledPosition),
      billboard: {
        image: 'https://picsum.photos/id/101/50/50',
        width: 25,
        height: 25,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      },
    });

    // 轨迹线
    this.trailEntity = this.viewer.entities.add({
      id: `drone-trail-${this.id}`,
      polyline: {
        positions: this.trailData.map((p) => p.position),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: this.color,
        }),
      },
    });
  }

  // 设置事件监听
  _setupEventListeners() {
    this._clockTickHandler = (clock) => {
      if (
        this.isPlaying &&
        Cesium.JulianDate.greaterThanOrEquals(clock.currentTime, this.endTime)
      ) {
        this.setPlayState(false);
      }
    };
    this.viewer.clock.onTick.addEventListener(this._clockTickHandler);
  }

  // 播放状态控制（修复核心）
  setPlayState(play) {
    this.isPlaying = play;

    // 同步Cesium时钟动画状态
    // 当任何无人机处于播放状态时，时钟推进
    const anyPlaying = this.manager.getAllDrones().some((drone) => drone.isPlaying);
    this.viewer.clock.shouldAnimate = anyPlaying;

    // 通知状态变化
    this.onStateChange &&
      this.onStateChange({
        id: this.id,
        isPlaying: play,
      });
  }

  // 切换播放状态
  togglePlay() {
    this.setPlayState(!this.isPlaying);
  }

  // 设置速度
  setSpeed(speed) {
    this.speed = speed;
    this.onStateChange &&
      this.onStateChange({
        id: this.id,
        speed,
      });
  }

  // 重置到起点
  reset() {
    this.setPlayState(false);
    this.viewer.clock.currentTime = this.startTime.clone();
  }

  // 聚焦到无人机
  focus() {
    this.viewer.trackedEntity = this.entity;
    this.viewer.zoomTo(this.entity, new Cesium.HeadingPitchRange(0, -0.5, 1000));
  }

  // 切换跟随状态
  toggleFollow() {
    if (this.isFollowing) {
      this.stopFollowing(); // 调用停止跟随
    } else {
      this.startFollowing(); // 调用开始跟随
    }
  }

  // 开始跟随（简化版）
  startFollowing() {
    // 避免重复开启跟随
    if (this.isFollowing || !this.entity || !this.viewer) return;

    // 直接设置跟踪实体，使用Cesium默认的跟踪视角
    this.viewer.trackedEntity = this.entity;

    // 标记跟随状态
    this.isFollowing = true;
    this.onStateChange &&
      this.onStateChange({
        id: this.id,
        isFollowing: this.isFollowing,
      });
  }

  // 停止跟随（简化版）
  stopFollowing() {
    // 避免重复停止跟随
    if (!this.isFollowing || !this.viewer) return;

    // 取消跟踪（Cesium会保持当前相机视角）
    this.viewer.trackedEntity = undefined;

    // 清除跟随状态
    this.isFollowing = false;
    this.onStateChange &&
      this.onStateChange({
        id: this.id,
        isFollowing: this.isFollowing,
      });
  }

  // 销毁自身
  destroy() {
    // 停止相机跟随
    this.stopFollowing();
    // 移除事件监听
    this.viewer.clock.onTick.removeEventListener(this._clockTickHandler);

    // 移除实体
    this.viewer.entities.remove(this.entity);
    this.viewer.entities.remove(this.trailEntity);

    // 清理引用
    this.entity = null;
    this.trailEntity = null;
    this.onStateChange = null;
  }
}

/**
 * 无人机管理类 - 仅负责全局管理和协调
 */
export default class DroneManager {
  constructor(viewer) {
    if (!viewer) throw new Error('必须提供Cesium Viewer实例');

    // 核心属性
    this.viewer = viewer;
    this.drones = new Map(); // 存储所有无人机：key=id，value=Drone实例
    this.activeDroneId = null;

    // 初始化时钟
    this.viewer.clock.multiplier = 1.0;
    this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  }

  // 创建无人机
  createDrone(options = {}) {
    const droneId = options.id || Date.now();

    // 避免ID重复
    if (this.drones.has(droneId)) {
      throw new Error(`无人机ID ${droneId} 已存在`);
    }

    // 创建无人机实例
    const drone = new Drone({
      ...options,
      id: droneId,
      viewer: this.viewer,
      manager: this, // 直接将管理器传递给无人机
    });

    // 存储实例
    this.drones.set(droneId, drone);

    // 设置状态变化回调
    drone.onStateChange = (state) => this._onDroneStateChange(state);

    // 首次创建时设为活跃
    if (this.drones.size === 1) {
      this.activeDroneId = droneId;
    }

    // 更新时间轴
    this.updateTimelineRange();

    return drone;
  }

  // 获取所有无人机
  getAllDrones() {
    return Array.from(this.drones.values());
  }

  // 获取活跃无人机
  getActiveDrone() {
    return this.activeDroneId ? this.drones.get(this.activeDroneId) : null;
  }

  // 设置活跃无人机
  setActiveDrone(id) {
    if (this.drones.has(id)) {
      this.activeDroneId = id;
    }
  }

  // 全局控制所有无人机
  controlAll(play) {
    this.getAllDrones().forEach((drone) => drone.setPlayState(play));
    this.viewer.clock.shouldAnimate = play;
  }

  // 全局设置速度
  setAllSpeed(speed) {
    this.getAllDrones().forEach((drone) => drone.setSpeed(speed));
    this.viewer.clock.multiplier = speed;
  }

  // 更新时间轴范围
  updateTimelineRange() {
    const drones = this.getAllDrones();
    if (drones.length === 0) return;

    let earliestStart = drones[0].startTime;
    let latestEnd = drones[0].endTime;

    drones.forEach((drone) => {
      if (Cesium.JulianDate.lessThan(drone.startTime, earliestStart)) {
        earliestStart = drone.startTime;
      }
      if (Cesium.JulianDate.greaterThan(drone.endTime, latestEnd)) {
        latestEnd = drone.endTime;
      }
    });

    // 更新时钟和时间轴
    this.viewer.clock.startTime = earliestStart.clone();
    this.viewer.clock.endTime = latestEnd.clone();
    this.viewer.clock.currentTime = earliestStart.clone();
    this.viewer.timeline.zoomTo(earliestStart, latestEnd);
  }

  // 销毁指定无人机
  destroyDrone(id) {
    const drone = this.drones.get(id);
    if (drone) {
      drone.destroy();
      this.drones.delete(id);

      // 处理活跃无人机被销毁的情况
      if (this.activeDroneId === id) {
        this.activeDroneId = this.drones.size > 0 ? this.drones.keys().next().value : null;
      }

      this.updateTimelineRange();
    }
  }

  // 销毁所有无人机
  destroyAll() {
    this.getAllDrones().forEach((drone) => drone.destroy());
    this.drones.clear();
    this.activeDroneId = null;
  }

  // 无人机状态变化时的处理
  _onDroneStateChange(state) {
    // 可在这里处理跨无人机的状态协调
    // 例如：当任何无人机播放时，自动同步全局时钟状态
  }
}
