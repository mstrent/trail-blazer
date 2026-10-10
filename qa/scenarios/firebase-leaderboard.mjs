// Checks the Firebase SDK loaded from index.html and the leaderboard query.
// Read-only: never writes to the live leaderboard collection.
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

export default async function scenario(game) {
  const result = await game.page.evaluate(async () => {
    const tag = document.querySelector('script[src*="firebasejs/"]');
    const expected = tag && tag.src.match(/firebasejs\/([^/]+)\//)[1];
    if (typeof firebase === 'undefined' || !window.db) {
      return { expected, error: 'firebase / window.db not initialized' };
    }
    const snap = await window.db.collection('leaderboard')
      .orderBy('score', 'desc')
      .limit(10)
      .get();
    return {
      expected,
      sdkVersion: firebase.SDK_VERSION,
      hasAdd: typeof window.db.collection('leaderboard').add === 'function',
      rows: snap.docs.map(d => d.data()),
    };
  });

  assert(!result.error, result.error);
  assert(result.sdkVersion === result.expected,
    `SDK_VERSION ${result.sdkVersion} != script tag version ${result.expected}`);
  assert(result.hasAdd, 'collection().add is not a function');
  assert(result.rows.length <= 10, `expected <= 10 rows, got ${result.rows.length}`);
  for (let i = 0; i < result.rows.length; i++) {
    const r = result.rows[i];
    assert(typeof r.name === 'string' && typeof r.score === 'number',
      `row ${i} has unexpected shape: ${JSON.stringify(r)}`);
    if (i > 0) assert(result.rows[i - 1].score >= r.score, `rows not sorted desc at ${i}`);
  }

  console.log(`Firebase ${result.sdkVersion}: leaderboard returned ${result.rows.length} rows.`);
  console.log('firebase-leaderboard PASSED');
}
