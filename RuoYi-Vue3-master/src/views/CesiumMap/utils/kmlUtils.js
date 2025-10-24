/**
 * KML导出工具类 - 负责将Cesium实体导出为KML格式
 */
export default class KmlExporter {
  /**
   * 导出KML格式数据 - 使用工具类版本
   */
  static exportKML(drawingMode, viewer, currentEntities) {
    console.log('entities', currentEntities);

    // 筛选指定类型的实体
    const entities = currentEntities.filter((entity) => {
      try {
        return (
          entity.properties &&
          entity.properties.getValue &&
          entity.properties.getValue().type === drawingMode
        );
      } catch (error) {
        console.error('Error filtering entity:', error);
        return false;
      }
    });

    if (entities.length === 0) {
      console.warn(`没有找到${this.getDrawingModeName(drawingMode)}类型的实体`);
      return null;
    }

    // 创建KML文档
    let kmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    kmlContent += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
    kmlContent += '  <Document>\n';
    kmlContent += `    <name>${this.getDrawingModeName(drawingMode)}集合</name>\n`;

    // ===== 保存当前视角 - 使用工具类 =====
    const saveCameraView = () => {
      return new Promise((resolve) => {
        if (viewer && viewer.camera) {
          try {
            // 使用requestAnimationFrame确保获取最新的相机状态
            requestAnimationFrame(() => {
              try {
                // 使用工具类转换相机
                const cameraKml = KmlCameraUtils.cesiumCameraToKmlCamera(viewer.camera);

                if (cameraKml) {
                  console.log('✅ 已保存当前视角到KML');
                  resolve(cameraKml);
                } else {
                  console.warn('⚠️  相机转换返回空字符串');
                  resolve('');
                }
              } catch (error) {
                console.error('Error saving camera view:', error);
                resolve(''); // 返回空字符串
              }
            });
          } catch (error) {
            console.error('Error in exportKML:', error);
            resolve(''); // 返回空字符串
          }
        } else {
          console.warn('⚠️  没有找到Cesium viewer或camera');
          resolve(''); // 返回空字符串
        }
      });
    };

    // ===== 主流程 - 使用async/await处理异步 =====
    const exportProcess = async () => {
      try {
        // 1. 保存相机视角
        const cameraKml = await saveCameraView();
        kmlContent += cameraKml;

        // 2. 定义默认颜色
        const defaultColors = {
          point: Cesium.Color.RED,
          line: Cesium.Color.BLUE,
          polygon: Cesium.Color.GREEN.withAlpha(0.3),
          rectangle: Cesium.Color.ORANGE.withAlpha(0.3),
          circle: Cesium.Color.PURPLE.withAlpha(0.3),
        };

        // 3. 为每个实体创建样式
        const styleIds = [];
        entities.forEach((entity, index) => {
          try {
            const properties =
              entity.properties && entity.properties.getValue ? entity.properties.getValue() : {};
            const entityType = properties.type || drawingMode;

            // 获取实体颜色
            const color = KmlColorUtils.getEntityColor(
              entity,
              defaultColors[entityType] || defaultColors.point
            );

            // 创建唯一的样式ID
            const styleId = `style_${index}`;
            styleIds.push(styleId);

            // 添加样式定义
            kmlContent += `    <Style id="${styleId}">\n`;

            if (entityType === 'point') {
              kmlContent += '      <IconStyle>\n';
              kmlContent += `        <color>${KmlColorUtils.cesiumColorToKmlColor(color)}</color>\n`;
              kmlContent += '        <Icon>\n';
              kmlContent +=
                '          <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>\n';
              kmlContent += '        </Icon>\n';
              kmlContent += '      </IconStyle>\n';
            } else if (entityType === 'line') {
              kmlContent += '      <LineStyle>\n';
              kmlContent += `        <color>${KmlColorUtils.cesiumColorToKmlColor(color)}</color>\n`;
              kmlContent += '        <width>3</width>\n';
              kmlContent += '      </LineStyle>\n';
            } else {
              // 面状要素（多边形、矩形、圆形）
              kmlContent += '      <PolyStyle>\n';
              kmlContent += `        <color>${KmlColorUtils.cesiumColorToKmlColor(color)}</color>\n`;
              kmlContent += '      </PolyStyle>\n';
              kmlContent += '      <LineStyle>\n';
              // 边框使用不透明颜色
              kmlContent += `        <color>${KmlColorUtils.cesiumColorToKmlColor(color, 1.0)}</color>\n`;
              kmlContent += '        <width>2</width>\n';
              kmlContent += '      </LineStyle>\n';
            }

            kmlContent += `    </Style>\n`;
          } catch (error) {
            console.error(`Error creating style for entity ${index}:`, error);
            styleIds.push(null);
          }
        });

        // 4. 生成实体KML
        entities.forEach((entity, index) => {
          try {
            const name = entity.name || `${this.getDrawingModeName(drawingMode)}_${index + 1}`;
            const properties =
              entity.properties && entity.properties.getValue ? entity.properties.getValue() : {};
            const entityType = properties.type || drawingMode;
            const styleId = styleIds[index];

            if (!styleId) {
              console.warn(`Skipping entity ${index} due to style creation error`);
              return;
            }

            // 根据类型生成不同的KML
            switch (entityType) {
              case 'point':
                kmlContent += this.generatePointKML(entity, name, properties, styleId);
                break;
              case 'line':
                kmlContent += this.generateLineKML(entity, name, properties, styleId);
                break;
              case 'polygon':
                kmlContent += this.generatePolygonKML(entity, name, properties, styleId);
                break;
              case 'rectangle':
                kmlContent += this.generateRectangleKML(entity, name, properties, styleId);
                break;
              case 'circle':
                kmlContent += this.generateCircleKML(entity, name, properties, styleId);
                break;
            }
          } catch (error) {
            console.error(`Error generating KML for entity ${index}:`, error);
          }
        });

        kmlContent += '  </Document>\n';
        kmlContent += '</kml>';

        // 调试：输出KML内容
        console.log('Generated KML:', kmlContent);

        // 5. 创建并下载KML文件
        this.downloadKMLFile(kmlContent, drawingMode);

        return kmlContent;
      } catch (error) {
        console.error('Error in export process:', error);
        return null;
      }
    };

    // 启动导出流程
    return exportProcess();
  }

  // ===== 生成KML的方法 =====
  static generatePointKML(entity, name, properties, styleId) {
    const coords = properties.coordinates;
    if (!coords || coords.length < 2) return '';

    const kmlCoord = `${coords[0]},${coords[1]},${coords[2] || 0}`;

    let kml = '    <Placemark>\n';
    kml += `      <name>${this.escapeXml(name)}</name>\n`;
    kml += `      <styleUrl>#${styleId}</styleUrl>\n`;
    kml += '      <Point>\n';
    kml += `        <coordinates>${kmlCoord}</coordinates>\n`;
    kml += '      </Point>\n';
    kml += '    </Placemark>\n';

    return kml;
  }

  static generateLineKML(entity, name, properties, styleId) {
    const coords = properties.coordinates;
    if (!coords || coords.length < 2) return '';

    let kml = '    <Placemark>\n';
    kml += `      <name>${this.escapeXml(name)}</name>\n`;
    kml += `      <styleUrl>#${styleId}</styleUrl>\n`;
    kml += '      <LineString>\n';
    kml += '        <tessellate>1</tessellate>\n';
    kml += '        <coordinates>\n';

    coords.forEach((coord) => {
      kml += `          ${coord[0]},${coord[1]},${coord[2] || 0}\n`;
    });

    kml += '        </coordinates>\n';
    kml += '      </LineString>\n';
    kml += '    </Placemark>\n';

    return kml;
  }

  static generatePolygonKML(entity, name, properties, styleId) {
    const coords = properties.coordinates;
    if (!coords || coords.length < 3) return '';

    let kml = '    <Placemark>\n';
    kml += `      <name>${this.escapeXml(name)}</name>\n`;
    kml += `      <styleUrl>#${styleId}</styleUrl>\n`;
    kml += '      <Polygon>\n';
    kml += '        <tessellate>1</tessellate>\n';
    kml += '        <outerBoundaryIs>\n';
    kml += '          <LinearRing>\n';
    kml += '            <coordinates>\n';

    coords.forEach((coord) => {
      kml += `              ${coord[0]},${coord[1]},${coord[2] || 0}\n`;
    });

    kml += '            </coordinates>\n';
    kml += '          </LinearRing>\n';
    kml += '        </outerBoundaryIs>\n';
    kml += '      </Polygon>\n';
    kml += '    </Placemark>\n';

    return kml;
  }

  static generateRectangleKML(entity, name, properties, styleId) {
    const coords = properties.coordinates;
    if (!coords || coords.length < 4) return '';

    let kml = '    <Placemark>\n';
    kml += `      <name>${this.escapeXml(name)}</name>\n`;
    kml += `      <styleUrl>#${styleId}</styleUrl>\n`;
    kml += '      <Polygon>\n';
    kml += '        <tessellate>1</tessellate>\n';
    kml += '        <outerBoundaryIs>\n';
    kml += '          <LinearRing>\n';
    kml += '            <coordinates>\n';

    coords.forEach((coord) => {
      kml += `              ${coord[0]},${coord[1]},${coord[2] || 0}\n`;
    });

    kml += '            </coordinates>\n';
    kml += '          </LinearRing>\n';
    kml += '        </outerBoundaryIs>\n';
    kml += '      </Polygon>\n';
    kml += '    </Placemark>\n';

    return kml;
  }

  static generateCircleKML(entity, name, properties, styleId) {
    const center = properties.center;
    const radius = properties.radius;

    if (!center || !radius || center.length < 2) return '';

    // 创建圆形多边形（用36边近似圆）
    const positions = [];
    const numPoints = 36;
    const centerLon = center[0];
    const centerLat = center[1];
    const earthRadius = 6378137; // 地球半径(米)

    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      // 计算经纬度偏移
      const deltaLon =
        ((radius * Math.cos(angle)) / (earthRadius * Math.cos((centerLat * Math.PI) / 180))) *
        (180 / Math.PI);
      const deltaLat = ((radius * Math.sin(angle)) / earthRadius) * (180 / Math.PI);

      positions.push([centerLon + deltaLon, centerLat + deltaLat, center[2] || 0]);
    }

    let kml = '    <Placemark>\n';
    kml += `      <name>${this.escapeXml(name)}</name>\n`;
    kml += `      <styleUrl>#${styleId}</styleUrl>\n`;
    kml += '      <Polygon>\n';
    kml += '        <tessellate>1</tessellate>\n';
    kml += '        <outerBoundaryIs>\n';
    kml += '          <LinearRing>\n';
    kml += '            <coordinates>\n';

    positions.forEach((coord) => {
      kml += `              ${coord[0]},${coord[1]},${coord[2] || 0}\n`;
    });

    kml += '            </coordinates>\n';
    kml += '          </LinearRing>\n';
    kml += '        </outerBoundaryIs>\n';
    kml += '      </Polygon>\n';
    kml += '    </Placemark>\n';

    return kml;
  }

  /**
   * XML特殊字符转义
   */
  static escapeXml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 下载KML文件
   */
  static downloadKMLFile(kmlContent, drawingMode) {
    try {
      const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.getDrawingModeName(drawingMode)}_${new Date().toISOString().slice(0, 10)}.kml`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('KML文件下载已触发');
      }, 100);
    } catch (error) {
      console.error('下载KML文件失败:', error);
      alert('下载KML文件失败，请检查控制台日志');
    }
  }

  /**
   * 获取绘制模式的中文名称
   */
  static getDrawingModeName(mode) {
    const modeNames = {
      point: '点',
      line: '线',
      polygon: '多边形',
      rectangle: '矩形',
      circle: '圆形',
    };
    return modeNames[mode] || mode;
  }
}

/**
 * 颜色工具类 - 处理KML颜色转换
 */
class KmlColorUtils {
  /**
   * 将Cesium颜色转换为KML颜色格式 (ARGB)
   */
  static cesiumColorToKmlColor(color, alpha = 1.0) {
    try {
      // 如果是字符串，尝试解析
      if (typeof color === 'string') {
        color = Cesium.Color.fromCssColorString(color);
      }

      // 如果是Cesium.Color对象
      if (color instanceof Cesium.Color) {
        const a = Math.round(color.alpha * 255);
        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);

        // KML格式：AABBGGRR
        return `${a.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}`;
      }

      // 默认颜色
      return 'ff0000ff'; // 红色
    } catch (error) {
      console.error('Error converting color to KML format:', error);
      return 'ff0000ff'; // 默认红色
    }
  }

  /**
   * 获取实体的颜色
   */
  static getEntityColor(entity, defaultColor) {
    try {
      if (!entity) return defaultColor;

      // 检查实体是否有颜色属性
      if (entity.properties && entity.properties.getValue) {
        const props = entity.properties.getValue();
        if (props.color) {
          return props.color;
        }
      }

      // 从图形属性中获取颜色
      if (entity.point && entity.point.color) {
        return entity.point.color.getValue();
      }
      if (entity.polyline && entity.polyline.material) {
        const material = entity.polyline.material.getValue();
        if (material.color) {
          return material.color.getValue();
        }
      }
      if (entity.polygon && entity.polygon.material) {
        const material = entity.polygon.material.getValue();
        if (material.color) {
          return material.color.getValue();
        }
      }

      return defaultColor;
    } catch (error) {
      console.error('Error getting entity color:', error);
      return defaultColor;
    }
  }
}

/**
 * 相机工具类 - 处理KML相机视角（已修复角度转换）
 */
class KmlCameraUtils {
  /**
   * 将Cesium相机转换为KML Camera元素
   * @param {Cesium.Camera} camera - Cesium相机对象
   * @returns {string} KML Camera元素字符串
   */
  static cesiumCameraToKmlCamera(camera) {
    try {
      if (!camera) return '';

      // 获取相机参数
      const position = Cesium.Cartographic.fromCartesian(camera.position);
      const heading = Cesium.Math.toDegrees(camera.heading);
      const pitch = Cesium.Math.toDegrees(camera.pitch);
      const roll = Cesium.Math.toDegrees(camera.roll);

      // 正确转换俯仰角度
      // Cesium pitch: 0°=水平, 正值=向上, 负值=向下
      // KML tilt: 0°=俯视, 90°=水平, 180°=仰视
      const tilt = 90 - pitch;

      console.log('📷 相机角度转换:');
      console.log(`  Cesium pitch: ${pitch.toFixed(2)}°`);
      console.log(`  KML tilt: ${tilt.toFixed(2)}°`);

      // 创建KML Camera元素
      let kml = '    <Camera>\n';
      kml += `      <longitude>${Cesium.Math.toDegrees(position.longitude).toFixed(6)}</longitude>\n`;
      kml += `      <latitude>${Cesium.Math.toDegrees(position.latitude).toFixed(6)}</latitude>\n`;
      kml += `      <altitude>${position.height.toFixed(2)}</altitude>\n`;
      kml += `      <heading>${heading.toFixed(6)}</heading>\n`;
      kml += `      <tilt>${tilt.toFixed(6)}</tilt>\n`; // 使用正确转换后的tilt
      kml += `      <roll>${roll.toFixed(6)}</roll>\n`;
      kml += '      <altitudeMode>absolute</altitudeMode>\n';
      kml += '    </Camera>\n';

      return kml;
    } catch (error) {
      console.error('Error converting camera to KML:', error);
      return '';
    }
  }
}
