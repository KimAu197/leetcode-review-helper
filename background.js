// 后台服务脚本 - 遗忘曲线调度和Google Calendar集成

class SpacedRepetitionManager {
  constructor() {
    // 遗忘曲线间隔 (天数): 1天, 3天, 7天, 14天, 30天, 60天
    this.reviewIntervals = [1, 3, 7, 14, 30, 60];
    this.init();
  }

  init() {
    // 监听消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放以支持异步响应
    });

    // 设置每日检查alarm
    chrome.alarms.create('dailyReviewCheck', {
      periodInMinutes: 60 // 每小时检查一次
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'dailyReviewCheck') {
        this.checkDailyReviews();
      }
    });

    // 扩展安装时的初始化
    chrome.runtime.onInstalled.addListener(() => {
      this.onInstalled();
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'addProblem': {
          const addResult = await this.addProblem(request.problem);
          sendResponse(addResult);
          break;
        }
        case 'logPractice': {
          const logResult = await this.logPractice(request.problem);
          sendResponse(logResult);
          break;
        }
        case 'getTodayPractice': {
          const practice = await this.getTodayPractice();
          sendResponse({ practice });
          break;
        }
        case 'getTagStats': {
          const tagStats = await this.getTagStats();
          sendResponse({ tagStats });
          break;
        }
        case 'getAllTags': {
          const tags = await this.getAllTags();
          sendResponse({ tags });
          break;
        }
        case 'getProblemsByTag': {
          const tagProblems = await this.getProblemsByTag(request.tag);
          sendResponse({ problems: tagProblems });
          break;
        }
        case 'checkProblem': {
          const status = await this.checkProblemStatus(request.slug);
          sendResponse(status);
          break;
        }
        case 'getProblems': {
          const problems = await this.getAllProblems();
          sendResponse({ problems });
          break;
        }
        case 'getTodayReviews': {
          const reviews = await this.getTodayReviews();
          sendResponse({ reviews });
          break;
        }
        case 'getTodayCompleted': {
          const completed = await this.getTodayCompleted();
          sendResponse({ completed });
          break;
        }
        case 'markReviewed': {
          await this.markProblemReviewed(request.slug);
          sendResponse({ success: true });
          break;
        }
        case 'deleteProblem': {
          await this.deleteProblem(request.slug);
          sendResponse({ success: true });
          break;
        }
        case 'syncToCalendar': {
          const syncResult = await this.syncProblemToCalendar(request.slug);
          sendResponse(syncResult);
          break;
        }
        case 'connectCalendar': {
          const authResult = await this.authenticateGoogle();
          sendResponse(authResult);
          break;
        }
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // ============ 刷题记录（不加入复习计划） ============

  async logPractice(problemInfo) {
    try {
      const storageResult = await chrome.storage.local.get('practiceLog');
      const practiceLog = storageResult.practiceLog || [];

      // 检查今天是否已记录同一题
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = today.getTime();

      const alreadyLogged = practiceLog.some(
        p => p.slug === problemInfo.slug && p.loggedAt >= todayTs
      );

      if (alreadyLogged) {
        return { success: false, error: '今天已经记录过这道题了' };
      }

      practiceLog.push({
        ...problemInfo,
        loggedAt: Date.now()
      });

      await chrome.storage.local.set({ practiceLog });
      console.log('📝 Practice logged:', problemInfo.slug);

      return { success: true };
    } catch (error) {
      console.error('Error logging practice:', error);
      return { success: false, error: error.message };
    }
  }

  async getTodayPractice() {
    const storageResult = await chrome.storage.local.get('practiceLog');
    const practiceLog = storageResult.practiceLog || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    return practiceLog.filter(p => p.loggedAt >= todayTs);
  }

  async getTagStats() {
    // 统计今日刷题 + 复习完成的 tag 分布
    const todayPractice = await this.getTodayPractice();
    const todayCompleted = await this.getTodayCompleted();

    const allToday = [...todayPractice, ...todayCompleted];
    const tagCounts = {};

    allToday.forEach(problem => {
      const tags = problem.tags || [];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // 转换为排序数组
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  async getAllTags() {
    // 从所有题目（复习 + 刷题记录）中收集所有 tag
    const problems = await this.getAllProblems();
    const storageResult = await chrome.storage.local.get('practiceLog');
    const practiceLog = storageResult.practiceLog || [];

    const tagMap = {}; // tag -> { count, problems[] }

    const addToTagMap = (problem) => {
      const tags = problem.tags || [];
      tags.forEach(tag => {
        if (!tagMap[tag]) {
          tagMap[tag] = { count: 0, problems: [] };
        }
        // 避免重复
        if (!tagMap[tag].problems.some(p => p.slug === problem.slug)) {
          tagMap[tag].count++;
          tagMap[tag].problems.push(problem);
        }
      });
    };

    problems.forEach(addToTagMap);
    practiceLog.forEach(addToTagMap);

    return Object.entries(tagMap)
      .map(([tag, data]) => ({ tag, count: data.count }))
      .sort((a, b) => b.count - a.count);
  }

  async getProblemsByTag(tag) {
    const problems = await this.getAllProblems();
    const storageResult = await chrome.storage.local.get('practiceLog');
    const practiceLog = storageResult.practiceLog || [];

    const seen = new Set();
    const result = [];

    const addIfTagged = (problem, source) => {
      if (seen.has(problem.slug)) return;
      const tags = problem.tags || [];
      if (tags.includes(tag)) {
        seen.add(problem.slug);
        result.push({ ...problem, source });
      }
    };

    problems.forEach(p => addIfTagged(p, 'review'));
    practiceLog.forEach(p => addIfTagged(p, 'practice'));

    return result;
  }

  // ============ 核心功能：题目管理 ============

  async addProblem(problemInfo) {
    try {
      const storageResult = await chrome.storage.local.get('problems');
      const problemsMap = storageResult.problems || {};

      // 检查是否已存在
      if (problemsMap[problemInfo.slug]) {
        return {
          success: false,
          error: '这道题已经在复习计划中了'
        };
      }

      // 生成复习日期
      const reviewDates = this.generateReviewDates();

      // 保存题目信息
      problemsMap[problemInfo.slug] = {
        ...problemInfo,
        addedAt: Date.now(),
        reviewDates: reviewDates,
        completedReviews: [],
        currentInterval: 0,
        calendarEventIds: []
      };

      await chrome.storage.local.set({ problems: problemsMap });

      console.log('✅ Problem added successfully:', problemInfo.slug);

      return {
        success: true,
        reviewDates: reviewDates,
        message: '成功添加到复习计划'
      };
    } catch (error) {
      console.error('Error adding problem:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateReviewDates() {
    const now = new Date();
    const dates = [];

    for (const interval of this.reviewIntervals) {
      const reviewDate = new Date(now);
      reviewDate.setDate(reviewDate.getDate() + interval);
      reviewDate.setHours(20, 0, 0, 0); // 默认晚上8点提醒
      dates.push(reviewDate.getTime());
    }

    return dates;
  }

  async checkProblemStatus(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      const nextReview = problem.reviewDates[problem.currentInterval];

      return {
        exists: true,
        nextReview: nextReview,
        completedReviews: problem.completedReviews.length,
        totalReviews: problem.reviewDates.length
      };
    }

    return { exists: false };
  }

  async getAllProblems() {
    const storageResult = await chrome.storage.local.get('problems');
    return Object.values(storageResult.problems || {});
  }

  async getTodayReviews() {
    const problems = await this.getAllProblems();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTimestamp = today.getTime();
    const tomorrowTimestamp = tomorrow.getTime();

    return problems.filter(problem => {
      if (problem.currentInterval >= problem.reviewDates.length) {
        return false; // 已完成所有复习
      }

      const nextReviewDate = problem.reviewDates[problem.currentInterval];
      return nextReviewDate >= todayTimestamp && nextReviewDate < tomorrowTimestamp;
    });
  }

  async getTodayCompleted() {
    const problems = await this.getAllProblems();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return problems.filter(problem => {
      return problem.completedReviews.some(ts => ts >= todayTimestamp);
    });
  }

  async markProblemReviewed(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      problem.completedReviews.push(Date.now());
      problem.currentInterval++;

      await chrome.storage.local.set({ problems: problemsMap });

      // 创建桌面通知（安全调用）
      try {
        const remaining = problem.reviewDates.length - problem.currentInterval;
        if (remaining > 0) {
          const nextDate = new Date(problem.reviewDates[problem.currentInterval]);
          chrome.notifications.create(`review-${slug}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '复习完成！',
            message: `${problem.number}. ${problem.title} - 下次复习: ${nextDate.toLocaleDateString()}`
          }, () => { if (chrome.runtime.lastError) { /* ignore icon errors */ } });
        } else {
          chrome.notifications.create(`review-${slug}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '完成全部复习！',
            message: `${problem.number}. ${problem.title} - 已完成所有复习计划`
          }, () => { if (chrome.runtime.lastError) { /* ignore icon errors */ } });
        }
      } catch (notifError) {
        console.warn('Notification failed:', notifError);
      }
    }
  }

  async deleteProblem(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    delete problemsMap[slug];
    await chrome.storage.local.set({ problems: problemsMap });
  }

  // ============ 每日提醒 ============

  async checkDailyReviews() {
    try {
      const reviews = await this.getTodayReviews();

      if (reviews.length > 0) {
        try {
          chrome.notifications.create('daily-review', {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: '今日复习提醒',
            message: `你有 ${reviews.length} 道题需要复习！`
          }, () => { if (chrome.runtime.lastError) { /* ignore icon errors */ } });
        } catch (e) {
          console.warn('Notification failed:', e);
        }

        // 更新badge
        chrome.action.setBadgeText({ text: reviews.length.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    } catch (error) {
      console.error('checkDailyReviews error:', error);
    }
  }

  // ============ Google Calendar集成（可选） ============

  isCalendarConfigured() {
    // 检查是否配置了有效的Google OAuth client_id
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2 && manifest.oauth2.client_id;
    return clientId && !clientId.includes('YOUR_GOOGLE_CLIENT_ID');
  }

  async authenticateGoogle() {
    if (!this.isCalendarConfigured()) {
      return {
        success: false,
        error: '请先在manifest.json中配置Google OAuth client_id，参考SETUP_GUIDE.md'
      };
    }

    try {
      const token = await chrome.identity.getAuthToken({ interactive: true });
      await chrome.storage.local.set({ googleToken: token.token || token });
      return { success: true, token: token.token || token };
    } catch (error) {
      console.error('Google authentication failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getGoogleToken() {
    if (!this.isCalendarConfigured()) {
      return null;
    }

    try {
      const storageResult = await chrome.storage.local.get('googleToken');
      if (storageResult.googleToken) {
        return storageResult.googleToken;
      }

      // 尝试获取新token（非交互式，不弹窗）
      try {
        const tokenResult = await chrome.identity.getAuthToken({ interactive: false });
        const token = tokenResult.token || tokenResult;
        if (token) {
          await chrome.storage.local.set({ googleToken: token });
          return token;
        }
      } catch (e) {
        // 非交互式获取失败，需要用户手动连接
      }

      return null;
    } catch (error) {
      console.error('Failed to get Google token:', error);
      return null;
    }
  }

  async syncProblemToCalendar(slug) {
    if (!this.isCalendarConfigured()) {
      return { success: false, error: '请先配置Google Calendar API' };
    }

    const token = await this.getGoogleToken();
    if (!token) {
      return { success: false, error: '请先在设置中连接Google Calendar' };
    }

    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    const problem = problemsMap[slug];

    if (!problem) {
      return { success: false, error: '题目不存在' };
    }

    const eventIds = [];

    // 为每个复习日期创建日历事件
    for (let i = problem.currentInterval; i < problem.reviewDates.length; i++) {
      const reviewDate = new Date(problem.reviewDates[i]);
      const endDate = new Date(reviewDate.getTime() + 60 * 60 * 1000); // 1小时后

      const event = {
        summary: `复习: ${problem.number}. ${problem.title}`,
        description: `LeetCode题目复习\n\n难度: ${problem.difficulty}\n链接: ${problem.url}\n\n这是第 ${i + 1}/${problem.reviewDates.length} 次复习`,
        start: {
          dateTime: reviewDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 }
          ]
        },
        colorId: '9'
      };

      try {
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        });

        if (response.ok) {
          const eventData = await response.json();
          eventIds.push(eventData.id);
        } else {
          const errorData = await response.json();
          console.error('Calendar event creation failed:', errorData);
        }
      } catch (error) {
        console.error('Failed to create calendar event:', error);
      }
    }

    // 保存事件ID
    problem.calendarEventIds = eventIds;
    await chrome.storage.local.set({ problems: problemsMap });

    return { success: true, eventIds };
  }

  async deleteCalendarEvent(eventId) {
    const token = await this.getGoogleToken();
    if (!token) return;

    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.warn('Failed to delete calendar event:', error);
    }
  }

  // ============ 初始化 ============

  async onInstalled() {
    console.log('LeetCode Spaced Repetition installed!');

    // 初始化存储
    const storageResult = await chrome.storage.local.get(['problems', 'practiceLog']);
    if (!storageResult.problems) {
      await chrome.storage.local.set({ problems: {} });
    }
    if (!storageResult.practiceLog) {
      await chrome.storage.local.set({ practiceLog: [] });
    }

    // 立即检查今日复习
    this.checkDailyReviews();
  }
}

// 初始化管理器
new SpacedRepetitionManager();
