export class FaceApiController {
    constructor() {
        this.initialized = false;
        this.lastDetections = null;
        this.lastFaceResults = null;
    }

    async initialize() {
        try {
            console.log('Loading face-api.js models...');
            this.updateStatus('Loading face detection models...', 'connected');
            
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri('/assets/faceapi'),
                faceapi.nets.faceLandmark68Net.loadFromUri('/assets/faceapi'),
                faceapi.nets.faceRecognitionNet.loadFromUri('/assets/faceapi'),
                faceapi.nets.faceExpressionNet.loadFromUri('/assets/faceapi')
            ]);
            
            this.initialized = true;
            console.log('Face-API.js models loaded successfully');
            this.updateStatus('Face detection models ready', 'connected');
            
        } catch (error) {
            console.error('Error loading face-api.js models:', error);
            this.updateStatus('Face models failed to load', 'disconnected');
            this.initialized = false;
        }
    }

    async detectFaces(imageSource) {
        if (!this.initialized) {
            return null;
        }
        
        try {
            const detections = await faceapi.detectAllFaces(
                imageSource, 
                new faceapi.TinyFaceDetectorOptions({
                    inputSize: 416,
                    scoreThreshold: 0.5
                })
            ).withFaceLandmarks();
            
            this.lastDetections = detections;
            return detections;
            
        } catch (error) {
            console.error('Error in face-api detection:', error);
            return null;
        }
    }

    updateStatus(message, className) {
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = message;
        }
    }

    getLastDetections() {
        return this.lastDetections;
    }

    setFaceResults(faceResults) {
        this.lastFaceResults = faceResults;
    }

    getFaceResults() {
        return this.lastFaceResults;
    }
}