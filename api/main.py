import os
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Jay Wisdom Zora Search API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")

static_dir = Path("/app/static")

if static_dir.exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", response_class=HTMLResponse)
    async def serve_frontend():
        index_path = static_dir / "index.html"
        return HTMLResponse(index_path.read_text(encoding="utf-8"))

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
def search(
    q: str = Query("", description="Search term"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    if not DATABASE_URL:
        return {
            "results": [],
            "query": q,
            "count": 0,
            "total": 0,
            "limit": limit,
            "offset": offset,
            "next_offset": None,
            "prev_offset": None,
            "error": "DATABASE_URL missing",
        }

    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(CREATE_TABLE_SQL)

        params = []
        where_sql = ""

        if q.strip():
            where_sql = """
            WHERE
              to_tsvector('english',
                COALESCE(title,'') || ' ' ||
                COALESCE(description,'') || ' ' ||
                array_to_string(COALESCE(query_aliases, ARRAY[]::text[]), ' ') || ' ' ||
                array_to_string(COALESCE(themes, ARRAY[]::text[]), ' ')
              ) @@ plainto_tsquery('english', %s)
              OR title ILIKE %s
              OR description ILIKE %s
            """
            params = [q, f"%{q}%", f"%{q}%"]

        cur.execute(f"SELECT COUNT(*) AS total FROM artworks {where_sql};", params)
        total = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT *
            FROM artworks
            {where_sql}
            ORDER BY created_at DESC NULLS LAST, id DESC
            LIMIT %s OFFSET %s;
            """,
            params + [limit, offset],
        )

        rows = cur.fetchall()
        conn.commit()

        return {
            "results": rows,
            "query": q,
            "count": len(rows),
            "total": total,
            "limit": limit,
            "offset": offset,
            "next_offset": offset + limit if offset + limit < total else None,
            "prev_offset": max(offset - limit, 0) if offset > 0 else None,
        }
    finally:
        if conn:
            conn.close()
