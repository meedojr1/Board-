/**
 * CASIO fx-991ES PLUS 2nd Edition Engine
 * Complete scientific calculation simulation with exact key layout.
 */

class ScientificCalculator {
  constructor(widgetId, canvasEngine, objectManager) {
    this.widget = document.getElementById(widgetId);
    this.canvasEngine = canvasEngine;
    this.objectManager = objectManager;

    this.expressionEl = document.getElementById('casio-expr-display');
    this.resultEl = document.getElementById('casio-result-display');
    this.degIndicator = document.getElementById('casio-deg-indicator');

    this.expression = '';
    this.currentVal = '0';
    this.ans = 0;
    this.isShift = false;
    this.isAlpha = false;
    this.angleMode = 'DEG';
    this.isEvaluated = false;

    this.init();
  }

  init() {
    this.setupDraggable();
    this.setupKeypad();
    this.updateDisplay();
  }

  setupDraggable() {
    const header = this.widget?.querySelector('.casio-top-bar');
    if (!header) return;

    let isDragging = false;
    let startX, startY, origX, origY;

    const onPointerDown = (e) => {
      if (e.target.closest('.casio-window-controls')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.widget.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      header.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.widget.style.left = `${Math.max(10, Math.min(window.innerWidth - 330, origX + dx))}px`;
      this.widget.style.top = `${Math.max(10, Math.min(window.innerHeight - 100, origY + dy))}px`;
      this.widget.style.right = 'auto';
    };

    const onPointerUp = (e) => {
      isDragging = false;
      try { header.releasePointerCapture(e.pointerId); } catch(err) {}
    };

    header.addEventListener('pointerdown', onPointerDown);
    header.addEventListener('pointermove', onPointerMove);
    header.addEventListener('pointerup', onPointerUp);
  }

  setupKeypad() {
    if (!this.widget) return;

    // Numeric and operator keys
    this.widget.querySelectorAll('[data-val]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = btn.dataset.val;
        this.handleInput(val);
      });
    });

    // Scientific function keys
    this.widget.querySelectorAll('[data-fn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fn = btn.dataset.fn;
        this.handleFunction(fn);
      });
    });

    // Action keys (DEL, AC, =, mode)
    this.widget.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.action;
        this.handleAction(act);
      });
    });

    // Shift and Alpha
    document.getElementById('casio-btn-shift')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isShift = !this.isShift;
      document.getElementById('casio-shift-indicator')?.classList.toggle('active', this.isShift);
    });

    document.getElementById('casio-btn-alpha')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isAlpha = !this.isAlpha;
      document.getElementById('casio-alpha-indicator')?.classList.toggle('active', this.isAlpha);
    });

    // S<=>D (Decimal to fraction / rounded)
    document.getElementById('casio-btn-sd')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSD();
    });

    // Angle mode toggle (DEG / RAD)
    document.getElementById('casio-deg-indicator')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
      if (this.degIndicator) this.degIndicator.innerText = this.angleMode;
    });

    // Insert to Whiteboard button
    document.getElementById('casio-insert-board')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentVal) {
        const text = `${this.expression ? this.expression + ' = ' : ''}${this.currentVal}`;
        this.objectManager.addObject('text', {
          text: text,
          fontSize: 26,
          color: '#38bdf8'
        });
      }
    });
  }

  handleInput(char) {
    if (this.isEvaluated && !['+', '-', '×', '÷', '^', '*10^'].includes(char)) {
      this.expression = '';
      this.currentVal = '0';
    }
    this.isEvaluated = false;

    if (char === '*10^') {
      this.currentVal = (this.currentVal === '0' ? '' : this.currentVal) + '×10^';
    } else if (this.currentVal === '0' && char !== '.') {
      this.currentVal = char;
    } else {
      this.currentVal += char;
    }
    this.updateDisplay();
  }

  handleFunction(fn) {
    let num = parseFloat(this.currentVal) || 0;
    let res = 0;

    switch (fn) {
      case 'sin':
        const radSin = this.angleMode === 'DEG' ? (num * Math.PI) / 180 : num;
        res = Math.sin(radSin);
        this.expression = `sin(${this.currentVal})`;
        break;
      case 'cos':
        const radCos = this.angleMode === 'DEG' ? (num * Math.PI) / 180 : num;
        res = Math.cos(radCos);
        this.expression = `cos(${this.currentVal})`;
        break;
      case 'tan':
        const radTan = this.angleMode === 'DEG' ? (num * Math.PI) / 180 : num;
        res = Math.tan(radTan);
        this.expression = `tan(${this.currentVal})`;
        break;
      case 'sqrt':
        res = Math.sqrt(num);
        this.expression = `√(${this.currentVal})`;
        break;
      case 'sq':
        res = num * num;
        this.expression = `(${this.currentVal})²`;
        break;
      case 'fraction':
        this.handleInput('/');
        return;
      case 'log':
        res = Math.log10(num);
        this.expression = `log(${this.currentVal})`;
        break;
      case 'ln':
        res = Math.log(num);
        this.expression = `ln(${this.currentVal})`;
        break;
      case 'pi':
        if (this.currentVal === '0') this.currentVal = 'π';
        else this.currentVal += '×π';
        this.updateDisplay();
        return;
      case 'e':
        if (this.currentVal === '0') this.currentVal = 'e';
        else this.currentVal += '×e';
        this.updateDisplay();
        return;
      case 'fact':
        res = this.factorial(Math.floor(num));
        this.expression = `${this.currentVal}!`;
        break;
      case 'ans':
        if (this.currentVal === '0') this.currentVal = String(this.ans);
        else this.currentVal += String(this.ans);
        this.updateDisplay();
        return;
      case 'sd':
        this.toggleSD();
        return;
      case 'calc':
      case 'integral':
      case 'deg':
      case 'hyp':
      case 'rcl':
      case 'eng':
      case 'mplus':
        this.calculate();
        return;
    }

    this.currentVal = this.formatResult(res);
    this.isEvaluated = true;
    this.updateDisplay();
  }

  toggleSD() {
    const num = parseFloat(this.currentVal);
    if (!isNaN(num)) {
      if (this.currentVal.includes('/')) {
        const parts = this.currentVal.split('/');
        if (parts.length === 2) {
          const dec = parseFloat(parts[0]) / parseFloat(parts[1]);
          this.currentVal = this.formatResult(dec);
        }
      } else {
        this.currentVal = this.toFraction(num);
      }
      this.updateDisplay();
    }
  }

  handleAction(action) {
    switch (action) {
      case 'ac':
        this.expression = '';
        this.currentVal = '0';
        this.isEvaluated = false;
        break;
      case 'del':
        if (this.currentVal.length > 1) {
          this.currentVal = this.currentVal.slice(0, -1);
        } else {
          this.currentVal = '0';
        }
        break;
      case 'equals':
        this.calculate();
        break;
      case 'mode':
        this.angleMode = this.angleMode === 'DEG' ? 'RAD' : 'DEG';
        if (this.degIndicator) this.degIndicator.innerText = this.angleMode;
        break;
    }
    this.updateDisplay();
  }

  calculate() {
    try {
      let expr = this.currentVal
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/\^/g, '**')
        .replace(/π/g, 'Math.PI')
        .replace(/e/g, 'Math.E');

      const allowed = /^[0-9+\-*/().\s*%Math.PIE]+$/;
      if (!allowed.test(expr)) {
        throw new Error('Invalid Input');
      }

      const res = Function(`"use strict"; return (${expr})`)();
      this.expression = this.currentVal;
      this.currentVal = this.formatResult(res);
      this.ans = res;
      this.isEvaluated = true;
    } catch (err) {
      this.currentVal = 'Syntax ERROR';
    }
    this.updateDisplay();
  }

  factorial(n) {
    if (n < 0) return NaN;
    if (n <= 1) return 1;
    let v = 1;
    for (let i = 2; i <= Math.min(n, 120); i++) v *= i;
    return v;
  }

  formatResult(val) {
    if (isNaN(val) || !isFinite(val)) return 'Math ERROR';
    return Number(val.toFixed(8)).toString();
  }

  toFraction(val) {
    if (Number.isInteger(val)) return `${val}/1`;
    const tolerance = 1.0E-6;
    let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
    let b = val;
    do {
      let a = Math.floor(b);
      let aux = h1; h1 = a * h1 + h2; h2 = aux;
      aux = k1; k1 = a * k1 + k2; k2 = aux;
      b = 1 / (b - a);
    } while (Math.abs(val - h1 / k1) > val * tolerance);
    return `${h1}/${k1}`;
  }

  updateDisplay() {
    if (this.expressionEl) this.expressionEl.innerText = this.expression;
    if (this.resultEl) this.resultEl.innerText = this.currentVal;
  }

  toggle() {
    this.widget?.classList.toggle('visible');
    this.updateDisplay();
  }

  show() {
    this.widget?.classList.add('visible');
    this.updateDisplay();
  }

  hide() {
    this.widget?.classList.remove('visible');
  }
}
