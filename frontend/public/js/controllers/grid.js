export class GridController {
    constructor() {
        this.currentTileIndex = 0;
        this.allFaces = []; // Store all faces for sorting
        this.maxFaces = 0; // Maximum number of faces (cols * rows)
    }

    generateGrid() {
        const gridContainer = document.getElementById('gridContainer');
        gridContainer.innerHTML = '';
        
        const aspectRatio = window.innerWidth / window.innerHeight;
        
        const gridSquares = 40; 

        let cols, rows;
        if (aspectRatio > 1) {
            cols = Math.ceil(Math.sqrt(gridSquares * aspectRatio));
            rows = Math.ceil(gridSquares / cols);
        } else {
            rows = Math.ceil(Math.sqrt(gridSquares / aspectRatio));
            cols = Math.ceil(gridSquares / rows);
        }
        
        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        gridContainer.style.display = 'grid';
        
        const totalItems = cols * rows;
        this.maxFaces = totalItems; // Store the maximum number of faces
        
        for (let i = 0; i < totalItems; i++) {
            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item';
            gridItem.style.backgroundColor = `hsl(${(i * 137.5) % 360}, 20%, 95%)`;
            
            const scoreLabel = document.createElement('div');
            scoreLabel.className = 'score-label';
            scoreLabel.textContent = '';
            
            gridItem.appendChild(scoreLabel);
            gridContainer.appendChild(gridItem);
        }
    }

    updateBackgroundTiles(matchingFaces) {
        const gridItems = document.querySelectorAll('.grid-item');

        console.info('Updating', gridItems.length, 'background tiles with matching faces', matchingFaces);
        
        if (matchingFaces.length === 0) {
            this.addEmptyTile(gridItems);
            return;
        }
        
        // Fade out current items, then fade in sorted faces
        const fadeOutPromises = [];
        Array.from(gridItems).reverse().forEach((tile, index) => {
            const promise = new Promise(resolve => {
                setTimeout(() => {
                    tile.classList.add('fadeOut');
                    
                    setTimeout(() => {
                        tile.style.backgroundImage = '';
                        tile.style.backgroundSize = '';
                        tile.style.backgroundRepeat = '';
                        tile.style.backgroundPosition = '';
                        
                        const scoreLabel = tile.querySelector('.score-label');
                        if (scoreLabel) {
                            scoreLabel.textContent = '';
                        }
                        
                        tile.classList.remove('fadeOut');
                        resolve();
                    }, 300);
                }, index * 20);
            });
            fadeOutPromises.push(promise);
        });
        
        // After fade out completes, update allFaces and fade in
        Promise.all(fadeOutPromises).then(() => {
            this.allFaces = [...matchingFaces].sort((a, b) => (b.score || 0) - (a.score || 0));
            
            this.allFaces.forEach((face, index) => {
                if (index >= gridItems.length) return;
                
                setTimeout(() => {
                    const currentTile = gridItems[index];
                    this.displayFaceOnTile(currentTile, face);
                }, index * 20);
            });
            
            this.currentTileIndex = this.allFaces.length % gridItems.length;
        });
    }
    
    displayFaceOnTile(tile, face) {
        if (!tile) return;
        
        let imageSource;
        if (face.metadata.image_path.startsWith('/uploads')) {
            imageSource = `/local${face.metadata.image_path}`;
        } else {
            imageSource = `/faces/${face.metadata.image_path}`;
        }

        if (!imageSource) return;
        
        tile.classList.add('fadeIn');
        
        tile.style.backgroundImage = `url(${imageSource})`;
        tile.style.backgroundSize = 'contain';
        tile.style.backgroundRepeat = 'no-repeat';
        tile.style.backgroundPosition = 'center';
        
        const scoreLabel = tile.querySelector('.score-label');
        if (scoreLabel && face.score !== undefined) {
            scoreLabel.textContent = `${face.metadata.name}:${face.score.toFixed(2)} (${face.index.split('-')[1].split('-')[0]})`;
        } else if (scoreLabel) {
            scoreLabel.textContent = '--';
        }
        
        setTimeout(() => {
            tile.classList.remove('fadeIn');
        }, 300);
    }

    addEmptyTile(gridItems) {
        const currentTile = gridItems[this.currentTileIndex];
        
        if (currentTile) {
            currentTile.classList.add('flipping');

            let animationduration = Math.random() * 0.5 + 0.5;
            currentTile.style.animationDuration = `${animationduration}s`;
            
            setTimeout(() => {
                currentTile.style.backgroundImage = '';
                currentTile.style.backgroundSize = '';
                currentTile.style.backgroundRepeat = '';
                currentTile.style.backgroundPosition = '';
                
                const scoreLabel = currentTile.querySelector('.score-label');
                if (scoreLabel) {
                    scoreLabel.textContent = '';
                }
                
            }, 300);
            
            setTimeout(() => {
                currentTile.classList.remove('flipping');
            }, 600);
            
            this.currentTileIndex = (this.currentTileIndex + 1) % gridItems.length;
        }
    }
    
    clearAllTiles() {
        const gridItems = document.querySelectorAll('.grid-item');
        gridItems.forEach(item => {
            item.style.backgroundImage = '';
            item.style.backgroundSize = '';
            item.style.backgroundRepeat = '';
            item.style.backgroundPosition = '';
            
            const scoreLabel = item.querySelector('.score-label');
            if (scoreLabel) {
                scoreLabel.textContent = '';
            }
        });
        this.currentTileIndex = 0;
    }
    
    sortAndDisplayFaces() {
        this.clearAllTiles();
        
        if (this.allFaces.length === 0) {
            return;
        }
        
        const sortedFaces = [...this.allFaces].sort((a, b) => (b.score || 0) - (a.score || 0));
        const gridItems = document.querySelectorAll('.grid-item');
        
        sortedFaces.forEach((face, index) => {
            if (index >= gridItems.length) return;
            
            const currentTile = gridItems[index];
            
            let imageSource;
            if (face.metadata.image_path.startsWith('/uploads')) {
                imageSource = `/local${face.metadata.image_path}`;
            } else {
                imageSource = `/faces/${face.metadata.image_path}`;
            }

            if (imageSource && currentTile) {
                currentTile.style.backgroundImage = `url(${imageSource})`;
                currentTile.style.backgroundSize = 'contain';
                currentTile.style.backgroundRepeat = 'no-repeat';
                currentTile.style.backgroundPosition = 'center';
                
                const scoreLabel = currentTile.querySelector('.score-label');
                if (scoreLabel && face.score !== undefined) {
                    scoreLabel.textContent = `${face.metadata.name}:${face.score.toFixed(2)} (${face.index.split('-')[1].split('-')[0]})`;
                } else if (scoreLabel) {
                    scoreLabel.textContent = '--';
                }
            }
        });
        
        this.currentTileIndex = sortedFaces.length % gridItems.length;
    }

    updateInfoboxImage(topFace) {
        const infoboxImage = document.getElementById('infobox-image');
        if (!infoboxImage) return;
        
        // Clear existing content
        infoboxImage.innerHTML = '';
        
        if (!topFace || !topFace.metadata || !topFace.metadata.image_path) {
            return;
        }
        
        // Determine image source
        let imageSource;
        if (topFace.metadata.image_path.startsWith('/uploads')) {
            imageSource = `/local${topFace.metadata.image_path}`;
        } else {
            imageSource = `/faces/${topFace.metadata.image_path}`;
        }
        
        // Create and append image element
        const img = document.createElement('img');
        img.src = imageSource;
        img.alt = topFace.metadata.name || 'Face match';
        infoboxImage.appendChild(img);
    }

    clearGrid() {
        const gridItems = document.querySelectorAll('.grid-item');
        
        Array.from(gridItems).forEach((tile, index) => {
            setTimeout(() => {
                tile.classList.add('fadeOut');
                
                setTimeout(() => {
                    tile.style.backgroundImage = '';
                    tile.style.backgroundSize = '';
                    tile.style.backgroundRepeat = '';
                    tile.style.backgroundPosition = '';
                    
                    const scoreLabel = tile.querySelector('.score-label');
                    if (scoreLabel) {
                        scoreLabel.textContent = '';
                    }
                    
                    tile.classList.remove('fadeOut');
                }, 300);
            }, index * 10);
        });
        
        // Clear stored faces
        this.allFaces = [];
        this.currentTileIndex = 0;
        
        // Clear infobox image
        const infoboxImage = document.getElementById('infobox-image');
        if (infoboxImage) {
            infoboxImage.innerHTML = '';
        }
    }
}