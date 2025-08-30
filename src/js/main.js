import { VisualizationManager } from './visualization-manager.js';
import { MenuManager } from './navigation/menu.js';

class MediaVisualizer {
    constructor() {
        this.visualizationManager = new VisualizationManager();
        this.menuManager = new MenuManager(this.visualizationManager);
        
        this.initialize();
    }

    initialize() {
        // Sync menu with current visualization
        this.menuManager.syncWithVisualization();
        
        console.log('MediaVisualizer initialized with new architecture');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mediaVisualizer = new MediaVisualizer();
});