import KmlExporter from './kmlUtils';
/**
 * Cesium绘图工具类
 * 功能：支持点、线、多边形、矩形、圆形的绘制与测量
 */
class CesiumDrawingTool {
  constructor(viewer) {
    this.viewer = viewer;
    this.entities = []; // 存储所有已完成的实体
    this.tempEntities = []; // 存储临时绘制的实体
    this.history = []; // 用于撤销操作的历史记录
    this.drawingMode = null; // 当前绘制模式
    this.positions = []; // 存储当前绘制的坐标点
    this.isEditing = false; // 是否处于编辑状态
    this.measureInfo = { length: 0, area: 0, radius: 0 }; // 测量信息

    // 初始化事件处理器
    this.handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    this.eventListeners = {}; // 存储已注册的事件监听标识

    // 禁用实体聚焦行为
    this.disableEntityFocusBehaviors();

    // 创建提示标签
    this.createHintElement();
  }

  /**
   * 禁用实体相关的双击聚焦和点击行为
   */
  disableEntityFocusBehaviors() {
    // 移除默认的双击实体聚焦行为
    this.viewer.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    // 移除实体点击选择行为
    this.viewer.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
      Cesium.KeyboardEventModifier.CTRL
    );

    // 安全地移除selectedEntityChanged事件监听器
    if (
      this.viewer.selectedEntityChanged &&
      typeof this.viewer.selectedEntityChanged.getListeners === 'function'
    ) {
      const listeners = this.viewer.selectedEntityChanged.getListeners();
      if (Array.isArray(listeners)) {
        [...listeners].forEach((listener) => {
          if (typeof listener === 'function') {
            this.viewer.selectedEntityChanged.removeEventListener(listener);
          }
        });
      }
    }

    // 禁用实体选择和追踪
    this.viewer.trackedEntity = undefined;
    this.viewer.selectedEntity = undefined;
  }

  /**
   * 创建鼠标位置的功能提示标签
   */
  createHintElement() {
    this.hintElement = document.createElement('div');
    this.hintElement.style.position = 'absolute';
    this.hintElement.style.padding = '6px 10px';
    this.hintElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.hintElement.style.color = 'white';
    this.hintElement.style.borderRadius = '4px';
    this.hintElement.style.fontSize = '12px';
    this.hintElement.style.pointerEvents = 'none';
    this.hintElement.style.zIndex = '9999';
    this.hintElement.style.display = 'none';
    this.hintElement.style.whiteSpace = 'nowrap';
    document.body.appendChild(this.hintElement);
  }

  /**
   * 更新提示标签内容和位置
   */
  updateHint(position) {
    if (!this.hintElement || !this.isEditing) {
      this.hintElement.style.display = 'none';
      return;
    }

    // 基础操作提示
    let actionHint = '';
    switch (this.drawingMode) {
      case 'point':
        actionHint = '单击完成绘制';
        break;
      case 'line':
        actionHint = '左键：添加点  右键：撤销上一步 <br>双击：完成绘制';
        break;
      case 'polygon':
        actionHint = '左键：添加点  右键：撤销上一步 <br> 双击：完成绘制';
        break;
      case 'rectangle':
        if (this.positions.length <= 0) {
          actionHint = '单击开始绘制';
        } else {
          actionHint = '单击完成绘制';
        }
        break;
      case 'circle':
        if (this.positions.length <= 0) {
          actionHint = '单击开始绘制';
        } else {
          actionHint = '单击完成绘制';
        }
        break;
    }

    // 测量信息提示
    let measureHint = '';
    if (this.drawingMode === 'line' && this.positions.length >= 1) {
      measureHint = `长度: ${this.measureInfo.length.toFixed(2)}米`;
    } else if (
      (this.drawingMode === 'polygon' && this.positions.length >= 2) ||
      this.drawingMode === 'rectangle'
    ) {
      measureHint = `面积: ${(this.measureInfo.area / 10000).toFixed(2)}平方米`;
    } else if (this.drawingMode === 'circle' && this.positions.length >= 1) {
      measureHint = `半径: ${this.measureInfo.radius.toFixed(2)}米`;
    }

    // 组合提示内容
    let content = actionHint;
    if (measureHint) {
      content += `<br>${measureHint}`;
    }

    this.hintElement.innerHTML = content;
    this.hintElement.style.left = `${position.x + 10}px`;
    this.hintElement.style.top = `${position.y + 10}px`;
    this.hintElement.style.display = 'block';
  }

  /**
   * 绑定编辑模式所需的事件
   */
  bindEditEvents() {
    // 先清除可能存在的事件监听
    this.unbindEditEvents();

    // 鼠标左键点击 - 绘制点、线、面的顶点
    this.eventListeners.leftClick = this.handler.setInputAction((event) => {
      if (!this.isEditing || !this.drawingMode) return;

      const position = this.getClickPosition(event.position);
      if (!position) return;

      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const height = cartographic.height || 0;

      // 记录历史用于撤销（点不需要撤销）
      if (this.drawingMode !== 'point') {
        this.history.push({
          mode: this.drawingMode,
          action: 'addPoint',
          position: [lon, lat, height],
        });
      }

      // 根据不同模式处理点击
      switch (this.drawingMode) {
        case 'point':
          this.drawPoint([lon, lat, height]);
          // 清除预览点
          this.clearTemporaryEntities();
          // 点绘制完成后自动退出编辑模式
          this.exitEditingMode();
          break;

        case 'line':
          this.positions.push([lon, lat, height]);
          this.updateTemporaryLine();
          break;

        case 'polygon':
          this.positions.push([lon, lat, height]);
          this.updateTemporaryPolygon();
          break;

        case 'rectangle':
          if (this.positions.length === 0) {
            this.positions.push([lon, lat, height]);
          } else if (this.positions.length === 1) {
            this.positions.push([lon, lat, height]);
            this.finishDrawingRectangle();
            // 矩形绘制完成后自动退出编辑模式
            this.exitEditingMode();
          }
          break;

        case 'circle':
          if (this.positions.length === 0) {
            this.positions.push([lon, lat, height]);
          } else if (this.positions.length === 1) {
            this.positions.push([lon, lat, height]);
            this.finishDrawingCircle();
            // 圆形绘制完成后自动退出编辑模式
            this.exitEditingMode();
          }
          break;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 鼠标移动 - 更新临时图形和提示
    this.eventListeners.mouseMove = this.handler.setInputAction((event) => {
      // 更新提示
      this.updateHint(event.endPosition);

      if (!this.isEditing || !this.drawingMode) return;
      // if (this.positions.length === 0) return;

      const position = this.getClickPosition(event.endPosition);
      if (!position) return;

      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);

      // 更新临时图形
      requestAnimationFrame(() => {
        switch (this.drawingMode) {
          case 'point':
            // console.log('11111111111',this.drawingMode)
            // 点模式下显示跟随鼠标的预览点
            this.updateTemporaryPoint([lon, lat, 0]);
            break;
          case 'line':
            if (this.positions.length > 0) {
              this.updateTemporaryLine([...this.positions, [lon, lat, 0]]);
            }
            break;

          case 'polygon':
            if (this.positions.length > 0) {
              this.updateTemporaryPolygon([...this.positions, [lon, lat, 0]]);
            }
            break;

          case 'rectangle':
            if (this.positions.length === 1) {
              this.updateTemporaryRectangle(this.positions[0], [lon, lat, 0]);
            }
            break;

          case 'circle':
            if (this.positions.length === 1) {
              this.updateTemporaryCircle(this.positions[0], [lon, lat, 0]);
            }
            break;
        }
      });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 双击事件 - 完成绘制或退出编辑模式
    this.eventListeners.doubleClick = this.handler.setInputAction((event) => {
      if (!this.isEditing) return;

      // 检查点击位置是否有实体
      const pickedObject = this.viewer.scene.pick(event.position);
      const isOnEntity = Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id);

      // 尝试完成当前绘制
      let drawingCompleted = false;

      if (this.drawingMode === 'line' && this.positions.length >= 2) {
        this.finishDrawingLine();
        drawingCompleted = true;
        // 线绘制完成后自动退出编辑模式
        this.exitEditingMode();
      } else if (this.drawingMode === 'polygon' && this.positions.length >= 3) {
        this.finishDrawingPolygon();
        drawingCompleted = true;
        // 多边形绘制完成后自动退出编辑模式
        this.exitEditingMode();
      }

      // 如果没有进行绘制操作且点击空白处，则退出编辑模式
      if (!drawingCompleted && !isOnEntity) {
        this.exitEditingMode();
      }

      // 修复：使用Cesium正确的方式阻止事件传播
      this.handler.cancelEvent = true;
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // 右键点击 - 取消当前绘制或回退上一步
    this.eventListeners.rightClick = this.handler.setInputAction((event) => {
      // 处理右键事件
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      } else {
        this.handler.cancelEvent = true;
      }

      if (!this.isEditing) return;

      // 点不需要撤销
      if (this.drawingMode === 'point') {
        this.clearTemporaryEntities();
        this.positions = [];
        return;
      }

      // 线和多边形支持撤销上一步
      if (
        (this.drawingMode === 'line' || this.drawingMode === 'polygon') &&
        this.positions.length > 0
      ) {
        this.positions.pop();
        this.history.pop();
        if (this.drawingMode === 'line') {
          this.updateTemporaryLine(this.positions);
        } else if (this.drawingMode === 'polygon') {
          this.updateTemporaryPolygon(this.positions);
        }
      } else {
        this.clearTemporaryEntities();
        this.positions = [];
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  /**
   * 清除编辑模式的事件监听
   */
  unbindEditEvents() {
    Object.keys(this.eventListeners).forEach((key) => {
      const action = this.eventListeners[key];
      if (action && action.type) {
        this.handler.removeInputAction(action.type, action.modifier);
      }
    });
    this.eventListeners = {};
  }

  /**
   * 获取鼠标点击位置的地理坐标
   */
  getClickPosition(screenPosition) {
    try {
      const ray = this.viewer.camera.getPickRay(screenPosition);
      if (!ray) return null;
      return (
        this.viewer.scene.pickPosition(screenPosition) ||
        this.viewer.scene.globe.pick(ray, this.viewer.scene)
      );
    } catch (e) {
      console.error('获取点击位置失败:', e);
      return null;
    }
  }

  /**
   * 开始绘制模式
   */
  startDrawing(mode) {
    // 开始新绘制前确保退出之前的编辑模式
    if (this.isEditing) {
      this.exitEditingMode();
    }

    this.isEditing = true;
    this.drawingMode = mode;
    this.positions = [];
    this.measureInfo = { length: 0, area: 0, radius: 0 };
    this.clearTemporaryEntities();
    this.bindEditEvents();
  }

  /**
   * 退出编辑模式
   */
  exitEditingMode() {
    this.isEditing = false;
    this.drawingMode = null;
    this.clearTemporaryEntities();
    this.positions = [];
    this.measureInfo = { length: 0, area: 0, radius: 0 };
    this.unbindEditEvents();
    this.hintElement.style.display = 'none';
  }

  /**
   * 清除临时实体
   */
  clearTemporaryEntities() {
    if (this.tempEntities.length === 0) return;

    const entitiesToRemove = this.tempEntities;
    this.tempEntities = [];
    entitiesToRemove.forEach((entity) => {
      if (this.viewer.entities.contains(entity)) {
        this.viewer.entities.remove(entity);
      }
    });
  }

  /**
   * 更新临时点（预览点）
   */
  updateTemporaryPoint(coords) {
    // 如果已有临时点，更新其位置
    if (this.tempEntities.length > 0 && this.tempEntities[0].point) {
      this.tempEntities[0].position = Cesium.Cartesian3.fromDegrees(
        coords[0],
        coords[1],
        coords[2]
      );
    } else {
      // 否则创建新的临时点
      this.clearTemporaryEntities();

      const point = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], coords[2]),
        point: {
          color: new Cesium.Color(1, 0, 0, 0.7), // 半透明红色，与最终点区分
          pixelSize: 10,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
      });

      this.tempEntities.push(point);
    }
  }

  /**
   * 绘制点
   */
  drawPoint(coords) {
    const point = this.viewer.entities.add({
      name: `点_${this.entities.length + 1}`,
      position: Cesium.Cartesian3.fromDegrees(coords[0], coords[1], coords[2]),
      point: {
        color: Cesium.Color.RED,
        pixelSize: 10,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      properties: {
        type: 'point',
        coordinates: coords,
      },
    });

    this.entities.push(point);
    return point;
  }

  /**
   * 更新临时线
   */
  updateTemporaryLine(positions) {
    if (!positions || positions.length < 2) {
      this.clearTemporaryEntities();
      this.measureInfo.length = 0;
      return;
    }

    this.measureInfo.length = this.calculateLineLength(positions);

    if (this.tempEntities.length > 0 && this.tempEntities[0].polyline) {
      this.tempEntities[0].polyline.positions = new Cesium.CallbackProperty(() => {
        return positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0));
      }, false);
    } else {
      this.clearTemporaryEntities();

      const line = this.viewer.entities.add({
        polyline: {
          positions: positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0)),
          width: 3,
          material: Cesium.Color.BLUE,
          clampToGround: true,
        },
      });

      this.tempEntities.push(line);
    }
  }

  /**
   * 完成线绘制
   */
  finishDrawingLine() {
    if (!this.positions || this.positions.length < 2) {
      console.log('至少需要2个点来绘制线');
      return;
    }

    const totalLength = this.calculateLineLength(this.positions);

    const line = this.viewer.entities.add({
      name: `线_${this.entities.length + 1}`,
      polyline: {
        positions: this.positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0)),
        width: 3,
        material: Cesium.Color.BLUE,
        clampToGround: true,
      },
      label: {
        text: `总长度: ${totalLength.toFixed(2)}米`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      },
      properties: {
        type: 'line',
        coordinates: this.positions,
        length: totalLength,
      },
    });

    const midIndex = Math.floor(this.positions.length / 2);
    line.label.position = Cesium.Cartesian3.fromDegrees(
      this.positions[midIndex][0],
      this.positions[midIndex][1],
      10
    );

    this.entities.push(line);
    this.history.push({
      mode: 'line',
      action: 'complete',
      entity: line,
    });
    this.clearTemporaryEntities();
    this.positions = [];
    this.measureInfo.length = 0;
  }

  /**
   * 更新临时多边形
   */
  updateTemporaryPolygon(positions) {
    if (!positions || positions.length < 3) {
      this.clearTemporaryEntities();
      this.measureInfo.area = 0;
      return;
    }

    this.measureInfo.area = this.calculatePolygonArea(positions);

    if (this.tempEntities.length > 0 && this.tempEntities[0].polygon) {
      this.tempEntities[0].polygon.hierarchy = new Cesium.CallbackProperty(() => {
        return new Cesium.PolygonHierarchy(
          positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
        );
      }, false);
    } else {
      this.clearTemporaryEntities();

      const polygon = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(
            positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
          ),
          material: new Cesium.Color(0, 1, 0, 0.3),
          outline: true,
          outlineColor: Cesium.Color.GREEN,
        },
      });

      this.tempEntities.push(polygon);
    }
  }

  /**
   * 完成多边形绘制
   */
  finishDrawingPolygon() {
    if (!this.positions || this.positions.length < 3) {
      console.log('至少需要3个点来绘制多边形');
      return;
    }

    const area = this.calculatePolygonArea(this.positions);
    const center = this.calculatePolygonCenter(this.positions);

    const polygon = this.viewer.entities.add({
      name: `多边形_${this.entities.length + 1}`,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(
          this.positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
        ),
        material: new Cesium.Color(0, 1, 0, 0.3),
        outline: true,
        outlineColor: Cesium.Color.GREEN,
      },
      label: {
        text: `面积: ${(area / 10000).toFixed(2)}平方米`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      },
      properties: {
        type: 'polygon',
        coordinates: this.positions,
        area: area,
      },
    });

    polygon.label.position = Cesium.Cartesian3.fromDegrees(center[0], center[1], 10);

    this.entities.push(polygon);
    this.history.push({
      mode: 'polygon',
      action: 'complete',
      entity: polygon,
    });
    this.clearTemporaryEntities();
    this.positions = [];
    this.measureInfo.area = 0;
  }

  /**
   * 更新临时矩形
   */
  updateTemporaryRectangle(origin, corner) {
    if (!origin || !corner) {
      this.clearTemporaryEntities();
      this.measureInfo.area = 0;
      return;
    }

    // 计算矩形四个顶点
    const positions = [
      [origin[0], origin[1], origin[2] || 0],
      [corner[0], origin[1], origin[2] || 0],
      [corner[0], corner[1], origin[2] || 0],
      [origin[0], corner[1], origin[2] || 0],
      [origin[0], origin[1], origin[2] || 0], // 闭合多边形
    ];

    this.measureInfo.area = this.calculatePolygonArea(positions);

    if (this.tempEntities.length > 0 && this.tempEntities[0].polygon) {
      this.tempEntities[0].polygon.hierarchy = new Cesium.CallbackProperty(() => {
        return new Cesium.PolygonHierarchy(
          positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
        );
      }, false);
    } else {
      this.clearTemporaryEntities();

      const rectangle = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(
            positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
          ),
          material: new Cesium.Color(1, 0.5, 0, 0.3),
          outline: true,
          outlineColor: Cesium.Color.ORANGE,
        },
      });

      this.tempEntities.push(rectangle);
    }
  }

  /**
   * 完成矩形绘制
   */
  finishDrawingRectangle() {
    if (!this.positions || this.positions.length < 2) {
      console.log('需要2个对角点来绘制矩形');
      return;
    }

    const origin = this.positions[0];
    const corner = this.positions[1];

    // 计算矩形四个顶点
    const positions = [
      [origin[0], origin[1], origin[2] || 0],
      [corner[0], origin[1], origin[2] || 0],
      [corner[0], corner[1], origin[2] || 0],
      [origin[0], corner[1], origin[2] || 0],
      [origin[0], origin[1], origin[2] || 0], // 闭合多边形
    ];

    const area = this.calculatePolygonArea(positions);
    const center = this.calculatePolygonCenter(positions);

    const rectangle = this.viewer.entities.add({
      name: `矩形_${this.entities.length + 1}`,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(
          positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
        ),
        material: new Cesium.Color(1, 0.5, 0, 0.3),
        outline: true,
        outlineColor: Cesium.Color.ORANGE,
      },
      label: {
        text: `面积: ${(area / 10000).toFixed(2)}平方米`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      },
      properties: {
        type: 'rectangle',
        coordinates: positions,
        area: area,
      },
    });

    rectangle.label.position = Cesium.Cartesian3.fromDegrees(center[0], center[1], 10);

    this.entities.push(rectangle);
    this.history.push({
      mode: 'rectangle',
      action: 'complete',
      entity: rectangle,
    });
    this.clearTemporaryEntities();
    this.positions = [];
    this.measureInfo.area = 0;
  }

  /**
   * 更新临时圆形
   */
  updateTemporaryCircle(center, edgePoint) {
    if (!center || !edgePoint) {
      this.clearTemporaryEntities();
      this.measureInfo.area = 0;
      return;
    }

    // 计算半径
    const radius = this.calculateDistance(center, edgePoint);

    //更新矩形半径
    this.measureInfo.radius = radius;

    // 计算圆形面积
    this.measureInfo.area = Math.PI * radius * radius;

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

    if (this.tempEntities.length > 0 && this.tempEntities[0].polygon) {
      this.tempEntities[0].polygon.hierarchy = new Cesium.CallbackProperty(() => {
        return new Cesium.PolygonHierarchy(
          positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
        );
      }, false);
    } else {
      this.clearTemporaryEntities();

      const circle = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(
            positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
          ),
          material: new Cesium.Color(0.5, 0, 1, 0.3),
          outline: true,
          outlineColor: Cesium.Color.PURPLE,
        },
      });

      this.tempEntities.push(circle);
    }
  }

  /**
   * 完成圆形绘制
   */
  finishDrawingCircle() {
    if (!this.positions || this.positions.length < 2) {
      console.log('需要圆心和边缘点来绘制圆形');
      return;
    }

    const center = this.positions[0];
    const edgePoint = this.positions[1];

    // 计算半径
    const radius = this.calculateDistance(center, edgePoint);

    // 计算圆形面积
    const area = Math.PI * radius * radius;

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

    const circle = this.viewer.entities.add({
      name: `圆形_${this.entities.length + 1}`,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(
          positions.map((p) => Cesium.Cartesian3.fromDegrees(p[0], p[1], p[2] || 0))
        ),
        material: new Cesium.Color(0.5, 0, 1, 0.3),
        outline: true,
        outlineColor: Cesium.Color.PURPLE,
      },
      label: {
        // 只显示面积，不显示半径
        text: `面积: ${(area / 10000).toFixed(2)}平方米`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, -20),
      },
      properties: {
        type: 'circle',
        center: center,
        radius: radius, // 保留半径属性供内部使用
        area: area,
      },
    });

    circle.label.position = Cesium.Cartesian3.fromDegrees(center[0], center[1], 10);

    this.entities.push(circle);
    console.log('this.entities', this.entities);
    this.history.push({
      mode: 'circle',
      action: 'complete',
      entity: circle,
    });
    this.clearTemporaryEntities();
    this.positions = [];
    this.measureInfo.area = 0;
  }

  //导出KML工具类
  exportKML(drawingMode) {
    KmlExporter.exportKML(drawingMode, this.viewer, this.entities);
  }

  /**
   * 计算两点之间的距离(米)
   */
  calculateDistance(point1, point2) {
    if (!point1 || !point2) return 0;

    const R = 6371000; // 地球半径(米)
    const φ1 = (point1[1] * Math.PI) / 180;
    const φ2 = (point2[1] * Math.PI) / 180;
    const Δφ = ((point2[1] - point1[1]) * Math.PI) / 180;
    const Δλ = ((point2[0] - point1[0]) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 计算线的总长度(米)
   */
  calculateLineLength(points) {
    if (!points || points.length < 2) return 0;

    let totalLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalLength += this.calculateDistance(points[i], points[i + 1]);
    }
    return totalLength;
  }

  /**
   * 计算多边形面积(平方米)
   */
  calculatePolygonArea(points) {
    if (!points || points.length < 3) return 0;

    const R = 6378137; // WGS84地球半径(米)
    let area = 0;
    const rad = Math.PI / 180;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const lon1 = points[i][0] * rad;
      const lat1 = points[i][1] * rad;
      const lon2 = points[j][0] * rad;
      const lat2 = points[j][1] * rad;

      const temp = (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
      area += temp;
    }

    area = (area * R * R) / 2;
    return Math.abs(area);
  }

  /**
   * 计算多边形中心坐标
   */
  calculatePolygonCenter(points) {
    if (!points || points.length === 0) return [0, 0];

    let lonSum = 0,
      latSum = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      lonSum += points[i][0];
      latSum += points[i][1];
    }

    return [lonSum / n, latSum / n];
  }

  /**
   * 销毁工具，清理资源
   */
  destroy() {
    this.exitEditingMode();
    this.handler.destroy();
    if (this.hintElement && this.hintElement.parentElement) {
      this.hintElement.parentElement.removeChild(this.hintElement);
    }
    this.entities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.entities = [];
    this.tempEntities = [];
    this.history = [];
  }
}

// 添加默认导出
export default CesiumDrawingTool;
