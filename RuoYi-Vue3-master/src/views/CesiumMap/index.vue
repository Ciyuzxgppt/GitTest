<template>
  <div class="cesium-container">
    <!-- 地球容器 -->
    <div ref="cesiumContainer" class="map-view"></div>
    <!-- 右键菜单 -->
   <CesiumContextMenu />
  </div>
</template>

<script setup>
import { onMounted, ref, shallowRef, onUnmounted } from 'vue'
import CesiumContextMenu from './components/CesiumContextMenu/index.vue'
import {createCesiumInstance,setDefaultView,setDefaultPosition,addAirportMarker} from './utils/initCesium'
import cesiumBus from './utils/cesiumEventBus';

// 地球实例引用
const cesiumContainer = shallowRef(null)
let viewer=null

onMounted(async() => {
  viewer= await createCesiumInstance(cesiumContainer.value)
  cesiumBus.setViewer(viewer)
  // setDefaultView(viewer)
  addAirportMarker(viewer)
  setDefaultPosition(viewer)
})

// 组件卸载时销毁地球实例
onUnmounted(() => {
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})
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
