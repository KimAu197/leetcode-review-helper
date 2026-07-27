const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const backgroundSource = fs.readFileSync(
  path.join(__dirname, '..', 'background.js'),
  'utf8'
);

function loadBackground(initialStorage = {}) {
  const storage = structuredClone(initialStorage);
  let messageListener;

  const chrome = {
    action: {
      setBadgeBackgroundColor() {},
      setBadgeText() {}
    },
    alarms: {
      create() {},
      onAlarm: { addListener() {} }
    },
    notifications: {
      create(_id, _options, callback) {
        if (callback) callback();
      }
    },
    runtime: {
      getURL(value) { return value; },
      lastError: null,
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      }
    },
    storage: {
      local: {
        async get(keys) {
          if (typeof keys === 'string') {
            return Object.hasOwn(storage, keys) ? { [keys]: storage[keys] } : {};
          }
          if (Array.isArray(keys)) {
            return Object.fromEntries(
              keys.filter(key => Object.hasOwn(storage, key)).map(key => [key, storage[key]])
            );
          }
          return { ...storage };
        },
        async set(values) {
          Object.assign(storage, values);
        }
      }
    }
  };

  vm.runInNewContext(backgroundSource, {
    chrome,
    console: { error() {}, log() {}, warn() {} },
    Date,
    fetch,
    setTimeout,
    clearTimeout
  });

  const send = (action, payload = {}) => new Promise((resolve, reject) => {
    if (!messageListener) {
      reject(new Error('background message listener was not registered'));
      return;
    }

    const timeout = setTimeout(() => reject(new Error(`message timed out: ${action}`)), 1000);
    messageListener({ action, ...payload }, {}, response => {
      clearTimeout(timeout);
      resolve(response);
    });
  });

  return { send, storage };
}

test('calendar reads derive reviews without adding them to today practice', async () => {
  const reviewedAt = Date.now();
  const { send, storage } = loadBackground({
    practiceLog: [
      { slug: 'new', type: 'practice', loggedAt: reviewedAt - 2 },
      { slug: 'legacy', loggedAt: reviewedAt - 1 },
      { slug: 'reviewed', type: 'review', loggedAt: reviewedAt }
    ],
    problems: {
      reviewed: {
        slug: 'reviewed',
        title: 'Reviewed',
        completedReviews: [reviewedAt],
        reviewHistory: [{ date: reviewedAt, rating: 1 }]
      }
    }
  });

  const todayResponse = await send('getTodayPractice');
  const allResponse = await send('getAllPractice');

  assert.deepEqual(Array.from(todayResponse.practice, problem => problem.slug), ['new', 'legacy']);
  assert.deepEqual(Array.from(allResponse.practiced, problem => problem.slug), ['new', 'legacy', 'reviewed']);
  assert.equal(allResponse.practiced.at(-1).type, 'review');
  assert.equal(allResponse.practiced.at(-1).rating, 1);
  assert.equal(storage.practiceLog.length, 3, 'read filtering must not delete stored data');
});

test('explicit practice logging succeeds when only a review entry exists today', async () => {
  const yesterday = Date.now() - 86400000;
  const { send, storage } = loadBackground({
    practiceLog: [
      { slug: 'reviewed', type: 'review', loggedAt: Date.now() }
    ],
    problems: {
      reviewed: {
        slug: 'reviewed',
        addedAt: yesterday,
        completedReviews: [],
        reviewHistory: [],
        reviewDates: []
      }
    }
  });

  const response = await send('logPractice', {
    problem: { slug: 'reviewed', title: 'Reviewed then practiced', solved: true }
  });
  const todayResponse = await send('getTodayPractice');
  const planResponse = await send('getDailyPlan');

  assert.equal(response.success, true);
  assert.equal(storage.practiceLog.length, 2);
  assert.equal(storage.practiceLog.at(-1).type, 'practice');
  assert.equal(storage.practiceLog.at(-1).isNewProblem, false);
  assert.equal(todayResponse.practice.length, 1, 'explicit practice still counts toward today');
  assert.equal(planResponse.plan.newDone, 0, 'old review practice must not advance new-problem progress');
});

test('marking a review hard does not append to practiceLog', async () => {
  const { send, storage } = loadBackground({
    practiceLog: [{ slug: 'new', type: 'practice', loggedAt: Date.now() }],
    problems: {
      reviewed: {
        slug: 'reviewed',
        number: 1,
        title: 'Reviewed',
        completedReviews: [],
        reviewHistory: [],
        reviewDates: [],
        currentIntervalDays: 1,
        easeFactor: 2.5
      }
    }
  });

  const response = await send('markReviewed', { slug: 'reviewed', rating: 1 });
  const allResponse = await send('getAllPractice');

  assert.equal(response.success, true);
  assert.equal(storage.practiceLog.length, 1);
  assert.equal(storage.practiceLog[0].slug, 'new');
  assert.equal(storage.problems.reviewed.completedReviews.length, 1);
  assert.equal(storage.problems.reviewed.reviewHistory.at(-1).rating, 1);
  assert.equal(allResponse.practiced.filter(entry => entry.type === 'review').length, 1);
  assert.equal(allResponse.practiced.find(entry => entry.type === 'review').slug, 'reviewed');
});

test('legacy practice entries infer new status without counting an old review as new', async () => {
  const now = Date.now();
  const { send } = loadBackground({
    practiceLog: [
      { slug: 'legacy-new', type: 'practice', loggedAt: now - 1000 },
      { slug: 'old-review', type: 'practice', loggedAt: now }
    ],
    problems: {
      'old-review': {
        slug: 'old-review',
        addedAt: now - 86400000,
        completedReviews: [],
        reviewHistory: [],
        reviewDates: []
      }
    }
  });

  const todayResponse = await send('getTodayPractice');
  const planResponse = await send('getDailyPlan');

  assert.equal(todayResponse.practice.length, 2);
  assert.equal(planResponse.plan.newDone, 1);
});

test('adding a review problem still auto-logs it as practice when enabled', async () => {
  const { send, storage } = loadBackground({
    practiceLog: [],
    problems: {},
    firstInterval: 1,
    autoLogOnReview: true
  });

  const response = await send('addProblem', {
    problem: { slug: 'new', title: 'New' }
  });

  assert.equal(response.success, true);
  assert.equal(storage.practiceLog.length, 1);
  assert.equal(storage.practiceLog[0].type, 'practice');
  assert.equal(storage.practiceLog[0].isNewProblem, true);
});
