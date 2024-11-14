class ResourceTracker {
    constructor() {
        this.players = {};
        this.resources = ['lumber', 'brick', 'wool', 'grain', 'ore', 'unknown'];
        this.isVisible = true;
        this.processCount = 0;
        this.showUnknown = true;
        this.setupTracker();
        this.setupPlayerBoards();
        this.setupLogObserver();
    }

    setupTracker() {
        this.trackerElement = document.createElement('div');
        this.trackerElement.className = 'resource-tracker';
        document.body.appendChild(this.trackerElement);
        this.updateDisplay();

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'toggleTracker') {
                this.toggleVisibility();
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
        if (!logNode.querySelector) return; // 确保节点有 querySelector 方法

        const roundedBox = logNode.querySelector('.roundedbox');
        if (!roundedBox) return;

        this.processCount++;
        const logText = roundedBox.textContent;

        if (logText.includes('获得')) {
            this.handleGain(roundedBox);
        }

        // 买了一张发展卡
        if (logText.includes('买了一张发展卡')) {
            this.handleDevelopmentCard(roundedBox);
        }

        // 升级为城市
        if (logText.includes('升级为城市')) {
            this.handleUpgradeToCity(roundedBox);
        }

        // 造了一条路
        if (logText.includes('造了一条路')) {
            this.handleBuildRoad(roundedBox);
        }

        // 造了一个村庄
        if (logText.includes('造了一个村庄')) {
            this.handleBuildVillage(roundedBox);
        }

        // 和银行交易
        if (logText.includes('和银行交易')) {
            this.handleBankTransaction(roundedBox);
        }

        // 和玩家交易
        if (logText.includes('交给')) {
            this.handleTradeWithPlayer(roundedBox);
        }

        // 弃置
        if (logText.includes('弃置')) {
            this.handleDiscard(roundedBox);
        }

        // 偷取资源
        if (logText.includes('偷取')) {
            this.handleStealResource(roundedBox);
        }



        this.updateDisplay();
    }

    handleGain(logNode) {
        console.log('Processing gain:', logNode.textContent); // 调试日志

        // 获取玩家名称
        const playerName = logNode.textContent.split('获得')[0].trim();
        console.log('Player:', playerName);

        // 获取资源信息
        const resourceSpan = logNode.querySelector('span[style*="white-space: nowrap"]');
        if (!resourceSpan) {
            console.log('No resource span found');
            return;
        }

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

        // 解析资源
        let currentCount = 1;
        const childNodes = Array.from(resourceSpan.childNodes);
        childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                // 如果是文本节点，可能包含数量
                const num = parseInt(node.textContent);
                if (!isNaN(num)) {
                    currentCount = num;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('cat_log_token')) {
                // 根据图标类名确定资源类型
                let resourceType = null;
                if (node.classList.contains('icon_lumber')) resourceType = 'lumber';
                else if (node.classList.contains('icon_brick')) resourceType = 'brick';
                else if (node.classList.contains('icon_wool')) resourceType = 'wool';
                else if (node.classList.contains('icon_grain')) resourceType = 'grain';
                else if (node.classList.contains('icon_ore')) resourceType = 'ore';

                if (resourceType) {
                    this.players[playerName][resourceType] += currentCount;
                    console.log(`Added ${currentCount} ${resourceType} to ${playerName}`);
                    currentCount = 1; // 重置为默认值
                }
            }
        });

        this.updateDisplay();
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

        let html = `<div style="font-weight: bold; margin-bottom: 10px;">资源追踪器</div>`;
        html += `<div style="margin-bottom: 10px;">处理日志次数: ${this.processCount}</div>`;
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
        // 建道路消耗：1木材 1砖块
        const playerName = logNode.textContent.split('使用')[0].trim();
        if (!this.players[playerName]) return;

        this.players[playerName].lumber -= 1;
        this.players[playerName].brick -= 1;

        console.log(`${playerName} built road: -1 lumber, -1 brick`);
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
        // 例如: "PanPrzestworzy 交给 pollyrigon 木材 并收到 麦子 作为交换"
        const logText = logNode.textContent;
        const parts = logText.split('交给');
        if (parts.length !== 2) return;

        const giver = parts[0].trim();
        const remainingText = parts[1];
        const receiverParts = remainingText.split('并收到');
        if (receiverParts.length !== 2) return;

        const receiverAndResource = receiverParts[0].trim();
        const receiver = receiverAndResource.split(' ')[0];

        // 获取交易的资源信息
        const resourceSpans = logNode.querySelectorAll('span[style*="white-space: nowrap"]');
        if (resourceSpans.length !== 2) return;

        // 处理给出的资源
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

        // 处理收到的资源
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

// 初始化追踪器
const tracker = new ResourceTracker();