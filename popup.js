// Popup界面逻辑

class PopupManager {
  constructor() {
    this.currentTab = 'practice';
    this.selectedTag = null;
    this.init();
  }

  async init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    this.setupEventListeners();
    await this.loadData();
    setInterval(() => this.loadData(), 30000);
  }

  setupEventListeners() {
    document.getElementById('connectCalendar').addEventListener('click', () => this.connectCalendar());
    document.getElementById('exportData').addEventListener('click', () => this.exportData());
    document.getElementById('importData').addEventListener('click', () => this.importData());
    document.getElementById('clearData').addEventListener('click', () => this.clearData());
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    switch (tabName) {
      case 'practice': await this.loadTodayPractice(); break;
      case 'review': await this.loadReviewTab(); break;
      case 'tags': await this.loadTagsTab(); break;
    }
  }

  async loadData() {
    await this.updateStats();
    await this.loadTabData(this.currentTab);
  }

  // ============ 统计面板 ============

  async updateStats() {
    try {
      const [problemsRes, reviewsRes, completedRes, practiceRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getProblems' }),
        chrome.runtime.sendMessage({ action: 'getTodayReviews' }),
        chrome.runtime.sendMessage({ action: 'getTodayCompleted' }),
        chrome.runtime.sendMessage({ action: 'getTodayPractice' })
      ]);

      document.getElementById('totalProblems').textContent = (problemsRes.problems || []).length;
      document.getElementById('todayReviews').textContent = (reviewsRes.reviews || []).length;
      document.getElementById('todayCompleted').textContent = (completedRes.completed || []).length;
      document.getElementById('todayPractice').textContent = (practiceRes.practice || []).length;
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  // ============ 今日刷题 Tab ============

  async loadTodayPractice() {
    try {
      const [practiceRes, tagStatsRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getTodayPractice' }),
        chrome.runtime.sendMessage({ action: 'getTagStats' })
      ]);

      const practice = practiceRes.practice || [];
      const tagStats = tagStatsRes.tagStats || [];

      // Tag 统计图
      this.renderTagStats(tagStats);

      // 刷题列表
      const container = document.getElementById('practiceList');
      if (practice.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 11l3 3L22 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>今天还没有刷题记录</p>
            <small>在LeetCode题目页点击"记录刷题"按钮</small>
          </div>`;
        return;
      }

      container.innerHTML = practice
        .sort((a, b) => b.loggedAt - a.loggedAt)
        .map(p => this.createPracticeCard(p))
        .join('');

      this.attachCardListeners();
    } catch (error) {
      console.error('Error loading practice:', error);
    }
  }

  renderTagStats(tagStats) {
    const section = document.getElementById('tagStatsSection');
    const chart = document.getElementById('tagStatsChart');

    if (tagStats.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    const maxCount = Math.max(...tagStats.map(t => t.count));

    chart.innerHTML = tagStats.map(({ tag, count }) => {
      const width = Math.max((count / maxCount) * 100, 15);
      return `
        <div class="tag-stat-row">
          <span class="tag-stat-label">${tag}</span>
          <div class="tag-stat-bar-wrapper">
            <div class="tag-stat-bar" style="width:${width}%">${count}</div>
          </div>
        </div>`;
    }).join('');
  }

  createPracticeCard(problem) {
    const tags = (problem.tags || []);
    const tagsHtml = tags.length > 0
      ? `<div class="problem-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
      : '';
    const time = new Date(problem.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="problem-card" data-slug="${problem.slug}">
        <div class="problem-header">
          <div class="problem-title">
            <span class="problem-number">#${problem.number}</span>
            ${problem.title}
          </div>
          <span class="difficulty ${(problem.difficulty || '').toLowerCase()}">${problem.difficulty}</span>
        </div>
        ${tagsHtml}
        <div class="problem-meta">
          <span>🕐 ${time}</span>
        </div>
        <div class="problem-actions">
          <button class="btn-small btn-link" data-action="open" data-url="${problem.url}">打开题目</button>
        </div>
      </div>`;
  }

  // ============ 复习 Tab ============

  async loadReviewTab() {
    try {
      const [reviewsRes, completedRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getTodayReviews' }),
        chrome.runtime.sendMessage({ action: 'getTodayCompleted' })
      ]);

      const reviews = reviewsRes.reviews || [];
      const completed = completedRes.completed || [];

      // 待复习
      const pendingList = document.getElementById('reviewPendingList');
      const pendingTitle = document.getElementById('reviewPendingTitle');
      pendingTitle.textContent = `待复习 (${reviews.length})`;

      if (reviews.length === 0) {
        pendingList.innerHTML = `<div class="empty-state small"><p>今天没有需要复习的题目</p></div>`;
      } else {
        pendingList.innerHTML = reviews.map(p => this.createReviewCard(p, false)).join('');
      }

      // 已复习
      const doneList = document.getElementById('reviewDoneList');
      const doneTitle = document.getElementById('reviewDoneTitle');
      doneTitle.textContent = `今日已复习 (${completed.length})`;

      if (completed.length === 0) {
        doneList.innerHTML = `<div class="empty-state small"><p>还没有完成复习</p></div>`;
      } else {
        doneList.innerHTML = completed.map(p => this.createReviewCard(p, true)).join('');
      }

      this.attachCardListeners();
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  }

  createReviewCard(problem, isDone) {
    const tags = (problem.tags || []);
    const tagsHtml = tags.length > 0
      ? `<div class="problem-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
      : '';

    const nextReview = problem.reviewDates && problem.reviewDates[problem.currentInterval];
    const isAllDone = problem.currentInterval >= problem.reviewDates.length;
    const progress = `${problem.completedReviews.length}/${problem.reviewDates.length}`;

    return `
      <div class="problem-card" data-slug="${problem.slug}">
        <div class="problem-header">
          <div class="problem-title">
            <span class="problem-number">#${problem.number}</span>
            ${problem.title}
          </div>
          <span class="difficulty ${(problem.difficulty || '').toLowerCase()}">${problem.difficulty}</span>
        </div>
        ${tagsHtml}
        <div class="problem-meta">
          <span>✅ ${progress}</span>
          <span>📅 ${isAllDone ? '全部完成' : `下次: ${new Date(nextReview).toLocaleDateString()}`}</span>
        </div>
        <div class="problem-actions">
          ${!isDone && !isAllDone ? `<button class="btn-small btn-done" data-action="done" data-slug="${problem.slug}">完成复习</button>` : ''}
          <button class="btn-small btn-link" data-action="open" data-url="${problem.url}">打开题目</button>
          <button class="btn-small btn-delete" data-action="delete" data-slug="${problem.slug}">删除</button>
        </div>
      </div>`;
  }

  // ============ 按标签 Tab ============

  async loadTagsTab() {
    try {
      const tagsRes = await chrome.runtime.sendMessage({ action: 'getAllTags' });
      const tags = tagsRes.tags || [];

      const chipsContainer = document.getElementById('tagFilterChips');

      if (tags.length === 0) {
        chipsContainer.innerHTML = '<p class="empty-hint">还没有任何标签，添加题目后会自动出现</p>';
        return;
      }

      chipsContainer.innerHTML = tags.map(({ tag, count }) => `
        <button class="tag-chip ${this.selectedTag === tag ? 'active' : ''}" data-tag="${tag}">
          ${tag} <span class="tag-chip-count">${count}</span>
        </button>
      `).join('');

      // Chip点击事件
      chipsContainer.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          this.selectedTag = chip.dataset.tag;
          // 更新active状态
          chipsContainer.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.loadProblemsByTag(chip.dataset.tag);
        });
      });

      // 如果有已选tag，加载其题目
      if (this.selectedTag) {
        this.loadProblemsByTag(this.selectedTag);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  async loadProblemsByTag(tag) {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getProblemsByTag', tag });
      const problems = res.problems || [];

      const container = document.getElementById('tagProblemList');

      if (problems.length === 0) {
        container.innerHTML = `<div class="empty-state small"><p>没有找到"${tag}"标签的题目</p></div>`;
        return;
      }

      container.innerHTML = problems.map(p => {
        const sourceLabel = p.source === 'review' ? '复习中' : '已刷题';
        const sourceCls = p.source === 'review' ? 'source-review' : 'source-practice';
        const tags = (p.tags || []);
        const tagsHtml = tags.length > 0
          ? `<div class="problem-tags">${tags.map(t => `<span class="tag ${t === tag ? 'tag-highlight' : ''}">${t}</span>`).join('')}</div>`
          : '';

        return `
          <div class="problem-card" data-slug="${p.slug}">
            <div class="problem-header">
              <div class="problem-title">
                <span class="problem-number">#${p.number}</span>
                ${p.title}
              </div>
              <span class="source-badge ${sourceCls}">${sourceLabel}</span>
              <span class="difficulty ${(p.difficulty || '').toLowerCase()}">${p.difficulty}</span>
            </div>
            ${tagsHtml}
            <div class="problem-actions">
              <button class="btn-small btn-link" data-action="open" data-url="${p.url}">打开题目</button>
            </div>
          </div>`;
      }).join('');

      this.attachCardListeners();
    } catch (error) {
      console.error('Error loading problems by tag:', error);
    }
  }

  // ============ 通用事件绑定 ============

  attachCardListeners() {
    document.querySelectorAll('[data-action="done"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.markProblemDone(btn.dataset.slug);
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
          await this.deleteProblem(btn.dataset.slug);
        }
      });
    });
  }

  async markProblemDone(slug) {
    try {
      await chrome.runtime.sendMessage({ action: 'markReviewed', slug });
      await this.loadData();
    } catch (error) {
      alert('标记失败: ' + error.message);
    }
  }

  async deleteProblem(slug) {
    try {
      await chrome.runtime.sendMessage({ action: 'deleteProblem', slug });
      await this.loadData();
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  }

  // ============ 设置 ============

  async connectCalendar() {
    const btn = document.getElementById('connectCalendar');
    const status = document.getElementById('calendarStatus');
    btn.disabled = true;
    btn.textContent = '连接中...';

    try {
      const response = await chrome.runtime.sendMessage({ action: 'connectCalendar' });
      if (response.success) {
        status.textContent = '✅ 已连接';
        status.className = 'status-message success';
        btn.textContent = '已连接';
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      status.textContent = '❌ ' + error.message;
      status.className = 'status-message error';
      btn.disabled = false;
      btn.textContent = '重试';
    }
    status.classList.remove('hidden');
  }

  async exportData() {
    try {
      const [problemsRes, practiceRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getProblems' }),
        chrome.runtime.sendMessage({ action: 'getTodayPractice' })
      ]);

      const data = {
        problems: problemsRes.problems || [],
        practiceLog: practiceRes.practice || [],
        exportedAt: Date.now()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leetcode-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('导出失败: ' + error.message);
    }
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const text = await e.target.files[0].text();
        const data = JSON.parse(text);

        if (data.problems) {
          const problemsMap = {};
          (Array.isArray(data.problems) ? data.problems : Object.values(data.problems))
            .forEach(p => { problemsMap[p.slug] = p; });
          await chrome.storage.local.set({ problems: problemsMap });
        }
        if (data.practiceLog) {
          await chrome.storage.local.set({ practiceLog: data.practiceLog });
        }

        await this.loadData();
        alert('导入成功！');
      } catch (error) {
        alert('导入失败: ' + error.message);
      }
    };
    input.click();
  }

  async clearData() {
    if (confirm('确定清空所有数据？此操作不可恢复！')) {
      await chrome.storage.local.set({ problems: {}, practiceLog: [] });
      await this.loadData();
      alert('已清空');
    }
  }
}

new PopupManager();
