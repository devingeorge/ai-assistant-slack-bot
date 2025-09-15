import { Client as PgClient } from 'pg';
import OpenAI from 'openai';
import { config } from '../config.js';

let pg = null;
let openai = null;

export function ragEnabled() {
  return !!(config.rag.enabled && config.rag.pgConn);
}

export async function initRagIfNeeded() {
  if (!ragEnabled()) return;
  if (!pg) {
    pg = new PgClient({ connectionString: config.rag.pgConn });
    await pg.connect();
  }
  if (!openai && config.rag.openaiKey) {
    openai = new OpenAI({ apiKey: config.rag.openaiKey });
  }
}

async function embed(texts) {
  if (!openai) return [];
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts
  });
  return res.data.map((d) => d.embedding);
}

export async function retrieveContext(query, topK = config.rag.topK) {
  if (!ragEnabled() || !pg || !openai) return '';
  const [qvec] = await embed([query]);
  if (!qvec) return '';
  const sql = `
    SELECT text
    FROM documents
    ORDER BY embedding <=> $1
    LIMIT $2;
  `;
  const res = await pg.query(sql, [qvec, topK]);
  return res.rows?.map((r) => r.text).join('\n\n') || '';
}