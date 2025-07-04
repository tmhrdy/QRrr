import { Pool, PoolConfig } from 'pg';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'kolaysiparis',
  user: process.env.DB_USER || 'kolayuser',
  password: process.env.DB_PASSWORD || 'Poyraz.1',
  max: 20, // Maksimum bağlantı sayısı
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Veritabanı bağlantı havuzu
export const pool = new Pool(dbConfig);

// Veritabanı bağlantısını test et
export async function connectDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL veritabanına bağlandı');
    client.release();
  } catch (error) {
    console.error('❌ Veritabanı bağlantı hatası:', error);
    throw error;
  }
}

// Veritabanı bağlantısını kapat
export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log('✅ Veritabanı bağlantısı kapatıldı');
  } catch (error) {
    console.error('❌ Veritabanı kapatma hatası:', error);
    throw error;
  }
}

// Veritabanı sorgusu çalıştır
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

// Transaction wrapper
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} 