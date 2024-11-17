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
        // 垄断，五谷丰登
        '获得': 'handleGain',
        // 垄断
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
        this.players = {};
        this.resources = Object.values(ResourceTracker.RESOURCES).map(r => r.id);
        this.processCount = 0;
        this.showUnknown = true;

        chrome.storage.sync.get(['isTrackerEnabled'], (result) => {
            this.isEnabled = result.isTrackerEnabled ?? true;
            if (this.isEnabled) {
                this.domManager = new window.DOMManager(this);
                this.setupPlayerBoards();
                this.setupLogObserver();
            }
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync' && changes.isTrackerEnabled) {
                this.isEnabled = changes.isTrackerEnabled.newValue;
                this.domManager?.setVisibility(this.isEnabled);
            }
        });

        // 添加消息监听器
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'toggleTracker') {
                this.isEnabled = message.isEnabled;
                this.domManager?.setVisibility(this.isEnabled);
            }
        });
    }

    setupPlayerBoards() {
        const playerBoards = document.querySelectorAll('#player_boards .player-board');
        playerBoards.forEach(board => {
            const playerNameElement = board.querySelector('.player-name a');
            if (playerNameElement) {
                const playerName = playerNameElement.textContent.trim();
                const playerColor = playerNameElement.style.color;
                this.initializePlayer(playerName, playerColor);
            }
        });
    }

    initializePlayer(playerName, playerColor) {
        this.players[playerName] = {
            lumber: 0,
            brick: 0,
            wool: 0,
            grain: 0,
            ore: 0,
            unknown: 0,
            color: playerColor
        };
        console.log(`Initialized player: ${playerName}`);
    }

    setupLogObserver() {
        const logsContainer = document.getElementById('logs');
        if (logsContainer) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            this.processLogEntry(node);
                        }
                    });
                });
            });

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

        const playerName = logNode.textContent.split('获得')[0].trim();

        const resourceSpan = logNode.querySelector('span[style*="white-space: nowrap"]');
        if (!resourceSpan) {
            console.log('No resource span found');
            return;
        }

        let currentCount = 1;
        const childNodes = Array.from(resourceSpan.childNodes);
        childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const num = parseInt(node.textContent);
                if (!isNaN(num)) {
                    currentCount = num;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                const resourceType = this.getResourceTypeFromIcon(node);
                if (resourceType) {
                    this.players[playerName][resourceType] += currentCount;
                    console.log(`Added ${currentCount} ${resourceType} to ${playerName}`);
                    currentCount = 1;
                }
            }
        });

        this.updateDisplay();
    }

    updateDisplay() {
        this.domManager?.updateDisplay();
    }

    handleDevelopmentCard(logNode) {
        const playerName = logNode.textContent.split('使用')[0].trim();
        if (!this.players[playerName]) return;

        try {
            const costs = ResourceTracker.ACTIONS.BUY_DEVELOPMENT_CARD.cost;
            Object.entries(costs).forEach(([resource, amount]) => {
                this.updatePlayerResource(playerName, resource, -amount);
            });
        } catch (error) {
            console.log(`发展卡购买资源计算错误: ${error.message}`);
        }
    }

    handleUpgradeToCity(logNode) {
        const playerName = logNode.textContent.split('用')[0].trim();
        if (!this.players[playerName]) return;

        try {
            const costs = ResourceTracker.ACTIONS.BUILD_CITY.cost;
            Object.entries(costs).forEach(([resource, amount]) => {
                this.updatePlayerResource(playerName, resource, -amount);
            });
        } catch (error) {
            console.log(`升级城市资源计算错误: ${error.message}`);
        }
    }

    handleBuildRoad(logNode) {
        const playerName = logNode.textContent.split('使用')[0].trim();
        if (!this.players[playerName]) return;

        try {
            const costs = ResourceTracker.ACTIONS.BUILD_ROAD.cost;
            Object.entries(costs).forEach(([resource, amount]) => {
                this.updatePlayerResource(playerName, resource, -amount);
            });
        } catch (error) {
            console.log(`建造道路资源计算错误: ${error.message}`);
        }
    }

    handleBuildVillage(logNode) {
        const playerName = logNode.textContent.split('使用')[0].trim();
        if (!this.players[playerName]) return;

        try {
            const costs = ResourceTracker.ACTIONS.BUILD_SETTLEMENT.cost;
            Object.entries(costs).forEach(([resource, amount]) => {
                this.updatePlayerResource(playerName, resource, -amount);
            });
        } catch (error) {
            console.log(`建造村庄资源计算错误: ${error.message}`);
        }

        console.log(`${playerName} built village`);
    }

    updatePlayerResource(playerName, resource, amount) {
        if (!this.players[playerName]) return;

        this.players[playerName][resource] += amount;

        if (this.players[playerName][resource] < 0) {
            const deficit = Math.abs(this.players[playerName][resource]);
            // 使用unknown资源补充到0
            this.players[playerName].unknown -= deficit;
            this.players[playerName][resource] = 0;

            console.log(`Used ${deficit} unknown resources to cover ${resource} deficit for ${playerName}`);
            // print 剩下多少unknown资源
            console.log(`${playerName} has ${this.players[playerName].unknown} unknown resources left`);
            // 报错
            throw new Error(`${playerName} has ${this.players[playerName].unknown} unknown resources left`);
        }

        console.log(`${playerName}'s ${resource} changed by ${amount}, now: ${this.players[playerName][resource]}`);
    }

    handleBankTransaction(logNode) {
        const playerName = logNode.textContent.split('和银行交易')[0].trim();
        if (!this.players[playerName]) return;

        const resourceSpans = logNode.querySelectorAll('span[style*="white-space: nowrap"]');
        if (resourceSpans.length !== 2) return;

        try {
            // 辅助函数处理资源变化
            const processResources = (span, multiplier) => {
                let count = 1;
                Array.from(span.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const num = parseInt(node.textContent);
                        if (!isNaN(num)) count = num;
                    } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                        const resourceType = this.getResourceTypeFromIcon(node);
                        if (resourceType) {
                            this.updatePlayerResource(playerName, resourceType, count * multiplier);
                            count = 1;
                        }
                    }
                });
            };

            processResources(resourceSpans[0], -1);
            processResources(resourceSpans[1], 1);
        } catch (error) {
            console.log(`银行交易资源计算错误: ${error.message}`);
        }

        console.log(`${playerName} traded with bank`);
    }

    handleTradeWithPlayer(logNode) {
        const logText = logNode.textContent;
        const parts = logText.split('交给');
        if (parts.length !== 2) return;

        const giver = parts[0].trim();
        const remainingText = parts[1];
        const receiverParts = remainingText.split('并收到');
        if (receiverParts.length !== 2) return;

        const receiverAndResource = receiverParts[0].trim();
        const receiver = receiverAndResource.split(' ')[0];

        const resourceSpans = logNode.querySelectorAll('span[style*="white-space: nowrap"]');
        if (resourceSpans.length !== 2) return;

        try {
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
        } catch (error) {
            console.log(`玩家交易资源计算错误: ${error.message}`);
        }

        console.log(`Trade between ${giver} and ${receiver}`);
    }

    getResourceTypeFromIcon(node) {
        if (node.classList.contains('icon_lumber')) return 'lumber';
        if (node.classList.contains('icon_brick')) return 'brick';
        if (node.classList.contains('icon_wool')) return 'wool';
        if (node.classList.contains('icon_grain')) return 'grain';
        if (node.classList.contains('icon_ore')) return 'ore';
        return null;
    }

    handleDiscard(logNode) {
        const logText = logNode.textContent;
        const playerName = logText.split('弃置了')[0].trim();
        if (!this.players[playerName]) return;

        const resourceSpan = logNode.querySelector('span[style*="white-space: nowrap"]');
        if (!resourceSpan) return;

        try {
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
        } catch (error) {
            console.log(`弃置资源计算错误: ${error.message}`);
        }

        console.log(`${playerName} discarded resources`);
    }

    handleStealResource(logNode) {
        const logText = logNode.textContent;
        const parts = logText.split('从');
        if (parts.length !== 2) return;

        const stealer = parts[0].trim();
        const victim = parts[1].split('处偷取')[0].trim();

        if (!this.players[stealer] || !this.players[victim]) return;

        // 计算被偷者的非零资源数量
        const victimResources = ['lumber', 'brick', 'wool', 'grain', 'ore'];
        const nonZeroResources = victimResources.filter(resource =>
            this.players[victim][resource] > 0
        );

        try {
            if (nonZeroResources.length === 1) {
                const resource = nonZeroResources[0];
                this.updatePlayerResource(victim, resource, -1);
                this.updatePlayerResource(stealer, resource, 1);
                console.log(`${stealer} stole 1 ${resource} from ${victim}`);
            } else {
                nonZeroResources.forEach(resource => {
                    this.updatePlayerResource(victim, resource, -1);
                });
                this.updatePlayerResource(victim, 'unknown', nonZeroResources.length - 1);
                this.updatePlayerResource(stealer, 'unknown', 1);
                console.log(`${stealer} stole an unknown resource from ${victim}, who had ${nonZeroResources.length} types of resources`);
            }
        } catch (error) {
            console.log(`偷取资源计算错误: ${error.message}`);
        }
    }
}

const tracker = new ResourceTracker();