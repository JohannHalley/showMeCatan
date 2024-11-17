class DOMManager {
    constructor(resourceTracker) {
        this.resourceTracker = resourceTracker;
        this.trackerElement = null;
        this.setupTracker();
    }

    setupTracker() {
        this.trackerElement = document.createElement('div');
        this.trackerElement.className = 'resource-tracker';
        this.trackerElement.style.left = '20px';
        this.trackerElement.style.top = '20px';
        document.body.appendChild(this.trackerElement);
        this.setupDragging();
        this.updateDisplay();
    }

    setupDragging() {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

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
            <div style="margin-bottom: 10px;">处理日志次数: ${this.resourceTracker.processCount}</div>
        `;

        for (const [playerName, resources] of Object.entries(this.resourceTracker.players)) {
            html += `
                <div class="player-resources">
                    <div class="player-name" style="color: ${resources.color}">${playerName}</div>
                    ${this.resourceTracker.resources
                        .filter(resource => this.resourceTracker.showUnknown || resource !== 'unknown')
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
        this.setupCloseButton();
    }

    setupCloseButton() {
        const closeButton = this.trackerElement.querySelector('.close-button');
        closeButton.addEventListener('click', () => this.toggleVisibility());
    }

    toggleVisibility() {
        this.trackerElement.classList.toggle('hidden');
    }

    setVisibility(isVisible) {
        this.trackerElement.style.display = isVisible ? 'block' : 'none';
    }
}

window.DOMManager = DOMManager; 