import os
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(title="Jay Wisdom Zora Search API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
DATABASE_URL = os.getenv("DATABASE_URL")
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS artworks (
  id SERIAL PRIMARY KEY,
  title TEXT,
  description TEXT,
  image_uri TEXT,
  zora_url TEXT,
  contract TEXT,
  token_id TEXT,
  chain TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  themes TEXT[] DEFAULT ARRAY[]::TEXT[],
  query_aliases TEXT[] DEFAULT ARRAY[]::TEXT[],
  UNIQUE(contract, token_id)
);
"""
@app.get("/health")
def health():
    return {"ok": True, "service": "jay-zora-search-api"}
@app.get("/search")
def search(q: str = Query("", description="Search term")):
    if not DATABASE_URL:
        return {"results": [], "query": q, "count": 0, "error": "DATABASE_URL missing"}
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(CREATE_TABLE_SQL)
    if q.strip():
        cur.execute("""
            SELECT *
            FROM artworks
            WHERE
              to_tsvector('english',
                COALESCE(title,'') || ' ' ||
                COALESCE(description,'') || ' ' ||
                array_to_string(COALESCE(query_aliases, ARRAY[]::text[]), ' ') || ' ' ||
                array_to_string(COALESCE(themes, ARRAY[]::text[]), ' ')
              ) @@ plainto_tsquery('english', %s)
              OR title ILIKE %s
              OR description ILIKE %s
            ORDER BY created_at DESC NULLS LAST
            LIMIT 50;
        """, (q, f"%{q}%", f"%{q}%"))
    else:
        cur.execute("SELECT * FROM artworks ORDER BY created_at DESC NULLS LAST LIMIT 50;")
    rows = cur.fetchall()
    conn.commit()
    cur.close()
    conn.close()
    return {"results": rows, "query": q, "count": len(rows)}
