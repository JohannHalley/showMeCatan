document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('trackerToggle');

    // 从存储中获取当前状态
    chrome.storage.sync.get(['isTrackerEnabled'], (result) => {
        toggle.checked = result.isTrackerEnabled ?? true;
    });

    // 监听开关变化
    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        // 保存状态到存储
        chrome.storage.sync.set({ isTrackerEnabled: isEnabled }, () => {
            // 向当前标签页发送消息
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                        action: 'toggleTracker',
                        isEnabled: isEnabled 
                    });
                }
            });
        });
    });
}); 