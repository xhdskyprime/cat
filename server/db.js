const { Pool } = require('pg');
require('dotenv').config();

// Load from DATABASE_URL or fallback to parts
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/cat_db';

const pool = new Pool({
  connectionString,
  max: 20, // Concurrency limit
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper for converting SQLite parameters (?) to PostgreSQL parameters ($1, $2, ...)
function convertParameters(query) {
  let index = 1;
  return query.replace(/\?/g, () => `$${index++}`);
}

// SQLite3 Compatibility Layer
const db = {
  pool,
  
  // db.get(sql, params, cb) -> Fetch one row
  get: (sql, params, cb) => {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    const postgresSql = convertParameters(sql);
    pool.query(postgresSql, params)
      .then(res => cb(null, res.rows[0]))
      .catch(err => cb(err));
  },

  // db.all(sql, params, cb) -> Fetch all rows
  all: (sql, params, cb) => {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    const postgresSql = convertParameters(sql);
    pool.query(postgresSql, params)
      .then(res => cb(null, res.rows))
      .catch(err => cb(err));
  },

  // db.run(sql, params, cb) -> Execute command (no rows)
  run: (sql, params, cb) => {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    const postgresSql = convertParameters(sql).replace('INSERT OR IGNORE', 'INSERT').replace('INSERT OR REPLACE', 'INSERT').replace('OR IGNORE', '');
    
    // Note: SQL differences for INSERT OR IGNORE etc. need handling in code refactor.
    // For now, this is a basic shim.
    pool.query(postgresSql, params)
      .then(res => {
        // Mock the 'this' context of sqlite3 (this.lastID, this.changes)
        if (cb) cb.call({ lastID: null, changes: res.rowCount }, null);
      })
      .catch(err => {
        if (cb) cb(err);
      });
  },

  // db.serialize(cb) -> SQLite specific, in PG it's just a regular callback
  serialize: (cb) => {
    cb();
  },

  // db.prepare(sql) -> Return a mock statement
  prepare: (sql) => {
    const postgresSql = convertParameters(sql);
    return {
      run: (...args) => {
        const cb = args.length > 0 && typeof args[args.length - 1] === 'function' ? args.pop() : null;
        const params = args;
        pool.query(postgresSql, params)
          .then(res => { if (cb) cb(null, res); })
          .catch(err => { if (cb) cb(err); });
      },
      finalize: () => {} // Mock
    };
  },

  // db.close(cb)
  close: (cb) => {
    pool.end().then(() => cb(null)).catch(err => cb(err));
  }
};

// Initial Schema Sync (Mocking createTables from original db.js)
// Realistically, you should run database_schema.sql once manually or use a migration tool.
console.log('PostgreSQL Pool connected and Shim initialized.');

module.exports = db;
