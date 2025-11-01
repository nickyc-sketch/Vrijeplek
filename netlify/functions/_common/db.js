const { MongoClient } = require("mongodb");
let client, db;
async function getDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri || !dbName) throw new Error("Missing MONGODB_URI or MONGODB_DB");
  if (!client) {
    client = new MongoClient(uri, { maxPoolSize: 5 });
    await client.connect();
  }
  db = client.db(dbName);
  return db;
}
module.exports = { getDb };
