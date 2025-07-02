import pkg from 'pg';
import config from '../config/config.js';
const { Pool } = pkg;

let pool;
export function getPool() {
  if (!config.database.url) return null;
  if (!pool) {
    pool = new Pool({ connectionString: config.database.url, max: 5 });
  }
  return pool;
}

export async function getSubscriptionTypeById(id) {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query('SELECT * FROM subscription_types WHERE id = $1', [id]);
  return rows[0] || null;
} 