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
    document.getElementById('exportData').addEventListener('click', () => this.exportData());
    document.getElementById('importData').addEventListener('click', () => this.importData());
    document.getElementById('clearData').addEventListener('click', () => this.clearData());
    document.getElementById('refreshTagsBtn').addEventListener('click', () => this.handleRefreshTags());
    document.getElementById('saveFirstIntervalBtn').addEventListener('click', () => this.saveFirstInterval());
    document.getElementById('firstIntervalInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveFirstInterval();
    });
    document.getElementById('autoLogOnReviewToggle').addEventListener('change', (e) => this.saveAutoLogSetting(e.target.checked));
    document.getElementById('clearStaleReviewsBtn').addEventListener('click', () => this.clearStaleReviews());
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
      case 'practiced': await this.loadPracticedTab(); break;
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
              <span class="donut-legend-pct">${total > 0 ? Math.round(i.count / total * 100) : 0}%</span></span>
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

      const reviewPct = p.reviewTarget > 0 ? Math.min(100, Math.round((p.reviewsDone || 0) / p.reviewTarget * 100)) : 0;
      const newPct = p.goals?.dailyNew > 0 ? Math.min(100, Math.round((p.newDone || 0) / p.goals.dailyNew * 100)) : 0;

      const modeClass = p.backlogMode ? 'plan-backlog' : (p.isWeekend ? 'plan-weekend' : '');
      const modeBadge = p.backlogMode
        ? `<div class="plan-backlog-badge">⚠️ 积压清理模式 · ${p.overdueCount || 0}道逾期 · 约${p.backlogDays || 0}天消化</div>`
        : (p.isWeekend ? '<div class="plan-weekend-badge">🔄 周末清仓模式 · 复习量×1.5</div>' : '');

      container.innerHTML = `
        <div class="plan-card ${modeClass}">
          ${modeBadge}
          <div class="plan-grid">
            <div class="plan-item">
              <div class="plan-val">${p.dueCount || 0}${(p.overdueCount || 0) > 0 ? `<small class="plan-overdue-hint"> (${p.overdueCount}逾期)</small>` : ''}</div>
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
                <span class="plan-ring-text">${p.reviewsDone || 0}/${p.reviewTarget || 0}</span>
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
                <span class="plan-ring-text">${p.newDone || 0}/${p.goals?.dailyNew || 3}</span>
              </div>
              <div class="plan-lbl">新题进度</div>
            </div>
            <div class="plan-item">
              <div class="plan-val plan-time">~${p.estimatedMinutes || 0}<small>min</small></div>
              <div class="plan-lbl">预计剩余</div>
            </div>
          </div>
          ${(p.weakTags?.length || 0) > 0 ? `
            <div class="plan-weak">
              <span class="plan-weak-label">🎯 盲区推荐</span>
              ${(p.weakTags || []).slice(0, 3).map(t => `<span class="plan-weak-tag" title="平均EF:${t.avgEF || 0} 失败率:${t.failRate || 0}%">${t.tag}</span>`).join('')}
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
            <span class="share-medal">${medals[i] || ''}</span>
            <span class="share-name">#${p.number || '?'} ${p.title || '未知题目'}</span>
            <span class="share-diff ${(p.difficulty || '').toLowerCase()}">${p.difficulty || 'Unknown'}</span>
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

      // 今日 AC 率
      this.renderTodayAcRate(practice);

      // 今日刷题列表
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

  renderTodayAcRate(practice) {
    const section = document.getElementById('todayAcSection');
    const container = document.getElementById('todayAcRate');

    // 只统计有 solved 字段的题目
    const withStatus = practice.filter(p => p.solved !== undefined);
    if (withStatus.length === 0) {
      section.classList.add('hidden');
      return;
    }

    const acCount = withStatus.filter(p => p.solved === true).length;
    const total = withStatus.length;
    const rate = total > 0 ? Math.round((acCount / total) * 100) : 0;

    section.classList.remove('hidden');
    container.innerHTML = `
      <div class="ac-rate-card">
        <div class="ac-rate-main">
          <div class="ac-rate-circle">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" stroke-width="6"/>
              <circle cx="40" cy="40" r="36" fill="none" stroke="${rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444'}" stroke-width="6"
                stroke-dasharray="${rate * 2.26} 226" stroke-linecap="round"
                style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dasharray 0.5s"/>
            </svg>
            <span class="ac-rate-text">${rate}%</span>
          </div>
          <div class="ac-rate-details">
            <div class="ac-rate-row">
              <span class="ac-rate-label">✓ AC</span>
              <span class="ac-rate-val ac-yes">${acCount}</span>
            </div>
            <div class="ac-rate-row">
              <span class="ac-rate-label">✗ 未AC</span>
              <span class="ac-rate-val ac-no">${total - acCount}</span>
            </div>
            <div class="ac-rate-row">
              <span class="ac-rate-label">总计</span>
              <span class="ac-rate-val">${total}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderHeatmapCalendar(allPractice) {
    const container = document.getElementById('heatmapCalendar');

    // 按日期统计（使用本地时区）
    const countByDate = {};
    const problemsByDate = {};
    allPractice.forEach(p => {
      const date = new Date(p.loggedAt);
      // 使用本地时区日期，避免 UTC 转换问题
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      countByDate[dateKey] = (countByDate[dateKey] || 0) + 1;
      if (!problemsByDate[dateKey]) problemsByDate[dateKey] = [];
      problemsByDate[dateKey].push(p);
    });

    // 存储数据供后续使用
    this.practiceData = { countByDate, problemsByDate, allPractice };

    // 初始化为当前月份
    if (!this.currentCalendarDate) {
      this.currentCalendarDate = new Date();
    }

    this.renderMonthView();
  }

  renderMonthView() {
    const container = document.getElementById('heatmapCalendar');
    if (!this.practiceData) return;

    const { countByDate, problemsByDate } = this.practiceData;
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();

    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // 获取当月第一天是星期几 (0=周日)
    const firstDayOfWeek = firstDay.getDay();

    // 计算当月统计
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();
    const monthProblems = this.practiceData.allPractice.filter(p =>
      p.loggedAt >= monthStart && p.loggedAt <= monthEnd
    );
    const monthCount = monthProblems.length;
    const monthPracticeCount = monthProblems.filter(p => p.type === 'practice').length;
    const monthReviewCount = monthProblems.filter(p => p.type === 'review').length;
    const monthAcCount = monthProblems.filter(p => p.solved === true).length;
    const monthAcRate = monthCount > 0 ? Math.round((monthAcCount / monthCount) * 100) : 0;

    // 生成日历格子
    const cells = [];

    // 填充空白 (周日到第一天之前)
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push('<div class="calendar-cell calendar-empty"></div>');
    }

    // 填充日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      // 使用本地时区生成日期键
      const dateYear = date.getFullYear();
      const dateMonth = String(date.getMonth() + 1).padStart(2, '0');
      const dateDay = String(date.getDate()).padStart(2, '0');
      const dateKey = `${dateYear}-${dateMonth}-${dateDay}`;

      const count = countByDate[dateKey] || 0;
      const isToday = date.getTime() === todayTs;
      const isFuture = date > today;

      const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
      const todayClass = isToday ? 'calendar-today' : '';
      const futureClass = isFuture ? 'calendar-future' : '';

      cells.push(`
        <div class="calendar-cell ${todayClass} ${futureClass}"
             data-date="${dateKey}"
             data-count="${count}"
             data-level="${level}">
          <div class="calendar-day-num">${day}</div>
          ${count > 0 ? `<div class="calendar-count level-${level}">${count}</div>` : ''}
        </div>
      `);
    }

    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

    container.innerHTML = `
      <div class="calendar-header">
        <button class="calendar-nav-btn" id="calendar-prev-month">‹</button>
        <div class="calendar-title">
          <span class="calendar-year clickable" id="calendar-year-selector">${year}年</span>
          <span class="calendar-month clickable" id="calendar-month-selector">${monthNames[month]}</span>
        </div>
        <button class="calendar-nav-btn" id="calendar-next-month">›</button>
      </div>
      <div class="calendar-stats">
        <span class="calendar-stat">本月总计: <strong>${monthCount}</strong></span>
        <span class="calendar-stat">新题: <strong>${monthPracticeCount}</strong></span>
        <span class="calendar-stat">复习: <strong>${monthReviewCount}</strong></span>
        <span class="calendar-stat">AC率: <strong>${monthAcRate}%</strong></span>
      </div>
      <div class="calendar-weekdays">
        ${['日', '一', '二', '三', '四', '五', '六'].map(d => `<div class="calendar-weekday">${d}</div>`).join('')}
      </div>
      <div class="calendar-grid">
        ${cells.join('')}
      </div>
      <div class="calendar-legend">
        <span class="calendar-legend-label">少</span>
        <div class="calendar-legend-item level-0"></div>
        <div class="calendar-legend-item level-1"></div>
        <div class="calendar-legend-item level-2"></div>
        <div class="calendar-legend-item level-3"></div>
        <div class="calendar-legend-item level-4"></div>
        <span class="calendar-legend-label">多</span>
      </div>
    `;

    // 绑定导航按钮
    document.getElementById('calendar-prev-month').addEventListener('click', () => {
      this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
      this.renderMonthView();
    });

    document.getElementById('calendar-next-month').addEventListener('click', () => {
      this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
      this.renderMonthView();
    });

    // 年份选择器
    document.getElementById('calendar-year-selector').addEventListener('click', () => {
      this.showYearPicker(year);
    });

    // 月份选择器
    document.getElementById('calendar-month-selector').addEventListener('click', () => {
      this.showMonthPicker(month);
    });

    // 绑定日期点击
    container.querySelectorAll('.calendar-cell[data-count]').forEach(cell => {
      const count = parseInt(cell.dataset.count);
      if (count > 0) {
        cell.style.cursor = 'pointer';
        cell.addEventListener('click', () => {
          const dateKey = cell.dataset.date;
          this.showDayDetails(dateKey, this.practiceData.allPractice);
          // 高亮选中
          container.querySelectorAll('.calendar-cell').forEach(c => c.classList.remove('selected'));
          cell.classList.add('selected');
        });
      }
    });
  }

  showYearPicker(currentYear) {
    const container = document.getElementById('heatmapCalendar');
    const today = new Date().getFullYear();
    const startYear = today - 5; // 往前5年
    const endYear = today;

    const years = [];
    for (let y = endYear; y >= startYear; y--) {
      years.push(y);
    }

    container.innerHTML = `
      <div class="calendar-header">
        <button class="calendar-nav-btn calendar-back-btn" id="calendar-back-to-month">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div class="calendar-title">
          <span class="calendar-month" style="font-size:13px;">选择年份</span>
        </div>
        <div style="width:32px;"></div>
      </div>
      <div class="year-picker-grid">
        ${years.map(y => `
          <button class="year-picker-item ${y === currentYear ? 'selected' : ''}" data-year="${y}">
            ${y}
          </button>
        `).join('')}
      </div>
    `;

    document.getElementById('calendar-back-to-month').addEventListener('click', () => {
      this.renderMonthView();
    });

    container.querySelectorAll('.year-picker-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const year = parseInt(btn.dataset.year);
        this.currentCalendarDate.setFullYear(year);
        this.renderMonthView();
      });
    });
  }

  showMonthPicker(currentMonth) {
    const container = document.getElementById('heatmapCalendar');
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

    container.innerHTML = `
      <div class="calendar-header">
        <button class="calendar-nav-btn calendar-back-btn" id="calendar-back-to-month">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div class="calendar-title">
          <span class="calendar-month" style="font-size:13px;">选择月份</span>
        </div>
        <div style="width:32px;"></div>
      </div>
      <div class="month-picker-grid">
        ${monthNames.map((name, idx) => `
          <button class="month-picker-item ${idx === currentMonth ? 'selected' : ''}" data-month="${idx}">
            ${name}
          </button>
        `).join('')}
      </div>
    `;

    document.getElementById('calendar-back-to-month').addEventListener('click', () => {
      this.renderMonthView();
    });

    container.querySelectorAll('.month-picker-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const month = parseInt(btn.dataset.month);
        this.currentCalendarDate.setMonth(month);
        this.renderMonthView();
      });
    });
  }

  showDayDetails(dateKey, allPractice) {
    const section = document.getElementById('selectedDaySection');
    const title = document.getElementById('selectedDayTitle');
    const list = document.getElementById('selectedDayList');

    const dayProblems = allPractice.filter(p => {
      const pDate = new Date(p.loggedAt);
      // 使用本地时区生成日期键
      const year = pDate.getFullYear();
      const month = String(pDate.getMonth() + 1).padStart(2, '0');
      const day = String(pDate.getDate()).padStart(2, '0');
      const pDateKey = `${year}-${month}-${day}`;
      return pDateKey === dateKey;
    });

    if (dayProblems.length === 0) {
      section.classList.add('hidden');
      return;
    }

    const date = new Date(dateKey);
    title.textContent = `${date.getMonth() + 1}月${date.getDate()}日刷题记录 (${(dayProblems || []).length}题)`;
    section.classList.remove('hidden');

    list.innerHTML = (dayProblems || [])
      .sort((a, b) => (b.loggedAt || 0) - (a.loggedAt || 0))
      .map(p => this.createPracticeCard(p, false))
      .join('');

    this.attachCardListeners();

    // 滚动到详情区域
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  createPracticeCard(problem, showDate = false) {
    const tags = problem.tags || [];
    const tagsHtml = tags.length > 0 ? `<div class="problem-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : '';

    // 如果 showDate=true，显示日期；否则只显示时间
    const dateTime = new Date(problem.loggedAt);
    const timeDisplay = showDate
      ? `${dateTime.getMonth() + 1}/${dateTime.getDate()} ${dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const durationHtml = problem.duration ? `<span>⏱ ${problem.duration}min</span>` : '';

    // 类型标记：新题 or 复习
    const typeHtml = problem.type === 'review'
      ? '<span class="type-badge type-review">🔄 复习</span>'
      : '<span class="type-badge type-practice">✨ 新题</span>';

    const solvedHtml = problem.solved !== undefined
      ? (problem.solved ? '<span class="ac-badge ac-yes">✓ AC</span>' : '<span class="ac-badge ac-no">✗ 未AC</span>')
      : '';
    const notesHtml = problem.notes ? `<div class="problem-notes">${this.escapeHtml(problem.notes)}</div>` : '';
    return `
      <div class="problem-card" data-slug="${problem.slug || ''}">
        <div class="problem-header">
          <div class="problem-title"><span class="problem-number">#${problem.number || '?'}</span>${problem.title || '未知题目'}</div>
          <span class="difficulty ${(problem.difficulty || '').toLowerCase()}">${problem.difficulty || 'Unknown'}</span>
        </div>
        ${tagsHtml}
        <div class="problem-meta"><span>🕐 ${timeDisplay}</span>${typeHtml}${solvedHtml}${durationHtml}</div>
        ${notesHtml}
        <div class="problem-actions"><button class="btn-small btn-link" data-action="open" data-url="${problem.url || ''}">打开题目</button></div>
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

  // ============ 已刷题目 Tab ============

  async loadPracticedTab() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllPractice' });
      const practiced = response.practiced || [];

      // 只渲染热力图日历
      this.renderHeatmapCalendar(practiced);
    } catch (error) { console.error('Error loading practiced:', error); }
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

    // Overdue calculation
    const now = Date.now();
    const overdueDays = nextReview ? Math.floor((now - nextReview) / 86400000) : 0;
    const overdueHtml = !isDone && overdueDays > 0
      ? `<span class="overdue-badge" title="逾期${overdueDays}天">逾期${overdueDays}天</span>`
      : '';

    // Last rating info for completed reviews
    const history = problem.reviewHistory || [];
    const lastR = history.length > 0 ? history[history.length - 1] : null;
    const rLabels = ['😵 忘了', '😤 困难', '👍 记得', '😊 简单'];
    const lastInfo = isDone && lastR ? `<span>${rLabels[lastR.rating] || '?'} → ${lastR.interval || 0}天后</span>` : '';

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
          ${overdueHtml}
          <div class="problem-title"><span class="problem-number">#${problem.number || '?'}</span>${problem.title || '未知题目'}</div>
          <span class="difficulty ${(problem.difficulty || '').toLowerCase()}">${problem.difficulty || 'Unknown'}</span>
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
          <button class="btn-small btn-link" data-action="open" data-url="${problem.url || ''}">打开</button>
          <button class="btn-small btn-delete" data-action="delete" data-slug="${slug}">移除</button>
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
      const fireLevel = (streak.currentStreak || 0) >= 30 ? 'streak-legendary' : (streak.currentStreak || 0) >= 7 ? 'streak-hot' : '';
      streakEl.innerHTML = `
        <div class="streak-card ${fireLevel}">
          <div class="streak-flame">${(streak.currentStreak || 0) > 0 ? '🔥' : '❄️'}</div>
          <div class="streak-info">
            <div class="streak-num">${streak.currentStreak || 0}<small>天连续</small></div>
            <div class="streak-meta">
              最长 ${streak.longestStreak || 0}天 · 成功率 ${streak.successRate || 0}% · ${streak.totalActiveDays || 0}天活跃
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
          const pHeight = Math.max(((d.practice || 0) / maxTotal) * 100, 0);
          const rHeight = Math.max(((d.review || 0) / maxTotal) * 100, 0);
          // 使用本地时区生成今天的日期
          const today = new Date();
          const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const isToday = d.date === todayKey;
          return `
            <div class="bar-col ${isToday ? 'bar-today' : ''}">
              <div class="bar-value">${d.total || ''}</div>
              <div class="bar-stack">
                ${(d.review || 0) > 0 ? `<div class="bar-seg bar-review" style="height:${rHeight}%" title="复习: ${d.review}"></div>` : ''}
                ${(d.practice || 0) > 0 ? `<div class="bar-seg bar-practice" style="height:${pHeight}%" title="刷题: ${d.practice}"></div>` : ''}
              </div>
              <div class="bar-label">${d.label || ''}</div>
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
          <div class="problem-card"><div class="problem-header"><div class="problem-title"><span class="problem-number">#${p.number || '?'}</span>${p.title || '未知题目'}</div><span class="source-badge ${sourceCls}">${sourceLabel}</span><span class="difficulty ${(p.difficulty || '').toLowerCase()}">${p.difficulty || 'Unknown'}</span></div>${tagsHtml}<div class="problem-actions"><button class="btn-small btn-link" data-action="open" data-url="${p.url || ''}">打开题目</button></div></div>`;
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
    await Promise.all([this.loadGoalsEditor(), this.loadViewGoalEditor(), this.loadFirstIntervalEditor(), this.loadAutoLogSetting()]);
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
        ${(weakTags?.length || 0) > 0 ? `
          <div class="goals-weak-hint">
            <span class="goals-weak-label">🎯 薄弱标签</span>
            ${(weakTags || []).slice(0, 4).map(t => `<span class="goals-weak-chip" title="EF:${t.avgEF || 0} 失败率:${t.failRate || 0}%">${t.tag || '?'}</span>`).join('')}
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

  // ============ 首次间隔设置 ============

  async loadViewGoalEditor() {
    try {
      const res = await chrome.runtime.sendMessage({ action: 'getDailyViewGoal' });
      const input = document.getElementById('dailyViewGoalInput');
      if (input) input.value = res.goal ?? 5;

      const saveBtn = document.getElementById('saveViewGoalBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const goal = parseInt(input.value) || 5;
          await chrome.runtime.sendMessage({ action: 'setDailyViewGoal', goal });
          saveBtn.textContent = '✓ 已保存';
          setTimeout(() => { saveBtn.textContent = '保存设置'; }, 2000);
        });
      }
    } catch (e) { console.error('loadViewGoalEditor error:', e); }
  }

  async loadFirstIntervalEditor() {
    const res = await chrome.runtime.sendMessage({ action: 'getFirstInterval' });
    const input = document.getElementById('firstIntervalInput');
    input.value = res.firstInterval ?? 1;
  }

  async saveFirstInterval() {
    const input = document.getElementById('firstIntervalInput');
    const day = parseInt(input.value);
    if (!day || day < 1 || day > 30) { input.focus(); return; }
    await chrome.runtime.sendMessage({ action: 'setFirstInterval', value: day });
    const btn = document.getElementById('saveFirstIntervalBtn');
    btn.textContent = '✅ 已保存';
    setTimeout(() => { btn.textContent = '保存'; }, 1500);
  }

  async loadAutoLogSetting() {
    const res = await chrome.runtime.sendMessage({ action: 'getAutoLogOnReview' });
    document.getElementById('autoLogOnReviewToggle').checked = res.enabled ?? false;
  }

  async saveAutoLogSetting(enabled) {
    await chrome.runtime.sendMessage({ action: 'setAutoLogOnReview', enabled });
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
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('从复习计划中移除此题？（刷题日历中的历史记录仍会保留）')) await this.deleteProblem(btn.dataset.slug);
      });
    });
  }

  async clearStaleReviews() {
    try {
      const countRes = await chrome.runtime.sendMessage({ action: 'countStaleReviews' });
      const n = countRes.count ?? 0;
      if (n === 0) {
        alert('没有「下次复习日早于 30 天前」的题目，无需清理。');
        return;
      }
      if (!confirm(`将移除 ${n} 道长期逾期题目（从复习计划中删除，刷题记录保留）。确定？`)) return;
      const res = await chrome.runtime.sendMessage({ action: 'clearStaleReviews' });
      if (res.success) {
        alert(`已清理 ${res.removed ?? n} 道题。`);
        await this.loadData();
      } else {
        alert('清理失败，请稍后重试。');
      }
    } catch (e) {
      console.error('clearStaleReviews', e);
      alert('清理失败: ' + (e.message || String(e)));
    }
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

  async exportData() {
    const [p, pr] = await Promise.all([
      chrome.runtime.sendMessage({ action: 'getProblems' }),
      chrome.runtime.sendMessage({ action: 'getTodayPractice' })
    ]);
    const blob = new Blob([JSON.stringify({ problems: p.problems, practiceLog: pr.practice, exportedAt: Date.now() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    a.download = `leetcode-data-${dateStr}.json`; a.click();
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
