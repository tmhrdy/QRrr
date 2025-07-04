"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.connectDatabase = connectDatabase;
exports.closeDatabase = closeDatabase;
exports.query = query;
exports.withTransaction = withTransaction;
const pg_1 = require("pg");
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'kolaysiparis',
    user: process.env.DB_USER || 'kolayuser',
    password: process.env.DB_PASSWORD || 'Poyraz.1',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};
exports.pool = new pg_1.Pool(dbConfig);
async function connectDatabase() {
    try {
        const client = await exports.pool.connect();
        console.log('✅ PostgreSQL veritabanına bağlandı');
        client.release();
    }
    catch (error) {
        console.error('❌ Veritabanı bağlantı hatası:', error);
        throw error;
    }
}
async function closeDatabase() {
    try {
        await exports.pool.end();
        console.log('✅ Veritabanı bağlantısı kapatıldı');
    }
    catch (error) {
        console.error('❌ Veritabanı kapatma hatası:', error);
        throw error;
    }
}
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await exports.pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    }
    catch (error) {
        console.error('Query error:', error);
        throw error;
    }
}
async function withTransaction(callback) {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=connection.js.map