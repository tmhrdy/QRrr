import { Pool } from 'pg';
export declare const pool: Pool;
export declare function connectDatabase(): Promise<void>;
export declare function closeDatabase(): Promise<void>;
export declare function query(text: string, params?: any[]): Promise<any>;
export declare function withTransaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
//# sourceMappingURL=connection.d.ts.map