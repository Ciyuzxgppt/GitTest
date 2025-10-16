import { ref, onMounted, onUnmounted, watch } from 'vue';
import { RealtimeDroneManager } from './../utils/realTimeTrack';

/**
 * 无人机实时数据Hook
 * 职责：集中处理模拟数据生成、定时推送，维护响应式状态
 * 所有业务层逻辑（模拟/真实接口）都在这里，不侵入实体/管理类
 * @param {Object} options 配置参数
 * @param {number} [options.initialCount=3] 初始无人机数量
 * @param {number} [options.mockInterval=1000] 模拟数据更新间隔（ms）
 * @param {number} [options.maxTrackPoints=100] 单无人机最大轨迹点数量
 * @returns {Object} 响应式状态与操作方法
 */
export function useRealtimeDrones(options = {}) {
  // 1. 解析配置参数（默认值+外部传入）
  const {
    initialCount = 3,
    mockInterval = 1000,
    maxTrackPoints = 100
  } = options;

  // 2. 初始化核心实例与响应式状态
  const droneManager = new RealtimeDroneManager();
  const drones = ref([]); // 响应式无人机列表（供组件使用）
  const isMockRunning = ref(false); // 模拟数据运行状态
  const mockTimer = ref(null); // 模拟数据定时器

  // 3. 模拟数据生成：仅在Hook层实现，不侵入其他文件
  /**
   * 生成初始位置（北京周边随机）
   * @returns {Object} 初始位置数据
   */
  const _generateInitialPos = () => {
    // 北京中心点：39.9042° N, 116.4074° E，偏移±0.1°（约±11公里）
    return {
      lat: 39.9042 + (Math.random() - 0.5) * 0.1,
      lng: 116.4074 + (Math.random() - 0.5) * 0.1,
      alt: 100 + Math.random() * 50, // 高度100-150米
      speed: 5 + Math.random() * 15 // 速度5-20米/秒
    };
  };

  /**
   * 基于当前位置生成移动后的模拟位置（小范围偏移）
   * @param {Object} currentPos 当前位置数据
   * @returns {Object} 移动后的模拟位置
   */
  const _generateMovePos = (currentPos) => {
    // 小范围偏移：±0.0002°（约±20米），模拟真实飞行
    return {
      lat: currentPos.lat + (Math.random() - 0.5) * 0.0004,
      lng: currentPos.lng + (Math.random() - 0.5) * 0.0004,
      alt: currentPos.alt + (Math.random() - 0.5) * 5, // 高度±5米波动
      speed: currentPos.speed + (Math.random() - 0.5) * 2 // 速度±2米/秒波动
    };
  };

  // 4. 模拟数据推送逻辑
  /**
   * 启动模拟数据推送
   */
  const startMock = () => {
    if (isMockRunning.value) return;

    // 初始化指定数量的无人机
    for (let i = 1; i <= initialCount; i++) {
      const droneId = `drone-${i}-${Date.now().toString().slice(-4)}`;
      const initialPos = _generateInitialPos();
      droneManager.createOrUpdateDrone(droneId, initialPos, maxTrackPoints);
    }

    // 定时更新模拟位置
    mockTimer.value = setInterval(() => {
      const allDrones = droneManager.getAllDrones();
      allDrones.forEach(drone => {
        const currentPos = drone.getCurrentPosition();
        const movePos = _generateMovePos(currentPos);
        droneManager.updateDronePosition(drone.getId(), movePos);
      });
    }, mockInterval);

    isMockRunning.value = true;
  };

  /**
   * 停止模拟数据推送
   */
  const stopMock = () => {
    if (!isMockRunning.value) return;

    clearInterval(mockTimer.value);
    mockTimer.value = null;
    isMockRunning.value = false;
  };

  // 5. 订阅管理类的数据更新，同步到响应式状态
  const unsubscribe = droneManager.subscribeToUpdates((updatedDrones) => {
    drones.value = updatedDrones;
  });

  // 6. 组件生命周期管理
  onMounted(() => {
    startMock(); // 组件挂载时启动模拟
  });

  onUnmounted(() => {
    stopMock(); // 组件卸载时停止模拟
    unsubscribe(); // 取消数据订阅
    droneManager.clearAllDrones(); // 清空所有无人机
  });

  // 7. 监听初始数量变化，重新初始化（可选功能）
  watch(
    () => initialCount,
    (newCount) => {
      stopMock();
      droneManager.clearAllDrones();
      startMock();
    },
    { immediate: false }
  );

  // 8. 暴露给组件的操作方法与响应式状态
  return {
    drones, // 响应式无人机列表（含位置、轨迹）
    isMockRunning, // 模拟数据运行状态
    // 操作方法
    addDrone: (id, initialPos) => {
      return droneManager.createOrUpdateDrone(id, initialPos, maxTrackPoints);
    },
    removeDrone: (id) => droneManager.removeDrone(id),
    clearAllDrones: () => {
      stopMock();
      droneManager.clearAllDrones();
      startMock();
    },
    startMock,
    stopMock
  };
}