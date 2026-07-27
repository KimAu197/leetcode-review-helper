# Calendar Review Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore completed reviews to the practice calendar and monthly total without adding them to Today Practice or new-problem progress.

**Architecture:** Keep `practiceLog` exclusively for explicit practice. Build read-only `type: 'review'` calendar events from each problem's `completedReviews` and `reviewHistory`, then merge those events with genuine practice in `getAllPractice()`. Ignore legacy `practiceLog` review rows so historical data is not double-counted.

**Tech Stack:** Chrome Manifest V3 service worker, vanilla JavaScript, Chrome Storage API, Node.js built-in test runner and `vm`.

## Global Constraints

- “今日刷题” only counts explicit practice records.
- “新题进度” only counts first-time practice.
- Calendar “复习” shows completed review events.
- Calendar “本月总计” equals explicit practice events plus completed review events.
- Review events must not be written back to `practiceLog`.
- Existing user data must not be deleted or migrated.

---

### Task 1: Derive review events for the practice calendar

**Files:**
- Modify: `tests/background.test.js`
- Modify: `background.js:340-343`

**Interfaces:**
- Consumes: `practiceLog`, `problems[*].completedReviews`, and `problems[*].reviewHistory` from Chrome local storage.
- Produces: `getAllPractice(): Promise<Array<object>>`, returning explicit `type: 'practice'` entries plus derived `type: 'review'` entries.

- [ ] **Step 1: Write the failing calendar-data tests**

Update the practice-read test so `getTodayPractice` still excludes review rows while `getAllPractice` returns exactly one derived review event, even when a legacy `practiceLog` review row also exists:

```js
const reviewedAt = Date.now();
const { send, storage } = loadBackground({
  practiceLog: [
    { slug: 'new', type: 'practice', loggedAt: reviewedAt },
    { slug: 'legacy', loggedAt: reviewedAt },
    { slug: 'reviewed', type: 'review', loggedAt: reviewedAt }
  ],
  problems: {
    reviewed: {
      slug: 'reviewed', title: 'Reviewed',
      completedReviews: [reviewedAt],
      reviewHistory: [{ date: reviewedAt, rating: 1 }]
    }
  }
});

assert.deepEqual(Array.from((await send('getTodayPractice')).practice, p => p.slug), ['new', 'legacy']);
const allPractice = (await send('getAllPractice')).practiced;
assert.deepEqual(Array.from(allPractice, p => p.slug), ['new', 'legacy', 'reviewed']);
assert.equal(allPractice.at(-1).type, 'review');
assert.equal(allPractice.at(-1).rating, 1);
assert.equal(storage.practiceLog.length, 3);
```

Extend the review-completion test to call `getAllPractice` after `markReviewed` and assert that the new review is visible without changing `practiceLog`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/background.test.js`

Expected: the calendar-data assertion fails because `getAllPractice()` currently returns only `new` and `legacy`.

- [ ] **Step 3: Implement derived calendar review events**

Change `getAllPractice()` to read both storage keys, discard legacy review rows from `practiceLog`, derive review events from each problem, and return a chronological merged list:

```js
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
```

- [ ] **Step 4: Run focused and static verification**

Run: `node --test tests/background.test.js`

Expected: all tests pass, including review visibility, no duplicate legacy review row, unchanged Today Practice, and unchanged new-problem progress.

Run: `node --check background.js && node --check content.js && node --check popup.js`

Expected: exit 0 with no syntax errors.

Run: `git diff --check`

Expected: exit 0 with no whitespace errors.

- [ ] **Step 5: Commit and update the existing PR**

```bash
git add background.js tests/background.test.js docs/superpowers/plans/2026-07-27-calendar-review-events.md
git commit -m "fix: restore reviews to practice calendar"
git push
```
