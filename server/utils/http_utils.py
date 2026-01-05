import json
from typing import Any, Dict, Optional, Tuple

def read_json(handler) -> Dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8", errors="replace")
    try:
        return json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        raise ValueError("JSON inválido")

def send_json(handler, status: int, payload: Dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    try:
        handler.wfile.write(body)
    except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
        # El cliente (navegador) cerró la conexión antes de leer la respuesta.
        return

def ok(data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"ok": True, "data": data or {}}

def err(code: str, message: str, fields: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    e: Dict[str, Any] = {"code": code, "message": message}
    if fields:
        e["fields"] = fields
    return {"ok": False, "error": e}
