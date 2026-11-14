/**
 * EduBoard Classroom & Measurement Tools Manager
 * Interactive Ruler, Protractor, Timer, Stopwatch, Student Picker, Dice.
 */

class ClassroomWidgets {
  constructor(canvasEngine, objectManager) {
    this.canvasEngine = canvasEngine;
    this.objectManager = objectManager;

    this.timerInterval = null;
    this.timerSecondsLeft = 0;
    this.isTimerRunning = false;
    this.isStopwatch = false;
    this.stopwatchElapsed = 0;

    this.init();
  }

  init() {
    this.initTimer();
  }

  // Show Interactive Ruler on Canvas (مطابق تماماً للصورة 3)
  createRuler() {
    const obj = this.objectManager.addObject('ruler-tool', {
      width: 520,
      height: 90,
      rotation: 0
    });
    return obj;
  }

  // Show Interactive Protractor on Canvas
  createProtractor() {
    const obj = this.objectManager.addObject('protractor-tool', {
      width: 360,
      height: 190,
      rotation: 0
    });
    return obj;
  }

  createStickyNote(color = '#fef08a') {
    this.objectManager.addObject('sticky', {
      color: color,
      text: '',
      width: 220,
      height: 180
    });
  }

  initTimer() {
    const timerWidget = document.getElementById('timer-widget');
    if (!timerWidget) return;

    const display = document.getElementById('timer-display');
    const minInput = document.getElementById('timer-min-input');
    const secInput = document.getElementById('timer-sec-input');
    const startBtn = document.getElementById('btn-timer-start');
    const resetBtn = document.getElementById('btn-timer-reset');
    const modeBtn = document.getElementById('btn-timer-mode');

    const updateDisplay = (secs) => {
      const m = String(Math.floor(secs / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      display.innerText = `${m}:${s}`;
    };

    startBtn.onclick = () => {
      if (this.isTimerRunning) {
        clearInterval(this.timerInterval);
        this.isTimerRunning = false;
        startBtn.innerHTML = '<i class="fas fa-play"></i> بدء';
        startBtn.className = 'btn btn-primary';
      } else {
        if (!this.isStopwatch && this.timerSecondsLeft <= 0) {
          const m = parseInt(minInput.value) || 0;
          const s = parseInt(secInput.value) || 0;
          this.timerSecondsLeft = m * 60 + s;
          if (this.timerSecondsLeft <= 0) this.timerSecondsLeft = 60;
        }

        this.isTimerRunning = true;
        startBtn.innerHTML = '<i class="fas fa-pause"></i> إيقاف مؤقت';
        startBtn.className = 'btn btn-warning';

        this.timerInterval = setInterval(() => {
          if (this.isStopwatch) {
            this.stopwatchElapsed++;
            updateDisplay(this.stopwatchElapsed);
          } else {
            if (this.timerSecondsLeft > 0) {
              this.timerSecondsLeft--;
              updateDisplay(this.timerSecondsLeft);
            } else {
              clearInterval(this.timerInterval);
              this.isTimerRunning = false;
              startBtn.innerHTML = '<i class="fas fa-play"></i> بدء';
              startBtn.className = 'btn btn-primary';
            }
          }
        }, 1000);
      }
    };

    resetBtn.onclick = () => {
      clearInterval(this.timerInterval);
      this.isTimerRunning = false;
      this.timerSecondsLeft = 0;
      this.stopwatchElapsed = 0;
      startBtn.innerHTML = '<i class="fas fa-play"></i> بدء';
      startBtn.className = 'btn btn-primary';
      updateDisplay(0);
    };

    modeBtn.onclick = () => {
      this.isStopwatch = !this.isStopwatch;
      modeBtn.innerText = this.isStopwatch ? 'وضع ساعة الإيقاف' : 'وضع المؤقت';
      document.querySelector('.timer-inputs').style.display = this.isStopwatch ? 'none' : 'flex';
      resetBtn.click();
    };
  }
}
