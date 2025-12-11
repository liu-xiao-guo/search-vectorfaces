export class DragController {
    constructor() {
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
    }

    initialize() {
        const videoContainer = document.querySelector('.user-media-container');
        
        videoContainer.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());
        
        videoContainer.addEventListener('touchstart', (e) => this.startDragTouch(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.dragTouch(e), { passive: false });
        document.addEventListener('touchend', () => this.endDrag());
    }

    startDrag(e) {
        this.isDragging = true;
        const videoContainer = document.querySelector('.user-media-container');
        const rect = videoContainer.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        e.preventDefault();
    }

    startDragTouch(e) {
        this.isDragging = true;
        const videoContainer = document.querySelector('.user-media-container');
        const rect = videoContainer.getBoundingClientRect();
        const touch = e.touches[0];
        this.dragOffset.x = touch.clientX - rect.left;
        this.dragOffset.y = touch.clientY - rect.top;
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;
        
        const videoContainer = document.querySelector('.user-media-container');
        const newX = e.clientX - this.dragOffset.x;
        const newY = e.clientY - this.dragOffset.y;
        
        const maxX = window.innerWidth - videoContainer.offsetWidth;
        const maxY = window.innerHeight - videoContainer.offsetHeight;
        
        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));
        
        videoContainer.style.transform = 'none';
        videoContainer.style.left = clampedX + 'px';
        videoContainer.style.top = clampedY + 'px';
        videoContainer.style.right = 'auto';
    }

    dragTouch(e) {
        if (!this.isDragging) return;
        
        const videoContainer = document.querySelector('.user-media-container');
        const touch = e.touches[0];
        const newX = touch.clientX - this.dragOffset.x;
        const newY = touch.clientY - this.dragOffset.y;
        
        const maxX = window.innerWidth - videoContainer.offsetWidth;
        const maxY = window.innerHeight - videoContainer.offsetHeight;
        
        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));
        
        videoContainer.style.transform = 'none';
        videoContainer.style.left = clampedX + 'px';
        videoContainer.style.top = clampedY + 'px';
        videoContainer.style.right = 'auto';
        
        e.preventDefault();
    }

    endDrag() {
        this.isDragging = false;
    }
}