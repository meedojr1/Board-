/**
 * EduBoard Canvas Objects Manager
 * Handles interactive objects (Images, PDF pages, Sticky Notes, Text boxes, Formulas, Rulers, Protractor)
 * with direct drawing over images, rotation, drag, locking, and instant deletion.
 */

class ObjectManager {
  constructor(containerId, canvasEngine) {
    this.container = document.getElementById(containerId);
    this.canvasEngine = canvasEngine;
    this.objects = [];
    this.selectedObject = null;
    this.nextId = 1;

    this.bindGlobalEvents();
  }

  bindGlobalEvents() {
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.board-object') && 
          !e.target.closest('.bottom-main-toolbar-container') && 
          !e.target.closest('#tool-options-popup') && 
          !e.target.closest('#shapes-popup') && 
          !e.target.closest('.object-action-bar') && 
          !e.target.closest('.modal-overlay')) {
        this.deselectAll();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!this.selectedObject) return;
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.removeObject(this.selectedObject.id);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        this.duplicateObject(this.selectedObject.id);
      }
    });
  }

  // Toggle pointer events on objects when switching between Select mode and Drawing mode
  updatePointerEventsMode(toolName) {
    const isSelect = toolName === 'select';
    const container = this.container;
    
    // In drawing/erasing/laser mode, the entire objects-container should let
    // pointer events fall through to the canvas underneath.
    // Only in 'select' or 'text' mode do we allow interactions with objects.
    const allowObjectInteractions = (toolName === 'select' || toolName === 'text');
    
    this.objects.forEach(obj => {
      if (obj.type === 'image' || obj.type === 'pdf-page') {
        // Media objects always let pointer through except in select mode
        obj.element.style.pointerEvents = allowObjectInteractions ? 'auto' : 'none';
      } else {
        // Text, sticky notes, rulers etc — allow interactions always except in pure drawing mode
        obj.element.style.pointerEvents = (toolName === 'pen' || toolName === 'highlighter' || toolName === 'shape' || toolName === 'eraser' || toolName === 'laser') ? 'none' : 'auto';
      }
    });

    // Also toggle the container itself
    if (container) {
      container.style.pointerEvents = allowObjectInteractions ? 'auto' : 'none';
    }
  }

  deselectAll() {
    this.objects.forEach(obj => {
      obj.element.classList.remove('selected');
    });
    this.selectedObject = null;
  }

  selectObject(obj) {
    this.deselectAll();
    this.selectedObject = obj;
    obj.element.classList.add('selected');
    this.bringToFront(obj.id);
  }

  addObject(type, data = {}) {
    const id = `obj_${this.nextId++}`;
    const el = document.createElement('div');
    el.className = 'board-object';
    el.id = id;

    const viewportCenterX = this.container.clientWidth / 2;
    const viewportCenterY = this.container.clientHeight / 2;
    const worldPos = this.canvasEngine.screenToWorld(viewportCenterX, viewportCenterY);

    const obj = {
      id,
      type,
      x: data.x !== undefined ? data.x : worldPos.x - 140,
      y: data.y !== undefined ? data.y : worldPos.y - 70,
      width: data.width || (type === 'ruler-tool' ? 520 : type === 'protractor-tool' ? 360 : type === 'stem' ? 320 : 260),
      height: data.height || (type === 'ruler-tool' ? 90 : type === 'protractor-tool' ? 190 : type === 'stem' ? 110 : 160),
      rotation: data.rotation || 0,
      locked: false,
      element: el,
      data: { ...data }
    };

    this.renderObjectContent(obj);
    this.setupObjectInteractions(obj);
    this.container.appendChild(el);
    this.objects.push(obj);

    this.updateObjectPosition(obj);
    this.selectObject(obj);

    return obj;
  }

  renderObjectContent(obj) {
    const el = obj.element;
    el.innerHTML = '';

    // Action Toolbar for standard objects
    if (obj.type !== 'ruler-tool' && obj.type !== 'protractor-tool') {
      const actionBar = document.createElement('div');
      actionBar.className = 'object-action-bar';
      actionBar.innerHTML = `
        <button class="object-action-btn btn-delete" title="حذف العنصر" style="color: #fb7185;"><i class="fas fa-trash-alt"></i></button>
        <button class="object-action-btn btn-front" title="إلى الأمام"><i class="fas fa-arrow-up"></i></button>
        <button class="object-action-btn btn-rotate" title="تدوير"><i class="fas fa-redo"></i></button>
        <button class="object-action-btn btn-lock" title="قفل / إلغاء القفل"><i class="fas fa-lock-open"></i></button>
        <button class="object-action-btn btn-duplicate" title="نسخ مضاعف"><i class="fas fa-copy"></i></button>
      `;

      const deleteBtn = actionBar.querySelector('.btn-delete');
      const onDelete = (e) => { e.stopPropagation(); e.preventDefault(); this.removeObject(obj.id); };
      deleteBtn.addEventListener('pointerdown', onDelete);
      deleteBtn.addEventListener('click', onDelete);

      const lockBtn = actionBar.querySelector('.btn-lock');
      const onLock = (e) => {
        e.stopPropagation();
        e.preventDefault();
        obj.locked = !obj.locked;
        const icon = lockBtn.querySelector('i');
        icon.className = obj.locked ? 'fas fa-lock' : 'fas fa-lock-open';
      };
      lockBtn.addEventListener('pointerdown', onLock);
      lockBtn.addEventListener('click', onLock);

      const rotateBtn = actionBar.querySelector('.btn-rotate');
      const onRotate = (e) => {
        e.stopPropagation();
        e.preventDefault();
        obj.rotation = (obj.rotation + 45) % 360;
        this.updateObjectPosition(obj);
      };
      rotateBtn.addEventListener('pointerdown', onRotate);
      rotateBtn.addEventListener('click', onRotate);

      const frontBtn = actionBar.querySelector('.btn-front');
      const onFront = (e) => { e.stopPropagation(); e.preventDefault(); this.bringToFront(obj.id); };
      frontBtn.addEventListener('pointerdown', onFront);
      frontBtn.addEventListener('click', onFront);

      const dupBtn = actionBar.querySelector('.btn-duplicate');
      const onDup = (e) => { e.stopPropagation(); e.preventDefault(); this.duplicateObject(obj.id); };
      dupBtn.addEventListener('pointerdown', onDup);
      dupBtn.addEventListener('click', onDup);

      el.appendChild(actionBar);

      ['nw', 'ne', 'sw', 'se'].forEach(dir => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${dir}`;
        handle.dataset.handle = dir;
        el.appendChild(handle);
      });
    }

    const content = document.createElement('div');
    content.className = 'object-inner-content';
    content.style.width = '100%';
    content.style.height = '100%';

    if (obj.type === 'image' || obj.type === 'pdf-page') {
      const img = document.createElement('img');
      img.src = obj.data.src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.pointerEvents = 'none';
      content.appendChild(img);
    } else if (obj.type === 'sticky') {
      const card = document.createElement('div');
      card.className = 'sticky-note-card';
      card.style.backgroundColor = obj.data.color || '#fef08a';
      card.style.width = '100%';
      card.style.height = '100%';
      card.style.borderRadius = '10px';
      card.style.padding = '12px';
      card.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';

      const textarea = document.createElement('textarea');
      textarea.className = 'sticky-note-textarea';
      textarea.placeholder = 'اكتب ملاحظة هنا...';
      textarea.value = obj.data.text || '';
      textarea.style.width = '100%';
      textarea.style.height = '100%';
      textarea.style.background = 'transparent';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.resize = 'none';
      textarea.style.fontFamily = 'inherit';
      textarea.style.fontSize = '1.05rem';
      textarea.style.fontWeight = '700';
      textarea.style.color = '#0f172a';
      textarea.addEventListener('input', (e) => { obj.data.text = e.target.value; });

      card.appendChild(textarea);
      content.appendChild(card);
    } else if (obj.type === 'text') {
      const textBox = document.createElement('div');
      textBox.className = 'board-text-content';
      textBox.contentEditable = true;
      textBox.innerText = obj.data.text || 'انقر هنا لكتابة نص';
      textBox.style.fontSize = (obj.data.fontSize || 26) + 'px';
      textBox.style.color = obj.data.color || '#38bdf8';
      textBox.style.fontWeight = '800';
      textBox.style.padding = '8px 12px';
      textBox.style.background = 'rgba(11, 19, 43, 0.75)';
      textBox.style.border = '1.5px dashed #38bdf8';
      textBox.style.borderRadius = '8px';
      textBox.style.minWidth = '120px';
      textBox.style.minHeight = '48px';
      textBox.style.cursor = 'text';

      textBox.addEventListener('input', (e) => { obj.data.text = e.target.innerText; });
      content.appendChild(textBox);

      setTimeout(() => {
        textBox.focus();
        if (document.createRange && window.getSelection) {
          const range = document.createRange();
          range.selectNodeContents(textBox);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 50);
    } else if (obj.type === 'stem') {
      const mathBox = document.createElement('div');
      mathBox.className = 'board-stem-box';
      mathBox.style.width = '100%';
      mathBox.style.height = '100%';
      mathBox.style.padding = '14px 18px';
      mathBox.style.background = '#111d38';
      mathBox.style.borderRadius = '12px';
      mathBox.style.border = '2px solid #38bdf8';
      mathBox.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6), 0 0 14px rgba(56, 189, 248, 0.3)';
      mathBox.style.display = 'flex';
      mathBox.style.alignItems = 'center';
      mathBox.style.justifyContent = 'center';
      mathBox.style.color = '#ffffff';
      mathBox.style.fontSize = '1.4rem';
      mathBox.style.overflow = 'hidden';

      if (window.katex && obj.data.latex) {
        try {
          katex.render(obj.data.latex, mathBox, { displayMode: true, throwOnError: false });
        } catch (e) {
          mathBox.innerText = obj.data.latex;
        }
      } else {
        mathBox.innerText = obj.data.latex || obj.data.title;
      }
      content.appendChild(mathBox);
    } else if (obj.type === 'ruler-tool') {
      // Interactive Realistic Ruler (مطابق تماماً للصورة 3)
      const rulerBox = document.createElement('div');
      rulerBox.className = 'interactive-ruler-box';

      const ticksContainer = document.createElement('div');
      ticksContainer.className = 'ruler-ticks-container';

      const totalCm = 20;
      for (let cm = 0; cm <= totalCm; cm++) {
        const leftPercent = (cm / totalCm) * 94 + 3;

        const cmTick = document.createElement('div');
        cmTick.className = 'ruler-tick cm';
        cmTick.style.left = `${leftPercent}%`;
        ticksContainer.appendChild(cmTick);

        const numLabel = document.createElement('span');
        numLabel.className = 'ruler-number-label';
        numLabel.style.left = `${leftPercent}%`;
        numLabel.innerText = cm;
        ticksContainer.appendChild(numLabel);

        if (cm < totalCm) {
          for (let mm = 1; mm <= 9; mm++) {
            const mmPercent = leftPercent + ((mm / 10) * (94 / totalCm));
            const mmTick = document.createElement('div');
            mmTick.className = `ruler-tick ${mm === 5 ? 'half-cm' : 'mm'}`;
            mmTick.style.left = `${mmPercent}%`;
            ticksContainer.appendChild(mmTick);
          }
        }
      }

      rulerBox.appendChild(ticksContainer);

      const bottomBar = document.createElement('div');
      bottomBar.className = 'ruler-bottom-bar';
      bottomBar.innerHTML = `
        <span class="ruler-title-text">(cm) مسطرة هندسية</span>
        <div class="ruler-controls-group">
          <button class="btn-ruler-rotate" title="تدوير المسطرة 15 درجة">تدوير 🔄</button>
          <button class="btn-ruler-close" title="إغلاق المسطرة">✕</button>
        </div>
      `;

      const onRulerRotate = (e) => {
        e.stopPropagation();
        e.preventDefault();
        obj.rotation = (obj.rotation + 15) % 360;
        this.updateObjectPosition(obj);
      };
      const rotateBtn = bottomBar.querySelector('.btn-ruler-rotate');
      rotateBtn.addEventListener('pointerdown', onRulerRotate);
      rotateBtn.addEventListener('click', onRulerRotate);

      const onRulerClose = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.removeObject(obj.id);
      };
      const closeBtn = bottomBar.querySelector('.btn-ruler-close');
      closeBtn.addEventListener('pointerdown', onRulerClose);
      closeBtn.addEventListener('click', onRulerClose);

      rulerBox.appendChild(bottomBar);
      content.appendChild(rulerBox);
    } else if (obj.type === 'protractor-tool') {
      // Interactive Protractor (منقلة هندسية 180 درجة)
      const protractorBox = document.createElement('div');
      protractorBox.className = 'interactive-protractor-box';

      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 190;
      const ctx = canvas.getContext('2d');

      const cx = 180;
      const cy = 180;
      const r = 160;

      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 0, false);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0284c7';
      ctx.stroke();

      for (let deg = 0; deg <= 180; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const is10 = deg % 10 === 0;
        const len = is10 ? 18 : 10;
        const x1 = cx - r * Math.cos(rad);
        const y1 = cy - r * Math.sin(rad);
        const x2 = cx - (r - len) * Math.cos(rad);
        const y2 = cy - (r - len) * Math.sin(rad);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = is10 ? '#0f172a' : '#64748b';
        ctx.lineWidth = is10 ? 1.5 : 1;
        ctx.stroke();

        if (is10 && deg > 0 && deg < 180) {
          const tx = cx - (r - 28) * Math.cos(rad);
          const ty = cy - (r - 28) * Math.sin(rad);
          ctx.font = 'bold 9px Arial';
          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(deg.toString(), tx, ty);
        }
      }

      protractorBox.appendChild(canvas);

      const centerDot = document.createElement('div');
      centerDot.className = 'protractor-center-origin';
      protractorBox.appendChild(centerDot);

      const controls = document.createElement('div');
      controls.className = 'protractor-bottom-controls';
      controls.innerHTML = `
        <span style="font-size: 0.72rem; font-weight: 800;">منقلة 180°</span>
        <button class="btn-protractor-rotate" style="background: #f59e0b; color: #000; border: none; border-radius: 4px; padding: 2px 6px; font-weight: 800; cursor: pointer;">تدوير 🔄</button>
        <button class="btn-protractor-close" style="background: none; border: none; color: white; font-weight: 800; cursor: pointer; font-size: 1rem;">✕</button>
      `;

      const onProtRotate = (e) => {
        e.stopPropagation();
        e.preventDefault();
        obj.rotation = (obj.rotation + 15) % 360;
        this.updateObjectPosition(obj);
      };
      const protRotateBtn = controls.querySelector('.btn-protractor-rotate');
      protRotateBtn.addEventListener('pointerdown', onProtRotate);
      protRotateBtn.addEventListener('click', onProtRotate);

      const onProtClose = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.removeObject(obj.id);
      };
      const protCloseBtn = controls.querySelector('.btn-protractor-close');
      protCloseBtn.addEventListener('pointerdown', onProtClose);
      protCloseBtn.addEventListener('click', onProtClose);

      protractorBox.appendChild(controls);
      content.appendChild(protractorBox);
    }

    el.appendChild(content);
  }

  setupObjectInteractions(obj) {
    const el = obj.element;

    el.addEventListener('pointerdown', (e) => {
      if (obj.locked) return;
      if (e.target.closest('.object-action-bar') || 
          e.target.closest('.ruler-controls-group') || 
          e.target.closest('.protractor-bottom-controls') ||
          e.target.tagName === 'BUTTON') {
        return;
      }

      e.stopPropagation();
      this.selectObject(obj);

      const isResizeHandle = e.target.classList.contains('resize-handle');
      const handleType = isResizeHandle ? e.target.dataset.handle : null;

      const startScreenX = e.clientX;
      const startScreenY = e.clientY;
      const startX = obj.x;
      const startY = obj.y;
      const startWidth = obj.width;
      const startHeight = obj.height;
      const scale = this.canvasEngine.scale;

      const onPointerMove = (moveEvt) => {
        const deltaX = (moveEvt.clientX - startScreenX) / scale;
        const deltaY = (moveEvt.clientY - startScreenY) / scale;

        if (isResizeHandle) {
          if (handleType === 'se') {
            obj.width = Math.max(80, startWidth + deltaX);
            obj.height = Math.max(50, startHeight + deltaY);
          } else if (handleType === 'sw') {
            const newW = Math.max(80, startWidth - deltaX);
            obj.x = startX + (startWidth - newW);
            obj.width = newW;
            obj.height = Math.max(50, startHeight + deltaY);
          } else if (handleType === 'ne') {
            obj.width = Math.max(80, startWidth + deltaX);
            const newH = Math.max(50, startHeight - deltaY);
            obj.y = startY + (startHeight - newH);
            obj.height = newH;
          } else if (handleType === 'nw') {
            const newW = Math.max(80, startWidth - deltaX);
            const newH = Math.max(50, startHeight - deltaY);
            obj.x = startX + (startWidth - newW);
            obj.y = startY + (startHeight - newH);
            obj.width = newW;
            obj.height = newH;
          }
        } else {
          obj.x = startX + deltaX;
          obj.y = startY + deltaY;
        }

        this.updateObjectPosition(obj);
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  updateObjectPosition(obj) {
    const screen = this.canvasEngine.worldToScreen(obj.x, obj.y);
    const scale = this.canvasEngine.scale;

    obj.element.style.left = `${screen.x}px`;
    obj.element.style.top = `${screen.y}px`;
    obj.element.style.width = `${obj.width * scale}px`;
    obj.element.style.height = `${obj.height * scale}px`;
    obj.element.style.transform = `rotate(${obj.rotation}deg)`;
  }

  updateAllPositions() {
    this.objects.forEach(obj => this.updateObjectPosition(obj));
  }

  bringToFront(id) {
    const obj = this.objects.find(o => o.id === id);
    if (!obj) return;
    this.container.appendChild(obj.element);
  }

  duplicateObject(id) {
    const original = this.objects.find(o => o.id === id);
    if (!original) return;
    this.addObject(original.type, {
      ...original.data,
      x: original.x + 30,
      y: original.y + 30,
      width: original.width,
      height: original.height,
      rotation: original.rotation
    });
  }

  removeObject(id) {
    const index = this.objects.findIndex(o => o.id === id);
    if (index === -1) return;
    const obj = this.objects[index];
    obj.element.remove();
    this.objects.splice(index, 1);
    if (this.selectedObject?.id === id) {
      this.selectedObject = null;
    }
  }

  clearAll() {
    this.objects.forEach(obj => obj.element.remove());
    this.objects = [];
    this.selectedObject = null;
  }
}
