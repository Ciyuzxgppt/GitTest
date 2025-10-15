<template>
  <div class="drone-control">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading">
      <i class="fa fa-spinner fa-spin"></i> 初始化中...
    </div>

    <!-- 控制界面 -->
    <div v-else class="control-panel">
      <div class="header">
        <h3>无人机轨迹控制系统</h3>
        <button @click="handleAddDrone" class="add-btn">
          <i class="fa fa-plus"></i> 添加无人机
        </button>
      </div>

      <!-- 无人机选择 -->
      <div class="drone-selector" v-if="state.drones.length > 0">
        <label>选择无人机：</label>
        <select v-model="state.activeDroneId" @change="handleDroneChange">
          <option
            v-for="drone in state.drones"
            :key="drone.id"
            :value="drone.id"
          >
            {{ drone.name }} ({{ drone.isPlaying ? "运行中" : "已暂停" }})
          </option>
        </select>
      </div>

      <!-- 单无人机控制 -->
      <div class="single-controls" v-if="state.activeDroneId">
        <div class="btn-group">
          <button @click="handlePlayPause" class="control-btn">
            <i
              :class="activeDrone?.isPlaying ? 'fa fa-pause' : 'fa fa-play'"
            ></i>
            {{ activeDrone?.isPlaying ? "暂停" : "播放" }}
          </button>
          <button @click="handleReset" class="control-btn">
            <i class="fa fa-refresh"></i> 重置
          </button>
          <button @click="handleFocus" class="control-btn">
            <i class="fa fa-crosshairs"></i> 聚焦
          </button>
          <button @click="handleDestroy" class="control-btn danger">
            <i class="fa fa-trash"></i> 移除
          </button>
          <button @click="handleFollow" class="control-btn follow-btn">
            <i
              :class="
                activeDrone?.isFollowing ? 'fa fa-check' : 'fa fa-arrows-alt'
              "
            ></i>
            {{ activeDrone?.isFollowing ? "取消跟随" : "跟随" }}
          </button>
        </div>

        <div class="speed-control">
          <label>速度：{{ activeDrone?.speed.toFixed(1) }}x</label>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            :value="activeDrone?.speed"
            @input="handleSpeedChange"
          />
        </div>
      </div>

      <!-- 全局控制 -->
      <div class="global-controls">
        <div class="btn-group">
          <button @click="handleControlAll" class="global-btn">
            <i :class="isAnyPlaying ? 'fa fa-pause' : 'fa fa-play'"></i>
            {{ isAnyPlaying ? "全部暂停" : "全部播放" }}
          </button>
          <button @click="handleDestroyAll" class="global-btn danger">
            <i class="fa fa-trash"></i> 清除全部
          </button>
        </div>
      </div>

      <!-- 状态信息 -->
      <div class="status-info">
        <p>当前时间：{{ state.currentTime }}</p>
        <p>无人机总数：{{ state.drones.length }}</p>
      </div>

      <!-- 新增：实时模拟启停按钮 -->
      <button
        @click="toggleRealTimeSimulation"
        class="add-btn"
        :class="{ active: isSimulationActive }"
      >
        <i :class="isSimulationActive ? 'fa fa-stop' : 'fa fa-play'"></i>
        {{ isSimulationActive ? "停止实时模拟" : "启动实时模拟" }}
      </button>

      <!-- 3. 实时无人机操作区 -->
      <div v-if="activeDrone?.type === 'realTime'" class="realtime-controls">
        <div class="action-buttons">
          <button @click="focusOnDrone" class="action-btn">
            <i class="fa fa-crosshairs"></i> 聚焦无人机
          </button>
          <button @click="clearTrail" class="action-btn danger">
            <i class="fa fa-trash"></i> 清除轨迹
          </button>
        </div>

        <!-- 实时状态信息 -->
        <div class="status-text">
          <p>实时模拟状态：{{ isSimulationActive ? "运行中" : "已停止" }}</p>
          <p>当前无人机：{{ activeDrone.name }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  useDroneTrajectories,
  useMockWebSocketDrones,
} from "./../../hooks/useDroneTrajectories";
import cesiumBus from "./../../utils/cesiumEventBus"; // 事件总线

// 状态管理
const isLoading = ref(false);
const viewer = ref(null);
const droneSystem = ref(null);
// 新增：实时模拟核心状态
const realTimeSystem = ref(null);
const realTimeDrones = ref([]);
const isSimulationActive = ref(false);

// 从系统获取状态
const state = computed(() => {
  console.log("droneSystem.444value", droneSystem.value);
  if (droneSystem.value) {
    console.log("333333", droneSystem.value.state);
  }
  return droneSystem.value
    ? droneSystem.value.state
    : {
        drones: [],
        activeDroneId: null,
        currentTime: "",
      };
});

// 当前活跃无人机
const activeDrone = computed(() => {
  return state.value.drones.find((d) => d.id === state.value.activeDroneId);
});

// 是否有任何无人机在运行
const isAnyPlaying = computed(() => {
  return state.value.drones.some((d) => d.isPlaying);
});

// 事件处理函数
const handleAddDrone = () => {
  if (droneSystem.value) {
    console.log("state.value", state.value);
    droneSystem.value.createDrone({
      name: `无人机${state.value.drones.length + 1}`,
    });
  }
};

const handleDroneChange = (e) => {
  if (droneSystem.value) {
    droneSystem.value.setActiveDrone(e.target.value);
  }
};

const handlePlayPause = () => {
  const drone = droneSystem.value?.getActiveDrone();
  console.log(droneSystem.value?.getActiveDrone());
  if (drone) {
    drone.togglePlay();
  }
};

const handleReset = () => {
  const drone = droneSystem.value?.getActiveDrone();
  if (drone) {
    drone.reset();
  }
};

const handleFocus = () => {
  const drone = droneSystem.value?.getActiveDrone();
  if (drone) {
    drone.focus();
  }
};

const handleDestroy = () => {
  if (droneSystem.value && state.value.activeDroneId) {
    droneSystem.value.destroyDrone(state.value.activeDroneId);
  }
};

const handleSpeedChange = (e) => {
  const newSpeed = parseFloat(e.target.value);
  if (droneSystem.value) {
    droneSystem.value.setAllSpeed(newSpeed);
  }
};

const handleControlAll = () => {
  if (droneSystem.value) {
    droneSystem.value.controlAll(!isAnyPlaying.value);
  }
};

const handleDestroyAll = () => {
  if (droneSystem.value) {
    droneSystem.value.destroyAll();
  }
};

// 新增：处理跟随按钮点击
const handleFollow = () => {
  const drone = droneSystem.value?.getActiveDrone();
  console.log(drone);
  if (drone) {
    drone.toggleFollow();
  }
};

// 新增：实时模拟控制方法
// 启动/停止实时模拟
const toggleRealTimeSimulation = () => {
  if (!realTimeSystem.value) return;

  if (isSimulationActive.value) {
    // 停止模拟
    realTimeSystem.value.stop();
    isSimulationActive.value = false;
  } else {
    // 启动模拟（创建2架实时无人机）
    realTimeSystem.value.start(1);
    isSimulationActive.value = true;
  }
};

// 聚焦实时无人机
const focusOnDrone = () => {
  if (activeDrone.value?.type === "realTime") {
    realTimeSystem.value.focus(activeDrone.value.id);
  }
};

// 清除实时轨迹
const clearTrail = () => {
  if (activeDrone.value?.type === "realTime") {
    realTimeSystem.value.clearTrail(activeDrone.value.id);
  }
};

// 初始化
const init = async (newViewer) => {
  try {
    viewer.value = newViewer;
    // 初始化无人机系统
    droneSystem.value = useDroneTrajectories(newViewer);
    console.log("droneSystem.value", droneSystem.value);
    // 创建初始无人机
    handleAddDrone();
    // 新增实时系统初始化
    realTimeSystem.value = useMockWebSocketDrones(newViewer);
    const updateInterval = setInterval(() => {
      if (realTimeSystem.value) {
        // 直接调用方法获取最新无人机列表
        realTimeDrones.value = realTimeSystem.value.getDrones();
        // 直接获取连接状态
        isSimulationActive.value = realTimeSystem.value.isConnected();
      }
    }, 500); // 每500ms更新一次

    // 组件卸载时清除定时器
    onUnmounted(() => clearInterval(updateInterval));
  } catch (error) {
    console.error("初始化失败:", error);
  } finally {
    isLoading.value = false;
  }
};

// 生命周期
onMounted(() => {
  // 监听Cesium初始化完成事件
  if (cesiumBus.isReady) {
    init(cesiumBus.getViewer());
  } else {
    const handleReady = (viewer) => init(viewer);
    cesiumBus.on("viewerReady", handleReady);

    // 组件卸载时移除监听
    onUnmounted(() => {
      cesiumBus.off("viewerReady", handleReady);
    });
  }
});

// 组件卸载时清理
onUnmounted(() => {
  if (droneSystem.value) {
    droneSystem.value.destroyAll();
  }
  if (realTimeSystem.value) {
    realTimeSystem.value.stop();
    realTimeSystem.value.destroyAll();
  }
});
</script>

<style scoped>
.drone-control {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  min-width: 400px;
}

.loading {
  background: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  text-align: center;
  color: #666;
}

.control-panel {
  background: rgba(255, 255, 255, 0.95);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.2);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.add-btn {
  background: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.drone-selector {
  margin-bottom: 15px;
}

.drone-selector label {
  display: block;
  margin-bottom: 5px;
  color: #555;
  font-size: 14px;
}

.drone-selector select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn-group {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
}

.control-btn {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: #4285f4;
  color: white;
}

.control-btn.danger {
  background: #ea4335;
}

.speed-control {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.speed-control label {
  display: block;
  margin-bottom: 5px;
  color: #555;
  font-size: 14px;
}

.speed-control input {
  width: 100%;
}

.global-controls {
  margin-bottom: 15px;
}

.global-btn {
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  background: #34a853;
  color: white;
}

.global-btn.danger {
  background: #ea4335;
}

.status-info {
  font-size: 14px;
  color: #666;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.status-info p {
  margin: 5px 0;
}
/* 新增：跟随按钮样式 */
.control-btn.follow-btn {
  background: #9c27b0;
}
</style>
    