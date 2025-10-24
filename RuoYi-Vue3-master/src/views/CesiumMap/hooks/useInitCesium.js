export const useInitCesium = () => {
  //视图对象
  let viewer = null;

  //创建视图对象/初始化影像与地形数据
  const createCesium = async (cesiumContainerElement) => {
    if (!window.Cesium || !cesiumContainerElement) return false;
    const Cesium = window.Cesium;

    //设置token
    Cesium.Ion.defaultAccessToken = import.meta.env.VITE_APP_CESIUM_TOKEN;

    //准备影像数据
    const openStreetMapProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: new Cesium.Credit('© OpenStreetMap contributors'),
      maximumLevel: 18, // 限制最大缩放级别（避免超出OSM服务范围）
      subdomains: ['a', 'b', 'c'], // 显式指定子域名（分散请求压力）
    });

    //准备地形数据
    // const terrainProvider = await Cesium.createWorldTerrainAsync({
    //   requestVertexNormals: true,
    //   requestWaterMask: true
    // });
    const pakImagerProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'D:\test\cesium\output/{z}/{x}/{y}.png', // 根据pak文件的实际结构调整路径
      fileExtension: 'png', // 根据实际情况修改
    });
    console.log('pakImagerProvider', pakImagerProvider);
    //创建viewer
    viewer = new Cesium.Viewer(cesiumContainerElement, {
      imageryProvider: openStreetMapProvider,
      // 隐藏右上方工具栏核心配置
      navigationHelpButton: false, // 隐藏导航帮助按钮（问号图标）
      homeButton: false, // 隐藏主页按钮（回到默认视角）
      sceneModePicker: false, // 隐藏场景模式切换（2D/3D/哥伦布视图）
      // baseLayerPicker: false,       // 隐藏底图切换控件
      searchButton: false, // 隐藏搜索框（Cesium ion搜索功能）

      // 其他常用隐藏配置
      // animation: false,             // 隐藏动画控件
      // timeline: false,              // 隐藏时间轴
      // fullscreenButton: false,      // 隐藏全屏按钮
      // vrButton: false,               // 隐藏VR按钮

      // terrainProvider: terrainProvider
    });

    // 添加纯蓝色影像图层（覆盖全球）
    // const blueImagery = new Cesium.SingleTileImageryProvider({
    //     url: Cesium.buildModuleUrl('Assets/Textures/transparent.png'), // 透明底图作为载体
    //     rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90) // 覆盖全球范围
    // });

    // // 将图层材质设置为蓝色
    // viewer.imageryLayers.addImageryProvider(blueImagery).material = Cesium.Color.BLUE.withAlpha(0.8);

    // 隐藏 Logo（可选）
    viewer._cesiumWidget._creditContainer.style.display = 'none';

    setDefaultPosition();
    addAirportMarker();

    return viewer;
  };

  //设置相机视角
  const setDefaultView = () => {
    // 指定经纬度和高度（单位：米）
    const lon = 113.3768; // 经度
    const lat = 23.107552; // 纬度
    const height = 1000; // 高度，可根据需要调整

    // 无动画，直接定位到目标
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
    });
  };

  //设置默认点位
  const setDefaultPosition = () => {
    // 指定经纬度和高度（单位：米）
    const longitude = 113.3768; // 经度
    const latitude = 23.107552; // 纬度
    const height = 1000; // 高度，可根据需要调整

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
      duration: 3,
    });
  };

  //添加机场标记
  const addAirportMarker = () => {
    // 解构机场数据并设置默认值
    const lon = 113.3768; // 经度
    const lat = 23.107552; // 纬度
    const name = '铁塔信号塔机场';
    const code = '';
    const altitude = 0;
    const color = '#1E90FF';

    // 方式1：使用在线图标（推荐）
    const airportIcon = new Cesium.BillboardGraphics({
      image: 'https://picsum.photos/seed/airport/32/32', // 机场图标占位图
      width: 32,
      height: 32,
      color: Cesium.Color.fromCssColorString(color),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      scaleByDistance: new Cesium.NearFarScalar(1000, 1.0, 100000, 0.5),
    });
    // 创建标签（显示机场名称和代码）
    const labelText = code ? `${name} (${code})` : name;
    const airportLabel = new Cesium.LabelGraphics({
      text: labelText,
      font: '14px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, 16), // 标签在图标上方16px
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
        0,
        50000 // 50公里内显示标签
      ),
    });

    // 创建机场实体并添加到地图
    const airportEntity = viewer.entities.add({
      name: `机场：${name}`,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
      billboard: airportIcon,
      label: airportLabel,
      // 存储额外信息（点击时可显示）
      properties: {
        type: 'airport',
        code: code,
        altitude: altitude,
      },
    });

    return airportEntity;
  };

  //销毁viewer
  const destroyCesium = () => {
    if (viewer) {
      viewer.destroy();
      viewer = null;
    }
  };

  return {
    viewer,
    createCesium,
    destroyCesium,
  };
};
