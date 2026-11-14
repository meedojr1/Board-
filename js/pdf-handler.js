/**
 * EduBoard PDF & Media Handler
 * Loads images and multi-page PDF files using PDF.js.
 * Provides thumbnail picker, page navigation, and board insertion.
 */

class PDFMediaHandler {
  constructor(canvasEngine, objectManager) {
    this.canvasEngine = canvasEngine;
    this.objectManager = objectManager;
    this.pdfDoc = null;
    this.currentPdfPage = 1;
    this.totalPdfPages = 0;
    this.pdfThumbnails = [];

    this.initPdfJs();
  }

  initPdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  // Load Image File
  handleImageUpload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate initial aspect ratio box
          const maxWidth = 480;
          const scale = Math.min(1, maxWidth / img.width);
          const width = img.width * scale;
          const height = img.height * scale;

          const obj = this.objectManager.addObject('image', {
            src: e.target.result,
            width: width,
            height: height
          });
          resolve(obj);
        };
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Load PDF File
  async handlePdfUpload(file, progressCallback) {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);
          if (!window.pdfjsLib) {
            throw new Error('PDF.js library not loaded.');
          }

          const loadingTask = window.pdfjsLib.getDocument(typedarray);
          this.pdfDoc = await loadingTask.promise;
          this.totalPdfPages = this.pdfDoc.numPages;
          this.currentPdfPage = 1;
          this.pdfThumbnails = [];

          // Generate thumbnails for all pages
          for (let i = 1; i <= this.totalPdfPages; i++) {
            const page = await this.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            this.pdfThumbnails.push({
              pageNumber: i,
              dataUrl: canvas.toDataURL('image/jpeg', 0.8)
            });

            if (progressCallback) {
              progressCallback(i, this.totalPdfPages);
            }
          }

          // Render first page onto board
          await this.insertPdfPageToBoard(1);
          resolve(this.pdfThumbnails);
        } catch (err) {
          reject(err);
        }
      };
      fileReader.readAsArrayBuffer(file);
    });
  }

  async renderPageToDataUrl(pageNumber, scale = 1.5) {
    if (!this.pdfDoc || pageNumber < 1 || pageNumber > this.totalPdfPages) return null;
    const page = await this.pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: viewport.width / (scale / 1.0),
      height: viewport.height / (scale / 1.0)
    };
  }

  async insertPdfPageToBoard(pageNumber) {
    this.currentPdfPage = pageNumber;
    const pageData = await this.renderPageToDataUrl(pageNumber, 1.8);
    if (!pageData) return null;

    const maxWidth = 550;
    const ratio = maxWidth / pageData.width;

    return this.objectManager.addObject('pdf-page', {
      src: pageData.dataUrl,
      pageNumber: pageNumber,
      totalPages: this.totalPdfPages,
      width: maxWidth,
      height: pageData.height * ratio
    });
  }
}
