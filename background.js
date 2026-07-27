// 后台服务脚本 - 遗忘曲线调度和Google Calendar集成

class SpacedRepetitionManager {
  constructor() {
    this.init();
  }

  async getFirstInterval() {
    const result = await chrome.storage.local.get('firstInterval');
    return result.firstInterval ?? 1;
  }

  // ============ SM-2 自适应算法 ============

  dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(20, 0, 0, 0);
    return d.getTime();
  }

  calculateNextReview(problem, rating) {
    let ef = problem.easeFactor ?? 2.5;
    let prevInterval = problem.currentIntervalDays ?? 1;
    let interval, newEf;

    switch (rating) {
      case 0: // Forgot — 完全忘了，重置
        interval = 1;
        newEf = Math.max(1.3, ef - 0.2);
        break;
      case 1: // Hard — 费劲想起来
        interval = Math.max(1, Math.round(prevInterval * 1.2));
        newEf = Math.max(1.3, ef - 0.15);
        break;
      case 2: // Good — 正常回忆
        interval = prevInterval <= 1 ? 3 : Math.round(prevInterval * ef);
        newEf = ef;
        break;
      case 3: // Easy — 轻松做出
        interval = prevInterval <= 1 ? 7 : Math.round(prevInterval * ef * 1.3);
        newEf = Math.min(3.0, ef + 0.15);
        break;
      default:
        interval = Math.max(1, Math.round(prevInterval * ef));
        newEf = ef;
    }

    return {
      interval,
      easeFactor: Math.round(newEf * 100) / 100,
      nextReviewDate: this.dateOffset(interval)
    };
  }

  calculatePriorityScore(problem) {
    const now = Date.now();
    const nextReview = problem.nextReviewDate ||
      (problem.reviewDates && problem.reviewDates[problem.currentInterval || 0]);
    if (!nextReview) return 0;

    let score = 0;

    // 1. 超期天数 (10分/天)
    const overdueDays = Math.max(0, (now - nextReview) / 86400000);
    score += overdueDays * 10;

    // 2. 掌握度低 = 高优先 (EF越低分越高)
    const ef = problem.easeFactor ?? 2.5;
    score += (3.0 - ef) * 15;

    // 3. 难度权重
    const dw = { Hard: 15, Medium: 10, Easy: 5, Unknown: 8 };
    score += dw[problem.difficulty] || 8;

    // 4. 最近表现差
    const history = problem.reviewHistory || [];
    if (history.length > 0 && history[history.length - 1].rating <= 1) {
      score += 20;
    }

    return Math.round(score * 10) / 10;
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
        case 'getAllPractice': {
          const practiced = await this.getAllPractice();
          sendResponse({ practiced });
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
        case 'refreshTags': {
          const refreshResult = await this.refreshAllTags();
          sendResponse(refreshResult);
          break;
        }
        case 'getFirstInterval': {
          const firstInterval = await this.getFirstInterval();
          sendResponse({ firstInterval });
          break;
        }
        case 'setFirstInterval': {
          await chrome.storage.local.set({ firstInterval: request.value });
          sendResponse({ success: true });
          break;
        }
        case 'getAutoLogOnReview': {
          const result = await chrome.storage.local.get('autoLogOnReview');
          sendResponse({ enabled: result.autoLogOnReview ?? false });
          break;
        }
        case 'setAutoLogOnReview': {
          await chrome.storage.local.set({ autoLogOnReview: request.enabled });
          sendResponse({ success: true });
          break;
        }
        case 'getStats': {
          const stats = await this.getStats();
          sendResponse({ stats });
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
        case 'getReviewQueue': {
          const queue = await this.getReviewQueue();
          sendResponse({ queue });
          break;
        }
        case 'getViewQueue': {
          const viewQueue = await this.getViewQueue();
          sendResponse({ viewQueue });
          break;
        }
        case 'markProblemViewed': {
          const viewResult = await this.markProblemViewed(request.slug);
          sendResponse(viewResult);
          break;
        }
        case 'markReviewed': {
          const reviewResult = await this.markProblemReviewed(request.slug, request.rating);
          sendResponse(reviewResult);
          break;
        }
        case 'deleteProblem': {
          await this.deleteProblem(request.slug);
          sendResponse({ success: true });
          break;
        }
        case 'countStaleReviews': {
          const stale = await this.getStaleReviewProblems();
          sendResponse({ count: stale.length });
          break;
        }
        case 'clearStaleReviews': {
          const result = await this.clearStaleReviews();
          sendResponse(result);
          break;
        }
        case 'getDailyPlan': {
          const plan = await this.getDailyPlan();
          sendResponse({ plan });
          break;
        }
        case 'getWeakTags': {
          const weakTags = await this.getWeakTags();
          sendResponse({ weakTags });
          break;
        }
        case 'getStreakData': {
          const streakInfo = await this.getStreakData();
          sendResponse({ streak: streakInfo });
          break;
        }
        case 'getAchievements': {
          const achievements = await this.getAchievements();
          sendResponse({ achievements });
          break;
        }
        case 'getGoals': {
          const goals = await this.getGoals();
          sendResponse({ goals });
          break;
        }
        case 'setGoals': {
          await chrome.storage.local.set({ goals: request.goals });
          sendResponse({ success: true });
          break;
        }
        case 'getDailyViewGoal': {
          const result = await chrome.storage.local.get('dailyViewGoal');
          sendResponse({ goal: result.dailyViewGoal ?? 5 });
          break;
        }
        case 'setDailyViewGoal': {
          await chrome.storage.local.set({ dailyViewGoal: request.goal });
          sendResponse({ success: true });
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
      const storageResult = await chrome.storage.local.get(['practiceLog', 'problems']);
      const practiceLog = storageResult.practiceLog || [];
      const problemsMap = storageResult.problems || {};

      // 检查今天是否已记录同一题
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = today.getTime();

      const alreadyLogged = practiceLog.some(
        p => p.slug === problemInfo.slug && p.loggedAt >= todayTs && p.type !== 'review'
      );

      if (alreadyLogged) {
        return { success: false, error: '今天已经记录过这道题了' };
      }

      const hasPreviousPractice = practiceLog.some(
        p => p.slug === problemInfo.slug && p.type !== 'review'
      );
      const reviewProblem = problemsMap[problemInfo.slug];
      const wasAlreadyInReview = reviewProblem &&
        (reviewProblem.addedAt == null || reviewProblem.addedAt < todayTs);

      practiceLog.push({
        ...problemInfo,
        type: 'practice', // 标记为新题刷题
        isNewProblem: !hasPreviousPractice && !wasAlreadyInReview,
        solved: problemInfo.solved ?? true, // 默认为 true（兼容旧数据）
        duration: problemInfo.duration || null,
        notes: problemInfo.notes || null,
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

    return practiceLog.filter(p => p.loggedAt >= todayTs && p.type !== 'review');
  }

  async getAllPractice() {
    const storageResult = await chrome.storage.local.get(['practiceLog', 'problems']);
    const practiceEntries = (storageResult.practiceLog || []).filter(p => p.type !== 'review');
    const reviewEvents = Object.values(storageResult.problems || {}).flatMap(problem => {
      const completed = (problem.completedReviews || []).filter(Number.isFinite);
      const history = (problem.reviewHistory || []).filter(item => Number.isFinite(item.date));
      const extraHistoryCount = Math.max(0, history.length - completed.length);

      const extraHistoryEvents = history.slice(0, extraHistoryCount).map(item => ({
        ...problem,
        type: 'review',
        rating: item.rating ?? null,
        solved: item.rating == null ? undefined : item.rating >= 2,
        duration: null,
        notes: null,
        loggedAt: item.date
      }));

      const completedEvents = completed.map((loggedAt, index) => {
        const historyIndex = history.length - completed.length + index;
        const item = historyIndex >= 0 ? history[historyIndex] : null;
        return {
          ...problem,
          type: 'review',
          rating: item?.rating ?? null,
          solved: item?.rating == null ? undefined : item.rating >= 2,
          duration: null,
          notes: null,
          loggedAt
        };
      });

      return [...extraHistoryEvents, ...completedEvents];
    });

    return [...practiceEntries, ...reviewEvents]
      .sort((a, b) => (a.loggedAt || 0) - (b.loggedAt || 0));
  }

  async getTodayNewPracticeCount() {
    const storageResult = await chrome.storage.local.get(['practiceLog', 'problems']);
    const practiceLog = storageResult.practiceLog || [];
    const problemsMap = storageResult.problems || {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    const todayPractice = practiceLog.filter(
      p => p.loggedAt >= todayTs && p.type !== 'review'
    );

    return todayPractice.filter(entry => {
      if (typeof entry.isNewProblem === 'boolean') return entry.isNewProblem;

      const hasEarlierPractice = practiceLog.some(
        p => p.slug === entry.slug && p.type !== 'review' && p.loggedAt < entry.loggedAt
      );
      const reviewProblem = problemsMap[entry.slug];
      const wasAlreadyInReview = reviewProblem &&
        (reviewProblem.addedAt == null || reviewProblem.addedAt < todayTs);

      return !hasEarlierPractice && !wasAlreadyInReview;
    }).length;
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

  // ============ 统计数据 ============

  async getStats() {
    const storageResult = await chrome.storage.local.get(['problems', 'practiceLog']);
    const problemsMap = storageResult.problems || {};
    const practiceLog = storageResult.practiceLog || [];
    const allReviewProblems = Object.values(problemsMap);

    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    // ---- 今日统计 ----
    const todayPractice = practiceLog.filter(p => p.loggedAt >= todayTs);
    const todayReviewDone = allReviewProblems.filter(p =>
      p.completedReviews.some(ts => ts >= todayTs)
    );
    const todayAll = [...todayPractice, ...todayReviewDone];

    const todayDifficulty = { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 };
    todayAll.forEach(p => {
      const d = p.difficulty || 'Unknown';
      todayDifficulty[d] = (todayDifficulty[d] || 0) + 1;
    });

    // ---- 累计统计 ----
    // 合并所有题目（去重）
    const allSlugs = new Set();
    const allProblems = [];
    const addUnique = (p) => {
      if (!allSlugs.has(p.slug)) {
        allSlugs.add(p.slug);
        allProblems.push(p);
      }
    };
    allReviewProblems.forEach(addUnique);
    practiceLog.forEach(addUnique);

    const totalDifficulty = { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 };
    allProblems.forEach(p => {
      const d = p.difficulty || 'Unknown';
      totalDifficulty[d] = (totalDifficulty[d] || 0) + 1;
    });

    // ---- 每日刷题量（最近30天） ----
    const dailyCounts = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayStartTs = dayStart.getTime();
      const dayEndTs = dayEnd.getTime();

      const practiceCount = practiceLog.filter(p =>
        p.loggedAt >= dayStartTs && p.loggedAt < dayEndTs
      ).length;

      const reviewCount = allReviewProblems.filter(p =>
        p.completedReviews.some(ts => ts >= dayStartTs && ts < dayEndTs)
      ).length;

      dailyCounts.push({
        date: `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`,
        label: `${dayStart.getMonth() + 1}/${dayStart.getDate()}`,
        practice: practiceCount,
        review: reviewCount,
        total: practiceCount + reviewCount
      });
    }

    return {
      todayTotal: todayAll.length,
      todayDifficulty,
      totalProblems: allProblems.length,
      totalDifficulty,
      reviewProblems: allReviewProblems.length,
      practiceProblems: practiceLog.length,
      dailyCounts
    };
  }

  // ============ 智能教练系统 ============

  async getGoals() {
    const result = await chrome.storage.local.get('goals');
    return result.goals || { dailyNew: 3, dailyReview: 8, timeBudget: 45 };
  }

  async getDailyPlan() {
    const goals = await this.getGoals();
    const dueReviews = await this.getReviewQueue();
    const newDone = await this.getTodayNewPracticeCount();
    const todayCompleted = await this.getTodayCompleted();
    const weakTags = await this.getWeakTags();

    const dayOfWeek = new Date().getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const reviewsDone = todayCompleted.length;

    // 堆积保护：如果积压太多，动态提高今日目标，但不超过时间预算
    const baseTarget = isWeekend ? Math.ceil(goals.dailyReview * 1.5) : goals.dailyReview;
    const maxByTime = Math.floor((goals.timeBudget || 45) / 5); // 每道复习~5min

    // 计算逾期统计
    const now = Date.now();
    const overdueProblems = dueReviews.filter(p => {
      const nr = p.nextReviewDate;
      if (!nr) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return nr < today.getTime();
    });
    const overdueCount = overdueProblems.length;

    // 如果积压 > 基础目标的 2 倍，进入"清仓模式"，适度增加目标
    let reviewTarget = baseTarget;
    let backlogMode = false;
    if (overdueCount > baseTarget * 2) {
      backlogMode = true;
      // 在基础目标基础上最多翻倍，但不超过时间预算允许量
      reviewTarget = Math.min(baseTarget * 2, maxByTime);
    }

    const recommendedReviews = Math.min(dueReviews.length, reviewTarget);

    // ~5min per review, ~15min per new problem
    const reviewMins = Math.max(0, recommendedReviews - reviewsDone) * 5;
    const newMins = Math.max(0, goals.dailyNew - newDone) * 15;
    const estimatedMinutes = Math.max(0, reviewMins + newMins);

    // 积压需要多少天消化完（按每天 baseTarget 复习）
    const backlogDays = overdueCount > 0 ? Math.ceil(overdueCount / baseTarget) : 0;

    return {
      isWeekend,
      backlogMode,
      goals,
      dueCount: dueReviews.length,
      overdueCount,
      backlogDays,
      reviewsDone,
      newDone,
      reviewTarget,
      recommendedReviews,
      estimatedMinutes,
      weakTags: weakTags.slice(0, 5),
      topReviews: dueReviews.slice(0, 3)
    };
  }

  async getWeakTags() {
    const storageResult = await chrome.storage.local.get(['problems', 'practiceLog']);
    const problemsMap = storageResult.problems || {};
    const tagStats = {};

    for (const problem of Object.values(problemsMap)) {
      const tags = problem.tags || [];
      const ef = problem.easeFactor ?? 2.5;
      const history = problem.reviewHistory || [];
      const fails = history.filter(h => h.rating <= 1).length;

      tags.forEach(tag => {
        if (!tagStats[tag]) tagStats[tag] = { total: 0, efSum: 0, failCount: 0, reviewCount: 0 };
        tagStats[tag].total++;
        tagStats[tag].efSum += ef;
        tagStats[tag].failCount += fails;
        tagStats[tag].reviewCount += history.length;
      });
    }

    return Object.entries(tagStats)
      .map(([tag, s]) => {
        const avgEF = s.total > 0 ? s.efSum / s.total : 2.5;
        const failRate = s.reviewCount > 0 ? s.failCount / s.reviewCount : 0;
        // Low EF + high fail rate + few problems = weak
        const score = (3.0 - avgEF) * 20 + failRate * 30 + (s.total < 3 ? 15 : 0);
        return { tag, avgEF: Math.round(avgEF * 100) / 100, failRate: Math.round(failRate * 100), total: s.total, score: Math.round(score) };
      })
      .filter(t => t.score > 5)
      .sort((a, b) => b.score - a.score);
  }

  // ============ 成就 & 连续天数 ============

  async getStreakData() {
    const storageResult = await chrome.storage.local.get(['problems', 'practiceLog']);
    const problemsMap = storageResult.problems || {};
    const practiceLog = storageResult.practiceLog || [];

    // 使用辅助函数生成本地时区的日期键
    const toLocalDateKey = (timestamp) => {
      const d = new Date(timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Collect all active dates
    const activeDates = new Set();
    for (const p of Object.values(problemsMap)) {
      (p.completedReviews || []).forEach(ts => activeDates.add(toLocalDateKey(ts)));
    }
    practiceLog.forEach(p => activeDates.add(toLocalDateKey(p.loggedAt)));

    // Current streak
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let currentStreak = 0;
    let check = new Date(today);

    if (!activeDates.has(toLocalDateKey(check.getTime()))) {
      check.setDate(check.getDate() - 1);
      if (!activeDates.has(toLocalDateKey(check.getTime()))) {
        currentStreak = 0;
      } else {
        while (activeDates.has(toLocalDateKey(check.getTime()))) {
          currentStreak++;
          check.setDate(check.getDate() - 1);
        }
      }
    } else {
      while (activeDates.has(toLocalDateKey(check.getTime()))) {
        currentStreak++;
        check.setDate(check.getDate() - 1);
      }
    }

    // Longest streak
    const sorted = [...activeDates].sort();
    let longest = 0, temp = 1;
    for (let i = 1; i < sorted.length; i++) {
      if ((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000 === 1) {
        temp++;
      } else {
        longest = Math.max(longest, temp);
        temp = 1;
      }
    }
    longest = Math.max(longest, temp);
    if (sorted.length === 0) longest = 0;

    // Review success rate
    let totalReviews = 0, goodReviews = 0;
    for (const p of Object.values(problemsMap)) {
      const h = p.reviewHistory || [];
      totalReviews += h.length;
      goodReviews += h.filter(r => r.rating >= 2).length;
    }

    return {
      currentStreak,
      longestStreak: longest,
      totalActiveDays: activeDates.size,
      successRate: totalReviews > 0 ? Math.round(goodReviews / totalReviews * 100) : 0,
      totalReviews
    };
  }

  async getAchievements() {
    const storageResult = await chrome.storage.local.get(['problems', 'practiceLog']);
    const problemsMap = storageResult.problems || {};
    const practiceLog = storageResult.practiceLog || [];
    const streak = await this.getStreakData();

    const uniqueProblems = new Set([
      ...Object.keys(problemsMap),
      ...practiceLog.map(p => p.slug)
    ]).size;

    return [
      { id: 'first_review', name: '初次复习', desc: '完成第一次复习', icon: '🎯', unlocked: streak.totalReviews >= 1 },
      { id: 'ten_reviews', name: '复习达人', desc: '完成10次复习', icon: '📚', unlocked: streak.totalReviews >= 10 },
      { id: 'fifty_reviews', name: '复习大师', desc: '完成50次复习', icon: '🏆', unlocked: streak.totalReviews >= 50 },
      { id: 'hundred_reviews', name: '复习传奇', desc: '完成100次复习', icon: '👑', unlocked: streak.totalReviews >= 100 },
      { id: 'streak_3', name: '三日连续', desc: '连续刷题3天', icon: '🔥', unlocked: streak.longestStreak >= 3 },
      { id: 'streak_7', name: '周周不断', desc: '连续刷题7天', icon: '🔥', unlocked: streak.longestStreak >= 7 },
      { id: 'streak_30', name: '月度坚持', desc: '连续刷题30天', icon: '💎', unlocked: streak.longestStreak >= 30 },
      { id: 'prob_10', name: '初探题海', desc: '涉猎10道题', icon: '🌊', unlocked: uniqueProblems >= 10 },
      { id: 'prob_50', name: '半百征途', desc: '涉猎50道题', icon: '⚡', unlocked: uniqueProblems >= 50 },
      { id: 'prob_100', name: '百题斩', desc: '涉猎100道题', icon: '🗡️', unlocked: uniqueProblems >= 100 },
      { id: 'rate_80', name: '记忆高手', desc: '复习成功率≥80%', icon: '🧠', unlocked: streak.successRate >= 80 && streak.totalReviews >= 10 },
      { id: 'rate_95', name: '过目不忘', desc: '成功率≥95%', icon: '🌟', unlocked: streak.successRate >= 95 && streak.totalReviews >= 20 },
    ];
  }

  // ============ Tag自动补全 ============

  async fetchTagsFromLeetCode(slug) {
    try {
      const query = `query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          topicTags { name slug }
        }
      }`;

      const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { titleSlug: slug } })
      });

      if (!response.ok) return [];

      const data = await response.json();
      const tags = data?.data?.question?.topicTags || [];
      return tags.map(t => t.name);
    } catch (error) {
      console.warn('Failed to fetch tags for', slug, error);
      return [];
    }
  }

  async refreshAllTags() {
    try {
      const storageResult = await chrome.storage.local.get(['problems', 'practiceLog']);
      const problemsMap = storageResult.problems || {};
      const practiceLog = storageResult.practiceLog || [];
      let updated = 0;

      // 补全 review problems 的 tags
      for (const slug of Object.keys(problemsMap)) {
        const problem = problemsMap[slug];
        if (!problem.tags || problem.tags.length === 0) {
          const tags = await this.fetchTagsFromLeetCode(slug);
          if (tags.length > 0) {
            problem.tags = tags;
            updated++;
          }
          // 避免请求过快
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // 补全 practiceLog 的 tags
      for (let i = 0; i < practiceLog.length; i++) {
        const entry = practiceLog[i];
        if (!entry.tags || entry.tags.length === 0) {
          const tags = await this.fetchTagsFromLeetCode(entry.slug);
          if (tags.length > 0) {
            entry.tags = tags;
            updated++;
          }
          await new Promise(r => setTimeout(r, 300));
        }
      }

      await chrome.storage.local.set({ problems: problemsMap, practiceLog });
      console.log(`✅ Refreshed tags for ${updated} problems`);
      return { success: true, updated };
    } catch (error) {
      console.error('Error refreshing tags:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ 核心功能：题目管理 ============

  async addProblem(problemInfo) {
    try {
      const storageResult = await chrome.storage.local.get('problems');
      const problemsMap = storageResult.problems || {};

      if (problemsMap[problemInfo.slug]) {
        return { success: false, error: '这道题已经在复习计划中了' };
      }

      // 用用户设置的首次间隔
      const firstInterval = await this.getFirstInterval();
      const nextReviewDate = this.dateOffset(firstInterval);

      problemsMap[problemInfo.slug] = {
        ...problemInfo,
        duration: problemInfo.duration || null,
        notes: problemInfo.notes || null,
        addedAt: Date.now(),
        // SM-2 自适应字段
        easeFactor: 2.5,
        currentIntervalDays: firstInterval,
        nextReviewDate: nextReviewDate,
        reviewHistory: [],
        completedReviews: [],
        // Legacy compat
        reviewDates: [nextReviewDate],
        currentInterval: 0
      };

      await chrome.storage.local.set({ problems: problemsMap });
      console.log('✅ Problem added:', problemInfo.slug, `(first review in ${firstInterval}d)`);

      // 如果开启了"加入复习时同步记录刷题"，自动记录一次
      const autoLogResult = await chrome.storage.local.get('autoLogOnReview');
      if (autoLogResult.autoLogOnReview === true) {
        await this.logPractice(problemInfo);
        console.log('✅ Also logged practice due to autoLogOnReview setting');
      }

      return {
        success: true,
        nextReviewDate,
        intervalDays: firstInterval,
        reviewDates: [nextReviewDate],
        message: '成功添加到复习计划'
      };
    } catch (error) {
      console.error('Error adding problem:', error);
      return { success: false, error: error.message };
    }
  }

  // generateReviewDates removed — SM-2 handles scheduling dynamically

  async checkProblemStatus(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (problemsMap[slug]) {
      const problem = problemsMap[slug];
      const nextReview = problem.nextReviewDate ||
        (problem.reviewDates && problem.reviewDates[problem.currentInterval || 0]);

      return {
        exists: true,
        nextReview: nextReview,
        easeFactor: problem.easeFactor ?? 2.5,
        currentIntervalDays: problem.currentIntervalDays || 0,
        completedReviews: (problem.completedReviews || []).length,
        totalReviews: (problem.reviewHistory || []).length
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
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTs = tomorrow.getTime();

    // 包含今天到期 + 逾期未复习的题目
    return problems.filter(problem => {
      const nextReview = problem.nextReviewDate ||
        (problem.reviewDates && (problem.currentInterval || 0) < problem.reviewDates.length
          ? problem.reviewDates[problem.currentInterval || 0] : null);
      if (!nextReview) return false;
      return nextReview < tomorrowTs;
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

  async getReviewQueue() {
    const dueProblems = await this.getTodayReviews();
    return dueProblems
      .map(p => ({ ...p, priorityScore: this.calculatePriorityScore(p) }))
      .sort((a, b) => b.priorityScore - a.priorityScore);
  }

  async markProblemReviewed(slug, rating = 2) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    if (!problemsMap[slug]) return { success: false, error: '题目不存在' };

    const problem = problemsMap[slug];
    const { interval, easeFactor, nextReviewDate } = this.calculateNextReview(problem, rating);

    problem.easeFactor = easeFactor;
    problem.currentIntervalDays = interval;
    problem.nextReviewDate = nextReviewDate;
    problem.completedReviews.push(Date.now());

    if (!problem.reviewHistory) problem.reviewHistory = [];
    problem.reviewHistory.push({
      date: Date.now(),
      rating: rating,
      interval: interval,
      easeFactor: easeFactor
    });

    // Legacy compat
    if (!problem.reviewDates) problem.reviewDates = [];
    problem.reviewDates.push(nextReviewDate);
    problem.currentInterval = problem.reviewDates.length - 1;

    await chrome.storage.local.set({ problems: problemsMap });

    const ratingLabels = ['Forgot', 'Hard', 'Good', 'Easy'];
    console.log(`📝 Review: ${slug} | ${ratingLabels[rating]} | Next: ${interval}d | EF: ${easeFactor}`);

    try {
      chrome.notifications.create(`review-${slug}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: '复习完成！',
        message: `${problem.number}. ${problem.title} — ${interval}天后再次复习`
      }, () => { if (chrome.runtime.lastError) {} });
    } catch (e) {}

    return { success: true, nextReviewDate, intervalDays: interval, easeFactor };
  }

  async deleteProblem(slug) {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};

    delete problemsMap[slug];
    await chrome.storage.local.set({ problems: problemsMap });
  }

  getNextReviewTimestamp(problem) {
    if (problem.nextReviewDate) return problem.nextReviewDate;
    const rd = problem.reviewDates;
    const ci = problem.currentInterval || 0;
    if (rd && ci < rd.length) return rd[ci];
    return null;
  }

  /** 下次复习日早于「今天 0 点往前 30 天」的题目（长期逾期堆积） */
  async getStaleReviewProblems() {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffTs = cutoff.getTime();

    return Object.values(problemsMap).filter((p) => {
      const next = this.getNextReviewTimestamp(p);
      return next != null && next < cutoffTs;
    });
  }

  async clearStaleReviews() {
    const stale = await this.getStaleReviewProblems();
    if (stale.length === 0) {
      return { success: true, removed: 0 };
    }
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    const removeSlugs = new Set(stale.map((p) => p.slug));
    removeSlugs.forEach((slug) => {
      delete problemsMap[slug];
    });
    await chrome.storage.local.set({ problems: problemsMap });
    return { success: true, removed: stale.length };
  }

  // ============ 看题队列（不做题，只看思路） ============

  async getViewQueue() {
    const storageResult = await chrome.storage.local.get(['problems', 'dailyViewGoal', 'viewedToday']);
    const problemsMap = storageResult.problems || {};
    const dailyViewGoal = storageResult.dailyViewGoal ?? 5;
    const viewedToday = storageResult.viewedToday || [];

    // 筛选条件：做过但没AC的题目（复习评分 <= 1）
    const viewCandidates = Object.values(problemsMap).filter(p => {
      const history = p.reviewHistory || [];
      if (history.length === 0) return false;

      // 最近一次复习是 Forgot 或 Hard
      const lastReview = history[history.length - 1];
      return lastReview.rating <= 1;
    });

    // 排除今天已看过的
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    const todayViewed = viewedToday.filter(v => v.viewedAt >= todayTs);
    const viewedSlugs = new Set(todayViewed.map(v => v.slug));

    const queue = viewCandidates
      .filter(p => !viewedSlugs.has(p.slug))
      .sort((a, b) => {
        // 按优先级排序：最近复习失败的优先
        const aLast = (a.reviewHistory || [])[a.reviewHistory.length - 1];
        const bLast = (b.reviewHistory || [])[b.reviewHistory.length - 1];
        return (bLast?.date || 0) - (aLast?.date || 0);
      })
      .slice(0, dailyViewGoal);

    return {
      queue,
      viewedCount: todayViewed.length,
      totalGoal: dailyViewGoal
    };
  }

  async markProblemViewed(slug) {
    const storageResult = await chrome.storage.local.get(['problems', 'viewedToday']);
    const problemsMap = storageResult.problems || {};
    const viewedToday = storageResult.viewedToday || [];

    if (!problemsMap[slug]) {
      return { success: false, error: '题目不存在' };
    }

    const problem = problemsMap[slug];

    // 记录今日已看
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    // 清理非今日的记录
    const cleanedViewed = viewedToday.filter(v => v.viewedAt >= todayTs);

    // 检查是否已记录
    if (!cleanedViewed.some(v => v.slug === slug)) {
      cleanedViewed.push({
        slug,
        viewedAt: Date.now()
      });
    }

    await chrome.storage.local.set({ viewedToday: cleanedViewed });

    // 自动安排第二天复习（将 nextReviewDate 设置为明天）
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);
    problem.nextReviewDate = tomorrow.getTime();
    problem.currentIntervalDays = 1;

    await chrome.storage.local.set({ problems: problemsMap });

    console.log(`👀 Viewed: ${slug}, scheduled for tomorrow`);

    return {
      success: true,
      message: '已标记为看过，明天会再次复习'
    };
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

  // ============ 初始化 ============

  async onInstalled() {
    console.log('LeetCode Spaced Repetition installed!');

    const storageResult = await chrome.storage.local.get(['problems', 'practiceLog']);
    if (!storageResult.problems) await chrome.storage.local.set({ problems: {} });
    if (!storageResult.practiceLog) await chrome.storage.local.set({ practiceLog: [] });

    // 迁移旧题目到 SM-2
    await this.migrateToSM2();
    this.checkDailyReviews();
  }

  async migrateToSM2() {
    const storageResult = await chrome.storage.local.get('problems');
    const problemsMap = storageResult.problems || {};
    let migrated = 0;

    for (const slug of Object.keys(problemsMap)) {
      const p = problemsMap[slug];
      if (p.easeFactor === undefined) {
        p.easeFactor = 2.5;
        p.reviewHistory = [];

        if (p.reviewDates && p.reviewDates.length > 0) {
          const ci = p.currentInterval || 0;
          if (ci < p.reviewDates.length) {
            p.nextReviewDate = p.reviewDates[ci];
            const prevTs = ci > 0 ? p.reviewDates[ci - 1] : (p.addedAt || Date.now());
            p.currentIntervalDays = Math.max(1, Math.round(Math.abs(p.reviewDates[ci] - prevTs) / 86400000));
          } else {
            // 旧复习全部完成，安排30天后
            p.currentIntervalDays = 30;
            p.nextReviewDate = this.dateOffset(30);
          }
        } else {
          p.currentIntervalDays = 1;
          p.nextReviewDate = this.dateOffset(1);
        }
        migrated++;
      }
    }

    if (migrated > 0) {
      await chrome.storage.local.set({ problems: problemsMap });
      console.log(`✅ Migrated ${migrated} problems to SM-2`);
    }
  }
}

// 初始化管理器
new SpacedRepetitionManager();
