import re
from datetime import date, datetime

ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def is_iso_date(value: str) -> bool:
    return bool(ISO_DATE_RE.match(value or ""))

def parse_iso_date(value: str) -> date:
    if not is_iso_date(value):
        raise ValueError("Fecha inválida. Formato esperado: YYYY-MM-DD")
    return datetime.strptime(value, "%Y-%m-%d").date()
