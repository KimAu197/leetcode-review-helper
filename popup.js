// Popup界面逻辑

class PopupManager {
  constructor() {
    this.currentTab = 'today';
    this.init();
  }

  async init() {
    // 设置Tab切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // 设置按钮事件
    this.setupEventListeners();

    // 加载数据
    await this.loadData();
    
    // 每30秒刷新一次
    setInterval(() => this.loadData(), 30000);
  }

  setupEventListeners() {
    // Google Calendar连接
    document.getElementById('connectCalendar').addEventListener('click', async () => {
      await this.connectCalendar();
    });

    // 复习时间设置
    document.getElementById('reviewTime').addEventListener('change', (e) => {
      this.saveReviewTime(e.target.value);
    });

    // 数据管理
    document.getElementById('exportData').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('importData').addEventListener('click', () => {
      this.importData();
    });

    document.getElementById('clearData').addEventListener('click', () => {
      this.clearData();
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // 更新Tab按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // 加载对应数据
    if (tabName === 'today') {
      this.loadTodayReviews();
    } else if (tabName === 'done') {
      this.loadTodayCompleted();
    } else if (tabName === 'all') {
      this.loadAllProblems();
    }
  }

  async loadData() {
    await this.updateStats();
    if (this.currentTab === 'today') {
      await this.loadTodayReviews();
    } else if (this.currentTab === 'done') {
      await this.loadTodayCompleted();
    } else if (this.currentTab === 'all') {
      await this.loadAllProblems();
    }
  }

  async updateStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProblems' });
      const problems = response.problems || [];

      const todayResponse = await chrome.runtime.sendMessage({ action: 'getTodayReviews' });
      const todayReviews = todayResponse.reviews || [];

      const todayCompletedResponse = await chrome.runtime.sendMessage({ action: 'getTodayCompleted' });
      const todayCompleted = todayCompletedResponse.completed || [];

      const allCompleted = problems.filter(p => 
        p.currentInterval >= p.reviewDates.length
      ).length;

      document.getElementById('totalProblems').textContent = problems.length;
      document.getElementById('todayReviews').textContent = todayReviews.length;
      document.getElementById('todayCompleted').textContent = todayCompleted.length;
      document.getElementById('completedProblems').textContent = allCompleted;
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  async loadTodayReviews() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTodayReviews' });
      const reviews = response.reviews || [];

      const container = document.getElementById('todayList');
      
      if (reviews.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" stroke-width="2"/>
              <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>今天没有需要复习的题目</p>
            <small>继续保持！🎉</small>
          </div>
        `;
        return;
      }

      container.innerHTML = reviews.map(problem => this.createProblemCard(problem, true)).join('');

      // 添加事件监听
      this.attachProblemCardListeners();
    } catch (error) {
      console.error('Error loading today reviews:', error);
    }
  }

  async loadTodayCompleted() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getTodayCompleted' });
      const completed = response.completed || [];

      const container = document.getElementById('doneList');

      if (completed.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-width="2" stroke-linecap="round"/>
              <path d="M22 4L12 14.01l-3-3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p>今天还没有完成复习</p>
            <small>去"今日复习"完成题目吧</small>
          </div>
        `;
        return;
      }

      container.innerHTML = completed.map(problem => this.createProblemCard(problem, false)).join('');
      this.attachProblemCardListeners();
    } catch (error) {
      console.error('Error loading today completed:', error);
    }
  }

  async loadAllProblems() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProblems' });
      const problems = response.problems || [];

      const container = document.getElementById('allList');
      
      if (problems.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>还没有添加任何题目</p>
            <small>打开LeetCode题目页面，点击浮动按钮添加</small>
          </div>
        `;
        return;
      }

      // 按添加时间倒序排列
      problems.sort((a, b) => b.addedAt - a.addedAt);

      container.innerHTML = problems.map(problem => this.createProblemCard(problem, false)).join('');

      // 添加事件监听
      this.attachProblemCardListeners();
    } catch (error) {
      console.error('Error loading all problems:', error);
    }
  }

  createProblemCard(problem, isToday) {
    const nextReview = problem.reviewDates[problem.currentInterval];
    const nextReviewDate = nextReview ? new Date(nextReview) : null;
    const isCompleted = problem.currentInterval >= problem.reviewDates.length;
    const tags = problem.tags || [];

    const tagsHtml = tags.length > 0
      ? `<div class="problem-tags">${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
      : '';

    return `
      <div class="problem-card" data-slug="${problem.slug}">
        <div class="problem-header">
          <div class="problem-title">
            <span class="problem-number">#${problem.number}</span>
            ${problem.title}
          </div>
          <span class="difficulty ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span>
        </div>
        ${tagsHtml}
        <div class="problem-meta">
          <span>📅 ${isCompleted ? '已完成所有复习' : `下次: ${nextReviewDate.toLocaleDateString()}`}</span>
          <span>✅ ${problem.completedReviews.length}/${problem.reviewDates.length}</span>
        </div>
        <div class="problem-actions">
          ${!isCompleted ? `<button class="btn-small btn-done" data-action="done" data-slug="${problem.slug}">完成复习</button>` : ''}
          <button class="btn-small btn-link" data-action="open" data-url="${problem.url}">打开题目</button>
          <button class="btn-small btn-delete" data-action="delete" data-slug="${problem.slug}">删除</button>
        </div>
      </div>
    `;
  }

  attachProblemCardListeners() {
    document.querySelectorAll('[data-action="done"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const slug = btn.dataset.slug;
        await this.markProblemDone(slug);
      });
    });

    document.querySelectorAll('[data-action="open"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: btn.dataset.url });
      });
    });

    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这道题吗？')) {
          const slug = btn.dataset.slug;
          await this.deleteProblem(slug);
        }
      });
    });
  }

  async markProblemDone(slug) {
    try {
      await chrome.runtime.sendMessage({
        action: 'markReviewed',
        slug: slug
      });
      await this.loadData();
    } catch (error) {
      console.error('Error marking problem done:', error);
      alert('标记失败: ' + error.message);
    }
  }

  async deleteProblem(slug) {
    try {
      await chrome.runtime.sendMessage({
        action: 'deleteProblem',
        slug: slug
      });
      await this.loadData();
    } catch (error) {
      console.error('Error deleting problem:', error);
      alert('删除失败: ' + error.message);
    }
  }

  async connectCalendar() {
    const btn = document.getElementById('connectCalendar');
    const status = document.getElementById('calendarStatus');

    btn.disabled = true;
    btn.textContent = '连接中...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'connectCalendar' });
      
      if (response.success) {
        status.textContent = '✅ 已成功连接到Google Calendar';
        status.className = 'status-message success';
        btn.textContent = '已连接';
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Calendar connection failed:', error);
      status.textContent = '❌ 连接失败: ' + error.message;
      status.className = 'status-message error';
      btn.disabled = false;
      btn.textContent = '重试连接';
    }

    status.classList.remove('hidden');
  }

  async saveReviewTime(time) {
    await chrome.storage.local.set({ reviewTime: time });
    console.log('Review time saved:', time);
  }

  async exportData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getProblems' });
      const problems = response.problems || [];

      const dataStr = JSON.stringify(problems, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `leetcode-reviews-${Date.now()}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      alert('数据导出成功！');
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败: ' + error.message);
    }
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        const text = await file.text();
        const problems = JSON.parse(text);
        
        // 保存导入的数据
        const problemsMap = {};
        problems.forEach(p => {
          problemsMap[p.slug] = p;
        });
        
        await chrome.storage.local.set({ problems: problemsMap });
        await this.loadData();
        alert('数据导入成功！');
      } catch (error) {
        console.error('Import failed:', error);
        alert('导入失败: ' + error.message);
      }
    };
    
    input.click();
  }

  async clearData() {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      if (confirm('再次确认：真的要删除所有复习记录吗？')) {
        await chrome.storage.local.set({ problems: {} });
        await this.loadData();
        alert('所有数据已清空');
      }
    }
  }
}

// 初始化
new PopupManager();
