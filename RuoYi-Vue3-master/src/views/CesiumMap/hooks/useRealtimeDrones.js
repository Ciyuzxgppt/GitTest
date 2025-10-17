
import { ref, onMounted, onUnmounted } from 'vue';
import { RealtimeDroneManager } from './../utils/realTimeTrack';

/**
 * 无人机Hook
 * 职责：接收viewer，初始化管理类，处理模拟数据
 * @param {Object} options 配置
 * @param {Cesium.Viewer} options.viewer Cesium实例（从上层传入）
 * @param {number} [options.initialCount=3] 初始无人机数量
 * @param {number} [options.mockInterval=1000] 模拟间隔
 */
export function useRealtimeDrones(options) {
  const {
    viewer, // 从上层传入的Cesium viewer
    initialCount = 3,
    mockInterval = 300,
    maxTrackPoints = 200
  } = options;

  // 初始化管理类（传递viewer）
  const droneManager = new RealtimeDroneManager(viewer);
  const drones = ref([]);
  const isMockRunning = ref(false);
  let mockTimer = null;

  /// 在useRealtimeDrones.js中，减小单次移动的偏移量
const _generateMockPosition = (currentPos = null) => {
  if (!currentPos) {
    // 初始位置（保持不变）
    return {
      lat: 39.9042,
      lng: 116.4074,
      alt: 100 + Math.random() * 50
    };
  }

  // 关键：减小单次移动的步长（从0.0004°降至0.0001°，约10米）
  const step = 0.00051; // 单次最大移动距离（经纬度方向）
  return {
    lat: currentPos.lat +  0.5 * step,
    lng: currentPos.lng +  0.5 * step,
    alt: currentPos.alt +  0.5 * 2 // 高度波动也减小
  };
};

  // 启动模拟（仅定时更新实时位置）
  const startMock = () => {
    // 初始化无人机
    for (let i = 1; i <= initialCount; i++) {
      droneManager.createOrUpdateDrone(`drone-${i}`, _generateMockPosition(), maxTrackPoints);
    }

    setDefaultPosition(viewer)

    // 定时更新实时点位
    mockTimer = setInterval(() => {
      droneManager.getAllDrones().forEach(drone => {
        const newPos = _generateMockPosition(drone.getCurrentPosition());
        droneManager.updateDronePosition(drone.getId(), newPos);
      });
    }, mockInterval);
  };

  // 停止模拟
  const stopMock = () => {
    clearInterval(mockTimer);
    isMockRunning.value = false;
  };

  // 订阅数据更新
  const unsubscribe = droneManager.subscribeToUpdates(updatedDrones => {
    drones.value = updatedDrones;
  });

  const setDefaultPosition = (viewer) => {
    // 指定经纬度和高度（单位：米）
    const longitude = 116.4074; // 经度
    const latitude = 39.9042; // 纬度
    const height = 4000; // 高度，可根据需要调整

    // 将经纬度转换为弧度
    const radiansLongitude = Cesium.Math.toRadians(longitude);
    const radiansLatitude = Cesium.Math.toRadians(latitude);

    // 创建笛卡尔坐标
    const cartesian = Cesium.Cartesian3.fromRadians(radiansLongitude, radiansLatitude, height);

    // 5. 飞行到目标山脉区域
    viewer.camera.flyTo({
      destination: cartesian, // 2000米高度
      // orientation: {
      //   heading: Cesium.Math.toRadians(90), // 朝向东（看尖峰侧面）
      //   pitch: Cesium.Math.toRadians(-30),  // 30度俯角（聚焦尖顶）
      //   roll: 0
      // },
      duration: 3
    });

  }
  onUnmounted(() => {
    stopMock();
    unsubscribe();
    droneManager.clearAllDrones();
  });

  // 暴露接口
  return {
    drones,
    isMockRunning,
    addDrone: (id, pos) => {
      if (droneManager.getDroneById(id)) {
        console.error(`无人机ID "${id}" 已存在，请更换ID`);
        return null;
      }
      return droneManager.createOrUpdateDrone(id, pos, maxTrackPoints);
    },
    removeDrone: (id) => droneManager.removeDrone(id),
    clearAllDrones: () => droneManager.clearAllDrones(),
    startMock,
    stopMock
  };
}