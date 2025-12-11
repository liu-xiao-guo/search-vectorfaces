export class ScreenshotController {
    constructor() {
        this.statusCallback = null;
    }

    initialize(canvas) {
        this.canvas = canvas;
        
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                console.log('Taking screenshot...');
                this.updateStatus('Taking screenshot...', 'connected');
                this.captureFullPageScreenshot();
            }
        });
        
        this.canvas.addEventListener('dblclick', () => {
            console.log('Double-click screenshot...');
            this.updateStatus('Taking screenshot...', 'connected');
            this.captureFullPageScreenshot();
        });
    }

    captureFullPageScreenshot() {
        try {
            const screenshotCanvas = document.createElement('canvas');
            const screenshotCtx = screenshotCanvas.getContext('2d');
            
            screenshotCanvas.width = window.innerWidth;
            screenshotCanvas.height = window.innerHeight;
            
            screenshotCtx.fillStyle = getComputedStyle(document.body).backgroundColor || '#f0f0f0';
            screenshotCtx.fillRect(0, 0, screenshotCanvas.width, screenshotCanvas.height);
            
            const gridContainer = document.getElementById('gridContainer');
            if (gridContainer && typeof html2canvas !== 'undefined') {
                html2canvas(gridContainer, {
                    useCORS: true,
                    allowTaint: true,
                    scale: 1,
                    width: window.innerWidth,
                    height: window.innerHeight
                }).then(gridCanvas => {
                    screenshotCtx.drawImage(gridCanvas, 0, 0);
                    
                    this.captureVideoContainer(screenshotCtx);
                    
                    this.downloadScreenshot(screenshotCanvas);
                });
            } else {
                this.captureManualScreenshot(screenshotCanvas, screenshotCtx);
            }
            
        } catch (error) {
            console.error('Error capturing screenshot:', error);
            if (this.canvas) {
                this.downloadScreenshot(this.canvas, 'vectorfaces-video-only');
            }
        }
    }

    captureVideoContainer(screenshotCtx) {
        const videoContainer = document.querySelector('.user-media-container');
        if (videoContainer && this.canvas) {
            const videoRect = videoContainer.getBoundingClientRect();
            
            screenshotCtx.drawImage(this.canvas, videoRect.left, videoRect.top, this.canvas.width, this.canvas.height);
            
            const statusDiv = document.getElementById('status');
            if (statusDiv) {
                const statusRect = statusDiv.getBoundingClientRect();
                screenshotCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                screenshotCtx.fillRect(
                    statusRect.left, 
                    statusRect.top, 
                    statusRect.width, 
                    statusRect.height
                );
                screenshotCtx.fillStyle = 'white';
                screenshotCtx.font = '10px Arial';
                screenshotCtx.textAlign = 'center';
                screenshotCtx.fillText(
                    statusDiv.textContent,
                    statusRect.left + statusRect.width / 2,
                    statusRect.top + statusRect.height / 2 + 3
                );
            }
        }
    }

    captureManualScreenshot(screenshotCanvas, screenshotCtx) {
        const videoContainer = document.querySelector('.user-media-container');
        if (videoContainer && this.canvas) {
            const videoRect = videoContainer.getBoundingClientRect();
            
            screenshotCtx.drawImage(this.canvas, videoRect.left, videoRect.top, this.canvas.width, this.canvas.height);
        }
        
        this.downloadScreenshot(screenshotCanvas);
    }

    downloadScreenshot(canvas, filename = 'vectorfaces-screenshot') {
        try {
            canvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.download = `${filename}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
                link.href = URL.createObjectURL(blob);
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                URL.revokeObjectURL(link.href);
                
                console.log('Screenshot saved as:', link.download);
                this.updateStatus('Screenshot saved!', 'connected');
                
                setTimeout(() => {
                    this.updateStatus('Streaming active', 'connected');
                }, 2000);
                
            }, 'image/png');
        } catch (error) {
            console.error('Error downloading screenshot:', error);
            this.updateStatus('Screenshot failed', 'disconnected');
        }
    }

    updateStatus(message, className) {
        if (this.statusCallback) {
            this.statusCallback(message, className);
        }
        
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = message;
        }
    }

    setStatusCallback(callback) {
        this.statusCallback = callback;
    }

    updateCanvasReferences(canvas) {
        this.canvas = canvas;
    }
}