-- Enable pgvector (one-time per database)
CREATE EXTENSION IF NOT EXISTS vector;

-- Simple documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  source TEXT,
  chunk_id INT,
  text TEXT,
  embedding vector(1536) -- dimension must match your embedder
);

-- Approximate index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_documents_embedding
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);