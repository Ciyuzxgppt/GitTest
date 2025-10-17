<template>
  <div>
    <!-- 历史轨迹控制界面 -->
    <div class="control-panel">
      <!-- <div class="header">
        <h3>无人机轨迹控制系统</h3>
        <button @click="handleAddDrone" class="add-btn">
          <i class="fa fa-plus"></i> 添加无人机
        </button>
      </div> -->

      <!-- 无人机选择 -->
      <!-- <div class="drone-selector" v-if="state.drones.length > 0">
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
      </div> -->

      <!-- 单无人机控制 -->
      <div class="single-controls" style="margin-top:20px;" v-if="state.activeDroneId">
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
      <!-- <div class="global-controls">
        <div class="btn-group">
          <button @click="handleControlAll" class="global-btn">
            <i :class="isAnyPlaying ? 'fa fa-pause' : 'fa fa-play'"></i>
            {{ isAnyPlaying ? "全部暂停" : "全部播放" }}
          </button>
          <button @click="handleDestroyAll" class="global-btn danger">
            <i class="fa fa-trash"></i> 清除全部
          </button>
        </div>
      </div> -->

      <!-- 状态信息 -->
      <div class="status-info">
        <p>当前时间：{{ state.currentTime }}</p>
        <p>无人机总数：{{ state.drones.length }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useDroneTrajectories } from "../../hooks/useDroneTrajectories";
import cesiumBus from "../../utils/cesiumEventBus"; // 事件总线

// const viewer = ref(null);
const droneSystem = ref(null);

// 从系统获取状态
const state = computed(() => {
  // console.log("droneSystem.444value", droneSystem.value);
  // if (droneSystem.value) {
  //   console.log("333333", droneSystem.value.state);
  // }
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
    // console.log("state.value", state.value);
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
  // console.log(droneSystem.value?.getActiveDrone());
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

// 初始化
const init = async (newViewer) => {
  // viewer.value = newViewer;
  // 初始化无人机系统
  droneSystem.value = useDroneTrajectories(newViewer);
  console.log("droneSystem.value", droneSystem.value);
  // 创建初始无人机
  handleAddDrone();
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

.control-panel {
  
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

.drone-monitor {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.status {
    margin: 10px 0;
    padding: 10px;
    background-color: #f5f5f5;
}

.connected {
    color: green;
    font-weight: bold;
}

.disconnected {
    color: red;
    font-weight: bold;
}

.controls {
    margin: 20px 0;
    display: flex;
    gap: 10px;
}

button {
    padding: 8px 16px;
    background-color: #42b983;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

button.danger {
    background-color: #e53e3e;
}

button.remove-btn {
    background-color: #f59e0b;
    margin-top: 10px;
}

.drone-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.drone-item {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 15px;
    background-color: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.position-info p {
    margin: 5px 0;
}
</style>
    