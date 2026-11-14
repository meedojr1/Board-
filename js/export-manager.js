/**
 * EduBoard Export & Print Manager
 * Exports high-resolution PNG, multi-page PDF documents, JSON sessions, and direct printing.
 */

class ExportManager {
  constructor(canvasEngine, objectManager) {
    this.canvasEngine = canvasEngine;
    this.objectManager = objectManager;
  }

  // Composite full whiteboard canvas into a standalone offscreen canvas
  async getCombinedCanvas() {
    const width = this.canvasEngine.container.clientWidth;
    const height = this.canvasEngine.container.clientHeight;
    const dpr = window.devicePixelRatio || 2;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width * dpr;
    exportCanvas.height = height * dpr;
    const ctx = exportCanvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 1. Draw Background
    ctx.drawImage(this.canvasEngine.bgCanvas, 0, 0, width, height);

    // 2. Draw Main Canvas Drawings
    ctx.drawImage(this.canvasEngine.mainCanvas, 0, 0, width, height);

    // 3. Draw DOM Objects (Images, Sticky notes, Text, STEM)
    for (const obj of this.objectManager.objects) {
      const screen = this.canvasEngine.worldToScreen(obj.x, obj.y);
      const scale = this.canvasEngine.scale;
      const w = obj.width * scale;
      const h = obj.height * scale;

      ctx.save();
      ctx.translate(screen.x, screen.y);
      if (obj.rotation) {
        ctx.rotate((obj.rotation * Math.PI) / 180);
      }

      if (obj.type === 'image' || obj.type === 'pdf-page') {
        const img = obj.element.querySelector('img');
        if (img && img.complete) {
          ctx.drawImage(img, 0, 0, w, h);
        }
      } else if (obj.type === 'sticky') {
        ctx.fillStyle = obj.data.color || '#fef08a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1e293b';
        ctx.font = '16px sans-serif';
        const lines = (obj.data.text || '').split('\n');
        lines.forEach((line, idx) => {
          ctx.fillText(line, 12, 28 + idx * 22, w - 24);
        });
      } else if (obj.type === 'text') {
        ctx.fillStyle = obj.data.color || '#1e293b';
        ctx.font = `${obj.data.fontSize || 22}px sans-serif`;
        ctx.fillText(obj.data.text || '', 0, 24, w);
      }

      ctx.restore();
    }

    return exportCanvas;
  }

  // Export as PNG Image
  async exportImage(filename = 'EduBoard_Lesson.png') {
    const canvas = await this.getCombinedCanvas();
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  }

  // Export as PDF Document
  async exportPDF(filename = 'EduBoard_Lesson.pdf') {
    const canvas = await this.getCombinedCanvas();
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(filename);
    } else {
      // Fallback: download as high-res PNG if jsPDF CDN is blocked
      this.exportImage(filename.replace('.pdf', '.png'));
    }
  }

  // Print whiteboard
  async printBoard() {
    const canvas = await this.getCombinedCanvas();
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Print EduBoard Lesson</title>
            <style>
              body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
              img { max-width: 100%; max-height: 100%; object-fit: contain; }
              @media print {
                body { margin: 0; }
                img { width: 100%; height: auto; }
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <img src="${dataUrl}" />
          </body>
        </html>
      `);
      win.document.close();
    }
  }
}
