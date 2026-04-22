# app/ship_lookup.py
"""
Ship lookup (PowerBI DAX -> Python mapping)

Goal:
- Provide a "SHIP" name based on SERIAL, just like the calculated column in PowerBI.
- Keep this in one place so it’s easy to maintain.
"""

from __future__ import annotations

# SERIAL -> SHIP (exactly as your DAX)
SHIP_BY_SERIAL: dict[str, str] = {
    "4GC00575": "KYDON (1st_repeater)",
    "4GC00588": "MARE_DI_LEVANTE",
    "4GC05650": "BSNAXOS",
    "4GC00571": "ELYROS",
    "4GC00580": "BSCHIOS",
    "4GC00584": "BS2",
    "4GC00594": "KRITI2",
    "4GC00555": "NISSOS_RODOS",
    "4GC05010": "DIAGORAS",
    "4GC05450": "BSGALAXY",
    "4GC05390": "DIONISIOS_SOLOMOS",
    "4GC00573": "SKIATHOS",
    "4GC05020": "THEOLOGOS",
    "4GC05370": "KNOSSOS PALACE 1",
    "4GC05350": "AIKATERINH",
    "4GC05130": "BSPATMOS",
    "4GC05220": "BSDELOS",
    "4GC05330": "ANDROS",
    "4GC00586": "KEFALONIA",
    "4GC05280": "KNOSSOS_PALACE2",
    "4GC05190": "SUPERSTAR(ex.SUPERFERRY2 )",
    "4GC05170": "BSPAROS",
    "4GC00596": "SUPERFASTXI",
    "4GC00569": "SUPERFAST_I",
    "4GC00557": "ANDREAS_KALVOS",
    "4GC05430": "ANEK_CHAMPION",
    "4GC00582": "ANEK_SPIRIT",
    "4GC00578": "BLUE_HORIZON",
    "4GC00567": "KYDON (2nd_repeater)",
    "4GC05310": "PREVELIS",
    "4GC00592": "SUPERFAST II",
    "4GC05260": "SUPERFERRY",
    "4GC00576": "ARIADNE",
    "4GV00705": "BSPAROS(Vodafone)",
    "4GC00549": "HELLENIC_SPEED",
}

def get_ship_name(serial: str | None) -> str:
    """
    Return ship name for a given SERIAL.
    If not found, return "ERROR" (to match your DAX default).
    """
    if not serial:
        return "ERROR"
    serial = str(serial).strip()
    return SHIP_BY_SERIAL.get(serial, "ERROR")