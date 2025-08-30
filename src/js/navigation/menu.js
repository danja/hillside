export class MenuManager {
    constructor(visualizationManager) {
        this.visualizationManager = visualizationManager;
        this.menuButtons = document.querySelectorAll('.menu-btn');
        
        this.initialize();
    }

    initialize() {
        // Add click listeners to menu buttons
        this.menuButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                this.handleMenuClick(event);
            });
        });
    }

    async handleMenuClick(event) {
        const button = event.target;
        const visualizationType = button.dataset.visualization;
        
        // Don't switch if already active
        if (button.classList.contains('active')) {
            return;
        }
        
        // Disable all buttons during switch
        this.setButtonsEnabled(false);
        
        try {
            // Switch visualization
            await this.visualizationManager.switchVisualization(visualizationType);
            
            // Update active button
            this.updateActiveButton(button);
            
            console.log(`Switched to ${visualizationType} visualization`);
        } catch (error) {
            console.error(`Failed to switch to ${visualizationType}:`, error);
        } finally {
            // Re-enable buttons
            this.setButtonsEnabled(true);
        }
    }

    updateActiveButton(activeButton) {
        // Remove active class from all buttons
        this.menuButtons.forEach(button => {
            button.classList.remove('active');
        });
        
        // Add active class to clicked button
        activeButton.classList.add('active');
    }

    setButtonsEnabled(enabled) {
        this.menuButtons.forEach(button => {
            button.disabled = !enabled;
            if (!enabled) {
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            } else {
                button.style.opacity = '';
                button.style.cursor = 'pointer';
            }
        });
    }

    // Update active button based on current visualization (useful for initialization)
    syncWithVisualization() {
        const currentType = this.visualizationManager.getCurrentType();
        const activeButton = document.querySelector(`[data-visualization="${currentType}"]`);
        if (activeButton) {
            this.updateActiveButton(activeButton);
        }
    }
}