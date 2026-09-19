function scoreFields(query, values = []) {
  let best = 0;
  for (const value of values) {
    const text = String(value ?? "").trim().toLowerCase();
    const position = text.indexOf(query);
    const score = position < 0 ? 0 : text === query ? 3 : position === 0 ? 2 : 1 / (Array.from(text.slice(0, position)).length + 1);
    best = Math.max(best, score);
  }
  return best;
}

function getSearchScore(query, fields) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;
  const primaryScore = scoreFields(normalized, fields.primary);
  return primaryScore ? 3 + primaryScore : scoreFields(normalized, fields.secondary);
}

function rankSearchResults(items, query, getFields) {
  if (!query.trim()) return [...items];
  return items
    .map((item) => ({ item, score: getSearchScore(query, getFields(item)) }))
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
}

function fieldScoreExpression(query, fields = []) {
  if (!fields.length) return 0;
  const regex = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    $max: {
      $map: {
        input: {
          $concatArrays: fields.map((field) => ({
            $cond: [{ $isArray: `$${field}` }, `$${field}`, [`$${field}`]],
          })),
        },
        as: "value",
        in: {
          $let: {
            vars: { text: { $trim: { input: { $convert: { input: "$$value", to: "string", onError: "", onNull: "" } } } } },
            in: {
              $let: {
                vars: { match: { $regexFind: { input: "$$text", regex: { $literal: regex }, options: "i" } } },
                in: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$$text", "$$match.match"] }, then: 3 },
                      { case: { $eq: ["$$match.idx", 0] }, then: 2 },
                      { case: { $gt: ["$$match.idx", 0] }, then: { $divide: [1, { $add: ["$$match.idx", 1] }] } },
                    ],
                    default: 0,
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function buildSearchRankingStages(query, fields, defaultSort) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [{ $sort: defaultSort }];
  return [
    {
      $set: {
        __searchScore: {
          $let: {
            vars: {
              primary: fieldScoreExpression(normalized, fields.primary),
              secondary: fieldScoreExpression(normalized, fields.secondary),
            },
            in: { $cond: [{ $gt: ["$$primary", 0] }, { $add: [3, "$$primary"] }, "$$secondary"] },
          },
        },
      },
    },
    { $sort: { __searchScore: -1, ...defaultSort, _id: defaultSort._id ?? 1 } },
    { $unset: "__searchScore" },
  ];
}

module.exports = { getSearchScore, rankSearchResults, buildSearchRankingStages };
