<template>
  <div class="drone-monitor">
    <el-button type="primary" @click="clickStart">开始</el-button>
    <el-button type="primary" @click="clickStop">停止</el-button>
  </div>
</template>

<script setup>
import { useRealtimeDrones } from './../../hooks/useRealtimeDrones';
import { ref } from 'vue';
import cesiumBus from '../../utils/cesiumEventBus'; // 事件总线

const droneSystem = ref(null);

// 生命周期
onMounted(() => {
  // 监听Cesium初始化完成事件
  if (cesiumBus.isReady) {
    init(cesiumBus.getViewer());
  } else {
    const handleReady = (viewer) => init(viewer);
    cesiumBus.on('viewerReady', handleReady);

    // 组件卸载时移除监听
    onUnmounted(() => {
      cesiumBus.off('viewerReady', handleReady);
    });
  }
});

// 初始化
const init = async (newViewer) => {
  // 初始化无人机系统
  droneSystem.value = useRealtimeDrones({
    viewer: newViewer,
    initialCount: 1,
    mockInterval: 1000,
    maxTrackPoints: 100,
  });
};

const clickStart = () => {
  console.log('start');
  droneSystem.value.startMock();
};
const clickStop = () => {
  console.log('stop');
  droneSystem.value.stopMock();
};
</script>

<style scoped>
.drone-monitor {
  margin-top: 20px;
}
</style>
