export class WebSocketController {
    constructor() {
        this.socket = null;
        this.onAnalysisCallback = null;
        this.onStatusCallback = null;
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = (event) => {
            console.log('WebSocket connected');
            this.updateStatus('Connected to server', 'connected');
            
            if (window.controllers?.userMedia) {
                window.controllers.userMedia.onWebSocketConnected();
            }
        };
        
        this.socket.onclose = (event) => {
            console.log('WebSocket disconnected');
            this.updateStatus('Reconnecting...', 'disconnected');
            setTimeout(() => this.connect(), 1000);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('Connection error', 'disconnected');
        };
        
        //Incoming messages, sends them through callbacks to whomever is listening
        this.socket.onmessage = (event) => {
            try {
                
                const message = JSON.parse(event.data);

                if (message.type === 'analysis' && message.face_analysis) {
                    console.log('Face analysis results:', message.face_analysis);
                    console.info('Matching faces', message.matching_faces);
                    console.info('Timing stats:', message.timing_stats);

                    this.onAnalysisCallback(message);
                }else if(message.type === 'not_found') {
                    this.onAnalysisCallback(message);
                    this.updateStatus("Waiting...")
                }

            } catch (error) {
                console.error('Error parsing server message:', error);
            }
        };
    }

    send(message){
        
        const socket = this.getSocket();

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket not ready to send message');
            return;
        }

        socket.send(JSON.stringify(message));

        //message['image'] = '<redacted embedding>';
        //console.info('Sent message to server:', message);
    }



    updateStatus(message, className) {
        if (this.onStatusCallback) {
            this.onStatusCallback(message, className);
        }
        
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = message;
        }
    }

    setAnalysisCallback(callback) {
        this.onAnalysisCallback = callback;
    }

    setStatusCallback(callback) {
        this.onStatusCallback = callback;
    }

    getSocket() {
        return this.socket;
    }

    close() {
        if (this.socket) {
            this.socket.close();
        }
    }
}