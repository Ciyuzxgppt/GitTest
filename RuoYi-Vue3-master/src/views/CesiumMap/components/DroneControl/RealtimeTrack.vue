<template>
    <div class="drone-monitor">
        <h2>无人机实时监控</h2>
        <div class="status">
            连接状态: 
            <span :class="isConnected ? 'connected' : 'disconnected'">
                {{ isConnected ? '已连接' : '未连接' }}
            </span>
            <!-- 新增：显示数据更新时间 -->
            <span class="update-time" v-if="isConnected">
                最后更新: {{ formatTime(lastUpdateTime) }}
            </span>
        </div>
        
        <div class="controls">
            <button @click="addNewDrone" :disabled="!isConnected">添加新无人机</button>
            <button @click="clearAllDrones" class="danger" :disabled="!isConnected || drones.length === 0">清除所有无人机</button>
            <!-- 新增：重置所有轨迹按钮 -->
            <button @click="resetAllTracks" class="warning" :disabled="!isConnected || drones.length === 0">重置所有轨迹</button>
        </div>

        <!-- 新增：空状态/加载提示 -->
        <div class="empty-tip" v-if="!isConnected">
            <div class="loading"></div>
            <p>正在连接无人机系统...</p>
        </div>
        <div class="empty-tip" v-else-if="drones.length === 0">
            <p>暂无无人机数据，点击"添加新无人机"开始监控</p>
        </div>
        
        <div class="drone-list" v-else>
            <div v-for="drone in drones" :key="drone.getId()" class="drone-item">
                <h3>无人机 {{ drone.getId() }}</h3>
                <div class="position-info">
                    <p>当前位置: 纬度 {{ drone.getCurrentPosition().lat.toFixed(6) }}, 经度 {{ drone.getCurrentPosition().lng.toFixed(6) }}</p>
                    <p>高度: {{ (drone.getCurrentPosition().alt || 0).toFixed(1) }} 米</p>
                    <p>速度: {{ (drone.getCurrentPosition().speed || 0).toFixed(1) }} 米/秒</p>
                    <p>轨迹点数量: {{ drone.getTrackPoints().length }} / 50（上限）</p>
                    <!-- 新增：轨迹点时间范围 -->
                    <p>轨迹时间: {{ getTrackTimeRange(drone) }}</p>
                </div>

                <!-- 新增：简易轨迹可视化 -->
                <div class="track-visual">
                    <p class="track-title">近期轨迹（最近10个点）</p>
                    <div class="track-line">
                        <div 
                            v-for="(point, idx) in getRecentTrack(drone)" 
                            :key="idx"
                            class="track-point"
                            :style="{ 
                                left: `${idx * 10}%`, 
                                height: `${getTrackHeight(point.lat, drone)}%`,
                                backgroundColor: getPointColor(idx)
                            }"
                            :title="`${idx+1}号点: 纬度${point.lat.toFixed(6)}`"
                        ></div>
                    </div>
                </div>

                <div class="drone-actions">
                    <button @click="removeDrone(drone.getId())" class="remove-btn">移除</button>
                    <!-- 新增：单个无人机轨迹重置 -->
                    <button @click="resetSingleTrack(drone)" class="reset-btn">重置该无人机轨迹</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useRealtimeDrones } from './../../hooks/useRealtimeDrones';
import { ref, watch } from 'vue';
import cesiumBus from "../../utils/cesiumEventBus"; // 事件总线





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

// 初始化
const init = async (newViewer) => {
  // 初始化无人机系统
  droneSystem.value = useRealtimeDrones(3, 1000, 50);

};


// 使用组合式函数，初始3架无人机，每1秒更新一次
const { 
    drones, 
    isConnected, 
    addDrone, 
    removeDrone, 
    clearAllDrones 
} = useMockDrones(3, 1000, 50);

// 新增：响应式变量 - 最后更新时间
const lastUpdateTime = ref(Date.now());

// 监听无人机数据变化，更新最后更新时间
watch(drones, () => {
    if (drones.value.length > 0) {
        lastUpdateTime.value = Date.now();
    }
});

// 添加新无人机的方法（保持原有逻辑，补充参数校验）
const addNewDrone = () => {
    const id = `drone-${Date.now()}`;
    const baseLat = 39.9042 + (Math.random() - 0.5) * 0.1;
    const baseLng = 116.4074 + (Math.random() - 0.5) * 0.1;
    // 补充：确保经纬度在合理范围
    const validLat = Math.max(39.8, Math.min(40.0, baseLat));
    const validLng = Math.max(116.3, Math.min(116.5, baseLng));
    addDrone(id, validLat, validLng);
};

// 新增：格式化时间函数
const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// 新增：获取无人机轨迹时间范围
const getTrackTimeRange = (drone) => {
    const tracks = drone.getTrackPoints();
    if (tracks.length === 0) return '无数据';
    const firstTime = formatTime(tracks[0].timestamp);
    const lastTime = formatTime(tracks[tracks.length - 1].timestamp);
    return `${firstTime} - ${lastTime}`;
};

// 新增：获取最近10个轨迹点（避免可视化拥挤）
const getRecentTrack = (drone) => {
    const tracks = drone.getTrackPoints();
    return tracks.length > 10 ? tracks.slice(-10) : tracks;
};

// 新增：计算轨迹点高度（用于可视化）
const getTrackHeight = (lat, drone) => {
    const tracks = drone.getTrackPoints();
    const latList = tracks.map(p => p.lat);
    const minLat = Math.min(...latList);
    const maxLat = Math.max(...latList);
    // 避免除数为0，确保高度范围有效
    const range = maxLat - minLat || 0.001;
    // 转换为 10% - 90% 的高度区间（留边距）
    return ((lat - minLat) / range) * 80 + 10;
};

// 新增：轨迹点颜色（越新越亮）
const getPointColor = (idx) => {
    const alpha = 0.4 + (idx * 0.06); // 透明度递增
    return `rgba(66, 185, 131, ${alpha})`;
};

// 新增：重置所有无人机轨迹
const resetAllTracks = () => {
    drones.value.forEach(drone => drone.clearTrack());
};

// 新增：重置单个无人机轨迹
const resetSingleTrack = (drone) => {
    drone.clearTrack();
};
</script>

<style scoped>
.drone-monitor {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
}

.status {
    margin: 10px 0;
    padding: 10px;
    background-color: #f5f5f5;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 20px;
}

.update-time {
    color: #666;
    font-size: 14px;
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
    transition: background 0.2s;
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

button.danger {
    background-color: #e53e3e;
}

button.warning {
    background-color: #f59e0b;
}

button:hover:not(:disabled) {
    opacity: 0.9;
}

/* 新增：空状态样式 */
.empty-tip {
    padding: 40px;
    text-align: center;
    color: #666;
    background-color: #f9f9f9;
    border-radius: 4px;
    margin: 20px 0;
}

.loading {
    width: 40px;
    height: 40px;
    border: 4px solid #eee;
    border-top-color: #42b983;
    border-radius: 50%;
    margin: 0 auto 15px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
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
    font-size: 14px;
    color: #333;
}

/* 新增：轨迹可视化样式 */
.track-visual {
    margin: 15px 0;
}

.track-title {
    font-size: 14px;
    color: #666;
    margin-bottom: 8px;
}

.track-line {
    width: 100%;
    height: 80px;
    background-color: #f9f9f9;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
}

.track-point {
    position: absolute;
    bottom: 0;
    width: 6%;
    border-radius: 3px 3px 0 0;
    transition: height 0.3s;
}

.drone-actions {
    display: flex;
    gap: 10px;
    margin-top: 15px;
}

button.remove-btn {
    background-color: #f59e0b;
}

button.reset-btn {
    background-color: #666;
    padding: 6px 12px;
    font-size: 13px;
}
</style>