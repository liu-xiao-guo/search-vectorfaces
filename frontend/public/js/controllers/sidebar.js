// Initialize settings

window.settings = {
    indices: [
         {
            selected: true,
            name: 'faces-bbq_hnsw-10.15',
            displayName: 'bbq HNSW',
            description: 'Vector index using BBQ algorithm'
        },
        {
            selected: true,
            name: 'faces-disk_bbq-10.15',
            displayName: 'disk BBQ',
            description: 'Disk-based index using BBQ algorithm.'
        },
         {
            selected: true,
            name: 'faces-int8_hnsw-10.15',
            displayName: 'int8 HNSW',
            description: 'Vector index using 8-bit quantization.'
        },
        
        { 
            selected: true,
            name: 'faces-int4_hnsw-10.15',
            displayName: 'int4 HNSW',
            description: 'Vector index using 4-bit quantization.'
        },
        
        {
            selected: true,
            name: 'faces-bbq_hnsw-uploads',
            displayName: 'Your uploads',
            description: 'Vector index using BBQ algorithm. Uploads are ephemeral and deleted alongside demo instances.'
        }
    ],
    size: '50',
    sizeOptions: [10,20,30,40,50,75,100],
    k: '50',
    kOptions: [3,5,10,20,30,50,100],
    num_candidates: '200',
    num_candidatesOptions: [50,100,200,400,600,1000],
    showFacialFeatures: false

};

export class SidebarController {
    constructor() {
        this.sidebar = null;
        this.toggleButton = null;
        this.isOpen = false;
    }

    initialize() {
        this.sidebar = document.getElementById('sidebar');
        this.toggleButton = document.getElementById('sidebar-toggle');
        
        if (!this.sidebar || !this.toggleButton) {
            console.error('Sidebar elements not found');
            return;
        }

        this.setupEventListeners();
        this.renderSettings();
    }

    setupEventListeners() {
        this.toggleButton.addEventListener('click', () => this.toggle());
        
        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.sidebar.contains(e.target) && 
                !this.toggleButton.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.sidebar.classList.add('active');
        this.toggleButton.classList.add('active');
        this.toggleButton.querySelector('i').className = 'fas fa-times';
        this.isOpen = true;
    }

    close() {
        this.sidebar.classList.remove('active');
        this.toggleButton.classList.remove('active');
        this.toggleButton.querySelector('i').className = 'fas fa-cog';
        this.isOpen = false;
    }

    renderSettings() {
        if (!window.settings) {
            console.error('window.settings not found');
            return;
        }

        const container = document.getElementById('sidebar-content');
        if (!container) return;

        container.innerHTML = `
            <div class="settings-section mb-5">
                <p class="menu-label">Indices</p>
                <ul class="menu-list">
                    ${this.renderIndicesOptions()}
                </ul>
            </div>
            
            <div class="settings-section mb-5">
                <p class="menu-label">size <span class="tag is-primary is-light" data-size-value>${window.settings.size}</span></p>
                <input 
                    type="range" 
                    class="slider is-fullwidth is-primary" 
                    id="size-slider"
                    min="0"
                    max="${window.settings.sizeOptions.length - 1}"
                    value="${window.settings.sizeOptions.indexOf(parseInt(window.settings.size))}"
                    step="1"
                />
                <p class="help has-text-grey mt-2">Number of results to display per page.</p>
            </div>
            
            <div class="settings-section mb-5">
                <p class="menu-label">k <span class="tag is-primary is-light" data-k-value>${window.settings.k}</span></p>
                <input 
                    type="range" 
                    class="slider is-fullwidth is-primary" 
                    id="k-slider"
                    min="0"
                    max="${window.settings.kOptions.length - 1}"
                    value="${window.settings.kOptions.indexOf(parseInt(window.settings.k))}"
                    step="1"
                />
                <p class="help has-text-grey mt-2">Number of top results to return. Higher values return more matches but may include less relevant results.</p>
            </div>
            
            <div class="settings-section mb-5">
                <p class="menu-label">num_candidates <span class="tag is-primary is-light" data-num-candidates-value>${window.settings.num_candidates}</span></p>
                <input 
                    type="range" 
                    class="slider is-fullwidth is-primary" 
                    id="num-candidates-slider"
                    min="0"
                    max="${window.settings.num_candidatesOptions.length - 1}"
                    value="${window.settings.num_candidatesOptions.indexOf(parseInt(window.settings.num_candidates))}"
                    step="1"
                />
                <p class="help has-text-grey mt-2">Number of candidates to consider during search. Higher values improve accuracy but increase query time.</p>
            </div>
            
            <div class="settings-section">
                <p class="menu-label">Display Options</p>
                <label class="checkbox">
                    <input 
                        type="checkbox" 
                        id="show-facial-features"
                        ${window.settings.showFacialFeatures ? 'checked' : ''}
                        class="mr-2"
                    />
                    <span>Show Facial Features</span>
                </label>
                <p class="help has-text-grey mt-2">Display facial feature overlays on search results.</p>
            </div>
        `;

        this.attachEventListeners();
    }

    renderIndicesOptions() {
        return window.settings.indices.map((option, index) => `
            <li>
                <label class="checkbox">
                    <input 
                        type="checkbox" 
                        data-index="${index}"
                        data-name="${option.name}"
                        ${option.selected ? 'checked' : ''}
                        class="index-checkbox mr-2"
                    />
                    <span class="has-text-weight-semibold">${option.displayName}</span>
                    <br>
                    <small class="has-text-grey">${option.description}</small>
                </label>
            </li>
        `).join('');
    }

    renderSortOptions() {
        return window.settings.sortOptions.map(option => `
            <li>
                <label class="radio">
                    <input 
                        type="radio" 
                        name="sort" 
                        value="${option}"
                        ${window.settings.sort === option ? 'checked' : ''}
                        class="sort-radio mr-2"
                    />
                    <span>${option}</span>
                </label>
            </li>
        `).join('');
    }

    attachEventListeners() {
        // Handle index checkboxes
        const checkboxes = document.querySelectorAll('.index-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const name = e.target.dataset.name;
                
                window.settings.indices[index].selected = e.target.checked;
                
                
                this.onSettingsChange();
            });
        });

        // Handle size slider
        const sizeSlider = document.getElementById('size-slider');
        if (sizeSlider) {
            sizeSlider.addEventListener('input', (e) => {
                const index = parseInt(e.target.value);
                const newValue = window.settings.sizeOptions[index];
                window.settings.size = newValue.toString();
                
                // Update the label
                const label = document.querySelector('[data-size-value]');
                if (label) label.textContent = newValue;
                
                this.onSettingsChange();
            });
        }
        
        // Handle k slider
        const kSlider = document.getElementById('k-slider');
        if (kSlider) {
            kSlider.addEventListener('input', (e) => {
                const index = parseInt(e.target.value);
                const newValue = window.settings.kOptions[index];
                window.settings.k = newValue.toString();
                
                // Update the label
                const label = document.querySelector('[data-k-value]');
                if (label) label.textContent = newValue;
                
                this.onSettingsChange();
            });
        }
        
        // Handle num_candidates slider
        const numCandidatesSlider = document.getElementById('num-candidates-slider');
        if (numCandidatesSlider) {
            numCandidatesSlider.addEventListener('input', (e) => {
                const index = parseInt(e.target.value);
                const newValue = window.settings.num_candidatesOptions[index];
                window.settings.num_candidates = newValue.toString();
                
                // Update the label
                const label = document.querySelector('[data-num-candidates-value]');
                if (label) label.textContent = newValue;
                
                this.onSettingsChange();
            });
        }
        
        // Handle facial features checkbox
        const facialFeaturesCheckbox = document.getElementById('show-facial-features');
        if (facialFeaturesCheckbox) {
            facialFeaturesCheckbox.addEventListener('change', (e) => {
                window.settings.showFacialFeatures = e.target.checked;
                this.onSettingsChange();
            });
        }
    }

    onSettingsChange() {
        console.log('Settings updated:', window.settings);
        
        // Dispatch a custom event that other modules can listen to
        window.dispatchEvent(new CustomEvent('settingsChanged', {
            detail: window.settings
        }));
    }
}
