// 初始化存储
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ isTrackerEnabled: true });
});

// 处理插件启用/禁用
chrome.management.onEnabled.addListener((info) => {
    if (info.id === chrome.runtime.id) {
        chrome.storage.sync.set({ isTrackerEnabled: true });
    }
});

chrome.management.onDisabled.addListener((info) => {
    if (info.id === chrome.runtime.id) {
        chrome.storage.sync.set({ isTrackerEnabled: false });
    }
}); 