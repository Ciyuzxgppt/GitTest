<template>
  <div class="cesium-container">
    <!-- 地球容器 -->
    <div ref="cesiumContainer" class="map-view"></div>
    <!-- 右键菜单 -->
    <CesiumContextMenu />
    <DroneControl />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, shallowRef } from 'vue';
import CesiumContextMenu from './components/CesiumContextMenu/index.vue';
import DroneControl from './components/DroneControl/index.vue';
import { useInitCesium } from './hooks/useInitCesium';
import cesiumBus from './utils/cesiumEventBus';
import './style/cesium.scss';
import CesiumDrawingTool from './utils/drawGraphics';

// 地球实例容器
const cesiumContainer = shallowRef(null);
// 地球实例引用
let viewer = null;
let drawerTool = null;
const { createCesium, destroyCesium } = useInitCesium();

onMounted(async () => {
  viewer = await createCesium(cesiumContainer.value);
  drawerTool = new CesiumDrawingTool(viewer);
  cesiumBus.setViewer({ viewer, drawerTool });
});

// 组件卸载时销毁地球实例
onUnmounted(() => {
  destroyCesium();
});
</script>

<style scoped>
.cesium-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.map-view {
  width: 100%;
  height: 100%;
}

.control-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  background-color: rgba(43, 43, 43, 0.8);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn:hover {
  background-color: rgba(43, 43, 43, 1);
}
</style>
