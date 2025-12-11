export class UploadController {
    constructor() {
        this.maxFileSize = 10 * 1024 * 1024;
        this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        this.uploadInput = null;
        this.uploadBtn = null;
    }

    initialize() {
        this.createUploadInput();
    }

    createUploadInput() {
        this.uploadInput = document.createElement('input');
        this.uploadInput.type = 'file';
        this.uploadInput.accept = this.allowedTypes.join(',');
        this.uploadInput.style.display = 'none';
        this.uploadInput.addEventListener('change', (e) => this.handleFileSelect(e));
        document.body.appendChild(this.uploadInput);

        this.uploadBtn = document.createElement('button');
        this.uploadBtn.id = 'uploadBtn';
        this.uploadBtn.className = 'button is-primary is-rounded upload-btn';
        this.uploadBtn.setAttribute('aria-label', 'Upload photo');
        this.uploadBtn.innerHTML = `
            <span class="icon">
                <i class="fas fa-upload"></i>
            </span>
        `;
        this.uploadBtn.addEventListener('click', () => this.triggerFileSelect());
        
        document.body.appendChild(this.uploadBtn);
    }

    triggerFileSelect() {
        this.uploadInput.click();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }

    async handleFile(file) {
        try {
            if (!this.validateFile(file)) {
                return;
            }

            this.updateButtonText('⏳ Processing...');
            this.updateStatus('Processing uploaded image...', 'connected');

            const img = new Image();
            const fileUrl = URL.createObjectURL(file);

            img.onload = async () => {
                try {
                    this.updateButtonText('⬆️ Uploading...');
                    this.updateStatus('Uploading to server...', 'connected');
                    
                    const imageData = this.getImageData(img);
                    
                    await this.sendImageForAnalysis(imageData, file.name);
                    
                    URL.revokeObjectURL(fileUrl);
                    
                    setTimeout(() => {
                        this.updateButtonText('📁 Upload Photo');
                    }, 3000);
                    
                } catch (error) {
                    console.error('Error processing uploaded image:', error);
                    this.updateStatus('Error processing image', 'disconnected');
                    this.updateButtonText('📁 Upload Photo');
                    URL.revokeObjectURL(fileUrl);
                }
            };

            img.onerror = () => {
                this.updateStatus('Error loading image file', 'disconnected');
                this.updateButtonText('📁 Upload Photo');
                URL.revokeObjectURL(fileUrl);
            };

            img.src = fileUrl;

        } catch (error) {
            console.error('Error handling uploaded file:', error);
            this.updateStatus('Upload failed', 'disconnected');
            this.updateButtonText('📁 Upload Photo');
        }
    }

    validateFile(file) {
        if (!this.allowedTypes.includes(file.type)) {
            alert(`Invalid file type. Please upload: ${this.allowedTypes.join(', ')}`);
            return false;
        }

        if (file.size > this.maxFileSize) {
            alert(`File too large. Maximum size: ${this.maxFileSize / (1024 * 1024)}MB`);
            return false;
        }

        return true;
    }

    getImageData(img) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        const maxWidth = 640;
        const maxHeight = 480;
        
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
            const scaleX = maxWidth / width;
            const scaleY = maxHeight / height;
            const scale = Math.min(scaleX, scaleY);
            
            width = Math.floor(width * scale);
            height = Math.floor(height * scale);
        }
        
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        tempCtx.drawImage(img, 0, 0, width, height);
        
        return tempCanvas.toDataURL('image/jpeg', 0.8);
    }

    async sendImageForAnalysis(imageData, filename, name) {
        try {
            this.currentImageData = imageData;
            
            const response = await fetch(imageData);
            const blob = await response.blob();
            
            const formData = new FormData();
            formData.append('image', blob, filename);
            formData.append('timestamp', new Date().toISOString());
            
            console.log('Sending upload request to /api/upload');
            
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            console.log('Upload response status:', uploadResponse.status);
            
            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
            }
            
            const result = await uploadResponse.json();
            console.log('Upload result:', result);
            
            this.handleUploadResponse(result);
            
        } catch (error) {
            console.error('Error uploading image:', error);
            this.updateStatus(`Upload failed: ${error.message}`, 'disconnected');
            this.updateButtonText('📁 Upload Photo');
        }
    }

    handleUploadResponse(result) {
        if (result.type == 'analysis') {
            const faceCount = result.face_analysis?.face_count || 0;
            this.updateStatus(`✅ Upload successful! Found ${faceCount} face(s)`, 'connected');
            this.updateButtonText('✅ Upload Complete');
            
            console.log('Upload result:', JSON.stringify(result));

            if (faceCount > 0) {
                this.showAnalysisModal(this.currentImageData, result);
                
                setTimeout(() => {
                    this.updateStatus(`${faceCount} face(s) analyzed!`, 'connected');
                }, 2000);
            } else {
                setTimeout(() => {
                    this.updateStatus('No faces detected in image', 'disconnected');
                    this.updateButtonText('📁 Upload Photo');
                }, 2000);
            }
        } else {
            this.updateStatus(`Upload failed: ${result.error || 'Unknown error'}`, 'disconnected');
            this.updateButtonText('📁 Upload Photo');
        }
    }

    showAnalysisModal(imageData, result) {
        const imageContainer = document.getElementById('analysis-image-container');
        const resultsContainer = document.getElementById('analysis-results-container');
        
        const faces = result.face_analysis?.faces || [];
        const faceCount = result.face_analysis?.face_count || 0;
        
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            ctx.drawImage(img, 0, 0);
            
            faces.forEach((face, index) => {
                const bbox = face.bbox || [0, 0, 0, 0];
                const [x1, y1, x2, y2] = bbox;
                
                ctx.strokeStyle = '#ffffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                
                ctx.fillStyle = '#ffffffff';
                ctx.font = '13px Arial';
                ctx.fillText(`Face ${index + 1}`, x1, y1 - 5);
                
                if (face.landmark && Array.isArray(face.landmark)) {
                    ctx.fillStyle = '#ff00fb81';
                    face.landmark.forEach(([lx, ly]) => {
                        ctx.beginPath();
                        ctx.arc(lx, ly, 2, 0, 2 * Math.PI);
                        ctx.fill();
                    });
                }
            });
            
            imageContainer.innerHTML = '';
            imageContainer.appendChild(canvas);
        };
        img.src = imageData;
        
        resultsContainer.innerHTML = `
            <div class="analysis-summary">
                <p><strong>Faces detected:</strong> ${faceCount}</p>
                <p><strong>Processing time:</strong> ${result.timing_stats?.face_analysis_ms?.toFixed(2) || 0}ms</p>
            </div>
            <div class="analysis-faces">
                ${faces.map((face, index) => {
                    const bbox = face.bbox || [0, 0, 0, 0];
                    const x = Math.round(bbox[0]);
                    const y = Math.round(bbox[1]);
                    const width = Math.round(bbox[2] - bbox[0]);
                    const height = Math.round(bbox[3] - bbox[1]);
                    const embedding = face.embedding || [];
                    
                    return `
                        <div class="analysis-face-item">
                            <div class="face-header">
                                <h3>Face ${index + 1}</h3>
                                <button class="index-btn" data-face-index="${index}">Index to Elasticsearch</button>
                            </div>

                            <div class="face-form">
                                <label for="face-name-${index}">Name:</label>
                                <input type="text" id="face-name-${index}" class="face-name-input" placeholder="Enter name (optional)">
                            </div>
                            
                            <details class="embedding-details">
                                <summary>Embedding Vector</summary>
                                <pre class="embedding-data">${JSON.stringify(embedding, null, 2)}</pre>
                            </details>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        resultsContainer.querySelectorAll('.index-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const faceIndex = parseInt(e.target.dataset.faceIndex);
                const nameInput = document.getElementById(`face-name-${faceIndex}`);
                const name = nameInput.value.trim();
                this.indexFaceToElasticsearch(faceIndex, name, faces[faceIndex], result);
            });
        });
        
        // Show Bulma modal
        const modal = document.getElementById('analysis-modal');
        modal.classList.add('is-active');
        
        // Close modal handlers
        const closeButtons = modal.querySelectorAll('[data-micromodal-close], .modal-background, .delete');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('is-active');
            });
        });
    }

    async indexFaceToElasticsearch(faceIndex, name, faceData, result) {
        try {
            const btn = document.querySelector(`.index-btn[data-face-index="${faceIndex}"]`);
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Indexing...';
            btn.disabled = true;
            
            const bbox = faceData.bbox || [0, 0, 0, 0];
            const [x1, y1, x2, y2] = bbox;
            
            const width = x2 - x1;
            const height = y2 - y1;
            const expansion = 0.25;
            
            const expandedWidth = width * (1 + 2 * expansion);
            const expandedHeight = height * (1 + 2 * expansion);
            
            const squareSize = Math.max(expandedWidth, expandedHeight);
            
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            
            const expandedX1 = Math.max(0, centerX - squareSize / 2);
            const expandedY1 = Math.max(0, centerY - squareSize / 2);
            
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = squareSize;
                canvas.height = squareSize;
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(
                    img,
                    expandedX1, expandedY1, squareSize, squareSize,
                    0, 0, squareSize, squareSize
                );
                
                const croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
                
                const response = await fetch('/api/index', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image: croppedImageData,
                        name: name || undefined,
                        timestamp: new Date().toISOString(),
                        source: 'upload'
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Indexing failed: ${response.status} ${response.statusText} - ${errorText}`);
                }
                
                const indexResult = await response.json();
                console.log('Index result:', indexResult);
                
                btn.innerHTML = '✅ Indexed!';
                btn.style.backgroundColor = '#4CAF50';
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    btn.style.backgroundColor = '';
                }, 3000);
            };
            
            img.onerror = () => {
                throw new Error('Failed to load image for cropping');
            };
            
            img.src = this.currentImageData;
            
        } catch (error) {
            console.error('Error indexing face:', error);
            const btn = document.querySelector(`.index-btn[data-face-index="${faceIndex}"]`);
            btn.innerHTML = '❌ Failed';
            btn.style.backgroundColor = '#f44336';
            
            setTimeout(() => {
                btn.innerHTML = 'Index to Elasticsearch';
                btn.disabled = false;
                btn.style.backgroundColor = '';
            }, 3000);
        }
    }

    updateButtonText(text) {
        if (this.uploadBtn) {
            // Map text states to appropriate icons
            const iconMap = {
                '⏳ Processing...': 'processing',
                '⬆️ Uploading...': 'uploading',
                '✅ Upload Complete': 'complete',
                '📁 Upload Photo': 'upload'
            };
            
            const state = iconMap[text] || 'upload';
            
            // Update button class for state
            this.uploadBtn.className = `upload-btn upload-btn-${state}`;
            
            // Set appropriate SVG icon
            if (state === 'processing' || state === 'uploading') {
                this.uploadBtn.innerHTML = `
                    <svg class="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                `;
            } else if (state === 'complete') {
                this.uploadBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                `;
            } else {
                this.uploadBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                `;
            }
        }
    }

    updateStatus(message, className) {
        if (window.controllers?.userMedia?.updateStatus) {
            window.controllers.userMedia.updateStatus(message, className);
        } else {
            const statusDiv = document.getElementById('status');
            if (statusDiv) {
                statusDiv.textContent = message;
            }
        }
    }
}