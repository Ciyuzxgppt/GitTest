import { ref, computed, watchEffect } from 'vue';
import DroneManager from './../utils/droneTrajectory';

export function useDroneTrajectories(viewer) {
  // 初始化管理器（非响应式）
  const droneManager = new DroneManager(viewer);

  // 仅UI需要的响应式状态
  const uiState = ref({
    drones: [], // 仅包含UI展示所需的无人机信息
    activeDroneId: null,
    currentTime: ''
  });

  // 同步无人机列表到UI
  const syncDronesToUI = () => {
    uiState.value.drones = droneManager.getAllDrones().map(drone => ({
      id: drone.id,
      name: drone.name,
      isPlaying: drone.isPlaying,
      speed: drone.speed,
      isFollowing: drone.isFollowing
    }));
    uiState.value.activeDroneId = droneManager.activeDroneId;
  };

  // 初始同步
  syncDronesToUI();

  // 监听管理器状态变化（通过重写方法实现）
  const originalCreate = droneManager.createDrone;
  droneManager.createDrone = (...args) => {
    const drone = originalCreate.apply(droneManager, args);
    // 监听单个无人机的状态变化
    drone.onStateChange = () => syncDronesToUI();
    syncDronesToUI();
    return drone;
  };

  const originalDestroy = droneManager.destroyDrone;
  droneManager.destroyDrone = (...args) => {
    originalDestroy.apply(droneManager, args);
    syncDronesToUI();
  };

  // 监听时钟变化，更新时间显示
  watchEffect(() => {
    const updateTime = () => {
      if (viewer.clock.currentTime) {
        uiState.value.currentTime = Cesium.JulianDate.toDate(
          viewer.clock.currentTime
        ).toLocaleString();
      }
      requestAnimationFrame(updateTime);
    };
    updateTime();
  });

  // 暴露给组件的方法
  return {
    // 响应式UI状态
    state: computed(() => uiState.value),

    // 操作方法
    createDrone: (options) => droneManager.createDrone(options),
    getActiveDrone: () => droneManager.getActiveDrone(),
    setActiveDrone: (id) => {
      droneManager.setActiveDrone(id);
      uiState.value.activeDroneId = id;
    },
    controlAll: (play) => droneManager.controlAll(play),
    setAllSpeed: (speed) => droneManager.setAllSpeed(speed),
    destroyDrone: (id) => droneManager.destroyDrone(id),
    destroyAll: () => {
      droneManager.destroyAll();
      syncDronesToUI();
    }
  };
}


export function useMockWebSocketDrones(viewer) {
  const realTimeManager = new DroneManager(viewer);
  const mockState = ref({
    isConnected: false,
    interval: null,
    updateFreq: 300
  });

  // 生成实时无人机（确保轨迹线实体正确初始化）
  const createRealTimeDrone = (initData = {}) => {
  // 1. 显式定义初始位置（优先使用传入的位置，否则用默认值）
  const defaultPosition = Cesium.Cartesian3.fromDegrees(113.3768, 23.107552, 1000);
  const initPosition = initData.position || defaultPosition;

  // 2. 创建无人机主体
  const drone = realTimeManager.createDrone({
    id: `real-time-drone-${Date.now()}`,
    name: `实时无人机-${realTimeManager.getAllDrones().length + 1}`,
    type: 'realTime',
    position: initPosition, // 确保位置被正确传入
    ...initData
  });

  // 3. 强制初始化轨迹线实体（关键：绑定到无人机位置）
  if (!drone.trailEntity) {
    drone.trailEntity = viewer.entities.add({
      polyline: {
        positions: [initPosition], // 初始就包含第一个位置点
        width: 3,
        material: Cesium.Color.RED.withAlpha(0.8),
        show: true
      }
    });
  } else {
    // 如果已有轨迹实体，确保初始位置正确
    drone.trailEntity.polyline.positions = [initPosition];
  }

  // 4. 初始化轨迹数组（必须包含初始位置，与轨迹线同步）
  drone.realTimeTrail = [initPosition.clone()]; // 用clone避免引用问题

  // 5. 确保无人机实体位置正确设置
  if (drone.entity) {
    drone.entity.position = new Cesium.ConstantPositionProperty(initPosition);
  } else {
    // 极端情况：如果实体未创建，手动创建无人机图标
    drone.entity = viewer.entities.add({
      position: new Cesium.ConstantPositionProperty(initPosition),
      billboard: {
        image: 'https://picsum.photos/id/1/30/30', // 确保图标可见
        show: true
      }
    });
  }

  return drone;
};


  // 正确的新位置计算逻辑（区分弧度和角度）
  const pushRealTimeData = () => {
    realTimeManager.getAllDrones().forEach(drone => {
      // 1. 获取当前位置（确保有效）
      let currentPos = drone.entity?.position?._value || drone.position;
      if (!currentPos || !currentPos.x) {
        currentPos = Cesium.Cartesian3.fromDegrees(113.3768, 39.9042, 150);
      }

      // 2. 转换为弧度单位的经纬度（Cartographic对象）
      const currentCartographic = Cesium.Cartographic.fromCartesian(currentPos);
      if (!currentCartographic) {
        console.error("无法将位置转换为经纬度");
        return;
      }

      // 3. 正确计算新位置：
      // 方式一：直接在弧度单位上微调（推荐，更高效）
      const newCartographic = new Cesium.Cartographic(
        currentCartographic.longitude + (Math.random() - 0.5) * 0.00001, // 弧度微调（≈0.0005度）
        currentCartographic.latitude + (Math.random() - 0.5) * 0.00001,
        currentCartographic.height + (Math.random() - 0.5) * 5
      );
      // 从弧度直接转换为Cartesian3
      const newPos = Cesium.Ellipsoid.WGS84.cartographicToCartesian(newCartographic);

      // // 方式二：先转为角度再微调（可读性高，但多一次转换）
      // const newLongitude = Cesium.Math.toDegrees(currentCartographic.longitude) + (Math.random() - 0.5) * 0.0005;
      // const newLatitude = Cesium.Math.toDegrees(currentCartographic.latitude) + (Math.random() - 0.5) * 0.0005;
      // const newHeight = currentCartographic.height + (Math.random() - 0.5) * 5;
      // const newPos = Cesium.Cartesian3.fromDegrees(newLongitude, newLatitude, newHeight);

      // 4. 更新位置和轨迹
      drone.entity.position = new Cesium.ConstantPositionProperty(newPos);
      drone.realTimeTrail.push(newPos.clone());
      if (drone.realTimeTrail.length > 100) drone.realTimeTrail.shift();
      drone.trailEntity.polyline.positions = drone.realTimeTrail;
    });
  };

  // 启动模拟时自动对准视角
  const start = (droneCount = 2) => {
    if (mockState.value.isConnected) return;

    // 创建无人机
    const drones = [];
    for (let i = 0; i < droneCount; i++) {
      const drone = createRealTimeDrone();
      drones.push(drone);
    }

    // 关键：启动后自动将视角聚焦到第一架无人机
    if (drones.length > 0) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          113.3768, 23.107552, 2000 // 无人机上方1000米
        ),
        duration: 2 // 2秒飞过去
      });
    }

    // 启动更新定时器
    mockState.value.interval = setInterval(pushRealTimeData, mockState.value.updateFreq);
    mockState.value.isConnected = true;
  };

  // 其他方法保持不变
  const stop = () => {
    if (mockState.value.interval) clearInterval(mockState.value.interval);
    mockState.value.isConnected = false;
  };

  onUnmounted(() => {
    stop();
    realTimeManager.destroyAll();
  });

  return {
    mockState,
    realTimeManager,
    createRealTimeDrone,
    start,
    stop,
    sendMockCommand: (command) => { },
    getDrones() {
      return Array.from(realTimeManager.drones.values());
    },
    isConnected() {
      return mockState.value.isConnected;
    }
  };
}
