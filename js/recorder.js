/**
 * EduBoard Screen & Lesson Recorder
 * Captures whiteboard display stream and teacher microphone narration.
 * Handles audio mixing, live status timer, and video export (MP4/WebM).
 */

class LessonRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.startTime = null;
    this.timerInterval = null;
    this.isRecording = false;
    this.isPaused = false;
    this.audioContext = null;
    this.mixedStream = null;

    this.banner = document.getElementById('recorder-banner');
    this.timerDisplay = document.getElementById('record-timer-text');
  }

  async startRecording(includeMic = true) {
    try {
      // 1. Capture screen or window
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          frameRate: { ideal: 30, max: 60 }
        },
        audio: true // System audio if available
      });

      let finalStream = displayStream;

      // 2. Mix teacher microphone if requested
      if (includeMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const destination = this.audioContext.createMediaStreamDestination();

          // Mix display audio if present
          if (displayStream.getAudioTracks().length > 0) {
            const displaySource = this.audioContext.createMediaStreamSource(displayStream);
            displaySource.connect(destination);
          }

          // Mix microphone audio
          const micSource = this.audioContext.createMediaStreamSource(micStream);
          micSource.connect(destination);

          // Combine video track + mixed audio track
          const mixedAudioTrack = destination.stream.getAudioTracks()[0];
          finalStream = new MediaStream([
            displayStream.getVideoTracks()[0],
            mixedAudioTrack
          ]);
        } catch (micErr) {
          console.warn('Microphone permission denied or unavailable, recording screen only:', micErr);
        }
      }

      this.mixedStream = finalStream;
      this.recordedChunks = [];

      // Determine supported mime type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      const selectedMime = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

      this.mediaRecorder = new MediaRecorder(finalStream, selectedMime ? { mimeType: selectedMime } : undefined);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.onRecordingStopped();
      };

      // Stop automatically if user clicks browser's native "Stop Sharing"
      displayStream.getVideoTracks()[0].onended = () => {
        if (this.isRecording) {
          this.stopRecording();
        }
      };

      this.mediaRecorder.start(1000); // 1-second chunks
      this.isRecording = true;
      this.startTime = Date.now();
      this.showBanner();
      this.startTimer();

      return true;
    } catch (err) {
      console.error('Failed to start screen recording:', err);
      return false;
    }
  }

  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
      clearInterval(this.timerInterval);
    }
  }

  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
      this.startTimer();
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.mixedStream) {
      this.mixedStream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.isRecording = false;
    this.isPaused = false;
    clearInterval(this.timerInterval);
    this.hideBanner();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      if (this.timerDisplay) {
        this.timerDisplay.innerText = `${mins}:${secs}`;
      }
    }, 1000);
  }

  showBanner() {
    if (this.banner) this.banner.classList.add('visible');
    const headerBtn = document.getElementById('btn-screen-record');
    if (headerBtn) headerBtn.classList.add('btn-recording');
  }

  hideBanner() {
    if (this.banner) this.banner.classList.remove('visible');
    const headerBtn = document.getElementById('btn-screen-record');
    if (headerBtn) headerBtn.classList.remove('btn-recording');
  }

  onRecordingStopped() {
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const videoUrl = URL.createObjectURL(blob);

    // Show preview modal
    const modal = document.getElementById('recording-modal');
    const videoEl = document.getElementById('recording-preview');
    const downloadBtn = document.getElementById('btn-download-recording');

    if (videoEl) {
      videoEl.src = videoUrl;
    }

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = `Lesson_Recording_${new Date().toISOString().slice(0, 10)}.webm`;
        a.click();
      };
    }

    if (modal) {
      modal.classList.add('active');
    }
  }
}
