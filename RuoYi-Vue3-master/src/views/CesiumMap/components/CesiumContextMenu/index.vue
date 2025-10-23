<template>
  <div
    ref="contextMenu"
    class="cesium-context-menu"
    :style="{ left: `${menuX}px`, top: `${menuY}px`, display: menuVisible ? 'block' : 'none' }"
  >
    <ul>
      <li @click="handleShowCoord">查看此处坐标</li>
      <li @click="clickDrawPoint">绘制点</li>
      <li @click="clickDrawLine">绘制线</li>
      <li @click="clickDrawPolygon">绘制面</li>
      <li @click="clickDrawCircle">绘制圆形</li>
      <li @click="clickDrawRectangle">绘制矩形</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import cesiumBus from './../../utils/cesiumEventBus';
import CesiumDrawingTool from './../../utils/drawGraphics'

// 菜单状态
const contextMenu = ref(null);
const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
// 存储右键点击的地理坐标
const clickPosition = ref({
  lon: 0, // 经度
  lat: 0, // 纬度
  height: 0 // 高度（可选）
});
let eventHandler = null;
let viewer = null;
let drawerTool = null


const clickDrawPoint = () => { 
  // 创建绘图工具实例
  // const drawer = new CesiumDrawingTool(viewer);
  drawerTool.startDrawing('point');
  menuVisible.value=false

};
const clickDrawLine = () => {
   // 创建绘图工具实例
  // const drawer = new CesiumDrawingTool(viewer);
  drawerTool.startDrawing('line');
  menuVisible.value=false
};
const clickDrawPolygon = () => { 
   // 创建绘图工具实例
  // const drawer = new CesiumDrawingTool(viewer);
  drawerTool.startDrawing('polygon');
  menuVisible.value=false
};

const clickDrawCircle=()=>{
  // 创建绘图工具实例
  // const drawer = new CesiumDrawingTool(viewer);
  drawerTool.startDrawing('circle');
  menuVisible.value=false
}

const clickDrawRectangle=()=>{
  // 创建绘图工具实例
  // const drawer = new CesiumDrawingTool(viewer);
  drawerTool.startDrawing('rectangle');
  menuVisible.value=false
}


onMounted(() => {
  // 检查 viewer 是否已就绪（避免事件已触发但组件未挂载的情况）
  if (cesiumBus.isReady) {
    viewer = cesiumBus.getViewer();
    bindRightClickEvent();
  } else {
    // 监听 viewer 就绪事件（核心：灵活响应初始化完成）
    const handleViewerReady = (newViewer,drawerToolObj) => {
      viewer = newViewer;
      drawerTool=drawerToolObj
      bindRightClickEvent();
    };
    cesiumBus.on('viewerReady', handleViewerReady);

    // 组件卸载时移除监听（避免内存泄漏）
    onUnmounted(() => {
      cesiumBus.off('viewerReady', handleViewerReady);
    });
  }
});

// 绑定右键事件并获取位置信息
const bindRightClickEvent = () => {
  if (!viewer) return;

  eventHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  
  eventHandler.setInputAction((cesiumEvent) => {
    // 阻止默认右键菜单
    if (cesiumEvent.nativeEvent) {
      cesiumEvent.nativeEvent.preventDefault();
    }

    const { position } = cesiumEvent; // 屏幕坐标（x,y）
    if (!position) return;

    // 1. 转换屏幕坐标为地理坐标
    // 该方法会自动考虑已加载的地形数据
    const cartesian = viewer.scene.pickPosition(position);

    // 2. 若需要地形高度，使用 scene.pickPosition()（需加载地形）
    // const cartesian = viewer.scene.pickPosition(endPosition);

    if (cartesian) {
      // 3. 将笛卡尔坐标转换为经纬度
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lon = Cesium.Math.toDegrees(cartographic.longitude); // 经度（度）
      const lat = Cesium.Math.toDegrees(cartographic.latitude);  // 纬度（度）
      const height = cartographic.height || 0;                  // 高度（米）

      // 4. 存储坐标信息（保留6位小数）
      clickPosition.value = {
        lon: Number(lon.toFixed(6)),
        lat: Number(lat.toFixed(6)),
        height: Number(height.toFixed(2))
      };
    }

    // 设置菜单位置并显示
    const rect = viewer.scene.canvas.getBoundingClientRect();
    menuX.value = position.x + rect.left;
    menuY.value = position.y + rect.top;
    menuVisible.value = true;
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  // 点击空白处关闭菜单
  const closeMenu = () => menuVisible.value = false;
  document.addEventListener('click', closeMenu);
  onUnmounted(() => document.removeEventListener('click', closeMenu));
}


// 菜单功能实现（省略，同上）
const handleShowCoord = () => { 
  const { lon, lat, height } = clickPosition.value;
  alert(`坐标：\n经度：${lon}\n纬度：${lat}\n高度：${height}米`);
  menuVisible.value = false;
};

</script>

<style scoped>
/* 核心样式：确保菜单可见且在顶层 */
.cesium-context-menu {
  /* 1. 定位方式：固定定位，不受父元素滚动影响 */
  position: fixed;
  
  /* 2. 基础样式：白色背景+阴影，确保可见 */
  width: 150px;
  background-color: #ffffff;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15); /* 阴影增强层次感 */
  
  /* 3. 层级：必须高于地图容器（Cesium默认z-index较低） */
  z-index: 9999; /* 足够大的值，避免被地图覆盖 */
  
  /* 4. 去除默认边距 */
  margin: 0;
  padding: 5px 0;
  
  /* 5. 禁止选中文字 */
  user-select: none;
}

/* 菜单项样式 */
.cesium-context-menu ul {
  list-style: none; /* 去除默认列表样式 */
  margin: 0;
  padding: 0;
}

.cesium-context-menu li {
  padding: 8px 16px; /* 内边距保证点击区域 */
  cursor: pointer; /* 鼠标悬停显示手型 */
  font-size: 14px;
  color: #333333;
}

/*  hover效果：增强交互反馈 */
.cesium-context-menu li:hover {
  background-color: #f5f5f5;
  color: #1890ff; /* 高亮颜色 */
}

/* 可选：添加边框分隔线 */
.cesium-context-menu li + li {
  border-top: 1px solid #f0f0f0;
}
</style>