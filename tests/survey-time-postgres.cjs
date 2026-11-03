const { PGlite } = require(process.argv[2] || "@electric-sql/pglite");
const assert = require("node:assert/strict");
async function main() {
  const { taipeiQuestionTime, isQuestionActive } =
    await import("../src/utils/surveyTime.ts");
  const db = new PGlite();
  try {
    for (const input of [
      "2026-11-03T10:00",
      "2026-11-03T10:00:12.123",
      "2026-11-03T10:00:00Z",
      "2026-11-03T10:00:00+08:00",
      "2026-11-03T10:00:00-07:00",
      "2026-03-08T02:30",
    ]) {
      const server = (
        await db.query(
          "SELECT $1::timestamp AT TIME ZONE 'Asia/Taipei' AS at",
          [input],
        )
      ).rows[0].at;
      assert.equal(taipeiQuestionTime(input), server.getTime(), input);
    }
    for (const now of [
      "2026-11-03T01:59:59.999Z",
      "2026-11-03T02:00:00Z",
      "2026-11-03T02:30:00Z",
      "2026-11-03T02:30:00.001Z",
    ]) {
      const q = { startTime: "2026-11-03T10:00", endTime: "2026-11-03T10:30" };
      const server = (
        await db.query(
          "SELECT NOT ($3::timestamptz < ($1::timestamp AT TIME ZONE 'Asia/Taipei') OR $3::timestamptz > ($2::timestamp AT TIME ZONE 'Asia/Taipei')) AS active",
          [q.startTime, q.endTime, now],
        )
      ).rows[0].active;
      assert.equal(isQuestionActive(q, Date.parse(now)), server, now);
    }
    console.log(
      "PASS: browser parsing and opening boundaries match PostgreSQL timestamp AT TIME ZONE Asia/Taipei, including legacy offsets and DST dates.",
    );
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
