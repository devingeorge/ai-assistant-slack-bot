import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client as PgClient } from 'pg';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pg = new PgClient({ connectionString: process.env.PG_CONN });

function chunkText(text, chunkSize = 1200, overlap = 150) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk);
  }
  return chunks;
}

async function embed(texts) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts
  });
  return res.data.map((d) => d.embedding);
}

(async () => {
  try {
    await pg.connect();
    const folder = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'docs');
    const files = fs.readdirSync(folder).filter((f) => f.endsWith('.txt') || f.endsWith('.md'));

    for (const file of files) {
      const full = path.join(folder, file);
      const content = fs.readFileSync(full, 'utf8');
      const chunks = chunkText(content);

      for (let i = 0; i < chunks.length; i += 50) {
        const batch = chunks.slice(i, i + 50);
        const embs = await embed(batch);
        for (let j = 0; j < batch.length; j++) {
          await pg.query(
            'INSERT INTO documents(source, chunk_id, text, embedding) VALUES ($1,$2,$3,$4)',
            [file, i + j, batch[j], embs[j]]
          );
        }
        console.log(`Indexed ${Math.min(i + 50, chunks.length)} / ${chunks.length} from ${file}`);
      }
    }
    console.log('RAG ingest complete.');
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pg.end();
  }
})();