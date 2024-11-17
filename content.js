class ResourceTracker {
    static RESOURCES = {
        LUMBER: { id: 'lumber', emoji: '🌲', icon: 'icon_lumber' },
        BRICK: { id: 'brick', emoji: '🧱', icon: 'icon_brick' },
        WOOL: { id: 'wool', emoji: '🐑', icon: 'icon_wool' },
        GRAIN: { id: 'grain', emoji: '🌾', icon: 'icon_grain' },
        ORE: { id: 'ore', emoji: '⛰️', icon: 'icon_ore' },
        UNKNOWN: { id: 'unknown', emoji: '❓', icon: null }
    };

    static ACTIONS = {
        BUILD_ROAD: { cost: { lumber: 1, brick: 1 } },
        BUILD_SETTLEMENT: { cost: { lumber: 1, brick: 1, wool: 1, grain: 1 } },
        BUILD_CITY: { cost: { grain: 2, ore: 3 } },
        BUY_DEVELOPMENT_CARD: { cost: { wool: 1, grain: 1, ore: 1 } }
    };

    static LOG_HANDLERS = {
        '获得': 'handleGain',
        '失去': 'handleDiscard',
        '买了一张发展卡': 'handleDevelopmentCard',
        '升级为城市': 'handleUpgradeToCity',
        '造了一条路': 'handleBuildRoad',
        '造了一个村庄': 'handleBuildVillage',
        '和银行交易': 'handleBankTransaction',
        '交给': 'handleTradeWithPlayer',
        '弃置': 'handleDiscard',
        '偷取': 'handleStealResource'
    };

    constructor() {
        // 初始化玩家资源状态对象
        this.players = {};
        // 定义所有可能的资源类型，包括未知资源
        this.resources = Object.values(ResourceTracker.RESOURCES).map(r => r.id);
        // 用于追踪处理过的日志数量
        this.processCount = 0;
        // 控制是否显示未知资源
        this.showUnknown = true;

        // 从 Chrome 存储中获取插件启用状态
        chrome.storage.sync.get(['isTrackerEnabled'], (result) => {
            // 如果没有存储状态，默认为启用
            this.isEnabled = result.isTrackerEnabled ?? true;
            if (this.isEnabled) {
                this.setupTracker();      // 设置追踪器UI
                this.setupPlayerBoards(); // 初始化玩家面板
                this.setupLogObserver();  // ! 设置日志监听器
            }
        });
    }

    setupTracker() {
        this.trackerElement = document.createElement('div');
        this.trackerElement.className = 'resource-tracker';

        // 设置初始位置
        this.trackerElement.style.left = '20px';
        this.trackerElement.style.top = '20px';

        document.body.appendChild(this.trackerElement);
        this.setupDragging();
        this.updateDisplay();

        // 监听插件状态变化
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.isTrackerEnabled) {
                this.isEnabled = changes.isTrackerEnabled.newValue;
                if (this.isEnabled) {
                    this.trackerElement.style.display = 'block';
                } else {
                    this.trackerElement.style.display = 'none';
                }
            }
        });
    }

    setupDragging() {
        let isDragging = false;
        let startX;
        let startY;
        let startLeft;
        let startTop;

        this.trackerElement.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-button')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(this.trackerElement.style.left) || 0;
            startTop = parseInt(this.trackerElement.style.top) || 0;

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;

            // 确保不会拖出屏幕
            const maxX = window.innerWidth - this.trackerElement.offsetWidth;
            const maxY = window.innerHeight - this.trackerElement.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, maxX));
            newTop = Math.max(0, Math.min(newTop, maxY));

            this.trackerElement.style.left = `${newLeft}px`;
            this.trackerElement.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    setupPlayerBoards() {
        const playerBoards = document.querySelectorAll('#player_boards .player-board');
        playerBoards.forEach(board => {
            const playerNameElement = board.querySelector('.player-name a');
            if (playerNameElement) {
                const playerName = playerNameElement.textContent.trim();
                const playerColor = playerNameElement.style.color;
                this.players[playerName] = {
                    lumber: 0,
                    brick: 0,
                    wool: 0,
                    grain: 0,
                    ore: 0,
                    unknown: 0,
                    color: playerColor
                };
                console.log('Player initialized:', playerName); // 调试日志
            }
        });
    }

    setupLogObserver() {
        // 获取日志容器元素
        const logsContainer = document.getElementById('logs');
        if (logsContainer) {
            // 创建 MutationObserver 实例来监听日志变化
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    // 遍历所有新增的节点
                    mutation.addedNodes.forEach((node) => {
                        // 只处理元素节点(nodeType === 1)
                        if (node.nodeType === 1) {
                            this.processLogEntry(node);
                        }
                    });
                });
            });

            // 开始观察日志容器的变化
            // childList: 监听子节点的增删
            // subtree: 监听所有后代节点的变化
            observer.observe(logsContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    processLogEntry(logNode) {
        if (!logNode.querySelector) return;

        const roundedBox = logNode.querySelector('.roundedbox');
        if (!roundedBox) return;

        this.processCount++;
        const logText = roundedBox.textContent;

        for (const [trigger, handler] of Object.entries(ResourceTracker.LOG_HANDLERS)) {
            if (logText.includes(trigger)) {
                this[handler](roundedBox);
            }
        }

        this.updateDisplay();
    }

    handleGain(logNode) {
        console.log('Processing gain:', logNode.textContent);

        // 从日志文本中提取玩家名称（在"获得"之前的文本）
        const playerName = logNode.textContent.split('获得')[0].trim();
        console.log('Player:', playerName);

        // 查找包含资源信息的 span 元素
        const resourceSpan = logNode.querySelector('span[style*="white-space: nowrap"]');
        if (!resourceSpan) {
            console.log('No resource span found');
            return;
        }

        // 如果玩家不存在，则初始化该玩家的资源状态
        if (!this.players[playerName]) {
            console.log('Player not found, initializing:', playerName);
            this.players[playerName] = {
                lumber: 0,
                brick: 0,
                wool: 0,
                grain: 0,
                ore: 0,
                unknown: 0,
                color: '#000000'
            };
        }

        // 解析资源获得情况
        let currentCount = 1; // 默认数量为1
        const childNodes = Array.from(resourceSpan.childNodes);
        childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                // 如果是文本节点，尝试解析数量
                const num = parseInt(node.textContent);
                if (!isNaN(num)) {
                    currentCount = num;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                // 根据资源图标的类名确定资源类型
                let resourceType = null;
                if (node.classList.contains('icon_lumber')) resourceType = 'lumber';
                else if (node.classList.contains('icon_brick')) resourceType = 'brick';
                else if (node.classList.contains('icon_wool')) resourceType = 'wool';
                else if (node.classList.contains('icon_grain')) resourceType = 'grain';
                else if (node.classList.contains('icon_ore')) resourceType = 'ore';

                // 更新玩家的资源数量
                if (resourceType) {
                    this.players[playerName][resourceType] += currentCount;
                    console.log(`Added ${currentCount} ${resourceType} to ${playerName}`);
                    currentCount = 1; // 重置为默认值
                }
            }
        });

        this.updateDisplay(); // 更新显示
    }

    updateDisplay() {
        const resourceEmojis = {
            'lumber': '🌲',
            'brick': '🧱',
            'wool': '🐑',
            'grain': '🌾',
            'ore': '⛰️',
            'unknown': '❓'
        };

        let html = `
            <div class="tracker-header">
                <div style="font-weight: bold;">资源追踪器</div>
                <div class="close-button">✕</div>
            </div>
            <div style="margin-bottom: 10px;">处理日志次数: ${this.processCount}</div>
        `;

        for (const [playerName, resources] of Object.entries(this.players)) {
            html += `
                <div class="player-resources">
                    <div class="player-name" style="color: ${resources.color}">${playerName}</div>
                    ${this.resources
                    .filter(resource => this.showUnknown || resource !== 'unknown')
                    .map(resource => `
                            <span class="resource-count">
                                ${resourceEmojis[resource]}
                                ${resources[resource]}
                            </span>
                        `).join('')}
                </div>
            `;
        }

        this.trackerElement.innerHTML = html;

        const closeButton = this.trackerElement.querySelector('.close-button');
        closeButton.addEventListener('click', () => this.toggleVisibility());
    }

    toggleVisibility() {
        this.isVisible = !this.isVisible;
        this.trackerElement.classList.toggle('hidden');
    }

    handleDevelopmentCard(logNode) {
        // 发展卡消耗：1羊毛 1麦子 1矿石
        const playerName = logNode.textContent.split('使用')[0].trim();
        if (!this.players[playerName]) return;

        this.players[playerName].wool -= 1;
        this.players[playerName].grain -= 1;
        this.players[playerName].ore -= 1;

        console.log(`${playerName} bought development card: -1 wool, -1 grain, -1 ore`);
    }

    handleUpgradeToCity(logNode) {
        // 升级城市消耗：2麦子 3矿石
        const playerName = logNode.textContent.split('用')[0].trim();
        if (!this.players[playerName]) return;

        this.players[playerName].grain -= 2;
        this.players[playerName].ore -= 3;

        console.log(`${playerName} upgraded to city: -2 grain, -3 ore`);
    }

    handleBuildRoad(logNode) {
        const playerName = logNode.textContent.split('使用')[0].trim();
        if (!this.players[playerName]) return;
        
        const costs = ResourceTracker.ACTIONS.BUILD_ROAD.cost;
        Object.entries(costs).forEach(([resource, amount]) => {
            this.updatePlayerResource(playerName, resource, -amount);
        });
    }

    handleBuildVillage(logNode) {
        const playerName = logNode.textContent.split('使用')[0].trim();
        if (!this.players[playerName]) return;

        this.updatePlayerResource(playerName, 'lumber', -1);
        this.updatePlayerResource(playerName, 'brick', -1);
        this.updatePlayerResource(playerName, 'wool', -1);
        this.updatePlayerResource(playerName, 'grain', -1);

        console.log(`${playerName} built village`);
    }

    updatePlayerResource(playerName, resource, amount) {
        if (!this.players[playerName]) return;

        this.players[playerName][resource] += amount;
        // 确保资源数量不会小于0
        if (this.players[playerName][resource] < 0) {
            this.players[playerName][resource] = 0;
        }

        console.log(`${playerName}'s ${resource} changed by ${amount}, now: ${this.players[playerName][resource]}`);
    }

    handleBankTransaction(logNode) {
        // 例如: "BoginiKarmelu 和银行交易: 4麦子 → 1木材"
        const logText = logNode.textContent;
        const playerName = logText.split('和银行交易')[0].trim();
        if (!this.players[playerName]) return;

        // 获取交易的资源信息
        const resourceSpans = logNode.querySelectorAll('span[style*="white-space: nowrap"]');
        if (resourceSpans.length !== 2) return; // 应该有两个span，一个是付出的资源，一个是获得的资源

        // 处理付出的资源（第一个span）
        let currentCount = 1;
        Array.from(resourceSpans[0].childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const num = parseInt(node.textContent);
                if (!isNaN(num)) currentCount = num;
            } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                let resourceType = this.getResourceTypeFromIcon(node);
                if (resourceType) {
                    this.updatePlayerResource(playerName, resourceType, -currentCount);
                    currentCount = 1;
                }
            }
        });

        // 处理获得的资源（第二个span）
        currentCount = 1;
        Array.from(resourceSpans[1].childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const num = parseInt(node.textContent);
                if (!isNaN(num)) currentCount = num;
            } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                let resourceType = this.getResourceTypeFromIcon(node);
                if (resourceType) {
                    this.updatePlayerResource(playerName, resourceType, currentCount);
                    currentCount = 1;
                }
            }
        });

        console.log(`${playerName} traded with bank`);
    }

    handleTradeWithPlayer(logNode) {
        // 解析交易日志，格式："玩家A 交给 玩家B 资源X 并收到 资源Y 作为交换"
        const logText = logNode.textContent;
        const parts = logText.split('交给');
        if (parts.length !== 2) return;

        // 提取交易双方信息
        const giver = parts[0].trim(); // 给出资源的玩家
        const remainingText = parts[1];
        const receiverParts = remainingText.split('并收到');
        if (receiverParts.length !== 2) return;

        const receiverAndResource = receiverParts[0].trim();
        const receiver = receiverAndResource.split(' ')[0]; // 接收资源的玩家

        // 获取交易的资源信息
        const resourceSpans = logNode.querySelectorAll('span[style*="white-space: nowrap"]');
        if (resourceSpans.length !== 2) return;

        // 处理给出的资源（第一个资源span）
        let currentCount = 1;
        Array.from(resourceSpans[0].childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const num = parseInt(node.textContent);
                if (!isNaN(num)) currentCount = num;
            } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                let resourceType = this.getResourceTypeFromIcon(node);
                if (resourceType) {
                    this.updatePlayerResource(giver, resourceType, -currentCount);
                    this.updatePlayerResource(receiver, resourceType, currentCount);
                    currentCount = 1;
                }
            }
        });

        // 处理收到的资源（第二个资源span）
        currentCount = 1;
        Array.from(resourceSpans[1].childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const num = parseInt(node.textContent);
                if (!isNaN(num)) currentCount = num;
            } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                let resourceType = this.getResourceTypeFromIcon(node);
                if (resourceType) {
                    this.updatePlayerResource(receiver, resourceType, -currentCount);
                    this.updatePlayerResource(giver, resourceType, currentCount);
                    currentCount = 1;
                }
            }
        });

        console.log(`Trade between ${giver} and ${receiver}`);
    }

    // 辅助方法：从图标类名获取资源类型
    getResourceTypeFromIcon(node) {
        if (node.classList.contains('icon_lumber')) return 'lumber';
        if (node.classList.contains('icon_brick')) return 'brick';
        if (node.classList.contains('icon_wool')) return 'wool';
        if (node.classList.contains('icon_grain')) return 'grain';
        if (node.classList.contains('icon_ore')) return 'ore';
        return null;
    }

    handleDiscard(logNode) {
        // 例如: "PanPrzestworzy 弃置了 3木材 2麦子"
        const logText = logNode.textContent;
        const playerName = logText.split('弃置了')[0].trim();
        if (!this.players[playerName]) return;

        // 获取弃置的资源信息
        const resourceSpan = logNode.querySelector('span[style*="white-space: nowrap"]');
        if (!resourceSpan) return;

        // 处理弃置的资源
        let currentCount = 1;
        Array.from(resourceSpan.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const num = parseInt(node.textContent);
                if (!isNaN(num)) currentCount = num;
            } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                let resourceType = this.getResourceTypeFromIcon(node);
                if (resourceType) {
                    this.updatePlayerResource(playerName, resourceType, -currentCount);
                    currentCount = 1;
                }
            }
        });

        console.log(`${playerName} discarded resources`);
    }

    handleStealResource(logNode) {
        // 例如: "BoginiKarmelu 从 pollyrigon 处偷取资源"
        const logText = logNode.textContent;
        const parts = logText.split('从');
        if (parts.length !== 2) return;

        const stealer = parts[0].trim();
        const victim = parts[1].split('处偷取')[0].trim();

        if (!this.players[stealer] || !this.players[victim]) return;

        // 偷取者获得一个未知资源
        this.updatePlayerResource(stealer, 'unknown', 1);
        // 被偷者失去一个未知资源
        this.updatePlayerResource(victim, 'unknown', -1);

        console.log(`${stealer} stole a resource from ${victim}`);
    }
}

// 创建资源追踪器实例
const tracker = new ResourceTracker();