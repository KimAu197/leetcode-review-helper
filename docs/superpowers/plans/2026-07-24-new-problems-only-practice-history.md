# New-Problems-Only Practice History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure review ratings never count as new practice or appear in the Practiced calendar, while preserving auto-log when a new problem is added to the review plan.

**Architecture:** Keep `practiceLog` as the storage source for genuine practice attempts. Stop review completion from writing synthetic `type: 'review'` entries, and filter already-stored review entries at both public practice read methods so current-day and historical practice UI consumers receive only genuine practice data.

**Tech Stack:** Chrome Manifest V3 service worker, vanilla JavaScript, Chrome Storage API, Node.js built-in test runner and `vm`.

## Global Constraints

- Preserve the “加入复习时同步记录刷题” setting and `addProblem()` auto-log behavior.
- Treat entries with `type: 'practice'` or no `type` as practice for backward compatibility.
- Exclude entries with `type: 'review'` from both Today and Practiced data sources.
- Do not delete or migrate existing user data.

---

### Task 1: Separate practice history from review completion

**Files:**
- Create: `tests/background.test.js`
- Modify: `background.js:319-334`
- Modify: `background.js:900-941`

**Interfaces:**
- Consumes: `chrome.storage.local.get()` and `chrome.storage.local.set()`.
- Produces: `getTodayPractice(): Promise<Array<object>>` and `getAllPractice(): Promise<Array<object>>`, both excluding `type === 'review'`; `markProblemReviewed(slug, rating)` updates only `problems`.

- [ ] **Step 1: Write failing service-worker tests**

Create a Chrome API stub, execute `background.js` in a Node `vm`, capture the registered runtime message listener, and add these assertions:

```js
test('today and all-practice reads exclude review entries but keep legacy practice', async () => {
  const { send, storage } = loadBackground({
    practiceLog: [
      { slug: 'new', type: 'practice', loggedAt: Date.now() },
      { slug: 'legacy', loggedAt: Date.now() },
      { slug: 'reviewed', type: 'review', loggedAt: Date.now() }
    ]
  });

  assert.deepEqual((await send('getTodayPractice')).practice.map(p => p.slug), ['new', 'legacy']);
  assert.deepEqual((await send('getAllPractice')).practiced.map(p => p.slug), ['new', 'legacy']);
  assert.equal(storage.practiceLog.length, 3);
});

test('marking a review hard does not append to practiceLog', async () => {
  const originalPractice = { slug: 'new', type: 'practice', loggedAt: Date.now() };
  const { send, storage } = loadBackground({
    practiceLog: [originalPractice],
    problems: {
      reviewed: {
        slug: 'reviewed', number: 1, title: 'Reviewed',
        completedReviews: [], reviewHistory: [], reviewDates: [],
        currentIntervalDays: 1, easeFactor: 2.5
      }
    }
  });

  const response = await send('markReviewed', { slug: 'reviewed', rating: 1 });

  assert.equal(response.success, true);
  assert.deepEqual(storage.practiceLog, [originalPractice]);
  assert.equal(storage.problems.reviewed.completedReviews.length, 1);
  assert.equal(storage.problems.reviewed.reviewHistory.at(-1).rating, 1);
});

test('adding a review problem still auto-logs it as practice when enabled', async () => {
  const { send, storage } = loadBackground({
    practiceLog: [], problems: {}, firstInterval: 1, autoLogOnReview: true
  });

  const response = await send('addProblem', { problem: { slug: 'new', title: 'New' } });

  assert.equal(response.success, true);
  assert.equal(storage.practiceLog.length, 1);
  assert.equal(storage.practiceLog[0].type, 'practice');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/background.test.js`

Expected: the first test includes `reviewed`, and the second test finds an appended `type: 'review'` entry. The auto-log preservation test passes.

- [ ] **Step 3: Implement minimal filtering and remove synthetic review logging**

Update both practice read methods:

```js
return practiceLog.filter(p => p.loggedAt >= todayTs && p.type !== 'review');
```

```js
return (storageResult.practiceLog || []).filter(p => p.type !== 'review');
```

Delete the `markProblemReviewed()` block beginning with `// 同时记录到 practiceLog（标记为复习）` and ending after `console.log('📝 Review logged to practice:', slug);`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/background.test.js`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Run static and diff verification**

Run: `node --check background.js && node --check popup.js && node --check content.js`

Expected: all commands exit 0 with no syntax errors.

Run: `git diff --check`

Expected: exit 0 with no whitespace errors.

- [ ] **Step 6: Commit only scoped files**

```bash
git add background.js tests/background.test.js docs/superpowers/specs/2026-07-23-new-problems-only-today-design.md docs/superpowers/plans/2026-07-24-new-problems-only-practice-history.md
git commit -m "fix: exclude reviews from practice history"
```
