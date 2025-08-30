import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MenuManager } from '../../src/js/navigation/menu.js';

// Mock DOM elements
const mockButton1 = {
    dataset: { visualization: 'hillside' },
    classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false)
    },
    addEventListener: vi.fn(),
    disabled: false,
    style: {}
};

const mockButton2 = {
    dataset: { visualization: 'roofs' },
    classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false)
    },
    addEventListener: vi.fn(),
    disabled: false,
    style: {}
};

const mockActiveButton = {
    dataset: { visualization: 'hillside' },
    classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false)
    }
};

// Mock visualization manager
const mockVisualizationManager = {
    switchVisualization: vi.fn(),
    startAudio: vi.fn(),
    getCurrentType: vi.fn(() => 'hillside')
};

// Mock global document
global.document = {
    querySelectorAll: vi.fn(() => [mockButton1, mockButton2]),
    querySelector: vi.fn(() => mockActiveButton)
};

describe('MenuManager', () => {
    let menuManager;

    beforeEach(() => {
        vi.clearAllMocks();
        mockVisualizationManager.switchVisualization.mockResolvedValue(undefined);
        mockVisualizationManager.startAudio.mockResolvedValue(undefined);
        menuManager = new MenuManager(mockVisualizationManager);
    });

    it('should initialize with correct properties', () => {
        expect(menuManager.visualizationManager).toBe(mockVisualizationManager);
        expect(menuManager.menuButtons).toEqual([mockButton1, mockButton2]);
    });

    it('should add event listeners to all buttons', () => {
        expect(mockButton1.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
        expect(mockButton2.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should handle menu click successfully', async () => {
        const mockEvent = {
            target: mockButton2
        };

        await menuManager.handleMenuClick(mockEvent);

        expect(mockVisualizationManager.switchVisualization).toHaveBeenCalledWith('roofs');
        expect(mockVisualizationManager.startAudio).toHaveBeenCalled();
        expect(mockButton2.classList.add).toHaveBeenCalledWith('active');
    });

    it('should not switch if button is already active', async () => {
        mockButton1.classList.contains.mockReturnValue(true);
        
        const mockEvent = {
            target: mockButton1
        };

        await menuManager.handleMenuClick(mockEvent);

        expect(mockVisualizationManager.switchVisualization).not.toHaveBeenCalled();
        expect(mockVisualizationManager.startAudio).not.toHaveBeenCalled();
    });

    it('should disable buttons during switch', async () => {
        const mockEvent = {
            target: mockButton2
        };

        // Mock a delay in switching
        mockVisualizationManager.switchVisualization.mockImplementation(() => {
            // During the switch, buttons should be disabled
            expect(mockButton1.disabled).toBe(true);
            expect(mockButton2.disabled).toBe(true);
            expect(mockButton1.style.opacity).toBe('0.5');
            expect(mockButton2.style.opacity).toBe('0.5');
            return Promise.resolve();
        });

        await menuManager.handleMenuClick(mockEvent);

        // After switch, buttons should be re-enabled
        expect(mockButton1.disabled).toBe(false);
        expect(mockButton2.disabled).toBe(false);
        expect(mockButton1.style.opacity).toBe('');
        expect(mockButton2.style.opacity).toBe('');
    });

    it('should handle switch error gracefully', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mockEvent = {
            target: mockButton2
        };

        mockVisualizationManager.switchVisualization.mockRejectedValue(new Error('Switch failed'));

        await menuManager.handleMenuClick(mockEvent);

        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to switch to roofs:', expect.any(Error));
        
        // Buttons should still be re-enabled after error
        expect(mockButton1.disabled).toBe(false);
        expect(mockButton2.disabled).toBe(false);

        consoleErrorSpy.mockRestore();
    });

    it('should update active button correctly', () => {
        menuManager.updateActiveButton(mockButton2);

        // Should remove active from all buttons
        expect(mockButton1.classList.remove).toHaveBeenCalledWith('active');
        expect(mockButton2.classList.remove).toHaveBeenCalledWith('active');

        // Should add active to the target button
        expect(mockButton2.classList.add).toHaveBeenCalledWith('active');
    });

    it('should set buttons enabled/disabled correctly', () => {
        // Test disable
        menuManager.setButtonsEnabled(false);
        
        expect(mockButton1.disabled).toBe(true);
        expect(mockButton2.disabled).toBe(true);
        expect(mockButton1.style.opacity).toBe('0.5');
        expect(mockButton2.style.opacity).toBe('0.5');
        expect(mockButton1.style.cursor).toBe('not-allowed');
        expect(mockButton2.style.cursor).toBe('not-allowed');

        // Test enable
        menuManager.setButtonsEnabled(true);
        
        expect(mockButton1.disabled).toBe(false);
        expect(mockButton2.disabled).toBe(false);
        expect(mockButton1.style.opacity).toBe('');
        expect(mockButton2.style.opacity).toBe('');
        expect(mockButton1.style.cursor).toBe('pointer');
        expect(mockButton2.style.cursor).toBe('pointer');
    });

    it('should sync with visualization correctly', () => {
        mockVisualizationManager.getCurrentType.mockReturnValue('roofs');
        
        menuManager.syncWithVisualization();
        
        expect(document.querySelector).toHaveBeenCalledWith('[data-visualization="roofs"]');
        expect(mockActiveButton.classList.add).toHaveBeenCalledWith('active');
    });

    it('should handle sync when no matching button found', () => {
        mockVisualizationManager.getCurrentType.mockReturnValue('unknown');
        global.document.querySelector.mockReturnValue(null);
        
        // Should not throw error
        expect(() => menuManager.syncWithVisualization()).not.toThrow();
    });

    it('should log successful switch', async () => {
        const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const mockEvent = {
            target: mockButton2
        };

        await menuManager.handleMenuClick(mockEvent);

        expect(consoleLogSpy).toHaveBeenCalledWith('Switched to roofs visualization and started audio');

        consoleLogSpy.mockRestore();
    });

    it('should handle audio start error gracefully', async () => {
        const mockEvent = {
            target: mockButton2
        };
        
        mockVisualizationManager.startAudio.mockRejectedValue(new Error('Audio failed'));

        // Should not throw - error should be handled internally
        await expect(menuManager.handleMenuClick(mockEvent)).resolves.toBeUndefined();
        
        // Switch should still have been attempted
        expect(mockVisualizationManager.switchVisualization).toHaveBeenCalled();
    });

    it('should maintain button state consistency', async () => {
        const mockEvent = {
            target: mockButton2
        };

        // Simulate multiple rapid clicks
        const promise1 = menuManager.handleMenuClick(mockEvent);
        const promise2 = menuManager.handleMenuClick({ target: mockButton1 });

        await Promise.all([promise1, promise2]);

        // All buttons should be re-enabled at the end
        expect(mockButton1.disabled).toBe(false);
        expect(mockButton2.disabled).toBe(false);
    });
});