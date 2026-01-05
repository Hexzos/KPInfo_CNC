import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

class Database:
    def __init__(self, db_path: Path):
        self.db_path = db_path

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    def init_schema(self, schema_sql: str) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript(schema_sql)
            conn.commit()

    def query_all(self, sql: str, params: Sequence[Any] = ()) -> List[Dict[str, Any]]:
        with self.connect() as conn:
            cur = conn.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]

    def query_one(self, sql: str, params: Sequence[Any] = ()) -> Optional[Dict[str, Any]]:
        with self.connect() as conn:
            cur = conn.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None

    def execute(self, sql: str, params: Sequence[Any] = ()) -> int:
        with self.connect() as conn:
            cur = conn.execute(sql, params)
            conn.commit()
            return int(cur.lastrowid)

    def execute_many(self, sql: str, rows: Sequence[Sequence[Any]]) -> None:
        with self.connect() as conn:
            conn.executemany(sql, rows)
            conn.commit()
