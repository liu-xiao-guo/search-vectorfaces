import { MediaSource } from './MediaSource.js';

// CameraMedia implementation
export class CameraMedia extends MediaSource {
    constructor(manager) {
        super(manager);
        this.video = null;
        this.previewInterval = null;
        this.statusAlternateInterval = null;
        this.currentStatusIndex = 0;
        this.statusMessages = [
            '...',
            'You\'re looking great!',
            'Perfect angle!',
            'Smile detected!',
            'Double tap for screenshot!',
            'You\'re photogenic!',
            'Camera loves you!',
            'Error 555 - Way too good looking!',
            'Vectors can\'t capture all of your beauty!',
            'Do I know you from somewhere?'
        ];
    }

    initialize(videoHeight) {
        this.video = this.manager.video;
        
        // Create canvas element
        this.canvas = document.getElementById('videoCanvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'videoCanvas';
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

        this.showStatus();
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
        const imageUploadButton = document.getElementById('imageUploadButton');
        if (imageUploadButton) {
            imageUploadButton.style.display = 'none';
        }
    }

    hide() {
        super.hide();
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
        try {
            const isSecureContext = window.isSecureContext || 
                                   location.protocol === 'https:' || 
                                   location.hostname === 'localhost' || 
                                   location.hostname === '127.0.0.1';
            
            if (!isSecureContext) {
                throw new Error('Camera access requires HTTPS. Please access this page via HTTPS or localhost.');
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return this.handleLegacyGetUserMedia();
            }

            let stream = await this.tryGetUserMedia();
            
            this.video.srcObject = stream;
            
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = async () => {
                    console.log('Video metadata loaded. Video dimensions:', this.video.videoWidth, 'x', this.video.videoHeight);
                    console.log('Video readyState:', this.video.readyState);
                    
                    try {
                        await this.video.play();
                        console.log('Video playback started successfully');
                        
                        if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
                            console.error('Video dimensions are 0, stream may not be working');
                            reject(new Error('Video stream has invalid dimensions'));
                            return;
                        }
                    
                        const socket = window.controllers?.webSocket?.getSocket();
                        if (socket && socket.readyState === WebSocket.OPEN) {
                            this.startAlternatingStatus();
                        } else {
                            this.updateStatus('Connecting to server...', 'connected');
                        }

                        this.manager.isStreaming = true;
                        this.manager.captureAndSend();
                        this.manager.scheduleNextCapture();

                        this.previewInterval = setInterval(() => this.update(), 33);
                        
                        resolve();
                    } catch (playError) {
                        console.error('Failed to play video:', playError);
                        reject(new Error(`Failed to play video: ${playError.message}`));
                    }
                };
                
                this.video.onerror = (error) => {
                    console.error('Video element error:', error);
                    reject(new Error('Failed to load video stream'));
                };
                
                setTimeout(() => {
                    if (!this.manager.isStreaming) {
                        console.error('Video stream loading timeout - current readyState:', this.video.readyState);
                        reject(new Error('Video stream loading timeout'));
                    }
                }, 10000);
            });
            
        } catch (error) {
            this.manager.handleStreamError(error);
            throw error;
        }
    }

    async tryGetUserMedia() {
        let constraints = {
                video: {
                    facingMode: 'user',
                    width: { ideal: 480, min: 320, max: 1280 },
                    height: { ideal: 700, min: 240, max: 1920 },
                },
                audio: false
        };

        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            console.warn('Failed with ideal constraints, trying basic constraints:', error);
            
            const basicConstraints = {
                video: { facingMode: 'user' },
                audio: false
            };
            
            try {
                return await navigator.mediaDevices.getUserMedia(basicConstraints);
            } catch (fallbackError) {
                console.warn('Failed with basic constraints, trying minimal constraints:', fallbackError);
                
                return await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }
        }
    }

    stop() {
        if (this.previewInterval) {
            clearInterval(this.previewInterval);
            this.previewInterval = null;
        }
        
        if (this.statusAlternateInterval) {
            clearTimeout(this.statusAlternateInterval);
            this.statusAlternateInterval = null;
        }
        
        if (this.video.srcObject) {
            const tracks = this.video.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.video.srcObject = null;
        }
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.detectionCtx) {
            this.detectionCtx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        }
        this.lastDetections = null;
    }

    startAlternatingStatus() {
        if (this.statusAlternateInterval) {
            return;
        }
        
        this.updateStatus(this.statusMessages[this.currentStatusIndex], 'connected');
        
        const setRandomInterval = () => {
            const randomDelay = Math.floor(Math.random() * 7000) + 3000;
            this.statusAlternateInterval = setTimeout(() => {
                this.currentStatusIndex = (this.currentStatusIndex + 1) % this.statusMessages.length;
                this.updateStatus(this.statusMessages[this.currentStatusIndex], 'connected');
                setRandomInterval();
            }, randomDelay);
        };
        
        setRandomInterval();
    }

    onWebSocketConnected() {
        this.startAlternatingStatus();
    }

    async update() {
        if (this.video && this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            const ctx = this.getContext();
            const canvas = this.getCanvas();
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const videoWidth = this.video.videoWidth;
            const videoHeight = this.video.videoHeight;
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            if (!this._frameCount) this._frameCount = 0;
            if (this._frameCount < 3) {
                console.log('Preview update:', {
                    frameCount: this._frameCount,
                    videoWidth,
                    videoHeight,
                    canvasWidth,
                    canvasHeight,
                    videoReadyState: this.video.readyState,
                    videoPaused: this.video.paused,
                    videoCurrentTime: this.video.currentTime
                });
            }
            this._frameCount++;
            
            const videoAspectRatio = videoWidth / videoHeight;
            const canvasAspectRatio = canvasWidth / canvasHeight;
            
            let sourceX = 0;
            let sourceY = 0;
            let sourceWidth = videoWidth;
            let sourceHeight = videoHeight;
            
            if (videoAspectRatio > canvasAspectRatio) {
                sourceWidth = videoHeight * canvasAspectRatio;
                sourceX = (videoWidth - sourceWidth) / 2;
            }
            else if (videoAspectRatio < canvasAspectRatio) {
                sourceHeight = videoWidth / canvasAspectRatio;
                sourceY = (videoHeight - sourceHeight) / 2;
            }
            
            ctx.drawImage(
                this.video,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, canvasWidth, canvasHeight
            );
            
            this.drawWatermark();
            
            const detections = await window.controllers.faceApi.detectFaces(this.video);
            if (detections && detections.length > 0) {
                this.lastDetections = { detections, sourceX, sourceY, sourceWidth, sourceHeight };
            } else {
                this.lastDetections = null;
            }
            
            if (this.lastDetections) {
                this.drawFaceDetections(
                    this.lastDetections.detections,
                    this.lastDetections.sourceX,
                    this.lastDetections.sourceY,
                    this.lastDetections.sourceWidth,
                    this.lastDetections.sourceHeight
                );
            }
            
            this.manager.onPreviewUpdated && this.manager.onPreviewUpdated();
        } else if (this.video) {
            if (!this._notReadyCount) this._notReadyCount = 0;
            if (this._notReadyCount < 5) {
                console.warn('Video not ready for preview:', {
                    readyState: this.video.readyState,
                    HAVE_ENOUGH_DATA: this.video.HAVE_ENOUGH_DATA,
                    paused: this.video.paused,
                    videoWidth: this.video.videoWidth,
                    videoHeight: this.video.videoHeight
                });
            }
            this._notReadyCount++;
        }
    }
}
