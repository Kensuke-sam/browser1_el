// Tauri API imports
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

console.log('Zen Browser - Rust/Tauri version starting...');

// Initialize the browser when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing browser...');

    try {
        // Test Tauri command
        const tabs = await invoke('get_all_tabs');
        console.log('Successfully connected to Rust backend!', tabs);

        // Get initial data
        const spaces = await invoke('get_all_spaces');
        const settings = await invoke('get_settings');

        console.log('Spaces:', spaces);
        console.log('Settings:', settings);

        // Set up event listeners
        await listen('tab-navigate', (event) => {
            console.log('Navigation event:', event.payload);
        });

        await listen('inject-exam-css', (event) => {
            console.log('Exam mode event:', event.payload);
        });

        // Initialize UI
        initializeUI();
    } catch (error) {
        console.error('Failed to initialize browser:', error);
    }
});

function initializeUI() {
    console.log('Initializing UI...');

    // Add click handler for new tab button
    const newTabBtn = document.getElementById('new-tab-btn');
    if (newTabBtn) {
        newTabBtn.addEventListener('click', async () => {
            try {
                const tab = await invoke('create_tab', {
                    url: 'https://www.google.com',
                    spaceId: null
                });
                console.log('Created tab:', tab);
            } catch (error) {
                console.error('Failed to create tab:', error);
            }
        });
    }

    console.log('UI initialized successfully!');
}
