const mongoose = require("mongoose");
const { rankSearchResults, buildSearchRankingStages } = require("./searchRanking");

const describeMongo = process.env.RUN_MONGO_SEARCH_TESTS === "1" ? describe : describe.skip;

describeMongo("read-only Mongo search ranking parity", () => {
  let client;
  beforeAll(async () => {
    require("dotenv").config({ path: require("node:path").join(__dirname, "../.env"), quiet: true });
    client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017/LIS-DB", { serverSelectionTimeoutMS: 5000 });
    await client.connect();
  });
  afterAll(async () => { await client?.close(); });

  const rows = [
    { code: "NONE", name: "RI" },
    { code: "XXRI", name: "Name" },
    { code: "ARI", name: "Name" },
    { code: "RIVER", name: "Name" },
    { code: "RI", name: "Name" },
    { code: "😀RI", name: "Name" },
    { code: "ÅRI", name: "Name" },
    { code: "å", name: "Name" },
    { code: null, aliases: ["RI001", "ZZ"], name: "Name" },
    { code: "ยาสามัญ", name: "ยา" },
    { code: "ยา", name: "Sample" },
    { code: "$r.i[ ]", name: "Name" },
    { code: 123, name: null, items: [{ batchNo: "RI" }] },
    { name: "RI other", aliases: [] },
  ].map((row, index) => ({ _id: index, order: index, ...row }));
  const fields = (row) => ({ primary: [row.code, ...(row.aliases ?? [])], secondary: [row.name, ...(row.items ?? []).map((item) => item.batchNo)] });

  test.each(["R", "Ri", "RI", " ri ", "ยา", "å", "$r.i[ ]", "[", "12", "missing", " "])("query %p has identical scores ordering in JS and Mongo", async (query) => {
    const expected = rankSearchResults(rows, query, fields);
    const stages = buildSearchRankingStages(query, { primary: ["code", "aliases"], secondary: ["name", "items.batchNo"] }, { order: 1 });
    const actual = await client.db().aggregate([{ $documents: { $literal: rows } }, ...stages]).toArray();
    expect(actual.map((row) => row._id)).toEqual(expected.map((row) => row._id));
    expect(actual.every((row) => !("__searchScore" in row))).toBe(true);
    const page = await client.db().aggregate([{ $documents: { $literal: rows } }, ...stages, { $skip: 1 }, { $limit: 2 }]).toArray();
    expect(page.map((row) => row._id)).toEqual(expected.slice(1, 3).map((row) => row._id));
  });
});
