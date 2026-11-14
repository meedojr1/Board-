/**
 * EduBoard Main Application Controller
 * Complete interactive Arabic digital classroom whiteboard controls.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Core Systems
  const canvasEngine = new WhiteboardCanvas('canvas-viewport');
  const objectManager = new ObjectManager('objects-container', canvasEngine);
  const pdfHandler = new PDFMediaHandler(canvasEngine, objectManager);
  const exportManager = new ExportManager(canvasEngine, objectManager);
  const stemLibrary = new STEMLibrary(objectManager);
  const classroomWidgets = new ClassroomWidgets(canvasEngine, objectManager);
  const recorder = new LessonRecorder();
  const calculator = new ScientificCalculator('calculator-widget', canvasEngine, objectManager);

  // Initialize pointer events: default tool is 'pen', so objects-container must be transparent
  objectManager.updatePointerEventsMode('pen');

  // Gentle Classroom Audio Feedback Synthesizer
  let audioCtx = null;
  const playClickSound = (type = 'click') => {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'click') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.5, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
    } catch(e) {}
  };

  // Sync objects on zoom/pan
  canvasEngine.onZoomChange = (zoomLevel) => {
    const zoomEl = document.getElementById('zoom-percentage-dock');
    if (zoomEl) zoomEl.innerText = `${zoomLevel}%`;
    objectManager.updateAllPositions();
  };

  const origRedraw = canvasEngine.redrawMainCanvas.bind(canvasEngine);
  canvasEngine.redrawMainCanvas = () => {
    origRedraw();
    objectManager.updateAllPositions();
  };

  // 2. Top Ribbon & Bottom Dock Horizontal Scroll Buttons
  const ribbonScrollArea = document.getElementById('ribbon-tabs-scroll-area');
  document.getElementById('ribbon-scroll-right')?.addEventListener('click', () => {
    playClickSound();
    ribbonScrollArea?.scrollBy({ left: 160, behavior: 'smooth' });
  });
  document.getElementById('ribbon-scroll-left')?.addEventListener('click', () => {
    playClickSound();
    ribbonScrollArea?.scrollBy({ left: -160, behavior: 'smooth' });
  });

  const dockScrollArea = document.getElementById('bottom-main-dock-scroll');
  document.getElementById('dock-scroll-right')?.addEventListener('click', () => {
    playClickSound();
    dockScrollArea?.scrollBy({ left: 140, behavior: 'smooth' });
  });
  document.getElementById('dock-scroll-left')?.addEventListener('click', () => {
    playClickSound();
    dockScrollArea?.scrollBy({ left: -140, behavior: 'smooth' });
  });

  // 3. Teacher Profile
  const welcomeModal = document.getElementById('welcome-modal');
  const teacherNameInput = document.getElementById('teacher-name-input');
  const teacherPhoneInput = document.getElementById('teacher-phone-input');
  const teacherHeaderName = document.getElementById('header-teacher-name');
  const teacherHeaderPhone = document.getElementById('header-teacher-phone');
  const btnSaveTeacher = document.getElementById('btn-save-teacher');

  const loadTeacherProfile = () => {
    const savedName = localStorage.getItem('eduboard_teacher_name') || 'Medo JR 99';
    const savedPhone = localStorage.getItem('eduboard_teacher_phone') || '01014396559';

    if (teacherHeaderName) teacherHeaderName.innerText = savedName;
    if (teacherHeaderPhone) teacherHeaderPhone.innerText = savedPhone;
    if (teacherNameInput) teacherNameInput.value = savedName;
    if (teacherPhoneInput) teacherPhoneInput.value = savedPhone;
  };

  btnSaveTeacher?.addEventListener('click', () => {
    playClickSound('success');
    const name = teacherNameInput.value.trim() || 'Medo JR 99';
    const phone = teacherPhoneInput.value.trim() || '01014396559';
    localStorage.setItem('eduboard_teacher_name', name);
    localStorage.setItem('eduboard_teacher_phone', phone);

    if (teacherHeaderName) teacherHeaderName.innerText = name;
    if (teacherHeaderPhone) teacherHeaderPhone.innerText = phone;
    welcomeModal.classList.remove('active');
    showToast(`تم حفظ بيانات المعلم: ${name}`);
  });

  const openTeacherModal = () => {
    playClickSound();
    welcomeModal.classList.add('active');
  };
  document.getElementById('teacher-header-badge')?.addEventListener('click', openTeacherModal);
  document.getElementById('teacher-phone-badge-btn')?.addEventListener('click', openTeacherModal);
  document.getElementById('btn-teacher-profile-ribbon')?.addEventListener('click', openTeacherModal);

  // 4. Fullscreen & Share Link
  document.getElementById('btn-fullscreen-toggle')?.addEventListener('click', () => {
    playClickSound();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      showToast('وضع الشاشة الكاملة');
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  });

  document.getElementById('btn-copy-link')?.addEventListener('click', () => {
    playClickSound('success');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('تم نسخ رابط السبورة بنجاح!');
      });
    }
  });

  // 5. Subject Switcher
  let currentSubject = 'العلوم';
  const subjectsModal = document.getElementById('subjects-modal');
  const currentSubjectLabel = document.getElementById('current-subject-label');

  document.getElementById('ribbon-tab-subject-switch')?.addEventListener('click', () => {
    playClickSound();
    subjectsModal.classList.add('active');
  });

  document.querySelectorAll('.btn-subject-item').forEach(btn => {
    btn.addEventListener('click', () => {
      playClickSound('success');
      document.querySelectorAll('.btn-subject-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSubject = btn.dataset.subject;
      if (currentSubjectLabel) currentSubjectLabel.innerText = currentSubject;
      subjectsModal.classList.remove('active');
      showToast(`تم تغيير المادة: ${currentSubject}`);
    });
  });

  // 6. Classroom Tools Dropdown Modal
  const classroomToolsModal = document.getElementById('classroom-tools-modal');
  document.getElementById('ribbon-tab-tools')?.addEventListener('click', () => {
    playClickSound();
    classroomToolsModal.classList.add('active');
  });

  document.getElementById('tool-choice-timer')?.addEventListener('click', () => {
    classroomToolsModal.classList.remove('active');
    document.getElementById('timer-widget').classList.add('visible');
  });

  document.getElementById('tool-choice-measure')?.addEventListener('click', () => {
    classroomToolsModal.classList.remove('active');
    document.getElementById('measurement-modal').classList.add('active');
  });

  document.getElementById('tool-choice-calc')?.addEventListener('click', () => {
    classroomToolsModal.classList.remove('active');
    calculator.show();
  });

  document.getElementById('tool-choice-stem')?.addEventListener('click', () => {
    classroomToolsModal.classList.remove('active');
    stemLibrary.showModal();
  });

  // 7. Saved Lessons Modal (مطابق تماماً للصورة 4)
  const myLessonsModal = document.getElementById('my-lessons-modal');
  const lessonsListContainer = document.getElementById('lessons-list-container');
  const lessonsSearchInput = document.getElementById('lessons-search-input');
  let selectedSubjectFilter = 'all';

  const getAllSavedLessons = () => {
    const lessons = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('eduboard_lesson_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          lessons.push({ key, ...item });
        } catch(e) {}
      }
    }
    return lessons.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  };

  const renderSavedLessonsList = () => {
    if (!lessonsListContainer) return;
    const allLessons = getAllSavedLessons();
    const countAllEl = document.getElementById('lessons-count-all');
    if (countAllEl) countAllEl.innerText = allLessons.length;

    const query = lessonsSearchInput?.value.trim().toLowerCase() || '';
    const filtered = allLessons.filter(l => {
      const matchSubject = selectedSubjectFilter === 'all' || l.subject === selectedSubjectFilter;
      const matchQuery = !query || (l.title && l.title.toLowerCase().includes(query));
      return matchSubject && matchQuery;
    });

    if (filtered.length === 0) {
      lessonsListContainer.innerHTML = `
        <div class="lessons-empty-state">
          <i class="far fa-file-alt lessons-empty-icon"></i>
          <div class="lessons-empty-title">لا توجد دروس محفوظة هنا</div>
          <div class="lessons-empty-desc">احفظ دروسك أثناء التدريس للرجوع إليها لاحقاً بسهولة</div>
        </div>
      `;
      return;
    }

    lessonsListContainer.innerHTML = '';
    filtered.forEach(lesson => {
      const itemEl = document.createElement('div');
      itemEl.className = 'saved-lesson-item';
      itemEl.innerHTML = `
        <div class="lesson-item-info-col">
          <div class="lesson-item-title-row">
            <span class="lesson-item-name">${lesson.title || 'درس بدون عنوان'}</span>
            <span class="lesson-badge-tag">${lesson.subject || 'العلوم'}</span>
            <span style="font-size: 0.72rem; color: #cbd5e1; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px;">${lesson.pages ? lesson.pages.length : 1} صفحة</span>
          </div>
          <div class="lesson-item-date"><i class="far fa-clock"></i> ${lesson.date || ''}</div>
        </div>
        <div class="lesson-item-actions-row">
          <button class="btn-open-lesson" title="فتح هذا الدرس">فتح الدرس 📖</button>
          <button class="btn-import-stb btn-export-single-stb" title="تصدير ملف الدرس stb."><i class="fas fa-download"></i> stb.</button>
          <button class="btn-delete-saved-lesson" title="حذف هذا الدرس"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;

      itemEl.querySelector('.btn-open-lesson').addEventListener('click', () => {
        playClickSound('success');
        loadLessonState(lesson);
        myLessonsModal.classList.remove('active');
        showToast(`تم فتح درس: "${lesson.title}"`);
      });

      itemEl.querySelector('.btn-export-single-stb').addEventListener('click', () => {
        playClickSound();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lesson, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `${lesson.title || 'درس'}.stb`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
        showToast('تم تصدير ملف الدرس بنجاح!');
      });

      itemEl.querySelector('.btn-delete-saved-lesson').addEventListener('click', () => {
        playClickSound();
        if (confirm(`هل أنت متأكد من حذف "${lesson.title}"؟`)) {
          localStorage.removeItem(lesson.key);
          renderSavedLessonsList();
          showToast('تم حذف الدرس');
        }
      });

      lessonsListContainer.appendChild(itemEl);
    });
  };

  const loadLessonState = (lesson) => {
    if (lesson.pages && lesson.pages.length > 0) {
      canvasEngine.pages = JSON.parse(JSON.stringify(lesson.pages));
      canvasEngine.currentPageIndex = 0;
      canvasEngine.loadCurrentPage();
    }
    objectManager.clearAll();
    if (lesson.objects && lesson.objects.length > 0) {
      lesson.objects.forEach(objData => {
        objectManager.addObject(objData.type, {
          ...objData.data,
          x: objData.x,
          y: objData.y,
          width: objData.width,
          height: objData.height,
          rotation: objData.rotation
        });
      });
    }
    const lessonTitleTab = document.getElementById('ribbon-lesson-title');
    if (lessonTitleTab) {
      lessonTitleTab.innerHTML = `<span>${lesson.title}</span> <i class="fas fa-pencil-alt" style="font-size: 0.72rem;"></i>`;
    }
    updatePageDisplay();
  };

  // Open My Lessons Modal
  document.getElementById('btn-my-lessons')?.addEventListener('click', () => {
    playClickSound();
    renderSavedLessonsList();
    myLessonsModal.classList.add('active');
  });

  // Search Filter in Lessons Modal
  lessonsSearchInput?.addEventListener('input', () => {
    renderSavedLessonsList();
  });

  // Category Filter in Lessons Modal
  document.querySelectorAll('.lesson-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClickSound();
      document.querySelectorAll('.lesson-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSubjectFilter = btn.dataset.subject;
      renderSavedLessonsList();
    });
  });

  // Save Lesson Action
  document.getElementById('btn-save-lesson')?.addEventListener('click', () => {
    playClickSound('success');
    canvasEngine.saveCurrentPageState();
    const lessonTitle = document.getElementById('ribbon-lesson-title')?.innerText.trim() || 'درس جديد';
    const timestamp = Date.now();
    const lessonData = {
      title: lessonTitle,
      subject: currentSubject,
      date: new Date().toLocaleString('ar-EG'),
      timestamp: timestamp,
      pages: canvasEngine.pages,
      objects: objectManager.objects.map(o => ({
        type: o.type,
        data: o.data,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation
      }))
    };
    localStorage.setItem(`eduboard_lesson_${timestamp}`, JSON.stringify(lessonData));
    showToast(`تم حفظ "${lessonTitle}" بنجاح!`);
  });

  // Import .stb Lesson File
  const stbFileInput = document.getElementById('stb-file-input');
  document.getElementById('btn-import-stb-action')?.addEventListener('click', () => {
    stbFileInput?.click();
  });

  stbFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const lesson = JSON.parse(evt.target.result);
        const timestamp = Date.now();
        localStorage.setItem(`eduboard_lesson_${timestamp}`, JSON.stringify(lesson));
        renderSavedLessonsList();
        showToast(`تم استيراد الدرس: "${lesson.title || file.name}" بنجاح!`);
      } catch(err) {
        showToast('خطأ: الملف غير صالح بصيغة stb.');
      }
    };
    reader.readAsText(file);
    stbFileInput.value = '';
  });

  // New Lesson Actions
  const handleNewLesson = () => {
    playClickSound();
    if (confirm('هل ترغب في بدء درس جديد وتفريغ السبورة؟')) {
      canvasEngine.pages = [{ id: 1, history: [], bgColor: '#0b132b', bgPattern: 'dot-grid', panX: 0, panY: 0, scale: 1.0, objects: [] }];
      canvasEngine.currentPageIndex = 0;
      canvasEngine.loadCurrentPage();
      objectManager.clearAll();
      updatePageDisplay();
      myLessonsModal.classList.remove('active');
      showToast('تم إنشاء درس جديد');
    }
  };

  document.getElementById('btn-new-lesson')?.addEventListener('click', handleNewLesson);
  document.getElementById('btn-modal-new-lesson')?.addEventListener('click', handleNewLesson);

  // 8. Export & Print Modal Controls
  const exportModal = document.getElementById('export-modal');
  document.getElementById('btn-export-print-ribbon')?.addEventListener('click', () => {
    playClickSound();
    exportModal.classList.add('active');
  });

  document.getElementById('btn-export-png-action')?.addEventListener('click', () => {
    playClickSound('success');
    const teacher = teacherHeaderName?.innerText || 'Medo_JR_99';
    exportManager.exportImage(`حصة_${teacher}_${new Date().toISOString().slice(0, 10)}.png`);
    exportModal.classList.remove('active');
    showToast('تم تصدير الحصة كصورة PNG');
  });

  document.getElementById('btn-export-pdf-action')?.addEventListener('click', () => {
    playClickSound('success');
    const teacher = teacherHeaderName?.innerText || 'Medo_JR_99';
    exportManager.exportPDF(`حصة_${teacher}_${new Date().toISOString().slice(0, 10)}.pdf`);
    exportModal.classList.remove('active');
    showToast('تم تصدير الحصة كملف PDF');
  });

  document.getElementById('btn-print-action')?.addEventListener('click', () => {
    playClickSound();
    exportManager.printBoard();
    exportModal.classList.remove('active');
  });

  // 9. Bottom Main Toolbar Tools Switching & Pointer Events Fix
  const toolButtons = document.querySelectorAll('[data-tool]');
  const colorPopup = document.getElementById('tool-options-popup');
  const shapesPopup = document.getElementById('shapes-popup');
  const btnShapeDock = document.getElementById('btn-shape-dock');
  const activeColorDot = document.getElementById('active-color-dot');

  const setTool = (toolName) => {
    playClickSound();
    canvasEngine.tool = toolName;
    const vp = document.getElementById('canvas-viewport');
    vp.className = '';

    toolButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    if (btnShapeDock) {
      btnShapeDock.classList.toggle('active-purple', toolName === 'shape');
    }

    if (toolName === 'pan') vp.classList.add('pan-mode');
    else if (toolName === 'laser') vp.classList.add('laser-mode');
    else if (toolName === 'text') vp.classList.add('text-mode');
    else if (toolName === 'select') vp.classList.add('select-mode');

    // Update pointer events on objects (allows smooth drawing directly over PDFs and Images)
    objectManager.updatePointerEventsMode(toolName);

    colorPopup?.classList.remove('visible');
    shapesPopup?.classList.remove('visible');
  };

  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      setTool(tool);
    });
  });

  // Color Popup Toggle & Selection
  const btnColorDock = document.getElementById('btn-color-dock');
  btnColorDock?.addEventListener('click', (e) => {
    e.stopPropagation();
    playClickSound();
    shapesPopup?.classList.remove('visible');
    colorPopup?.classList.toggle('visible');
  });

  document.querySelectorAll('.color-swatch-circle').forEach(swatch => {
    swatch.addEventListener('click', () => {
      playClickSound();
      document.querySelectorAll('.color-swatch-circle').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const col = swatch.dataset.color;
      canvasEngine.strokeColor = col;
      if (activeColorDot) activeColorDot.style.background = col;
      showToast(`تم اختيار اللون`);
    });
  });

  const customColorInput = document.getElementById('custom-color-picker');
  if (customColorInput) {
    customColorInput.addEventListener('input', (e) => {
      canvasEngine.strokeColor = e.target.value;
      if (activeColorDot) activeColorDot.style.background = e.target.value;
    });
  }

  const strokeSlider = document.getElementById('stroke-width-slider');
  const strokeValLabel = document.getElementById('stroke-val-label');
  if (strokeSlider) {
    strokeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      canvasEngine.strokeWidth = val;
      if (strokeValLabel) strokeValLabel.innerText = `${val}px`;
    });
  }

  // 10. Shapes Drawer (مطابق تماماً للصورة 4 و 5)
  btnShapeDock?.addEventListener('click', (e) => {
    e.stopPropagation();
    playClickSound();
    colorPopup?.classList.remove('visible');
    shapesPopup?.classList.toggle('visible');
  });

  document.getElementById('close-shapes-popup')?.addEventListener('click', () => {
    shapesPopup?.classList.remove('visible');
  });

  document.querySelectorAll('.shape-list-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClickSound();
      document.querySelectorAll('.shape-list-item-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const shapeType = btn.dataset.shape;
      canvasEngine.activeShape = shapeType;
      setTool('shape');
      shapesPopup?.classList.remove('visible');
      showToast(`أداة الشكل: ${btn.querySelector('.shape-item-title').innerText}`);
    });
  });

  // 11. Geometric Measurement Tools Modal & Spawning
  const measurementModal = document.getElementById('measurement-modal');
  document.getElementById('btn-ruler-dock')?.addEventListener('click', () => {
    playClickSound();
    measurementModal?.classList.add('active');
  });

  document.getElementById('btn-insert-ruler-modal')?.addEventListener('click', () => {
    playClickSound('success');
    classroomWidgets.createRuler();
    measurementModal?.classList.remove('active');
    setTool('select');
    showToast('تمت إضافة المسطرة الهندسية (cm) للسبورة');
  });

  document.getElementById('btn-insert-protractor-modal')?.addEventListener('click', () => {
    playClickSound('success');
    classroomWidgets.createProtractor();
    measurementModal?.classList.remove('active');
    setTool('select');
    showToast('تمت إضافة المنقلة الهندسية 180° للسبورة');
  });

  // 12. Text Box Tool Instant Spawn
  canvasEngine.onTextRequest = (worldX, worldY) => {
    playClickSound();
    objectManager.addObject('text', {
      x: worldX,
      y: worldY,
      text: 'اكتب الشرح هنا...',
      fontSize: 26,
      color: canvasEngine.strokeColor
    });
    setTool('select');
  };

  document.getElementById('quick-text-btn')?.addEventListener('click', () => {
    playClickSound();
    objectManager.addObject('text', {
      text: 'اكتب الشرح هنا...',
      fontSize: 26,
      color: canvasEngine.strokeColor
    });
    setTool('select');
    showToast('تم إدراج مربع نص جديد');
  });

  // 13. Quick STEM Formula Shortcuts
  document.getElementById('quick-math-btn')?.addEventListener('click', () => {
    playClickSound();
    stemLibrary.showModal();
    const mathTab = document.querySelector('[data-tab="math"]');
    if (mathTab) mathTab.click();
  });

  document.getElementById('quick-chem-btn')?.addEventListener('click', () => {
    playClickSound();
    stemLibrary.showModal();
    const chemTab = document.querySelector('[data-tab="chemistry"]');
    if (chemTab) chemTab.click();
  });

  // 14. Sticky Note Button
  document.getElementById('btn-sticky-dock')?.addEventListener('click', () => {
    playClickSound();
    classroomWidgets.createStickyNote('#fef08a');
    setTool('select');
    showToast('تمت إضافة ملاحظة لاصقة');
  });

  // 15. Undo, Redo, Clear All
  document.getElementById('btn-undo-dock')?.addEventListener('click', () => {
    playClickSound();
    canvasEngine.undo();
  });
  document.getElementById('btn-redo-dock')?.addEventListener('click', () => {
    playClickSound();
    canvasEngine.redo();
  });

  const clearModal = document.getElementById('clear-confirm-modal');
  document.getElementById('btn-trash-dock')?.addEventListener('click', () => {
    playClickSound();
    clearModal.classList.add('active');
  });

  document.getElementById('btn-confirm-clear')?.addEventListener('click', () => {
    playClickSound();
    canvasEngine.clearAll();
    objectManager.clearAll();
    clearModal.classList.remove('active');
    showToast('تم مسح محتويات الصفحة');
  });

  // 16. Zoom Controls
  document.getElementById('btn-zoom-in-dock')?.addEventListener('click', () => {
    playClickSound();
    canvasEngine.setZoom(Math.round(canvasEngine.scale * 100) + 15);
  });
  document.getElementById('btn-zoom-out-dock')?.addEventListener('click', () => {
    playClickSound();
    canvasEngine.setZoom(Math.round(canvasEngine.scale * 100) - 15);
  });
  document.getElementById('btn-zoom-reset-dock')?.addEventListener('click', () => {
    playClickSound();
    canvasEngine.resetView();
  });

  // 17. Multi-Page Navigation & Page Deletion
  const pageDisplay = document.getElementById('current-page-display-stepper');
  const btnPrevPage = document.getElementById('btn-prev-page-dock');
  const btnNextPage = document.getElementById('btn-next-page-dock');
  const btnAddPage = document.getElementById('btn-add-page-dock');
  const pageCurrentTab = document.getElementById('btn-page-current-tab');
  const btnDeleteCurrentPage = document.getElementById('btn-delete-current-page');

  const updatePageDisplay = () => {
    const current = canvasEngine.currentPageIndex + 1;
    const total = canvasEngine.pages.length;
    if (pageDisplay) pageDisplay.innerText = `صفحة ${current} من ${total}`;
    if (pageCurrentTab) pageCurrentTab.innerHTML = `<i class="fas fa-file-alt"></i> صفحة ${current}`;
  };

  btnPrevPage?.addEventListener('click', () => {
    playClickSound();
    if (canvasEngine.currentPageIndex > 0) {
      canvasEngine.switchPage(canvasEngine.currentPageIndex - 1);
      updatePageDisplay();
    }
  });

  btnNextPage?.addEventListener('click', () => {
    playClickSound();
    if (canvasEngine.currentPageIndex < canvasEngine.pages.length - 1) {
      canvasEngine.switchPage(canvasEngine.currentPageIndex + 1);
    } else {
      canvasEngine.addPage();
    }
    updatePageDisplay();
  });

  btnAddPage?.addEventListener('click', () => {
    playClickSound('success');
    canvasEngine.addPage();
    updatePageDisplay();
    showToast(`تمت إضافة صفحة جديدة (${canvasEngine.pages.length})`);
  });

  btnDeleteCurrentPage?.addEventListener('click', () => {
    playClickSound();
    if (canvasEngine.pages.length <= 1) {
      if (confirm('هل ترغب في مسح محتويات الصفحة الحالية؟')) {
        canvasEngine.clearAll();
        objectManager.clearAll();
        showToast('تم مسح الصفحة');
      }
      return;
    }

    if (confirm(`هل أنت متأكد من حذف الصفحة ${canvasEngine.currentPageIndex + 1}؟`)) {
      canvasEngine.deleteCurrentPage();
      updatePageDisplay();
      showToast('تم حذف الصفحة بنجاح');
    }
  });

  // 18. Ribbon Tabs Handlers
  document.getElementById('ribbon-tab-calc')?.addEventListener('click', () => {
    playClickSound();
    calculator.toggle();
  });

  document.getElementById('ribbon-tab-theme')?.addEventListener('click', () => {
    playClickSound();
    document.getElementById('bg-modal').classList.add('active');
  });

  document.getElementById('ribbon-tab-colors-templates')?.addEventListener('click', () => {
    playClickSound();
    document.getElementById('bg-modal').classList.add('active');
  });

  document.getElementById('ribbon-tab-grid')?.addEventListener('click', () => {
    playClickSound();
    document.getElementById('bg-modal').classList.add('active');
  });

  const lessonTitleTab = document.getElementById('ribbon-lesson-title');
  lessonTitleTab?.addEventListener('click', () => {
    playClickSound();
    const currentTitle = lessonTitleTab.querySelector('span')?.innerText || 'درس العلوم';
    const newTitle = prompt('أدخل عنوان الدرس الحالي:', currentTitle);
    if (newTitle) {
      lessonTitleTab.innerHTML = `<span>${newTitle}</span> <i class="fas fa-pencil-alt" style="font-size: 0.72rem;"></i>`;
    }
  });

  // 19. Background Selection
  document.querySelectorAll('.bg-choice-card').forEach(card => {
    card.addEventListener('click', () => {
      playClickSound();
      document.querySelectorAll('.bg-choice-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const color = card.dataset.bg;
      canvasEngine.setBackground(color, null);
    });
  });

  document.querySelectorAll('.pattern-card').forEach(card => {
    card.addEventListener('click', () => {
      playClickSound();
      document.querySelectorAll('.pattern-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const pattern = card.dataset.pattern;
      canvasEngine.setBackground(null, pattern);
    });
  });

  // 20. PDF & Image Upload
  const fileInput = document.getElementById('file-upload-input');
  const pdfModal = document.getElementById('pdf-modal');

  document.getElementById('btn-upload-dock')?.addEventListener('click', () => {
    playClickSound();
    fileInput.click();
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      showToast('جاري رفع الصورة...');
      await pdfHandler.handleImageUpload(file);
      showToast('تم إدراج الصورة في السبورة');
      setTool('pen');
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      showToast('جاري معالجة ملف الـ PDF...');
      try {
        const thumbs = await pdfHandler.handlePdfUpload(file, (curr, total) => {
          showToast(`معالجة PDF: صفحة ${curr}/${total}...`);
        });
        renderPdfThumbnails(thumbs);
        showToast('تم تحميل ملف PDF بنجاح!');
      } catch (err) {
        console.error('PDF error:', err);
        showToast('حدث خطأ في تحميل ملف PDF');
      }
    }
    fileInput.value = '';
  });

  const renderPdfThumbnails = (thumbnails) => {
    const grid = document.getElementById('pdf-thumbnails-grid');
    if (!grid) return;
    grid.innerHTML = '';

    thumbnails.forEach(t => {
      const card = document.createElement('div');
      card.className = `pdf-thumb-card ${t.pageNumber === 1 ? 'active' : ''}`;
      card.innerHTML = `
        <img class="pdf-thumb-img" src="${t.dataUrl}" />
        <span style="font-size: 0.82rem; font-weight: 700; color: #38bdf8;">صفحة ${t.pageNumber}</span>
      `;
      card.addEventListener('click', () => {
        playClickSound('success');
        grid.querySelectorAll('.pdf-thumb-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        pdfHandler.insertPdfPageToBoard(t.pageNumber);
        pdfModal.classList.remove('active');
        setTool('pen');
        showToast(`تم إدراج الصفحة ${t.pageNumber} في السبورة`);
      });
      grid.appendChild(card);
    });

    document.getElementById('pdf-total-pages-label').innerText = `${thumbnails.length} صفحة`;
    pdfModal.classList.add('active');
  };

  // 21. Screen Recorder & Mic Toggle
  const btnRecPill = document.getElementById('btn-rec-pill');
  const btnMicStatus = document.getElementById('btn-mic-status');
  let micEnabled = true;

  btnMicStatus?.addEventListener('click', () => {
    playClickSound();
    micEnabled = !micEnabled;
    if (micEnabled) {
      btnMicStatus.innerHTML = '<i class="fas fa-microphone"></i> المايك شغال';
      btnMicStatus.style.background = '#0f766e';
    } else {
      btnMicStatus.innerHTML = '<i class="fas fa-microphone-slash"></i> المايك معطل';
      btnMicStatus.style.background = '#475569';
    }
  });

  btnRecPill?.addEventListener('click', async () => {
    playClickSound();
    if (!recorder.isRecording) {
      const ok = await recorder.startRecording(micEnabled);
      if (ok) {
        btnRecPill.innerHTML = '<i class="fas fa-stop"></i> إيقاف التسجيل';
        showToast('بدأ تسجيل الحصة فيديو مع الصوت');
      }
    } else {
      recorder.stopRecording();
      btnRecPill.innerHTML = '<i class="fas fa-video"></i> تسجيل الشاشة + الصوت';
    }
  });

  // 22. Close Handlers
  document.getElementById('close-calc-widget')?.addEventListener('click', () => calculator.hide());
  document.getElementById('close-timer-widget')?.addEventListener('click', () => {
    document.getElementById('timer-widget').classList.remove('visible');
  });

  document.querySelectorAll('.modal-close, .btn-modal-cancel, .btn-cancel-dark').forEach(btn => {
    btn.addEventListener('click', () => {
      playClickSound();
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    });
  });

  // Helper Toast
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-info-circle" style="color: #38bdf8;"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }

  // 23. Toolbar Position Toggle (يمين / وسط / يسار)
  const toolbarContainer = document.querySelector('.bottom-main-toolbar-container');
  const toolbarHandleBtn = document.getElementById('toolbar-dock-handle-btn');
  const toolbarPositionMenu = document.getElementById('toolbar-position-menu');

  const applyToolbarPosition = (pos) => {
    if (!toolbarContainer) return;
    toolbarContainer.style.transition = 'left 0.3s ease, right 0.3s ease, transform 0.3s ease';

    if (pos === 'center') {
      toolbarContainer.style.left = '50%';
      toolbarContainer.style.right = 'auto';
      toolbarContainer.style.transform = 'translateX(-50%)';
    } else if (pos === 'left') {
      toolbarContainer.style.left = 'auto';
      toolbarContainer.style.right = '10px';
      toolbarContainer.style.transform = 'none';
    } else if (pos === 'right') {
      toolbarContainer.style.left = '10px';
      toolbarContainer.style.right = 'auto';
      toolbarContainer.style.transform = 'none';
    }
  };

  toolbarHandleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    playClickSound();
    toolbarPositionMenu?.classList.toggle('visible');
  });

  document.querySelectorAll('.toolbar-pos-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playClickSound();
      document.querySelectorAll('.toolbar-pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pos = btn.dataset.pos;
      applyToolbarPosition(pos);
      toolbarPositionMenu?.classList.remove('visible');
      showToast(`موضع الشريط: ${btn.innerText.trim()}`);
    });
  });

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#toolbar-position-menu') && !e.target.closest('#toolbar-dock-handle-btn')) {
      toolbarPositionMenu?.classList.remove('visible');
    }
  });

  // Load teacher details
  loadTeacherProfile();
});
