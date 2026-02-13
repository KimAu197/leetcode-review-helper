// Popup界面逻辑

class PopupManager {
  constructor() {
    this.currentTab = 'practice';
    this.selectedTag = null;
    this.init();
  }

  async init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
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
    document.getElementById('refreshTagsBtn').addEventListener('click', () => this.handleRefreshTags());
    document.getElementById('addIntervalBtn').addEventListener('click', () => this.addInterval());
    document.getElementById('resetIntervalsBtn').addEventListener('click', () => this.resetIntervals());
    document.getElementById('newIntervalInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addInterval();
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));
    this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    switch (tabName) {
      case 'practice': await this.loadTodayPractice(); break;
      case 'review': await this.loadReviewTab(); break;
      case 'stats': await this.loadStatsTab(); break;
      case 'tags': await this.loadTagsTab(); break;
      case 'settings': await this.loadSettingsTab(); break;
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

  // ============ 难度分布图（LeetCode风格甜甜圈） ============

  renderDifficultyChart(containerId, diffData) {
    const container = document.getElementById(containerId);
    const total = (diffData.Easy || 0) + (diffData.Medium || 0) + (diffData.Hard || 0) + (diffData.Unknown || 0);

    if (total === 0) {
      container.parentElement?.querySelector('.diff-section')?.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    // Show section
    const section = container.closest('.diff-section');
    if (section) section.classList.remove('hidden');

    const items = [
      { label: 'Easy', count: diffData.Easy || 0, color: '#00b8a3' },
      { label: 'Medium', count: diffData.Medium || 0, color: '#ffc01e' },
      { label: 'Hard', count: diffData.Hard || 0, color: '#ff375f' }
    ].filter(i => i.count > 0);

    // SVG donut chart parameters
    const size = 120;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 44;
    const stroke = 10;
    const circumference = 2 * Math.PI * radius;

    // Build arcs
    let offset = 0;
    const arcs = items.map(item => {
      const pct = item.count / total;
      const dashLen = pct * circumference;
      const gap = circumference - dashLen;
      const arc = `<circle
        cx="${cx}" cy="${cy}" r="${radius}"
        fill="none" stroke="${item.color}" stroke-width="${stroke}"
        stroke-dasharray="${dashLen} ${gap}"
        stroke-dashoffset="${-offset}"
        stroke-linecap="round"
        style="transition: stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease;"
      />`;
      offset += dashLen;
      return arc;
    });

    container.innerHTML = `
      <div class="donut-chart-wrapper">
        <div class="donut-svg-container">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
            <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="${stroke}" />
            ${arcs.join('')}
          </svg>
          <div class="donut-center">
            <span class="donut-total">${total}</span>
            <span class="donut-label">题</span>
          </div>
        </div>
        <div class="donut-legend">
          ${items.map(i => `
            <div class="donut-legend-row">
              <span class="donut-legend-dot" style="background:${i.color}"></span>
              <span class="donut-legend-name">${i.label}</span>
              <span class="donut-legend-count">${i.count}</span>
              <span class="donut-legend-pct">${Math.round(i.count / total * 100)}%</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  // ============ 每日计划 & Top3 卡片 ============

  async renderDailyPlan() {
    try {
      const planRes = await chrome.runtime.sendMessage({ action: 'getDailyPlan' });
      const p = planRes.plan || {};
      const container = document.getElementById('dailyPlanSection');

      const reviewPct = p.reviewTarget > 0 ? Math.min(100, Math.round(p.reviewsDone / p.reviewTarget * 100)) : 0;
      const newPct = p.goals?.dailyNew > 0 ? Math.min(100, Math.round(p.newDone / p.goals.dailyNew * 100)) : 0;

      container.innerHTML = `
        <div class="plan-card ${p.isWeekend ? 'plan-weekend' : ''}">
          ${p.isWeekend ? '<div class="plan-weekend-badge">🔄 周末清仓模式 · 复习量×1.5</div>' : ''}
          <div class="plan-grid">
            <div class="plan-item">
              <div class="plan-val">${p.dueCount}</div>
              <div class="plan-lbl">待复习</div>
            </div>
            <div class="plan-item">
              <div class="plan-progress-ring">
                <svg width="42" height="42" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="18" fill="none" stroke="#e5e7eb" stroke-width="3"/>
                  <circle cx="21" cy="21" r="18" fill="none" stroke="#667eea" stroke-width="3"
                    stroke-dasharray="${reviewPct * 1.13} 113" stroke-dashoffset="0"
                    stroke-linecap="round" style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dasharray 0.5s"/>
                </svg>
                <span class="plan-ring-text">${p.reviewsDone}/${p.reviewTarget}</span>
              </div>
              <div class="plan-lbl">复习进度</div>
            </div>
            <div class="plan-item">
              <div class="plan-progress-ring">
                <svg width="42" height="42" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="18" fill="none" stroke="#e5e7eb" stroke-width="3"/>
                  <circle cx="21" cy="21" r="18" fill="none" stroke="#f59e0b" stroke-width="3"
                    stroke-dasharray="${newPct * 1.13} 113" stroke-dashoffset="0"
                    stroke-linecap="round" style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dasharray 0.5s"/>
                </svg>
                <span class="plan-ring-text">${p.newDone}/${p.goals?.dailyNew || 3}</span>
              </div>
              <div class="plan-lbl">新题进度</div>
            </div>
            <div class="plan-item">
              <div class="plan-val plan-time">~${p.estimatedMinutes}<small>min</small></div>
              <div class="plan-lbl">预计剩余</div>
            </div>
          </div>
          ${p.weakTags?.length > 0 ? `
            <div class="plan-weak">
              <span class="plan-weak-label">🎯 盲区推荐</span>
              ${p.weakTags.slice(0, 3).map(t => `<span class="plan-weak-tag" title="平均EF:${t.avgEF} 失败率:${t.failRate}%">${t.tag}</span>`).join('')}
            </div>` : ''}
        </div>`;

      // Top 3 card
      this.renderTop3Card(p.topReviews || []);
    } catch (e) { console.error('renderDailyPlan error:', e); }
  }

  renderTop3Card(topReviews) {
    const container = document.getElementById('top3Card');
    if (!topReviews || topReviews.length === 0) { container.innerHTML = ''; return; }

    const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    const medals = ['🥇', '🥈', '🥉'];

    container.innerHTML = `
      <div class="share-card">
        <div class="share-header">
          <span class="share-date">${dateStr}</span>
          <span class="share-title">今日最该复习</span>
        </div>
        ${topReviews.map((p, i) => `
          <div class="share-item">
            <span class="share-medal">${medals[i]}</span>
            <span class="share-name">#${p.number} ${p.title}</span>
            <span class="share-diff ${(p.difficulty || '').toLowerCase()}">${p.difficulty}</span>
          </div>
        `).join('')}
        <div class="share-footer">LeetCode Review Helper · Spaced Repetition</div>
      </div>`;
  }

  // ============ 今日刷题 Tab ============

  async loadTodayPractice() {
    try {
      await this.renderDailyPlan();

      const [practiceRes, tagStatsRes, statsRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getTodayPractice' }),
        chrome.runtime.sendMessage({ action: 'getTagStats' }),
        chrome.runtime.sendMessage({ action: 'getStats' })
      ]);

      const practice = practiceRes.practice || [];
      const tagStats = tagStatsRes.tagStats || [];
      const stats = statsRes.stats || {};

      // 今日难度分布
      const diffSection = document.getElementById('todayDiffSection');
      if (stats.todayTotal > 0) {
        diffSection.classList.remove('hidden');
        this.renderDifficultyChart('todayDiffChart', stats.todayDifficulty);
      } else {
        diffSection.classList.add('hidden');
      }

      // Tag 统计图
      this.renderTagStats(tagStats);

      // 刷题列表
      const container = document.getElementById('practiceList');
      if (practice.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>今天还没有刷题记录</p><small>在LeetCode题目页点击"记录刷题"按钮</small></div>`;
        return;
      }
      container.innerHTML = practice.sort((a, b) => b.loggedAt - a.loggedAt).map(p => this.createPracticeCard(p)).join('');
      this.attachCardListeners();
    } catch (error) { console.error('Error loading practice:', error); }
  }

  renderTagStats(tagStats) {
    const section = document.getElementById('tagStatsSection');
    const chart = document.getElementById('tagStatsChart');
    if (tagStats.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    const maxCount = Math.max(...tagStats.map(t => t.count));
    chart.innerHTML = tagStats.map(({ tag, count }) => {
      const width = Math.max((count / maxCount) * 100, 15);
      return `<div class="tag-stat-row"><span class="tag-stat-label">${tag}</span><div class="tag-stat-bar-wrapper"><div class="tag-stat-bar" style="width:${width}%">${count}</div></div></div>`;
    }).join('');
  }

  createPracticeCard(problem) {
    const tags = problem.tags || [];
    const tagsHtml = tags.length > 0 ? `<div class="problem-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : '';
    const time = new Date(problem.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const durationHtml = problem.duration ? `<span>⏱ ${problem.duration}min</span>` : '';
    const notesHtml = problem.notes ? `<div class="problem-notes">${this.escapeHtml(problem.notes)}</div>` : '';
    return `
      <div class="problem-card" data-slug="${problem.slug}">
        <div class="problem-header">
          <div class="problem-title"><span class="problem-number">#${problem.number}</span>${problem.title}</div>
          <span class="difficulty ${(problem.difficulty || '').toLowerCase()}">${problem.difficulty}</span>
        </div>
        ${tagsHtml}
        <div class="problem-meta"><span>🕐 ${time}</span>${durationHtml}</div>
        ${notesHtml}
        <div class="problem-actions"><button class="btn-small btn-link" data-action="open" data-url="${problem.url}">打开题目</button></div>
      </div>`;
  }

  // ============ 复习 Tab ============

  async loadReviewTab() {
    try {
      const [queueRes, completedRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getReviewQueue' }),
        chrome.runtime.sendMessage({ action: 'getTodayCompleted' })
      ]);
      const reviews = queueRes.queue || [];
      const completed = completedRes.completed || [];

      document.getElementById('reviewPendingTitle').textContent = `待复习 (${reviews.length})`;
      const pendingList = document.getElementById('reviewPendingList');
      pendingList.innerHTML = reviews.length === 0
        ? `<div class="empty-state small"><p>今天没有需要复习的题目 🎉</p></div>`
        : reviews.map(p => this.createReviewCard(p, false)).join('');

      document.getElementById('reviewDoneTitle').textContent = `今日已复习 (${completed.length})`;
      const doneList = document.getElementById('reviewDoneList');
      doneList.innerHTML = completed.length === 0
        ? `<div class="empty-state small"><p>还没有完成复习</p></div>`
        : completed.map(p => this.createReviewCard(p, true)).join('');

      this.attachCardListeners();
    } catch (error) { console.error('Error loading reviews:', error); }
  }

  createReviewCard(problem, isDone) {
    const tags = problem.tags || [];
    const tagsHtml = tags.length > 0 ? `<div class="problem-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : '';
    const durationHtml = problem.duration ? `<span>⏱ ${problem.duration}min</span>` : '';
    const notesHtml = problem.notes ? `<div class="problem-notes">${this.escapeHtml(problem.notes)}</div>` : '';
    const slug = problem.slug;

    // SM-2 info
    const ef = problem.easeFactor ?? 2.5;
    const efClass = ef >= 2.3 ? 'ef-good' : ef >= 1.8 ? 'ef-mid' : 'ef-low';
    const ps = problem.priorityScore;
    const priorityHtml = ps !== undefined
      ? `<span class="priority-badge ${ps >= 40 ? 'pri-high' : ps >= 20 ? 'pri-med' : 'pri-low'}" title="优先级 ${ps.toFixed(1)}">P${Math.round(ps)}</span>`
      : '';

    const nextReview = problem.nextReviewDate ||
      (problem.reviewDates && problem.reviewDates[problem.currentInterval || 0]);

    // Last rating info for completed reviews
    const history = problem.reviewHistory || [];
    const lastR = history.length > 0 ? history[history.length - 1] : null;
    const rLabels = ['😵 忘了', '😤 困难', '👍 记得', '😊 简单'];
    const lastInfo = isDone && lastR ? `<span>${rLabels[lastR.rating]} → ${lastR.interval}天后</span>` : '';

    // Rating buttons for pending reviews
    const ratingHtml = !isDone ? `
      <div class="rating-group">
        <button class="btn-rate rate-forgot" data-action="rate" data-slug="${slug}" data-rating="0">😵忘了</button>
        <button class="btn-rate rate-hard" data-action="rate" data-slug="${slug}" data-rating="1">😤难</button>
        <button class="btn-rate rate-good" data-action="rate" data-slug="${slug}" data-rating="2">👍记得</button>
        <button class="btn-rate rate-easy" data-action="rate" data-slug="${slug}" data-rating="3">😊简单</button>
      </div>` : '';

    return `
      <div class="problem-card" data-slug="${slug}">
        <div class="problem-header">
          ${priorityHtml}
          <div class="problem-title"><span class="problem-number">#${problem.number}</span>${problem.title}</div>
          <span class="difficulty ${(problem.difficulty || '').toLowerCase()}">${problem.difficulty}</span>
        </div>
        ${tagsHtml}
        <div class="problem-meta">
          <span class="ef-indicator ${efClass}" title="掌握度 EF:${ef}">EF${ef.toFixed(1)}</span>
          ${!isDone && nextReview ? `<span>📅 ${new Date(nextReview).toLocaleDateString()}</span>` : ''}
          ${lastInfo}
          <span>✅ ${(problem.completedReviews || []).length}次</span>
          ${durationHtml}
        </div>
        ${notesHtml}
        <div class="problem-actions">
          ${ratingHtml}
          <button class="btn-small btn-link" data-action="open" data-url="${problem.url}">打开</button>
          <button class="btn-small btn-delete" data-action="delete" data-slug="${slug}">删除</button>
        </div>
      </div>`;
  }

  // ============ 统计 Tab ============

  async loadStatsTab() {
    try {
      const [statsRes, streakRes, achieveRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getStats' }),
        chrome.runtime.sendMessage({ action: 'getStreakData' }),
        chrome.runtime.sendMessage({ action: 'getAchievements' })
      ]);
      const stats = statsRes.stats || {};
      const streak = streakRes.streak || {};
      const achievements = achieveRes.achievements || [];

      // Streak display
      const streakEl = document.getElementById('streakSection');
      const fireLevel = streak.currentStreak >= 30 ? 'streak-legendary' : streak.currentStreak >= 7 ? 'streak-hot' : '';
      streakEl.innerHTML = `
        <div class="streak-card ${fireLevel}">
          <div class="streak-flame">${streak.currentStreak > 0 ? '🔥' : '❄️'}</div>
          <div class="streak-info">
            <div class="streak-num">${streak.currentStreak}<small>天连续</small></div>
            <div class="streak-meta">
              最长 ${streak.longestStreak}天 · 成功率 ${streak.successRate}% · ${streak.totalActiveDays}天活跃
            </div>
          </div>
        </div>`;

      // Achievements
      const achieveEl = document.getElementById('achievementsSection');
      const unlocked = achievements.filter(a => a.unlocked).length;
      achieveEl.innerHTML = `
        <div class="achieve-section">
          <h3 class="section-title">成就 ${unlocked}/${achievements.length}</h3>
          <div class="achieve-grid">
            ${achievements.map(a => `
              <div class="achieve-item ${a.unlocked ? 'unlocked' : 'locked'}" title="${a.desc}">
                <span class="achieve-icon">${a.icon}</span>
                <span class="achieve-name">${a.name}</span>
              </div>
            `).join('')}
          </div>
        </div>`;

      // 累计难度分布
      this.renderDifficultyChart('totalDiffChart', stats.totalDifficulty || {});

      // 每日柱状图
      this.renderDailyBarChart(stats.dailyCounts || []);

      // 汇总数字
      const summary = document.getElementById('statsSummary');
      summary.innerHTML = `
        <div class="summary-grid">
          <div class="summary-item"><span class="summary-val">${stats.totalProblems || 0}</span><span class="summary-label">总题目</span></div>
          <div class="summary-item"><span class="summary-val">${stats.reviewProblems || 0}</span><span class="summary-label">复习计划</span></div>
          <div class="summary-item"><span class="summary-val">${streak.totalReviews || 0}</span><span class="summary-label">总复习次数</span></div>
          <div class="summary-item"><span class="summary-val">${streak.successRate || 0}%</span><span class="summary-label">复习成功率</span></div>
        </div>`;
    } catch (error) { console.error('Error loading stats:', error); }
  }

  renderDailyBarChart(dailyCounts) {
    const container = document.getElementById('dailyBarChart');
    if (!dailyCounts || dailyCounts.length === 0) {
      container.innerHTML = '<p class="empty-hint">暂无数据</p>';
      return;
    }

    const maxTotal = Math.max(...dailyCounts.map(d => d.total), 1);

    // Only show last 14 days to fit the popup width
    const recent = dailyCounts.slice(-14);

    container.innerHTML = `
      <div class="bar-chart-wrapper">
        ${recent.map(d => {
          const pHeight = Math.max((d.practice / maxTotal) * 100, 0);
          const rHeight = Math.max((d.review / maxTotal) * 100, 0);
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return `
            <div class="bar-col ${isToday ? 'bar-today' : ''}">
              <div class="bar-value">${d.total || ''}</div>
              <div class="bar-stack">
                ${d.review > 0 ? `<div class="bar-seg bar-review" style="height:${rHeight}%" title="复习: ${d.review}"></div>` : ''}
                ${d.practice > 0 ? `<div class="bar-seg bar-practice" style="height:${pHeight}%" title="刷题: ${d.practice}"></div>` : ''}
              </div>
              <div class="bar-label">${d.label}</div>
            </div>`;
        }).join('')}
      </div>
      <div class="bar-legend">
        <span class="diff-legend-item"><span class="diff-dot" style="background:#f59e0b"></span>刷题</span>
        <span class="diff-legend-item"><span class="diff-dot" style="background:#667eea"></span>复习</span>
      </div>`;
  }

  // ============ 按标签 Tab ============

  async loadTagsTab() {
    try {
      let tagsRes = await chrome.runtime.sendMessage({ action: 'getAllTags' });
      let tags = tagsRes.tags || [];
      const chipsContainer = document.getElementById('tagFilterChips');

      if (tags.length === 0) {
        chipsContainer.innerHTML = '<p class="empty-hint">正在从LeetCode获取标签...</p>';
        const refreshRes = await chrome.runtime.sendMessage({ action: 'refreshTags' });
        if (refreshRes.success && refreshRes.updated > 0) {
          tagsRes = await chrome.runtime.sendMessage({ action: 'getAllTags' });
          tags = tagsRes.tags || [];
        }
        if (tags.length === 0) {
          chipsContainer.innerHTML = '<p class="empty-hint">还没有任何标签</p>';
          return;
        }
      }

      chipsContainer.innerHTML = tags.map(({ tag, count }) => `
        <button class="tag-chip ${this.selectedTag === tag ? 'active' : ''}" data-tag="${tag}">${tag} <span class="tag-chip-count">${count}</span></button>
      `).join('');

      chipsContainer.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          this.selectedTag = chip.dataset.tag;
          chipsContainer.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          this.loadProblemsByTag(chip.dataset.tag);
        });
      });

      if (this.selectedTag) this.loadProblemsByTag(this.selectedTag);
    } catch (error) { console.error('Error loading tags:', error); }
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
        const sourceCls = p.source === 'review' ? 'source-review' : 'source-practice';
        const sourceLabel = p.source === 'review' ? '复习中' : '已刷题';
        const tags = (p.tags || []);
        const tagsHtml = tags.length > 0 ? `<div class="problem-tags">${tags.map(t => `<span class="tag ${t === tag ? 'tag-highlight' : ''}">${t}</span>`).join('')}</div>` : '';
        return `
          <div class="problem-card"><div class="problem-header"><div class="problem-title"><span class="problem-number">#${p.number}</span>${p.title}</div><span class="source-badge ${sourceCls}">${sourceLabel}</span><span class="difficulty ${(p.difficulty || '').toLowerCase()}">${p.difficulty}</span></div>${tagsHtml}<div class="problem-actions"><button class="btn-small btn-link" data-action="open" data-url="${p.url}">打开题目</button></div></div>`;
      }).join('');
      this.attachCardListeners();
    } catch (error) { console.error('Error loading problems by tag:', error); }
  }

  async handleRefreshTags() {
    const btn = document.getElementById('refreshTagsBtn');
    btn.disabled = true; btn.textContent = '获取中...';
    try {
      const res = await chrome.runtime.sendMessage({ action: 'refreshTags' });
      btn.textContent = res.success ? `更新 ${res.updated} 道` : '失败';
      await this.loadTagsTab();
    } catch (e) { btn.textContent = '失败'; }
    setTimeout(() => { btn.textContent = '刷新标签'; btn.disabled = false; }, 2000);
  }

  // ============ 设置 Tab ============

  async loadSettingsTab() {
    await Promise.all([this.loadGoalsEditor(), this.loadIntervalsEditor()]);
  }

  async loadGoalsEditor() {
    try {
      const [goalsRes, weakRes] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getGoals' }),
        chrome.runtime.sendMessage({ action: 'getWeakTags' })
      ]);
      const goals = goalsRes.goals || { dailyNew: 3, dailyReview: 8, timeBudget: 45 };
      const weakTags = weakRes.weakTags || [];

      const container = document.getElementById('goalsEditor');
      container.innerHTML = `
        <div class="goals-grid">
          <div class="goals-field">
            <label>每日新题</label>
            <input type="number" id="goalNew" min="0" max="20" value="${goals.dailyNew}" class="goals-input">
          </div>
          <div class="goals-field">
            <label>每日复习</label>
            <input type="number" id="goalReview" min="0" max="50" value="${goals.dailyReview}" class="goals-input">
          </div>
          <div class="goals-field">
            <label>时间预算(min)</label>
            <input type="number" id="goalTime" min="10" max="300" value="${goals.timeBudget}" class="goals-input">
          </div>
        </div>
        ${weakTags.length > 0 ? `
          <div class="goals-weak-hint">
            <span class="goals-weak-label">🎯 薄弱标签</span>
            ${weakTags.slice(0, 4).map(t => `<span class="goals-weak-chip" title="EF:${t.avgEF} 失败率:${t.failRate}%">${t.tag}</span>`).join('')}
          </div>` : ''}
        <button id="saveGoalsBtn" class="btn-primary" style="margin-top:8px;">保存目标</button>`;

      document.getElementById('saveGoalsBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveGoalsBtn');
        const newGoals = {
          dailyNew: parseInt(document.getElementById('goalNew').value) || 3,
          dailyReview: parseInt(document.getElementById('goalReview').value) || 8,
          timeBudget: parseInt(document.getElementById('goalTime').value) || 45
        };
        await chrome.runtime.sendMessage({ action: 'setGoals', goals: newGoals });
        btn.textContent = '✅ 已保存';
        setTimeout(() => { btn.textContent = '保存目标'; }, 1500);
      });
    } catch (e) { console.error('loadGoalsEditor error:', e); }
  }

  // ============ 间隔编辑器 ============

  async loadIntervalsEditor() {
    const res = await chrome.runtime.sendMessage({ action: 'getIntervals' });
    const intervals = res.intervals || [1, 3, 7, 14, 30, 60];
    const editor = document.getElementById('intervalsEditor');

    editor.innerHTML = intervals.sort((a, b) => a - b).map(day => `
      <span class="interval-chip">
        ${day}天
        <button class="interval-remove" data-day="${day}" title="删除">×</button>
      </span>
    `).join('');

    editor.querySelectorAll('.interval-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const day = parseInt(btn.dataset.day);
        const newIntervals = intervals.filter(d => d !== day);
        if (newIntervals.length === 0) { alert('至少保留一个间隔'); return; }
        await chrome.runtime.sendMessage({ action: 'setIntervals', intervals: newIntervals });
        this.loadIntervalsEditor();
      });
    });
  }

  async addInterval() {
    const input = document.getElementById('newIntervalInput');
    const day = parseInt(input.value);
    if (!day || day < 1 || day > 365) { input.focus(); return; }

    const res = await chrome.runtime.sendMessage({ action: 'getIntervals' });
    const intervals = res.intervals || [1, 3, 7, 14, 30, 60];

    if (intervals.includes(day)) { input.value = ''; input.focus(); return; }

    intervals.push(day);
    intervals.sort((a, b) => a - b);
    await chrome.runtime.sendMessage({ action: 'setIntervals', intervals });
    input.value = '';
    this.loadIntervalsEditor();
  }

  async resetIntervals() {
    await chrome.runtime.sendMessage({ action: 'setIntervals', intervals: [1, 3, 7, 14, 30, 60] });
    this.loadIntervalsEditor();
  }

  // ============ 通用事件绑定 ============

  attachCardListeners() {
    document.querySelectorAll('[data-action="rate"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.markProblemDone(btn.dataset.slug, parseInt(btn.dataset.rating));
      });
    });
    document.querySelectorAll('[data-action="open"]').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); chrome.tabs.create({ url: btn.dataset.url }); });
    });
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => { e.stopPropagation(); if (confirm('确定删除？')) await this.deleteProblem(btn.dataset.slug); });
    });
  }

  async markProblemDone(slug, rating = 2) {
    await chrome.runtime.sendMessage({ action: 'markReviewed', slug, rating });
    await this.loadData();
  }

  async deleteProblem(slug) {
    await chrome.runtime.sendMessage({ action: 'deleteProblem', slug });
    await this.loadData();
  }

  // ============ 设置 ============

  async connectCalendar() {
    const btn = document.getElementById('connectCalendar');
    const status = document.getElementById('calendarStatus');
    btn.disabled = true; btn.textContent = '连接中...';
    try {
      const response = await chrome.runtime.sendMessage({ action: 'connectCalendar' });
      if (response.success) { status.textContent = '✅ 已连接'; status.className = 'status-message success'; btn.textContent = '已连接'; }
      else throw new Error(response.error);
    } catch (error) {
      status.textContent = '❌ ' + error.message; status.className = 'status-message error';
      btn.disabled = false; btn.textContent = '重试';
    }
    status.classList.remove('hidden');
  }

  async exportData() {
    const [p, pr] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'getProblems' }),
      chrome.runtime.sendMessage({ action: 'getTodayPractice' })
    ]);
    const blob = new Blob([JSON.stringify({ problems: p.problems, practiceLog: pr.practice, exportedAt: Date.now() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `leetcode-data-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  }

  importData() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (data.problems) {
          const map = {};
          (Array.isArray(data.problems) ? data.problems : Object.values(data.problems)).forEach(p => { map[p.slug] = p; });
          await chrome.storage.local.set({ problems: map });
        }
        if (data.practiceLog) await chrome.storage.local.set({ practiceLog: data.practiceLog });
        await this.loadData(); alert('导入成功！');
      } catch (err) { alert('导入失败: ' + err.message); }
    };
    input.click();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async clearData() {
    if (confirm('确定清空所有数据？不可恢复！')) {
      await chrome.storage.local.set({ problems: {}, practiceLog: [] });
      await this.loadData(); alert('已清空');
    }
  }
}

new PopupManager();
