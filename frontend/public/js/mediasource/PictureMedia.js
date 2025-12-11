import { MediaSource } from './MediaSource.js';

// PictureMedia implementation
export class PictureMedia extends MediaSource {
    constructor(manager) {
        super(manager);
        this.uploadedImage = null;
        this.imageUploadButton = null;
        this.imageUploadInput = null;
    }

    initialize(videoHeight) {
        // Create canvas element
        this.canvas = document.getElementById('imageCanvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'imageCanvas';
            const container = document.querySelector('.user-media-container');
            container.appendChild(this.canvas);
        }
        
        this.ctx = this.canvas.getContext('2d');

        // Set canvas sizes
        this.canvas.style.height = `${videoHeight}vh`;
        this.canvas.style.width = `calc(${videoHeight}vh * 0.686)`;
        this.canvas.style.visibility = 'visible';
        
        this.updateCanvasSize(videoHeight);
        this.createDetectionCanvas();
        
        // Setup image upload controls
        this.imageUploadButton = document.getElementById('imageUploadButton');
        this.imageUploadInput = document.getElementById('imageUploadInput');
        this.setupImageUpload();

        this.hideStatus();
        
    }

    updateCanvasSize(videoHeight) {
        const canvasHeight = Math.floor(window.innerHeight * (videoHeight / 100));
        const canvasWidth = Math.floor(canvasHeight * 0.686);
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        if (this.detectionCanvas) {
            this.createDetectionCanvas();
        }
    }

    show() {
        super.show();
        if (!this.uploadedImage) {
            this.imageUploadButton.style.display = 'flex';
        }
        
        if (window.controllers?.grid) {
            window.controllers.grid.clearGrid();
        }
    }

    hide() {
        super.hide();
        if (this.imageUploadButton) {
            this.imageUploadButton.style.display = 'none';
        }
    }

    setupImageUpload() {
        if (this.imageUploadButton && this.imageUploadInput) {
            this.imageUploadButton.addEventListener('click', () => {
                this.imageUploadInput.click();
            });

            this.imageUploadInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    this.loadImageFile(file);
                }
            });
        }
    }

    drawFaceDetections(detections, sourceX, sourceY, sourceWidth, sourceHeight) {
        if (!detections || detections.length === 0 || !this.detectionCtx) {
            return;
        }

        // Clear the detection canvas first
        this.detectionCtx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        const scaleX = canvasWidth / sourceWidth;
        const scaleY = canvasHeight / sourceHeight;
        
        detections.forEach(detection => {
            const box = detection.detection.box;
            
            const x = (box.x - sourceX) * scaleX;
            const y = (box.y - sourceY) * scaleY;
            const width = box.width * scaleX;
            const height = box.height * scaleY;
            
            this.detectionCtx.strokeStyle = '#11ff006b'; 
            this.detectionCtx.lineWidth = 2;
            this.detectionCtx.strokeRect(x, y, width, height);
            
            // Draw landmarks mesh
            if (detection.landmarks && window.settings.showFacialFeatures) {
                const landmarks = detection.landmarks.positions.map(point => ({
                    x: (point.x - sourceX) * scaleX,
                    y: (point.y - sourceY) * scaleY
                }));
                
                // Draw mesh connections
                this.detectionCtx.strokeStyle = '#FFFFFF5a';
                this.detectionCtx.lineWidth = 2;
                
                // Face outline connections
                const faceOutline = [
                    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], 
                    [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 16]
                ];
                
                // Left eyebrow
                const leftEyebrow = [[17, 18], [18, 19], [19, 20], [20, 21]];
                
                // Right eyebrow
                const rightEyebrow = [[22, 23], [23, 24], [24, 25], [25, 26]];
                
                // Nose bridge
                const noseBridge = [[27, 28], [28, 29], [29, 30]];
                
                // Nose base
                const noseBase = [[31, 32], [32, 33], [33, 34], [34, 35], [30, 33]];
                
                // Left eye
                const leftEye = [[36, 37], [37, 38], [38, 39], [39, 40], [40, 41], [41, 36]];
                
                // Right eye
                const rightEye = [[42, 43], [43, 44], [44, 45], [45, 46], [46, 47], [47, 42]];
                
                // Outer lip
                const outerLip = [
                    [48, 49], [49, 50], [50, 51], [51, 52], [52, 53], [53, 54], 
                    [54, 55], [55, 56], [56, 57], [57, 58], [58, 59], [59, 48]
                ];
                
                // Inner lip
                const innerLip = [
                    [60, 61], [61, 62], [62, 63], [63, 64], [64, 65], [65, 66], [66, 67], [67, 60]
                ];
                
                const allConnections = [
                    ...faceOutline, ...leftEyebrow, ...rightEyebrow, 
                    ...noseBridge, ...noseBase, ...leftEye, ...rightEye, 
                    ...outerLip, ...innerLip
                ];
                
                // Draw all connections
                allConnections.forEach(([i, j]) => {
                    if (landmarks[i] && landmarks[j]) {
                        this.detectionCtx.beginPath();
                        this.detectionCtx.moveTo(landmarks[i].x, landmarks[i].y);
                        this.detectionCtx.lineTo(landmarks[j].x, landmarks[j].y);
                        this.detectionCtx.stroke();
                    }
                });
                
                // Draw landmark points
                this.detectionCtx.fillStyle = '#FFFFFF5a';
                landmarks.forEach(point => {
                    if (point.x >= 0 && point.x <= canvasWidth && point.y >= 0 && point.y <= canvasHeight) {
                        this.detectionCtx.beginPath();
                        this.detectionCtx.arc(point.x, point.y, 1.5, 0, 2 * Math.PI);
                        this.detectionCtx.fill();
                    }
                });
            }
        });
    }

    async start() {
        if (this.uploadedImage) {
            this.drawImageOnCanvas();
            this.manager.captureAndSend();
            this.manager.scheduleNextCapture();
        }
    }

    stop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.detectionCtx) {
            this.detectionCtx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        }
        this.lastDetections = null;
    }

    update() {
        // No continuous updates needed for static images
    }

    loadImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.uploadedImage = img;
                this.drawImageOnCanvas();
                this.imageUploadButton.style.display = 'none';
                this.startImageAnalysis();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);

    }

    drawImageOnCanvas() {
        if (!this.uploadedImage || !this.getContext()) return;

        const canvas = this.getCanvas();
        const ctx = this.getContext();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const imgWidth = this.uploadedImage.width;
        const imgHeight = this.uploadedImage.height;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const imgAspectRatio = imgWidth / imgHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let sourceX = 0, sourceY = 0, sourceWidth = imgWidth, sourceHeight = imgHeight;

        if (imgAspectRatio > canvasAspectRatio) {
            sourceWidth = imgHeight * canvasAspectRatio;
            sourceX = (imgWidth - sourceWidth) / 2;
        } else if (imgAspectRatio < canvasAspectRatio) {
            sourceHeight = imgWidth / canvasAspectRatio;
            sourceY = (imgHeight - sourceHeight) / 2;
        }

        ctx.drawImage(
            this.uploadedImage,
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, canvasWidth, canvasHeight
        );

        this.drawWatermark();
        this.detectAndDrawImageFaces(sourceX, sourceY, sourceWidth, sourceHeight);
    }

    async detectAndDrawImageFaces(sourceX, sourceY, sourceWidth, sourceHeight) {
        if (!window.controllers.faceApi || !this.uploadedImage) return;

        const detections = await window.controllers.faceApi.detectFaces(this.uploadedImage);
        if (detections && detections.length > 0) {
            this.drawFaceDetections(detections, sourceX, sourceY, sourceWidth, sourceHeight);
        }
    }

    startImageAnalysis() {
        this.manager.captureAndSend();
        this.manager.scheduleNextCapture();
    }

    onWebSocketConnected() {
        // PictureMedia doesn't use alternating status messages
    }
}
