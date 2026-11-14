/**
 * EduBoard Canvas Drawing Engine
 * Manages drawing layers, smooth strokes, drawing over PDF/Images,
 * multi-page management with page deletion, and laser trails.
 */

class WhiteboardCanvas {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.bgCanvas = document.getElementById('bg-canvas');
    this.mainCanvas = document.getElementById('main-canvas');
    this.overlayCanvas = document.getElementById('overlay-canvas');
    this.laserCanvas = document.getElementById('laser-canvas');

    this.bgCtx = this.bgCanvas.getContext('2d');
    this.mainCtx = this.mainCanvas.getContext('2d');
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.laserCtx = this.laserCanvas.getContext('2d');

    this.scale = 1.0;
    this.minScale = 0.2;
    this.maxScale = 5.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startPanPoint = { x: 0, y: 0 };

    this.tool = 'pen';
    this.strokeColor = '#38bdf8';
    this.strokeWidth = 3;
    this.fillColor = 'transparent';
    this.activeShape = 'line';

    this.bgColor = '#0b132b';
    this.bgPattern = 'dot-grid';

    this.isDrawing = false;
    this.currentPoints = [];
    this.drawHistory = [];
    this.redoHistory = [];

    this.laserPoints = [];
    this.laserAnimationId = null;

    // Multi-page system
    this.pages = [
      { id: 1, history: [], bgColor: '#0b132b', bgPattern: 'dot-grid', panX: 0, panY: 0, scale: 1.0, objects: [] }
    ];
    this.currentPageIndex = 0;

    this.init();
  }

  init() {
    this.resizeCanvases();
    window.addEventListener('resize', () => this.resizeCanvases());
    this.bindEvents();
    this.renderBackground();
    this.startLaserLoop();
  }

  resizeCanvases() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    [this.bgCanvas, this.mainCanvas, this.overlayCanvas, this.laserCanvas].forEach(canvas => {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
    });

    this.renderBackground();
    this.redrawMainCanvas();
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.scale,
      y: (screenY - this.panY) / this.scale
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.scale + this.panX,
      y: worldY * this.scale + this.panY
    };
  }

  bindEvents() {
    const vp = this.container;

    vp.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    vp.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    this.prevPinchDist = null;
    vp.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        this.isPanning = false;
        this.isDrawing = false;
        this.prevPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    vp.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.prevPinchDist) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const delta = dist / this.prevPinchDist;
        this.zoomAtPoint(midX, midY, delta);
        this.prevPinchDist = dist;
      }
    }, { passive: true });

    vp.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.prevPinchDist = null;
      }
    }, { passive: true });
  }

  onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoomAtPoint(e.clientX, e.clientY, zoomFactor);
    } else {
      this.panX -= e.deltaX;
      this.panY -= e.deltaY;
      this.renderBackground();
      this.redrawMainCanvas();
    }
  }

  zoomAtPoint(screenX, screenY, factor) {
    const newScale = Math.min(Math.max(this.scale * factor, this.minScale), this.maxScale);
    if (newScale === this.scale) return;

    const world = this.screenToWorld(screenX, screenY);
    this.scale = newScale;
    this.panX = screenX - world.x * this.scale;
    this.panY = screenY - world.y * this.scale;

    this.renderBackground();
    this.redrawMainCanvas();

    if (this.onZoomChange) {
      this.onZoomChange(Math.round(this.scale * 100));
    }
  }

  setZoom(percentage) {
    const centerScreenX = this.container.clientWidth / 2;
    const centerScreenY = this.container.clientHeight / 2;
    const targetScale = percentage / 100;
    this.zoomAtPoint(centerScreenX, centerScreenY, targetScale / this.scale);
  }

  resetView() {
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.renderBackground();
    this.redrawMainCanvas();
    if (this.onZoomChange) this.onZoomChange(100);
  }

  onPointerDown(e) {
    if (e.target.closest('.bottom-main-toolbar-container') || 
        e.target.closest('.bottom-left-recorder-dock') ||
        e.target.closest('.bottom-page-controls-dock') ||
        e.target.closest('.top-header-primary') ||
        e.target.closest('.top-ribbon-bar') ||
        e.target.closest('#tool-options-popup') ||
        e.target.closest('#shapes-popup') ||
        e.target.closest('.floating-widget') || 
        e.target.closest('.modal-overlay')) {
      return;
    }

    // In select mode, clicking on interactive controls (like buttons inside ruler) should not draw
    if (this.tool === 'select') {
      return;
    }

    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = this.screenToWorld(screenX, screenY);

    if (this.tool === 'pan' || e.button === 1 || e.spaceKey) {
      this.isPanning = true;
      this.startPanPoint = { x: screenX - this.panX, y: screenY - this.panY };
      this.container.classList.add('pan-mode');
      return;
    }

    if (this.tool === 'laser') {
      this.isDrawing = true;
      this.laserPoints.push({ x: screenX, y: screenY, time: Date.now() });
      return;
    }

    if (this.tool === 'text') {
      if (this.onTextRequest) {
        this.onTextRequest(world.x, world.y, screenX, screenY);
      }
      return;
    }

    if (this.tool === 'eraser') {
      this.isDrawing = true;
      this.eraseAtPoint(world.x, world.y);
      return;
    }

    if (['pen', 'highlighter', 'shape'].includes(this.tool)) {
      this.isDrawing = true;
      this.currentPoints = [{
        x: world.x,
        y: world.y,
        pressure: e.pressure || 0.5
      }];
    }
  }

  onPointerMove(e) {
    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (this.isPanning) {
      this.panX = screenX - this.startPanPoint.x;
      this.panY = screenY - this.startPanPoint.y;
      this.renderBackground();
      this.redrawMainCanvas();
      return;
    }

    if (this.tool === 'laser') {
      if (this.isDrawing) {
        this.laserPoints.push({ x: screenX, y: screenY, time: Date.now() });
      }
      return;
    }

    if (!this.isDrawing) return;

    const world = this.screenToWorld(screenX, screenY);

    if (this.tool === 'eraser') {
      this.eraseAtPoint(world.x, world.y);
      return;
    }

    if (this.tool === 'pen' || this.tool === 'highlighter') {
      this.currentPoints.push({
        x: world.x,
        y: world.y,
        pressure: e.pressure || 0.5
      });
      this.renderLiveStroke();
    } else if (this.tool === 'shape') {
      this.renderLiveShape(world.x, world.y);
    }
  }

  onPointerUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (this.tool === 'laser') {
      this.isDrawing = false;
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;

    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = this.screenToWorld(screenX, screenY);

    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    if (this.tool === 'pen' || this.tool === 'highlighter') {
      if (this.currentPoints.length > 1) {
        const item = {
          type: this.tool,
          points: [...this.currentPoints],
          color: this.strokeColor,
          width: this.strokeWidth,
          opacity: this.tool === 'highlighter' ? 0.38 : 1.0
        };
        this.executeAction(item);
      }
    } else if (this.tool === 'shape') {
      if (this.currentPoints.length > 0) {
        const start = this.currentPoints[0];
        const item = {
          type: 'shape',
          shape: this.activeShape,
          startX: start.x,
          startY: start.y,
          endX: world.x,
          endY: world.y,
          color: this.strokeColor,
          width: this.strokeWidth,
          fill: this.fillColor
        };
        this.executeAction(item);
      }
    }

    this.currentPoints = [];
  }

  renderLiveStroke() {
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (this.currentPoints.length < 2) return;

    this.overlayCtx.save();
    this.overlayCtx.translate(this.panX, this.panY);
    this.overlayCtx.scale(this.scale, this.scale);

    this.drawStrokePath(this.overlayCtx, {
      type: this.tool,
      points: this.currentPoints,
      color: this.strokeColor,
      width: this.strokeWidth,
      opacity: this.tool === 'highlighter' ? 0.38 : 1.0
    });

    this.overlayCtx.restore();
  }

  renderLiveShape(endX, endY) {
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (this.currentPoints.length === 0) return;

    const start = this.currentPoints[0];

    this.overlayCtx.save();
    this.overlayCtx.translate(this.panX, this.panY);
    this.overlayCtx.scale(this.scale, this.scale);

    this.drawShape(this.overlayCtx, {
      shape: this.activeShape,
      startX: start.x,
      startY: start.y,
      endX: endX,
      endY: endY,
      color: this.strokeColor,
      width: this.strokeWidth,
      fill: this.fillColor
    });

    this.overlayCtx.restore();
  }

  drawStrokePath(ctx, item) {
    const pts = item.points;
    if (!pts || pts.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = item.color;
    ctx.lineWidth = item.width;
    ctx.globalAlpha = item.opacity || 1.0;

    if (item.type === 'highlighter') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = item.width * 3;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }

    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  drawShape(ctx, item) {
    const { shape, startX, startY, endX, endY, color, width, fill } = item;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = fill || 'transparent';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    switch (shape) {
      case 'line':
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        break;

      case 'arrow':
        this.drawArrow(ctx, startX, startY, endX, endY, false);
        break;

      case 'rect':
        const rx = Math.min(startX, endX);
        const ry = Math.min(startY, endY);
        const rw = Math.abs(endX - startX);
        const rh = Math.abs(endY - startY);
        if (fill && fill !== 'transparent') ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
        break;

      case 'circle':
        const radius = Math.hypot(endX - startX, endY - startY);
        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        if (fill && fill !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'ellipse':
        const cx = (startX + endX) / 2;
        const cy = (startY + endY) / 2;
        const rX = Math.abs(endX - startX) / 2;
        const rY = Math.abs(endY - startY) / 2;
        ctx.ellipse(cx, cy, Math.max(rX, 1), Math.max(rY, 1), 0, 0, Math.PI * 2);
        if (fill && fill !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'triangle':
        ctx.moveTo(startX + (endX - startX) / 2, startY);
        ctx.lineTo(startX, endY);
        ctx.lineTo(endX, endY);
        ctx.closePath();
        if (fill && fill !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'hexagon':
        this.drawHexagon(ctx, startX, startY, endX, endY, fill);
        break;

      case 'axes':
      case 'grid':
        this.drawCoordinateAxes(ctx, startX, startY, endX, endY);
        break;
    }

    ctx.restore();
  }

  drawHexagon(ctx, x1, y1, x2, y2, fill) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const r = Math.hypot(x2 - x1, y2 - y1) / 2;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const hx = cx + r * Math.cos(angle);
      const hy = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    if (fill && fill !== 'transparent') ctx.fill();
    ctx.stroke();
  }

  drawArrow(ctx, fromX, fromY, toX, toY, doubleEnded = false) {
    const headlen = 16;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  drawCoordinateAxes(ctx, x1, y1, x2, y2) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    this.drawArrow(ctx, x1, cy, x2, cy, false);
    this.drawArrow(ctx, cx, y2, cx, y1, false);

    const step = 30;
    ctx.lineWidth = 1;
    for (let x = cx + step; x < x2 - 20; x += step) {
      ctx.beginPath(); ctx.moveTo(x, cy - 4); ctx.lineTo(x, cy + 4); ctx.stroke();
    }
    for (let x = cx - step; x > x1 + 20; x -= step) {
      ctx.beginPath(); ctx.moveTo(x, cy - 4); ctx.lineTo(x, cy + 4); ctx.stroke();
    }
    for (let y = cy + step; y < y2 - 20; y += step) {
      ctx.beginPath(); ctx.moveTo(cx - 4, y); ctx.lineTo(cx + 4, y); ctx.stroke();
    }
    for (let y = cy - step; y > y1 + 20; y -= step) {
      ctx.beginPath(); ctx.moveTo(cx - 4, y); ctx.lineTo(cx + 4, y); ctx.stroke();
    }
  }

  eraseAtPoint(worldX, worldY) {
    const threshold = 18 / this.scale;
    const initialLen = this.drawHistory.length;

    this.drawHistory = this.drawHistory.filter(item => {
      if (item.type === 'pen' || item.type === 'highlighter') {
        for (const pt of item.points) {
          if (Math.hypot(pt.x - worldX, pt.y - worldY) < threshold + item.width / 2) {
            return false;
          }
        }
      } else if (item.type === 'shape') {
        const midX = (item.startX + item.endX) / 2;
        const midY = (item.startY + item.endY) / 2;
        if (Math.hypot(midX - worldX, midY - worldY) < threshold * 2) {
          return false;
        }
      }
      return true;
    });

    if (this.drawHistory.length !== initialLen) {
      this.redrawMainCanvas();
    }
  }

  startLaserLoop() {
    const renderLaser = () => {
      const now = Date.now();
      const maxAge = 900;
      this.laserPoints = this.laserPoints.filter(p => now - p.time < maxAge);

      this.laserCtx.clearRect(0, 0, this.laserCanvas.width, this.laserCanvas.height);

      if (this.laserPoints.length > 1) {
        this.laserCtx.save();
        for (let i = 1; i < this.laserPoints.length; i++) {
          const p1 = this.laserPoints[i - 1];
          const p2 = this.laserPoints[i];
          const age = now - p2.time;
          const alpha = Math.max(0, 1 - age / maxAge);

          this.laserCtx.beginPath();
          this.laserCtx.moveTo(p1.x, p1.y);
          this.laserCtx.lineTo(p2.x, p2.y);
          this.laserCtx.strokeStyle = `rgba(244, 63, 94, ${alpha})`;
          this.laserCtx.shadowColor = '#f43f5e';
          this.laserCtx.shadowBlur = 14;
          this.laserCtx.lineWidth = 6 * alpha;
          this.laserCtx.lineCap = 'round';
          this.laserCtx.stroke();
        }

        const head = this.laserPoints[this.laserPoints.length - 1];
        this.laserCtx.beginPath();
        this.laserCtx.arc(head.x, head.y, 6, 0, Math.PI * 2);
        this.laserCtx.fillStyle = '#ff0055';
        this.laserCtx.shadowBlur = 18;
        this.laserCtx.fill();
        this.laserCtx.restore();
      }

      this.laserAnimationId = requestAnimationFrame(renderLaser);
    };

    renderLaser();
  }

  renderBackground() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.bgCtx.clearRect(0, 0, width, height);

    if (this.bgColor.startsWith('gradient-dark')) {
      const grad = this.bgCtx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#070d1e');
      grad.addColorStop(1, '#0b132b');
      this.bgCtx.fillStyle = grad;
    } else if (this.bgColor.startsWith('gradient-warm')) {
      const grad = this.bgCtx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#fffbeb');
      grad.addColorStop(1, '#fef3c7');
      this.bgCtx.fillStyle = grad;
    } else {
      this.bgCtx.fillStyle = this.bgColor;
    }
    this.bgCtx.fillRect(0, 0, width, height);

    if (this.bgPattern === 'blank') return;

    const isDark = this.bgColor === '#0b132b' || this.bgColor === '#070d1e' || this.bgColor === '#1e1e2f' || this.bgColor === '#134e4a' || this.bgColor === '#000000' || this.bgColor.startsWith('gradient-dark');
    const dotColor = isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(67, 97, 238, 0.14)';
    const lineColor = isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(67, 97, 238, 0.14)';
    const marginColor = 'rgba(239, 68, 68, 0.4)';

    this.bgCtx.save();

    const startX = this.panX % (36 * this.scale);
    const startY = this.panY % (36 * this.scale);
    const step = 32 * this.scale;

    if (this.bgPattern === 'dot-grid') {
      this.bgCtx.fillStyle = dotColor;
      for (let x = startX; x < width; x += step) {
        for (let y = startY; y < height; y += step) {
          this.bgCtx.beginPath();
          this.bgCtx.arc(x, y, 1.4 * Math.min(this.scale, 1.4), 0, Math.PI * 2);
          this.bgCtx.fill();
        }
      }
    } else if (this.bgPattern === 'math-grid') {
      this.bgCtx.strokeStyle = lineColor;
      this.bgCtx.lineWidth = 1;

      for (let x = startX; x < width; x += step) {
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(x, 0);
        this.bgCtx.lineTo(x, height);
        this.bgCtx.stroke();
      }
      for (let y = startY; y < height; y += step) {
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(0, y);
        this.bgCtx.lineTo(width, y);
        this.bgCtx.stroke();
      }
    } else if (this.bgPattern === 'lined' || this.bgPattern === 'arabic-lined') {
      this.bgCtx.strokeStyle = lineColor;
      this.bgCtx.lineWidth = 1.2;

      for (let y = startY; y < height; y += step * 1.1) {
        this.bgCtx.beginPath();
        this.bgCtx.moveTo(0, y);
        this.bgCtx.lineTo(width, y);
        this.bgCtx.stroke();
      }

      this.bgCtx.strokeStyle = marginColor;
      this.bgCtx.lineWidth = 2;
      const marginX = this.bgPattern === 'arabic-lined' ? width - 80 * this.scale : 80 * this.scale;
      this.bgCtx.beginPath();
      this.bgCtx.moveTo(marginX, 0);
      this.bgCtx.lineTo(marginX, height);
      this.bgCtx.stroke();
    }

    this.bgCtx.restore();
  }

  redrawMainCanvas() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.mainCtx.clearRect(0, 0, width, height);

    this.mainCtx.save();
    this.mainCtx.translate(this.panX, this.panY);
    this.mainCtx.scale(this.scale, this.scale);

    for (const item of this.drawHistory) {
      if (item.type === 'pen' || item.type === 'highlighter') {
        this.drawStrokePath(this.mainCtx, item);
      } else if (item.type === 'shape') {
        this.drawShape(this.mainCtx, item);
      }
    }

    this.mainCtx.restore();
  }

  executeAction(item) {
    this.drawHistory.push(item);
    this.redoHistory = [];
    this.redrawMainCanvas();
  }

  undo() {
    if (this.drawHistory.length === 0) return;
    const item = this.drawHistory.pop();
    this.redoHistory.push(item);
    this.redrawMainCanvas();
  }

  redo() {
    if (this.redoHistory.length === 0) return;
    const item = this.redoHistory.pop();
    this.drawHistory.push(item);
    this.redrawMainCanvas();
  }

  clearAll() {
    this.drawHistory = [];
    this.redoHistory = [];
    this.redrawMainCanvas();
  }

  setBackground(color, pattern) {
    if (color) this.bgColor = color;
    if (pattern) this.bgPattern = pattern;
    this.renderBackground();
  }

  // Multi-Page Management
  addPage() {
    this.saveCurrentPageState();
    const newPage = {
      id: this.pages.length + 1,
      history: [],
      bgColor: this.bgColor,
      bgPattern: this.bgPattern,
      panX: 0,
      panY: 0,
      scale: 1.0,
      objects: []
    };
    this.pages.push(newPage);
    this.currentPageIndex = this.pages.length - 1;
    this.loadCurrentPage();
  }

  deleteCurrentPage() {
    if (this.pages.length <= 1) {
      this.clearAll();
      return;
    }
    this.pages.splice(this.currentPageIndex, 1);
    if (this.currentPageIndex >= this.pages.length) {
      this.currentPageIndex = this.pages.length - 1;
    }
    this.loadCurrentPage();
  }

  switchPage(index) {
    if (index < 0 || index >= this.pages.length || index === this.currentPageIndex) return;
    this.saveCurrentPageState();
    this.currentPageIndex = index;
    this.loadCurrentPage();
  }

  saveCurrentPageState() {
    if (!this.pages[this.currentPageIndex]) return;
    this.pages[this.currentPageIndex] = {
      ...this.pages[this.currentPageIndex],
      history: [...this.drawHistory],
      bgColor: this.bgColor,
      bgPattern: this.bgPattern,
      panX: this.panX,
      panY: this.panY,
      scale: this.scale
    };
  }

  loadCurrentPage() {
    const page = this.pages[this.currentPageIndex];
    if (!page) return;
    this.drawHistory = [...page.history];
    this.redoHistory = [];
    this.bgColor = page.bgColor;
    this.bgPattern = page.bgPattern;
    this.panX = page.panX || 0;
    this.panY = page.panY || 0;
    this.scale = page.scale || 1.0;

    this.renderBackground();
    this.redrawMainCanvas();
  }
}
