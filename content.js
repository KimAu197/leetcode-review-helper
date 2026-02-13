// LeetCode页面内容脚本 - 浮动按钮和题目信息抓取

class LeetCodeHelper {
  constructor() {
    this.floatingButton = null;
    this.problemInfo = null;
    this.reviewQueue = [];
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.currentUrl = window.location.href;
    this.extractProblemInfo();
    this.createFloatingButton();
    this.createQueuePanel();
    this.setupMessageListener();
    this.watchUrlChange();
  }

  // 监听SPA路由变化（LeetCode切换题目不会刷新页面）
  watchUrlChange() {
    let lastUrl = this.currentUrl;

    const check = () => {
      const url = window.location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        // URL 变了，等DOM更新后重新初始化
        setTimeout(() => this.onNavigate(), 800);
      }
    };

    // 轮询检测 URL 变化
    setInterval(check, 500);

    // 也监听 popstate（浏览器前进后退）
    window.addEventListener('popstate', () => setTimeout(() => this.onNavigate(), 800));
  }

  onNavigate() {
    if (!window.location.pathname.includes('/problems/')) return;

    this.currentUrl = window.location.href;
    this.extractProblemInfo();
    this.resetButtons();
    this.checkProblemStatus();
    this.refreshQueue();

    console.log('🔄 Navigated to:', this.problemInfo.slug);
  }

  resetButtons() {
    const logBtn = document.getElementById('leetcode-sr-log-btn');
    const mainBtn = document.getElementById('leetcode-sr-button');
    const status = document.getElementById('leetcode-sr-status');

    if (logBtn) {
      logBtn.classList.remove('added', 'adding');
      logBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M9 11l3 3L22 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>记录</span>`;
    }

    if (mainBtn) {
      mainBtn.classList.remove('added', 'adding');
      mainBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>复习</span>`;
    }

    if (status) {
      status.classList.add('hidden');
      status.textContent = '';
    }
  }

  extractProblemInfo() {
    // 检测是国际版还是中国版
    const isCN = window.location.hostname.includes('leetcode.cn');
    
    // 提取题目信息
    const urlMatch = window.location.pathname.match(/\/problems\/([^\/]+)/);
    const slug = urlMatch ? urlMatch[1] : '';

    // 尝试多种选择器以适应LeetCode的DOM结构
    let title = '';
    let difficulty = '';
    let number = '';

    // 标题选择器
    const titleSelectors = [
      'div[data-cy="question-title"]',
      '.css-v3d350',
      'span.mr-2.text-label-1',
      '[class*="text-title-large"]'
    ];

    for (const selector of titleSelectors) {
      const titleElem = document.querySelector(selector);
      if (titleElem) {
        const fullTitle = titleElem.textContent.trim();
        // 提取题号和标题 (格式: "1. Two Sum" 或 "1.两数之和")
        const match = fullTitle.match(/^(\d+)\.\s*(.+)$/);
        if (match) {
          number = match[1];
          title = match[2];
        } else {
          title = fullTitle;
        }
        break;
      }
    }

    // 难度选择器
    const difficultySelectors = [
      'div[diff]',
      '.css-10o4wqw',
      '[class*="text-difficulty"]',
      'div.mt-3 > div'
    ];

    for (const selector of difficultySelectors) {
      const diffElem = document.querySelector(selector);
      if (diffElem) {
        const text = diffElem.textContent.trim().toLowerCase();
        if (text.includes('easy') || text.includes('简单')) {
          difficulty = 'Easy';
        } else if (text.includes('medium') || text.includes('中等')) {
          difficulty = 'Medium';
        } else if (text.includes('hard') || text.includes('困难')) {
          difficulty = 'Hard';
        }
        if (difficulty) break;
      }
    }

    // 提取标签 (tags)
    const tags = this.extractTags();

    this.problemInfo = {
      number: number || 'Unknown',
      title: title || slug,
      slug: slug,
      difficulty: difficulty || 'Unknown',
      tags: tags,
      url: window.location.href,
      site: isCN ? 'leetcode.cn' : 'leetcode.com',
      timestamp: Date.now()
    };

    console.log('📚 Extracted problem info:', this.problemInfo);
  }

  extractTags() {
    const tags = [];

    // 方法1: 从页面DOM中提取tag链接
    const tagSelectors = [
      'a[href*="/tag/"]',
      'a[href*="/topics/"]',
      '[class*="topic-tag"]',
      'div.mt-2 a.rounded-xl',
      'a.no-underline.hover\\:text-current'
    ];

    for (const selector of tagSelectors) {
      try {
        const tagElements = document.querySelectorAll(selector);
        tagElements.forEach(el => {
          const text = el.textContent.trim();
          // 过滤掉空的和过长的（非tag文本）
          if (text && text.length < 30 && !tags.includes(text)) {
            tags.push(text);
          }
        });
        if (tags.length > 0) break;
      } catch (e) {
        // selector无效，跳过
      }
    }

    // 方法2: 如果DOM抓取失败，尝试从页面中匹配常见tag关键词
    if (tags.length === 0) {
      const allText = document.body.innerText;
      const commonTags = [
        'Array', 'String', 'Hash Table', 'Dynamic Programming', 'Math',
        'Sorting', 'Greedy', 'Depth-First Search', 'Binary Search',
        'Breadth-First Search', 'Tree', 'Matrix', 'Bit Manipulation',
        'Two Pointers', 'Stack', 'Heap', 'Graph', 'Linked List',
        'Sliding Window', 'Backtracking', 'Union Find', 'Recursion',
        'Divide and Conquer', 'Trie', 'Binary Tree', 'Simulation',
        'Design', 'Counting', 'Prefix Sum'
      ];

      // 在Topics区域附近查找
      const topicSection = document.querySelector('[class*="topic"], [class*="tag-list"]');
      const searchText = topicSection ? topicSection.innerText : '';

      if (searchText) {
        commonTags.forEach(tag => {
          if (searchText.includes(tag)) {
            tags.push(tag);
          }
        });
      }
    }

    return tags;
  }

  createFloatingButton() {
    // 创建浮动容器
    const container = document.createElement('div');
    container.id = 'leetcode-sr-container';
    container.className = 'leetcode-sr-floating';

    // 记录刷题按钮（只记录，不加复习）
    const logButton = document.createElement('button');
    logButton.id = 'leetcode-sr-log-btn';
    logButton.className = 'leetcode-sr-main-btn leetcode-sr-log';
    logButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M9 11l3 3L22 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>记录</span>
    `;

    // 加入复习按钮
    const mainButton = document.createElement('button');
    mainButton.id = 'leetcode-sr-button';
    mainButton.className = 'leetcode-sr-main-btn';
    mainButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span>复习</span>
    `;

    // 状态指示器
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'leetcode-sr-status';
    statusIndicator.className = 'leetcode-sr-status hidden';

    container.appendChild(logButton);
    container.appendChild(mainButton);
    container.appendChild(statusIndicator);
    document.body.appendChild(container);

    // 按钮点击事件
    logButton.addEventListener('click', () => this.handleLogPractice());
    mainButton.addEventListener('click', () => this.handleAddProblem());

    // 检查这道题是否已经添加
    this.checkProblemStatus();

    this.floatingButton = container;
  }

  async checkProblemStatus() {
    try {
      const response = await this.safeSendMessage({
        action: 'checkProblem',
        slug: this.problemInfo.slug
      });

      if (!response) return;

      const mainButton = document.getElementById('leetcode-sr-button');
      const statusIndicator = document.getElementById('leetcode-sr-status');

      if (response && response.exists) {
        mainButton.classList.add('added');
        mainButton.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M5 13l4 4L19 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>已加入</span>
        `;
        
        statusIndicator.textContent = `下次复习: ${new Date(response.nextReview).toLocaleDateString()}`;
        statusIndicator.classList.remove('hidden');
      }
    } catch (error) {
      console.warn('checkProblemStatus failed:', error);
    }
  }

  // 安全发送消息，处理所有扩展通信错误
  async safeSendMessage(message) {
    try {
      // 先检查runtime是否可用
      if (!chrome.runtime || !chrome.runtime.id) {
        this.showReloadPrompt();
        return null;
      }
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      console.warn('Message failed:', error);
      this.showReloadPrompt();
      return null;
    }
  }

  showReloadPrompt() {
    // 避免重复显示
    if (document.getElementById('leetcode-sr-reload-prompt')) return;

    const prompt = document.createElement('div');
    prompt.id = 'leetcode-sr-reload-prompt';
    prompt.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10001;
      background: white; border-radius: 12px; padding: 16px 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-left: 4px solid #f59e0b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px; color: #92400e; max-width: 320px; cursor: pointer;
    `;
    prompt.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px;">⚠️ 扩展已更新</div>
      <div style="font-size:12px;color:#78716c;">点击此处刷新页面以重新连接</div>
    `;
    prompt.addEventListener('click', () => {
      window.location.reload();
    });
    document.body.appendChild(prompt);
  }

  // 显示可选的完成时间+心得输入弹窗
  showInputDialog(mode) {
    // mode: 'log' | 'review'
    return new Promise((resolve) => {
      // 移除已有弹窗
      const existing = document.getElementById('leetcode-sr-dialog');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'leetcode-sr-dialog';
      overlay.className = 'leetcode-sr-overlay';

      const title = mode === 'log' ? '记录刷题' : '加入复习';
      overlay.innerHTML = `
        <div class="leetcode-sr-dialog-box">
          <div class="leetcode-sr-dialog-title">${title} — ${this.problemInfo.number}. ${this.problemInfo.title}</div>
          <div class="leetcode-sr-dialog-row">
            <label>⏱ 用时 (分钟)</label>
            <input type="number" id="sr-duration-input" min="1" max="999" placeholder="可选">
          </div>
          <div class="leetcode-sr-dialog-row">
            <label>📝 心得</label>
            <textarea id="sr-notes-input" rows="3" placeholder="可选，记录思路或注意事项..."></textarea>
          </div>
          <div class="leetcode-sr-dialog-actions">
            <button id="sr-dialog-cancel" class="sr-dialog-btn sr-btn-cancel">取消</button>
            <button id="sr-dialog-skip" class="sr-dialog-btn sr-btn-skip">跳过，直接${mode === 'log' ? '记录' : '添加'}</button>
            <button id="sr-dialog-confirm" class="sr-dialog-btn sr-btn-confirm">确定</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // 聚焦到第一个输入框
      setTimeout(() => document.getElementById('sr-duration-input')?.focus(), 100);

      const getValues = () => {
        const duration = parseInt(document.getElementById('sr-duration-input')?.value) || null;
        const notes = document.getElementById('sr-notes-input')?.value?.trim() || null;
        return { duration, notes };
      };

      const cleanup = () => overlay.remove();

      document.getElementById('sr-dialog-cancel').addEventListener('click', () => { cleanup(); resolve(null); });
      document.getElementById('sr-dialog-skip').addEventListener('click', () => { cleanup(); resolve({ duration: null, notes: null }); });
      document.getElementById('sr-dialog-confirm').addEventListener('click', () => { const v = getValues(); cleanup(); resolve(v); });

      // ESC 关闭
      const onKey = (e) => { if (e.key === 'Escape') { cleanup(); resolve(null); document.removeEventListener('keydown', onKey); } };
      document.addEventListener('keydown', onKey);

      // 点击蒙层关闭
      overlay.addEventListener('click', (e) => { if (e.target === overlay) { cleanup(); resolve(null); } });
    });
  }

  async handleLogPractice() {
    const logButton = document.getElementById('leetcode-sr-log-btn');

    if (logButton.classList.contains('adding') || logButton.classList.contains('added')) return;

    // 弹出可选输入框
    const extra = await this.showInputDialog('log');
    if (extra === null) return; // 用户取消

    logButton.classList.add('adding');
    logButton.innerHTML = `<div class="spinner"></div><span>记录中...</span>`;

    try {
      const response = await this.safeSendMessage({
        action: 'logPractice',
        problem: { ...this.problemInfo, duration: extra.duration, notes: extra.notes }
      });

      if (!response) {
        logButton.classList.remove('adding');
        logButton.innerHTML = `<span>重试</span>`;
        return;
      }

      if (response.success) {
        logButton.classList.remove('adding');
        logButton.classList.add('added');
        logButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M5 13l4 4L19 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>已记录</span>
        `;
        this.showNotification('已记录今日刷题！', 'success');
      } else {
        this.showNotification(response.error || '记录失败', 'info');
        logButton.classList.remove('adding');
        logButton.classList.add('added');
        logButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M5 13l4 4L19 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>已记录</span>
        `;
      }
    } catch (error) {
      logButton.classList.remove('adding');
      logButton.innerHTML = `<span>重试</span>`;
      this.showNotification('记录失败: ' + error.message, 'error');
    }
  }

  async handleAddProblem() {
    const mainButton = document.getElementById('leetcode-sr-button');
    const statusIndicator = document.getElementById('leetcode-sr-status');

    // 防止重复点击
    if (mainButton.classList.contains('adding')) return;

    // 弹出可选输入框
    const extra = await this.showInputDialog('review');
    if (extra === null) return; // 用户取消

    mainButton.classList.add('adding');
    mainButton.innerHTML = `
      <div class="spinner"></div>
      <span>添加中...</span>
    `;

    try {
      const response = await this.safeSendMessage({
        action: 'addProblem',
        problem: { ...this.problemInfo, duration: extra.duration, notes: extra.notes }
      });

      if (!response) {
        mainButton.classList.remove('adding');
        mainButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>重试</span>
        `;
        return;
      }

      if (response.success) {
        mainButton.classList.remove('adding');
        mainButton.classList.add('added');
        mainButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M5 13l4 4L19 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>已加入</span>
        `;

        statusIndicator.textContent = `首次复习: ${response.intervalDays}天后`;
        statusIndicator.classList.remove('hidden');

        // 3秒后显示具体日期
        setTimeout(() => {
          if (response.nextReviewDate) {
            const nextDate = new Date(response.nextReviewDate);
            statusIndicator.textContent = `下次复习: ${nextDate.toLocaleDateString()}`;
          }
        }, 3000);

        // 刷新队列
        this.refreshQueue();

        // 显示通知
        this.showNotification('✅ 已添加到复习计划！', 'success');
      } else {
        throw new Error(response.error || '添加失败');
      }
    } catch (error) {
      console.error('添加题目失败:', error);
      mainButton.classList.remove('adding');
      mainButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span>重试</span>
      `;
      this.showNotification('❌ 添加失败: ' + error.message, 'error');
    }
  }

  // ============ 复习队列面板（游戏任务风格） ============

  async createQueuePanel() {
    const panel = document.createElement('div');
    panel.id = 'leetcode-sr-queue';
    panel.className = 'sr-queue-panel sr-queue-collapsed';
    panel.innerHTML = `
      <div class="sr-queue-header" id="sr-queue-header">
        <span class="sr-queue-icon">📋</span>
        <span class="sr-queue-htitle">今日复习</span>
        <span class="sr-queue-badge" id="sr-queue-badge">0</span>
        <span class="sr-queue-toggle" id="sr-queue-toggle">▸</span>
      </div>
      <div class="sr-queue-body" id="sr-queue-body">
        <div class="sr-queue-progress" id="sr-queue-progress"></div>
        <div class="sr-queue-list" id="sr-queue-list"></div>
        <div class="sr-queue-footer">
          <button class="sr-queue-next-btn" id="sr-queue-next">下一题 →</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('sr-queue-header').addEventListener('click', () => {
      panel.classList.toggle('sr-queue-collapsed');
      const toggle = document.getElementById('sr-queue-toggle');
      toggle.textContent = panel.classList.contains('sr-queue-collapsed') ? '▸' : '▾';
    });

    document.getElementById('sr-queue-next').addEventListener('click', () => this.goToNextReview());

    await this.refreshQueue();
    setInterval(() => this.refreshQueue(), 60000);
  }

  async refreshQueue() {
    try {
      const response = await this.safeSendMessage({ action: 'getReviewQueue' });
      if (!response || !response.queue) return;
      this.reviewQueue = response.queue;
      this.renderQueue();
    } catch (e) {
      console.warn('Failed to refresh queue:', e);
    }
  }

  renderQueue() {
    const queue = this.reviewQueue || [];
    const currentSlug = this.problemInfo?.slug;

    // Badge
    const badge = document.getElementById('sr-queue-badge');
    if (badge) badge.textContent = queue.length;

    // Hide panel entirely if no reviews
    const panel = document.getElementById('leetcode-sr-queue');
    if (panel) panel.style.display = queue.length === 0 ? 'none' : '';

    // Progress — count today completed from completedReviews
    const progress = document.getElementById('sr-queue-progress');
    if (progress && queue.length > 0) {
      progress.innerHTML = `
        <span class="sr-progress-text">📋 ${queue.length} 道待复习</span>
      `;
    }

    // List
    const list = document.getElementById('sr-queue-list');
    if (!list) return;

    if (queue.length === 0) {
      list.innerHTML = '<div class="sr-queue-empty">🎉 今日复习全部完成！</div>';
      return;
    }

    list.innerHTML = queue.map(p => {
      const isCurrent = p.slug === currentSlug;
      const priClass = p.priorityScore >= 40 ? 'high' : p.priorityScore >= 20 ? 'med' : 'low';
      const diffClass = (p.difficulty || '').toLowerCase();
      const diffLabel = { easy: 'E', medium: 'M', hard: 'H' }[diffClass] || '?';

      return `
        <div class="sr-queue-item ${isCurrent ? 'sr-current' : ''}" data-slug="${p.slug}">
          <div class="sr-queue-item-main">
            <span class="sr-queue-pri ${priClass}"></span>
            <span class="sr-queue-item-title">#${p.number} ${p.title}</span>
            <span class="sr-queue-item-diff ${diffClass}">${diffLabel}</span>
          </div>
          ${isCurrent ? `
            <div class="sr-queue-rating">
              <button class="sr-rate forgot" data-slug="${p.slug}" data-rating="0">😵忘了</button>
              <button class="sr-rate hard" data-slug="${p.slug}" data-rating="1">😤难</button>
              <button class="sr-rate good" data-slug="${p.slug}" data-rating="2">👍记得</button>
              <button class="sr-rate easy" data-slug="${p.slug}" data-rating="3">😊简单</button>
            </div>
          ` : `
            <div class="sr-queue-item-go">
              <button class="sr-go-btn" data-url="${p.url}">跳转 →</button>
            </div>
          `}
        </div>
      `;
    }).join('');

    // Bind events
    list.querySelectorAll('.sr-rate').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.rateReview(btn.dataset.slug, parseInt(btn.dataset.rating));
      });
    });

    list.querySelectorAll('.sr-go-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = btn.dataset.url;
      });
    });
  }

  async rateReview(slug, rating) {
    const labels = ['忘了', '困难', '记得', '简单'];
    try {
      const response = await this.safeSendMessage({
        action: 'markReviewed', slug, rating
      });

      if (response && response.success) {
        this.showNotification(
          `✅ ${labels[rating]}！${response.intervalDays}天后再次复习`,
          'success'
        );
        await this.refreshQueue();

        if (slug === this.problemInfo?.slug) {
          this.checkProblemStatus();
        }
      }
    } catch (e) {
      this.showNotification('评分失败: ' + e.message, 'error');
    }
  }

  goToNextReview() {
    const queue = this.reviewQueue || [];
    const currentSlug = this.problemInfo?.slug;
    const next = queue.find(p => p.slug !== currentSlug) || queue[0];
    if (next) {
      window.location.href = next.url;
    } else {
      this.showNotification('🎉 所有复习都完成了！', 'success');
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `leetcode-sr-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // 动画显示
    setTimeout(() => notification.classList.add('show'), 10);

    // 3秒后移除
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'refreshStatus') {
        this.checkProblemStatus();
      }
    });
  }
}

// 初始化
new LeetCodeHelper();
