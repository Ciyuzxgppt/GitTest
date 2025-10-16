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
