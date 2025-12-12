
import { CameraMedia } from '../mediasource/CameraMedia.js';
import { PictureMedia } from '../mediasource/PictureMedia.js';

export class UserMediaController {
    constructor() {
        this.video = null;
        this.status = null;
        this.streamInterval = null;
        this.isStreaming = false;
        this.countdownTimer = null;
        this.countdownStartTime = null;

        this.captureInterval = 10000;

        this.videoHeight = 35;
        this.mediaToggle = document.getElementById('media-toggle');
        
        // Initialize media sources
        this.cameraMedia = new CameraMedia(this);
        this.pictureMedia = new PictureMedia(this);
        this.currentMediaSource = this.cameraMedia;
    }

    initialize() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        this.countdownElement = document.getElementById('captureCountdown');
        this.countdownProgress = this.countdownElement?.querySelector('.countdown-progress');

        this.video.style.visibility = 'visible';
        this.status.style.visibility = 'visible';

        this.mediaToggle.style.visibility = 'visible';
        
        this.setupToggleListeners();
        
        // Initialize media sources
        this.cameraMedia.initialize(this.videoHeight);
        this.pictureMedia.initialize(this.videoHeight);
        
        // Start with camera media
        this.currentMediaSource = this.cameraMedia;
        this.currentMediaSource.show();
    }

    setupToggleListeners() {
        const toggleButtons = this.mediaToggle.querySelectorAll('.toggle-option');
        
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.getAttribute('data-mode');
                this.switchMode(mode);
            });
        });
    }

    switchMode(mode) {
        const targetMediaSource = mode === 'camera' ? this.cameraMedia : this.pictureMedia;
        
        if (targetMediaSource === this.currentMediaSource) return;
        
        // Stop current media source
        this.currentMediaSource.stop();
        this.currentMediaSource.hide();
        
        // Update button states
        const toggleButtons = this.mediaToggle.querySelectorAll('.toggle-option');
        toggleButtons.forEach(button => {
            if (button.getAttribute('data-mode') === mode) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Switch to new media source
        this.currentMediaSource = targetMediaSource;
        this.currentMediaSource.show();
        this.currentMediaSource.start();
    }

    switchToSnapshotMode() {
        const snapshotData = this.cameraMedia.getImageData();
        if (!snapshotData) return;

        const img = new Image();
        img.onload = () => {
            this.pictureMedia.setSnapshotImage(img);
            
            this.currentMediaSource.stop();
            this.currentMediaSource.hide();
            
            const toggleButtons = this.mediaToggle.querySelectorAll('.toggle-option');
            toggleButtons.forEach(button => {
                if (button.getAttribute('data-mode') === 'image') {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
            
            this.currentMediaSource = this.pictureMedia;
            this.currentMediaSource.show();
            this.currentMediaSource.start();
        };
        img.src = snapshotData;
    }

    switchToCameraMode() {
        if (this.currentMediaSource === this.cameraMedia) return;
        
        this.currentMediaSource.stop();
        this.currentMediaSource.hide();
        
        const toggleButtons = this.mediaToggle.querySelectorAll('.toggle-option');
        toggleButtons.forEach(button => {
            if (button.getAttribute('data-mode') === 'camera') {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        this.currentMediaSource = this.cameraMedia;
        this.currentMediaSource.show();
        this.currentMediaSource.start();
    }

    async startStream() {
        await this.currentMediaSource.start();
    }


    handleStreamError(error) {
        console.error('Error accessing webcam:', error);
        
        let errorMessage = 'Error accessing webcam: ';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage += 'Camera permission denied. Please allow camera access and refresh the page.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage += 'No camera found. Please ensure your device has a camera.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage += 'Camera is busy or unavailable. Please close other apps using the camera.';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
            errorMessage += 'Camera constraints not supported. Trying with basic settings...';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Camera not supported in this browser. Try using Chrome, Firefox, or Safari.';
        } else if (error.name === 'SecurityError') {
            errorMessage += 'Security error. Please ensure you\'re using HTTPS or localhost.';
        } else if (error.message && error.message.includes('getUserMedia')) {
            errorMessage += 'Browser too old or incompatible. Please update your browser or try a different one.';
        } else {
            // Check if it's likely an HTTPS issue
            const isHttp = location.protocol === 'http:' && 
                          location.hostname !== 'localhost' && 
                          location.hostname !== '127.0.0.1';
            
            if (isHttp) {
                errorMessage += 'HTTPS is required for camera access. Please use HTTPS or localhost.';
            } else {
                errorMessage += error.message || 'Unknown error occurred.';
            }
        }
        
        alert(errorMessage);
        this.currentMediaSource.updateStatus('Camera access failed', 'disconnected');
    }

    stopStream() {
        if (this.streamInterval) {
            clearTimeout(this.streamInterval);
            this.streamInterval = null;
        }
        
        this.stopCountdown();
        this.currentMediaSource.stop();
        
        this.isStreaming = false;
        
        this.currentMediaSource.updateStatus('Stream stopped', 'disconnected');
    }

    startCountdown() {
        if (!this.countdownElement || !this.countdownProgress) return;
        
        this.countdownElement.style.display = 'block';
        this.countdownStartTime = Date.now();
        this.updateCountdown();
    }

    updateCountdown() {
        if (!this.isStreaming || !this.countdownProgress) return;
        
        const elapsed = Date.now() - this.countdownStartTime;
        const progress = Math.min(elapsed / this.captureInterval, 1);
        const circumference = 100.53;
        const offset = circumference * progress;
        
        this.countdownProgress.style.strokeDashoffset = offset;
        
        if (progress < 1) {
            this.countdownTimer = requestAnimationFrame(() => this.updateCountdown());
        }
    }

    stopCountdown() {
        if (this.countdownTimer) {
            cancelAnimationFrame(this.countdownTimer);
            this.countdownTimer = null;
        }
        if (this.countdownElement) {
            this.countdownElement.style.display = 'none';
        }
        if (this.countdownProgress) {
            this.countdownProgress.style.strokeDashoffset = 0;
        }
    }

    resetCountdown() {
        if (this.countdownTimer) {
            cancelAnimationFrame(this.countdownTimer);
        }
        this.startCountdown();
    }


    scheduleNextCapture() {
        if (this.streamInterval) {
            clearTimeout(this.streamInterval);
        }

        let interval = this.captureInterval;
        
        this.resetCountdown();
                
        this.streamInterval = setTimeout(() => {
            this.captureAndSend();
            if (this.isStreaming) {
                this.scheduleNextCapture();
                console.info("Scheduling the next capture in ",interval, "ms")
            }
        }, interval);
        
    }

    captureAndSend() {
        const imageData = this.currentMediaSource.getImageData();
        if (!imageData) return;
        
        this.triggerFlash();
        
        const message = {
            type: 'frame',
            timestamp: new Date().toISOString(),
            image: imageData,
            settings: window.settings
        };

        window.controllers.webSocket.send(message); 
    }

    triggerFlash() {
        const container = document.querySelector('.user-media-container');
        if (!container) return;
        
        container.classList.add('flash');
        setTimeout(() => {
            container.classList.remove('flash');
        }, 300);
    }

    onWebSocketConnected() {
        if (this.isStreaming) {
            this.currentMediaSource.onWebSocketConnected?.();
        }
    }

    setPreviewUpdateCallback(callback) {
        this.onPreviewUpdated = callback;
    }

    setFaceResults(faceAnalysis) {
        if (window.controllers.faceApi) {
            window.controllers.faceApi.setFaceResults(faceAnalysis);
        }
    }
}
