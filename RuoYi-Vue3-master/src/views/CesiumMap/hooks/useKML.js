export const useKML = (newViewer) => {
  const viewer = newViewer;
  let currentDataSource = null;

  const importKML = (file) => {
    // 移除上一次加载的数据
    if (currentDataSource) {
      viewer.dataSources.remove(currentDataSource);
    }

    // 转换文件为可访问的 URL
    const fileUrl = URL.createObjectURL(file);

    // 加载并解析 KML
    Cesium.KmlDataSource.load(fileUrl, {
      camera: viewer.camera,
      canvas: viewer.canvas,
      clampToGround: true,
    })
      .then((dataSource) => {
        currentDataSource = dataSource;
        viewer.dataSources.add(dataSource);
        // 定位到数据范围
        viewer.zoomTo(dataSource);
        // 释放临时 URL
        URL.revokeObjectURL(fileUrl);
      })
      .catch((error) => {
        console.error('KML 加载失败：', error);
        URL.revokeObjectURL(fileUrl);
      });
  };

  return {
    importKML,
  };
};
