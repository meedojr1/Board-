/**
 * EduBoard STEM Elements Library
 * High-contrast dark formula renderer for Mathematics, Physics, and Chemistry.
 */

const STEM_PRESETS = {
  math: [
    { title: 'المعادلة التربيعية', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
    { title: 'مبرهنة فيثاغورس', latex: 'a^2 + b^2 = c^2' },
    { title: 'متطابقة أويلر', latex: 'e^{i\\pi} + 1 = 0' },
    { title: 'التكامل المحدود', latex: '\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)' },
    { title: 'المشتقة ونهاية التفاضل', latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}" },
    { title: 'المتطابقة المثلثية', latex: '\\sin^2(\\theta) + \\cos^2(\\theta) = 1' },
    { title: 'مصفوفة 2x2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
    { title: 'مجموع متتالية', latex: '\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}' }
  ],
  physics: [
    { title: "قانون نيوتن الثاني", latex: '\\vec{F} = m \\vec{a} = \\frac{d\\vec{p}}{dt}' },
    { title: 'تكافؤ الكتلة والطاقة', latex: 'E = m c^2' },
    { title: "قانون أوم والقدرة", latex: 'V = I \\cdot R \\quad (P = V \\cdot I)' },
    { title: 'طاقة الحركة', latex: 'E_k = \\frac{1}{2} m v^2' },
    { title: 'قانون الجذب العام', latex: 'F = G \\frac{m_1 m_2}{r^2}' },
    { title: 'معادلة انتشار الموجة', latex: 'v = f \\cdot \\lambda' }
  ],
  chemistry: [
    { title: 'تكوين الماء', latex: '2\\text{H}_2 + \\text{O}_2 \\longrightarrow 2\\text{H}_2\\text{O}' },
    { title: 'معادلة البناء الضوئي', latex: '6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\xrightarrow{\\text{light}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2' },
    { title: 'قانون الغاز المثالي', latex: 'P V = n R T' },
    { title: 'احتراق الميثان', latex: '\\text{CH}_4 + 2\\text{O}_2 \\longrightarrow \\text{CO}_2 + 2\\text{H}_2\\text{O}' },
    { title: 'حلقة البنزين العطرية', latex: '\\text{C}_6\\text{H}_6 \\quad [\\text{Aromatic Ring}]' },
    { title: 'الأس الهيدروجيني pH', latex: '\\text{pH} = -\\log_{10}[\\text{H}^+]' }
  ]
};

class STEMLibrary {
  constructor(objectManager) {
    this.objectManager = objectManager;
    this.modal = document.getElementById('stem-modal');
    this.customInput = document.getElementById('custom-latex-input');
    this.previewBox = document.getElementById('custom-latex-preview');
    this.currentTab = 'math';

    this.init();
  }

  init() {
    this.setupTabs();
    this.renderPresetGrid('math');
    this.setupCustomInput();
  }

  setupTabs() {
    if (!this.modal) return;
    const tabBtns = this.modal.querySelectorAll('.stem-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.tab;
        this.renderPresetGrid(this.currentTab);
      });
    });
  }

  renderPresetGrid(category) {
    const grid = document.getElementById('stem-items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const items = STEM_PRESETS[category] || [];
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'stem-card';
      card.style.background = '#111d38';
      card.style.border = '1px solid rgba(56, 189, 248, 0.3)';
      card.style.borderRadius = '10px';
      card.style.padding = '12px 8px';
      card.style.cursor = 'pointer';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      card.style.gap = '8px';
      card.style.color = '#ffffff';

      const mathEl = document.createElement('div');
      mathEl.className = 'math-render';
      mathEl.style.fontSize = '1.15rem';
      mathEl.style.color = '#38bdf8';

      if (window.katex) {
        try {
          katex.render(item.latex, mathEl, { displayMode: false, throwOnError: false });
        } catch (e) {
          mathEl.innerText = item.latex;
        }
      } else {
        mathEl.innerText = item.latex;
      }

      const titleEl = document.createElement('div');
      titleEl.className = 'stem-title';
      titleEl.style.fontSize = '0.78rem';
      titleEl.style.color = '#cbd5e1';
      titleEl.style.fontWeight = '700';
      titleEl.innerText = item.title;

      card.appendChild(mathEl);
      card.appendChild(titleEl);

      card.addEventListener('click', () => {
        this.insertFormula(item.latex, item.title);
        this.hideModal();
      });

      grid.appendChild(card);
    });
  }

  setupCustomInput() {
    if (!this.customInput || !this.previewBox) return;

    this.customInput.addEventListener('input', () => {
      const val = this.customInput.value.trim();
      if (!val) {
        this.previewBox.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">معاينة المعادلة</span>';
        return;
      }
      if (window.katex) {
        try {
          katex.render(val, this.previewBox, { displayMode: true, throwOnError: false });
          this.previewBox.style.color = '#38bdf8';
        } catch (err) {
          this.previewBox.innerText = 'خطأ في صياغة معادلة LaTeX';
          this.previewBox.style.color = '#fb7185';
        }
      }
    });

    const insertCustomBtn = document.getElementById('btn-insert-custom-stem');
    if (insertCustomBtn) {
      insertCustomBtn.addEventListener('click', () => {
        const val = this.customInput.value.trim();
        if (val) {
          this.insertFormula(val, 'معادلة مخصصة');
          this.customInput.value = '';
          this.previewBox.innerHTML = '<span style="color: #94a3b8; font-size: 0.85rem;">معاينة المعادلة</span>';
          this.hideModal();
        }
      });
    }
  }

  insertFormula(latex, title = '') {
    this.objectManager.addObject('stem', {
      latex,
      title,
      width: 320,
      height: 110
    });
  }

  showModal() {
    if (this.modal) this.modal.classList.add('active');
  }

  hideModal() {
    if (this.modal) this.modal.classList.remove('active');
  }
}
