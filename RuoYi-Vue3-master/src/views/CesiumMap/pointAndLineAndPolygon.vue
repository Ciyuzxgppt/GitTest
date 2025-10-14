<template>
  <div class="cesium-container">
    <!-- Cesium容器 -->
    <div id="cesiumContainer" ref="cesiumContainer"></div>
    
    <!-- 控制面板 -->
    <div class="control-panel">
      <h3>Cesium 点线面绘制</h3>
      <div class="button-group">
        <button @click="drawType = 'point'" :class="{ active: drawType === 'point' }">
          绘制点
        </button>
        <button @click="drawType = 'line'" :class="{ active: drawType === 'line' }">
          绘制线
        </button>
        <button @click="drawType = 'polygon'" :class="{ active: drawType === 'polygon' }">
          绘制面
        </button>
        <button @click="clearAll">清除全部</button>
      </div>
      
      <!-- 坐标信息显示 -->
      <div class="coordinate-info" v-if="currentCoord">
        当前坐标: {{ currentCoord.lon.toFixed(6) }}, {{ currentCoord.lat.toFixed(6) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

// 组件状态
const cesiumContainer = ref(null);
const viewer = ref(null);
const drawType = ref(null);
const currentEntity = ref(null);
const positions = ref([]);
const entities = ref([]);
const currentCoord = ref(null);

// 初始化Cesium（适配1.118.1版本）
onMounted(async () => {
  // 配置Cesium Token（实际项目中建议放在环境变量）
  Cesium.Ion.defaultAccessToken = import.meta.env.VITE_APP_CESIUM_TOKEN
  
  // 1.118.1版本需要异步加载地形
  const terrainProvider = await Cesium.createWorldTerrainAsync({
    requestVertexNormals: true,
    requestWaterMask: true
  });
  
  // 创建Viewer实例
  viewer.value = new Cesium.Viewer(cesiumContainer.value, {
    terrainProvider: terrainProvider,  // 使用异步加载的地形
    infoBox: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    baseLayerPicker: true,
    timeline:false
  });
  
  // 初始化事件监听
  initEventListeners();
  
  // 初始视角定位到中国
  viewer.value.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(105, 35, 5000000),
    duration: 2
  });
});

// 初始化事件监听
function initEventListeners() {
  // 鼠标点击事件 - 绘制要素
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas);
  
  // 左键点击 - 添加点
  handler.setInputAction((movement) => {
    if (!drawType.value) return;
    
    // 获取点击位置的地理坐标
    const ray = viewer.value.camera.getPickRay(movement.position);
    const cartesian = viewer.value.scene.globe.pick(ray, viewer.value.scene);
    if (!cartesian) return;
    
    // 转换为经纬度显示
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    currentCoord.value = {
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      lat: Cesium.Math.toDegrees(cartographic.latitude)
    };
    
    positions.value.push(cartesian);
    
    // 根据绘制类型处理
    switch(drawType.value) {
      case 'point':
        createPoint(cartesian);
        resetDrawing();
        break;
      case 'line':
        createLine();
        break;
      case 'polygon':
        createPolygon();
        break;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  
  // 鼠标移动 - 动态更新线和面
  handler.setInputAction((movement) => {
    if (!drawType.value || (drawType.value !== 'line' && drawType.value !== 'polygon') || positions.value.length === 0) return;
    
    const ray = viewer.value.camera.getPickRay(movement.endPosition);
    const cartesian = viewer.value.scene.globe.pick(ray, viewer.value.scene);
    if (!cartesian) return;
    
    // 更新最后一个点的位置
    if (positions.value.length > 0) {
      positions.value.splice(positions.value.length - 1, 1, cartesian);
      
      // 更新线或面
      if (drawType.value === 'line' && currentEntity.value) {
        currentEntity.value.polyline.positions = new Cesium.CallbackProperty(() => positions.value, false);
      } else if (drawType.value === 'polygon' && currentEntity.value) {
        currentEntity.value.polygon.hierarchy = new Cesium.CallbackProperty(() => 
          new Cesium.PolygonHierarchy(positions.value), false
        );
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  
  // 双击 - 结束线和面的绘制
  handler.setInputAction(() => {
    if ((drawType.value === 'line' && positions.value.length >= 2) || 
        (drawType.value === 'polygon' && positions.value.length >= 3)) {
      resetDrawing();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  
  // 组件卸载时移除事件监听
  onUnmounted(() => {
    handler.destroy();
  });
}

// 创建点要素
function createPoint(position) {
  const point = viewer.value.entities.add({
    position: position,
    point: {
      pixelSize: 12,
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2
    },
    label: {
      text: `点 (${currentCoord.value.lon.toFixed(4)}, ${currentCoord.value.lat.toFixed(4)})`,
      font: '12px sans-serif',
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -15)
    }
  });
  
  entities.value.push(point);
  return point;
}

// 创建线要素
function createLine() {
  // 移除当前临时线
  if (currentEntity.value) {
    viewer.value.entities.remove(currentEntity.value);
  }
  
  currentEntity.value = viewer.value.entities.add({
    polyline: {
      positions: new Cesium.CallbackProperty(() => positions.value, false),
      width: 5,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.3,
        color: Cesium.Color.BLUE
      }),
      clampToGround: true
    }
  });
  
  // 线绘制完成后添加到实体列表
  if (positions.value.length >= 2) {
    entities.value.push(currentEntity.value);
  }
}

// 创建面要素
function createPolygon() {
  // 移除当前临时面
  if (currentEntity.value) {
    viewer.value.entities.remove(currentEntity.value);
  }
  
  currentEntity.value = viewer.value.entities.add({
    polygon: {
      hierarchy: new Cesium.CallbackProperty(() => 
        new Cesium.PolygonHierarchy(positions.value), false
      ),
      material: Cesium.Color.GREEN.withAlpha(0.3),
      outline: true,
      outlineColor: Cesium.Color.GREEN,
      outlineWidth: 2,
      clampToGround: true
    }
  });
  
  // 面绘制完成后添加到实体列表
  if (positions.value.length >= 3) {
    entities.value.push(currentEntity.value);
  }
}

// 重置绘制状态
function resetDrawing() {
  if (currentEntity.value && (drawType.value === 'line' || drawType.value === 'polygon')) {
    // 线和面已经添加到entities，不需要额外处理
  }
  currentEntity.value = null;
  positions.value = [];
}

// 清除所有要素
function clearAll() {
  entities.value.forEach(entity => {
    viewer.value.entities.remove(entity);
  });
  entities.value = [];
  resetDrawing();
  drawType.value = null;
  currentCoord.value = null;
}

// 监听绘制类型变化，重置绘制状态
watch(drawType, () => {
  resetDrawing();
});

// 组件卸载时销毁Cesium实例
onUnmounted(() => {
  if (viewer.value) {
    viewer.value.destroy();
  }
});
</script>

<style scoped>
.cesium-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
}

.control-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 100;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 0;
}

button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background: #007bff;
  color: white;
  cursor: pointer;
  transition: background 0.3s;
}

button:hover {
  background: #0056b3;
}

button.active {
  background: #28a745;
}

.coordinate-info {
  margin-top: 10px;
  font-size: 12px;
  color: #333;
  padding: 5px;
  background: rgba(240, 240, 240, 0.8);
  border-radius: 4px;
}
</style>
    