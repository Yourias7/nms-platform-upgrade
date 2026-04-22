import logging
import threading
from sqlalchemy.sql import func, text, case
import time
from datetime import datetime, timedelta
from .database import SessionLocal
from .models import HistoricMeasurement, LiveMeasurement, RealTimeProbeMeasurement, ProbesHistoricMeasurement
import csv
import io
from app.ship_lookup import get_ship_name

logger = logging.getLogger(__name__)

_historic_serials_cache = None
_historic_serials_cache_ts = 0.0
_historic_serials_lock = threading.Lock()
_HISTORIC_SERIALS_CACHE_TTL_SEC = 300


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def list_live_serials():
    """Return list of all distinct SERIAL values from database."""
    db = SessionLocal()
    try:
        rows = db.query(LiveMeasurement.SERIAL).distinct().all()
        serials = [r[0] for r in rows if r[0] is not None]
        logger.info(f"Retrieved {len(serials)} distinct serials from database")
        return serials
    finally:
        db.close()

def list_live_probes():
    """Return list of all distinct SERIAL values from database."""
    db = SessionLocal()
    try:
        rows = db.query(RealTimeProbeMeasurement.SERIAL).distinct().all()
        serials = [r[0] for r in rows if r[0] is not None]
        logger.info(f"Retrieved {len(serials)} distinct serials from database")
        return serials
    finally:
        db.close()
        
def list_live_serial_name_pairs():
    db = SessionLocal()
    try:
        rows = (
            db.query(LiveMeasurement.SERIAL, LiveMeasurement.NAME)
            .distinct()
            .all()
        )
        # only systems with serial, since name can be non-unique and not useful without serial
        pairs = [{"SERIAL": s, "NAME": n} for (s, n) in rows if s is not None]
        return pairs
    finally:
        db.close()

def list_live_probes_serial_name_pairs():
    db = SessionLocal()
    try:
        rows = (
            db.query(RealTimeProbeMeasurement.SERIAL, RealTimeProbeMeasurement.NAME)
            .distinct()
            .all()
        )
        # only systems with serial, since name can be non-unique and not useful without serial
        pairs = [{"SERIAL": s, "NAME": n} for (s, n) in rows if s is not None]
        return pairs
    finally:
        db.close()

def list_historic_alarm_serials():
    """Return list of all distinct SERIAL values from database."""
    global _historic_serials_cache, _historic_serials_cache_ts

    now = time.monotonic()
    with _historic_serials_lock:
        if _historic_serials_cache is not None and (now - _historic_serials_cache_ts) < _HISTORIC_SERIALS_CACHE_TTL_SEC:
            logger.info("Returning cached historic serials")
            return list(_historic_serials_cache)

    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=15)
        rows = (
            db.query(HistoricMeasurement.SERIAL)
            .filter(
                HistoricMeasurement.DATETIME >= func.dateadd(
                    text("DAY"), -15, func.sysutcdatetime()
                )
            )
            .filter((HistoricMeasurement.RSRP <= -120) | (HistoricMeasurement.SINR <= 0) | (HistoricMeasurement.LONGITUDE == 0) | (HistoricMeasurement.LATITUDE == 0) | (HistoricMeasurement.TEMP >= 75))
            .filter(HistoricMeasurement.SERIAL != None)
            .distinct()
            .all()
        )
        serials = [r[0] for r in rows if r[0] is not None]
        logger.info(f"Retrieved {len(serials)} distinct serials from database (last 15 days)")
        with _historic_serials_lock:
            _historic_serials_cache = list(serials)
            _historic_serials_cache_ts = time.monotonic()
        return serials
    finally:
        db.close()

def list_historic_alarm_probes():
    """Return list of all distinct SERIAL values from database."""
    global _historic_serials_cache, _historic_serials_cache_ts

    now = time.monotonic()
    with _historic_serials_lock:
        if _historic_serials_cache is not None and (now - _historic_serials_cache_ts) < _HISTORIC_SERIALS_CACHE_TTL_SEC:
            logger.info("Returning cached historic serials")
            return list(_historic_serials_cache)

    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=15)
        rows = (
            db.query(ProbesHistoricMeasurement.SERIAL)
            .filter(
                ProbesHistoricMeasurement.DATETIME >= func.dateadd(
                    text("DAY"), -15, func.sysutcdatetime()
                )
            )
            .filter((ProbesHistoricMeasurement.RSRP <= -120) | (ProbesHistoricMeasurement.SINR <= 0) | (ProbesHistoricMeasurement.LONGITUDE == 0) | (ProbesHistoricMeasurement.LATITUDE == 0) | (ProbesHistoricMeasurement.TEMP >= 75))
            .filter(ProbesHistoricMeasurement.SERIAL != None)
            .distinct()
            .all()
        )
        serials = [r[0] for r in rows if r[0] is not None]
        logger.info(f"Retrieved {len(serials)} distinct serials from database (last 15 days)")
        with _historic_serials_lock:
            _historic_serials_cache = list(serials)
            _historic_serials_cache_ts = time.monotonic()
        return serials
    finally:
        db.close()

def list_historic_serials():
    """Return list of all distinct SERIAL values from database."""
    global _historic_serials_cache, _historic_serials_cache_ts

    now = time.monotonic()
    with _historic_serials_lock:
        if _historic_serials_cache is not None and (now - _historic_serials_cache_ts) < _HISTORIC_SERIALS_CACHE_TTL_SEC:
            logger.info("Returning cached historic serials")
            return list(_historic_serials_cache)

    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=15)
        rows = (
            db.query(HistoricMeasurement.SERIAL)
            .filter(
                HistoricMeasurement.DATETIME >= func.dateadd(
                    text("DAY"), -15, func.sysutcdatetime()
                )
            )
            .filter(HistoricMeasurement.SERIAL != None)
            .distinct()
            .all()
        )
        serials = [r[0] for r in rows if r[0] is not None]
        logger.info(f"Retrieved {len(serials)} distinct serials from database (last 15 days)")
        with _historic_serials_lock:
            _historic_serials_cache = list(serials)
            _historic_serials_cache_ts = time.monotonic()
        return serials
    finally:
        db.close()

def list_historic_probes():
    """Return list of all distinct SERIAL values from database."""
    global _historic_serials_cache, _historic_serials_cache_ts

    now = time.monotonic()
    with _historic_serials_lock:
        if _historic_serials_cache is not None and (now - _historic_serials_cache_ts) < _HISTORIC_SERIALS_CACHE_TTL_SEC:
            logger.info("Returning cached historic serials")
            return list(_historic_serials_cache)

    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=15)
        rows = (
            db.query(ProbesHistoricMeasurement.SERIAL)
            .filter(
                ProbesHistoricMeasurement.DATETIME >= func.dateadd(
                    text("DAY"), -15, func.sysutcdatetime()
                )
            )
            .filter(ProbesHistoricMeasurement.SERIAL != None)
            .distinct()
            .all()
        )
        serials = [r[0] for r in rows if r[0] is not None]
        logger.info(f"Retrieved {len(serials)} distinct serials from database (last 15 days)")
        with _historic_serials_lock:
            _historic_serials_cache = list(serials)
            _historic_serials_cache_ts = time.monotonic()
        return serials
    finally:
        db.close()

def get_historic_records_by_serial(serial: str, early: str = None, latest: str = None, limit: int = 500, offset: int = 0):
    """Return paginated measurement records for a given SERIAL from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        base_query = (
            db.query(
                HistoricMeasurement.SERIAL.label("SERIAL"),
                HistoricMeasurement.NAME.label("NAME"),
                HistoricMeasurement.LATITUDE.label("LATITUDE"),
                HistoricMeasurement.LONGITUDE.label("LONGITUDE"),
                HistoricMeasurement.DATETIME.label("DATETIME"),
                HistoricMeasurement.HEADING.label("HEADING"),
                HistoricMeasurement.RSRP.label("RSRP"),
                HistoricMeasurement.SINR.label("SINR"),
                HistoricMeasurement.TEMP.label("TEMP"),
                HistoricMeasurement.S0RSRP.label("S0RSRP"),
                HistoricMeasurement.S0SINR.label("S0SINR"),
                HistoricMeasurement.S1RSRP.label("S1RSRP"),
                HistoricMeasurement.S1SINR.label("S1SINR"),
                HistoricMeasurement.S2RSRP.label("S2RSRP"),
                HistoricMeasurement.S2SINR.label("S2SINR"),
                HistoricMeasurement.S3RSRP.label("S3RSRP"),
                HistoricMeasurement.S3SINR.label("S3SINR"),
                HistoricMeasurement.SELECTED_ANTENNA.label("SELECTED_ANTENNA"),
                HistoricMeasurement.EARFCN.label("EARFCN"),
                HistoricMeasurement.BEST_CELLID.label("BEST_CELLID"),
                HistoricMeasurement.BEST_ENBID.label("BEST_ENBID"),
                HistoricMeasurement.BEST_SECID.label("BEST_SECID"),
                HistoricMeasurement.BEST_PCI.label("BEST_PCI"),
                HistoricMeasurement.RSRQ.label("RSRQ"),
                HistoricMeasurement.S0EARFCN.label("S0EARFCN"),
                HistoricMeasurement.S0CELLID.label("S0CELLID"),
                HistoricMeasurement.S0ENBID.label("S0ENBID"),
                HistoricMeasurement.S0PCI.label("S0PCI"),
                HistoricMeasurement.S0RSRQ.label("S0RSRQ"),
                HistoricMeasurement.S1EARFCN.label("S1EARFCN"),
                HistoricMeasurement.S1CELLID.label("S1CELLID"),
                HistoricMeasurement.S1ENBID.label("S1ENBID"),
                HistoricMeasurement.S1PCI.label("S1PCI"),
                HistoricMeasurement.S1RSRQ.label("S1RSRQ"),
                HistoricMeasurement.S2EARFCN.label("S2EARFCN"),
                HistoricMeasurement.S2CELLID.label("S2CELLID"),
                HistoricMeasurement.S2ENBID.label("S2ENBID"),
                HistoricMeasurement.S2PCI.label("S2PCI"),
                HistoricMeasurement.S2RSRQ.label("S2RSRQ"),
                HistoricMeasurement.S3EARFCN.label("S3EARFCN"),
                HistoricMeasurement.S3CELLID.label("S3CELLID"),
                HistoricMeasurement.S3ENBID.label("S3ENBID"),
                HistoricMeasurement.S3PCI.label("S3PCI"),
                HistoricMeasurement.S3RSRQ.label("S3RSRQ"),
            )
            .filter(HistoricMeasurement.SERIAL == ser)
            .filter(HistoricMeasurement.DATETIME >= cutoff)
            .filter(HistoricMeasurement.DATETIME >= sdate if sdate else True)
            .filter(HistoricMeasurement.DATETIME <= edate if edate else True)
        )
        total = base_query.count()
        rows = base_query.order_by(HistoricMeasurement.DATETIME.asc()).limit(limit).offset(offset).all()

        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "S0RSRP": row.S0RSRP,
                "S0SINR": row.S0SINR,
                "S1RSRP": row.S1RSRP,
                "S1SINR": row.S1SINR,
                "S2RSRP": row.S2RSRP,
                "S2SINR": row.S2SINR,
                "S3RSRP": row.S3RSRP,
                "S3SINR": row.S3SINR,
                "SELECTED_ANTENNA": row.SELECTED_ANTENNA,
                "EARFCN": row.EARFCN,
                "BEST_CELLID": row.BEST_CELLID,
                "BEST_ENBID": row.BEST_ENBID,
                "BEST_SECID": row.BEST_SECID,
                "BEST_PCI": row.BEST_PCI,
                "RSRQ": row.RSRQ,
                "S0EARFCN": row.S0EARFCN,
                "S0CELLID": row.S0CELLID,
                "S0ENBID": row.S0ENBID,
                "S0PCI": row.S0PCI,
                "S0RSRQ": row.S0RSRQ,
                "S1EARFCN": row.S1EARFCN,
                "S1CELLID": row.S1CELLID,
                "S1ENBID": row.S1ENBID,
                "S1PCI": row.S1PCI,
                "S1RSRQ": row.S1RSRQ,
                "S2EARFCN": row.S2EARFCN,
                "S2CELLID": row.S2CELLID,
                "S2ENBID": row.S2ENBID,
                "S2PCI": row.S2PCI,
                "S2RSRQ": row.S2RSRQ,
                "S3EARFCN": row.S3EARFCN,
                "S3CELLID": row.S3CELLID,
                "S3ENBID": row.S3ENBID,
                "S3PCI": row.S3PCI,
                "S3RSRQ": row.S3RSRQ
            }
            result.append(rec)

        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total for SERIAL: {ser}")
        return {"data": result, "total": total}
    finally:
        db.close()

def get_historic_records_by_probe(serial: str, early: str = None, latest: str = None, limit: int = 500, offset: int = 0):
    """Return paginated measurement records for a given SERIAL from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        base_query = (
            db.query(
                ProbesHistoricMeasurement.SERIAL.label("SERIAL"),
                ProbesHistoricMeasurement.NAME.label("NAME"),
                ProbesHistoricMeasurement.LATITUDE.label("LATITUDE"),
                ProbesHistoricMeasurement.LONGITUDE.label("LONGITUDE"),
                ProbesHistoricMeasurement.DATETIME.label("DATETIME"),
                ProbesHistoricMeasurement.HEADING.label("HEADING"),
                ProbesHistoricMeasurement.RSRP.label("RSRP"),
                ProbesHistoricMeasurement.SINR.label("SINR"),
                ProbesHistoricMeasurement.TEMP.label("TEMP"),
                ProbesHistoricMeasurement.EARFCN.label("EARFCN"),
                ProbesHistoricMeasurement.RSRQ.label("RSRQ"),
                ProbesHistoricMeasurement.BAND.label("BAND"),
                ProbesHistoricMeasurement.CID.label("CID"),
                ProbesHistoricMeasurement.CID_DEC.label("CID_DEC"),
                ProbesHistoricMeasurement.PCI.label("PCI"),
                ProbesHistoricMeasurement.GNSS.label("GNSS"),
                ProbesHistoricMeasurement.SPEED.label("SPEED"),
                ProbesHistoricMeasurement.MCC.label("MCC"),
                ProbesHistoricMeasurement.MNC.label("MNC"),
                ProbesHistoricMeasurement.MOBILITY.label("MOBILITY"),
                ProbesHistoricMeasurement.NETEXIST.label("NETEXIST"),
                ProbesHistoricMeasurement.REGISTERED.label("REGISTERED"),
                ProbesHistoricMeasurement.SCAN.label("SCAN#"),
                ProbesHistoricMeasurement.TAC.label("TAC"),
            )
            .filter(ProbesHistoricMeasurement.SERIAL == ser)
            .filter(ProbesHistoricMeasurement.DATETIME >= cutoff)
            .filter(ProbesHistoricMeasurement.DATETIME >= sdate if sdate else True)
            .filter(ProbesHistoricMeasurement.DATETIME <= edate if edate else True)
        )
        total = base_query.count()
        rows = base_query.order_by(ProbesHistoricMeasurement.DATETIME.asc()).limit(limit).offset(offset).all()

        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "EARFCN": row.EARFCN,
                "RSRQ": row.RSRQ,
                "BAND": row.BAND,
                "CID": row.CID,
                "CID_DEC": row.CID_DEC,
                "PCI": row.PCI,
                "GNSS": row.GNSS,
                "SPEED": row.SPEED,
                "MCC": row.MCC,
                "MNC": row.MNC,
                "MOBILITY": row.MOBILITY,
                "NETEXIST": row.NETEXIST,
                "REGISTERED": row.REGISTERED,
                "SCAN": row.SCAN,
                "TAC": row.TAC
            }
            result.append(rec)

        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total for SERIAL: {ser}")
        return {"data": result, "total": total}
    finally:
        db.close()

def get_all_historic_probe_records(early: str = None, latest: str = None, limit: int = 500, offset: int = 0):
    """Return paginated measurement records for ALL serials within the specified date range."""
    db = SessionLocal()
    try:
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        base_query = (
            db.query(
                ProbesHistoricMeasurement.SERIAL.label("SERIAL"),
                ProbesHistoricMeasurement.NAME.label("NAME"),
                ProbesHistoricMeasurement.LATITUDE.label("LATITUDE"),
                ProbesHistoricMeasurement.LONGITUDE.label("LONGITUDE"),
                ProbesHistoricMeasurement.DATETIME.label("DATETIME"),
                ProbesHistoricMeasurement.HEADING.label("HEADING"),
                ProbesHistoricMeasurement.RSRP.label("RSRP"),
                ProbesHistoricMeasurement.SINR.label("SINR"),
                ProbesHistoricMeasurement.TEMP.label("TEMP"),
                ProbesHistoricMeasurement.EARFCN.label("EARFCN"),
                ProbesHistoricMeasurement.RSRQ.label("RSRQ"),
                ProbesHistoricMeasurement.BAND.label("BAND"),
                ProbesHistoricMeasurement.CID.label("CID"),
                ProbesHistoricMeasurement.CID_DEC.label("CID_DEC"),
                ProbesHistoricMeasurement.PCI.label("PCI"),
                ProbesHistoricMeasurement.GNSS.label("GNSS"),
                ProbesHistoricMeasurement.SPEED.label("SPEED"),
                ProbesHistoricMeasurement.MCC.label("MCC"),
                ProbesHistoricMeasurement.MNC.label("MNC"),
                ProbesHistoricMeasurement.MOBILITY.label("MOBILITY"),
                ProbesHistoricMeasurement.NETEXIST.label("NETEXIST"),
                ProbesHistoricMeasurement.REGISTERED.label("REGISTERED"),
                ProbesHistoricMeasurement.SCAN.label("SCAN#"),
                ProbesHistoricMeasurement.TAC.label("TAC"),
            )
            .filter(ProbesHistoricMeasurement.DATETIME >= cutoff)
            .filter(ProbesHistoricMeasurement.DATETIME >= sdate if sdate else True)
            .filter(ProbesHistoricMeasurement.DATETIME <= edate if edate else True)
        )
        total = base_query.count()
        rows = base_query.order_by(ProbesHistoricMeasurement.DATETIME.asc()).limit(limit).offset(offset).all()

        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "EARFCN": row.EARFCN,
                "RSRQ": row.RSRQ,
                "BAND": row.BAND,
                "CID": row.CID,
                "CID_DEC": row.CID_DEC,
                "PCI": row.PCI,
                "GNSS": row.GNSS,
                "SPEED": row.SPEED,
                "MCC": row.MCC,
                "MNC": row.MNC,
                "MOBILITY": row.MOBILITY,
                "NETEXIST": row.NETEXIST,
                "REGISTERED": row.REGISTERED,
                "SCAN": row.SCAN,
                "TAC": row.TAC
            }
            result.append(rec)

        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total for ALL serials")
        return {"data": result, "total": total}
    finally:
        db.close()

def get_all_historic_records(early: str = None, latest: str = None, limit: int = 500, offset: int = 0):
    """Return paginated measurement records for ALL serials within the specified date range."""
    db = SessionLocal()
    try:
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        base_query = (
            db.query(
                HistoricMeasurement.SERIAL.label("SERIAL"),
                HistoricMeasurement.NAME.label("NAME"),
                HistoricMeasurement.LATITUDE.label("LATITUDE"),
                HistoricMeasurement.LONGITUDE.label("LONGITUDE"),
                HistoricMeasurement.DATETIME.label("DATETIME"),
                HistoricMeasurement.HEADING.label("HEADING"),
                HistoricMeasurement.RSRP.label("RSRP"),
                HistoricMeasurement.SINR.label("SINR"),
                HistoricMeasurement.TEMP.label("TEMP"),
                HistoricMeasurement.S0RSRP.label("S0RSRP"),
                HistoricMeasurement.S0SINR.label("S0SINR"),
                HistoricMeasurement.S1RSRP.label("S1RSRP"),
                HistoricMeasurement.S1SINR.label("S1SINR"),
                HistoricMeasurement.S2RSRP.label("S2RSRP"),
                HistoricMeasurement.S2SINR.label("S2SINR"),
                HistoricMeasurement.S3RSRP.label("S3RSRP"),
                HistoricMeasurement.S3SINR.label("S3SINR"),
                HistoricMeasurement.SELECTED_ANTENNA.label("SELECTED_ANTENNA"),
                HistoricMeasurement.EARFCN.label("EARFCN"),
                HistoricMeasurement.BEST_CELLID.label("BEST_CELLID"),
                HistoricMeasurement.BEST_ENBID.label("BEST_ENBID"),
                HistoricMeasurement.BEST_SECID.label("BEST_SECID"),
                HistoricMeasurement.BEST_PCI.label("BEST_PCI"),
                HistoricMeasurement.RSRQ.label("RSRQ"),
                HistoricMeasurement.S0EARFCN.label("S0EARFCN"),
                HistoricMeasurement.S0CELLID.label("S0CELLID"),
                HistoricMeasurement.S0ENBID.label("S0ENBID"),
                HistoricMeasurement.S0PCI.label("S0PCI"),
                HistoricMeasurement.S0RSRQ.label("S0RSRQ"),
                HistoricMeasurement.S1EARFCN.label("S1EARFCN"),
                HistoricMeasurement.S1CELLID.label("S1CELLID"),
                HistoricMeasurement.S1ENBID.label("S1ENBID"),
                HistoricMeasurement.S1PCI.label("S1PCI"),
                HistoricMeasurement.S1RSRQ.label("S1RSRQ"),
                HistoricMeasurement.S2EARFCN.label("S2EARFCN"),
                HistoricMeasurement.S2CELLID.label("S2CELLID"),
                HistoricMeasurement.S2ENBID.label("S2ENBID"),
                HistoricMeasurement.S2PCI.label("S2PCI"),
                HistoricMeasurement.S2RSRQ.label("S2RSRQ"),
                HistoricMeasurement.S3EARFCN.label("S3EARFCN"),
                HistoricMeasurement.S3CELLID.label("S3CELLID"),
                HistoricMeasurement.S3ENBID.label("S3ENBID"),
                HistoricMeasurement.S3PCI.label("S3PCI"),
                HistoricMeasurement.S3RSRQ.label("S3RSRQ"),
            )
            .filter(HistoricMeasurement.DATETIME >= cutoff)
            .filter(HistoricMeasurement.DATETIME >= sdate if sdate else True)
            .filter(HistoricMeasurement.DATETIME <= edate if edate else True)
        )
        total = base_query.count()
        rows = base_query.order_by(HistoricMeasurement.DATETIME.asc()).limit(limit).offset(offset).all()

        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "S0RSRP": row.S0RSRP,
                "S0SINR": row.S0SINR,
                "S1RSRP": row.S1RSRP,
                "S1SINR": row.S1SINR,
                "S2RSRP": row.S2RSRP,
                "S2SINR": row.S2SINR,
                "S3RSRP": row.S3RSRP,
                "S3SINR": row.S3SINR,
                "SELECTED_ANTENNA": row.SELECTED_ANTENNA,
                "EARFCN": row.EARFCN,
                "BEST_CELLID": row.BEST_CELLID,
                "BEST_ENBID": row.BEST_ENBID,
                "BEST_SECID": row.BEST_SECID,
                "BEST_PCI": row.BEST_PCI,
                "RSRQ": row.RSRQ,
                "S0EARFCN": row.S0EARFCN,
                "S0CELLID": row.S0CELLID,
                "S0ENBID": row.S0ENBID,
                "S0PCI": row.S0PCI,
                "S0RSRQ": row.S0RSRQ,
                "S1EARFCN": row.S1EARFCN,
                "S1CELLID": row.S1CELLID,
                "S1ENBID": row.S1ENBID,
                "S1PCI": row.S1PCI,
                "S1RSRQ": row.S1RSRQ,
                "S2EARFCN": row.S2EARFCN,
                "S2CELLID": row.S2CELLID,
                "S2ENBID": row.S2ENBID,
                "S2PCI": row.S2PCI,
                "S2RSRQ": row.S2RSRQ,
                "S3EARFCN": row.S3EARFCN,
                "S3CELLID": row.S3CELLID,
                "S3ENBID": row.S3ENBID,
                "S3PCI": row.S3PCI,
                "S3RSRQ": row.S3RSRQ
            }
            result.append(rec)

        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total for ALL serials")
        return {"data": result, "total": total}
    finally:
        db.close()

def get_alarm_records_by_probe(serial: str, early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75, limit: int = 100000, offset: int = 0):
    """Return list of alarm records for a given PROBE from database with pagination."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        
        # Log thresholds being used
        logger.info(f"Fetching alarm records for {ser} with thresholds - RSRP: {rsrp_threshold}, SINR: {sinr_threshold}, TEMP: {temp_threshold}")
        
        # Build base query for getting total count and paginated data
        base_query = (
            db.query(
                ProbesHistoricMeasurement.SERIAL.label("SERIAL"),
                ProbesHistoricMeasurement.NAME.label("NAME"),
                ProbesHistoricMeasurement.LATITUDE.label("LATITUDE"),
                ProbesHistoricMeasurement.LONGITUDE.label("LONGITUDE"),
                ProbesHistoricMeasurement.DATETIME.label("DATETIME"),
                ProbesHistoricMeasurement.HEADING.label("HEADING"),
                ProbesHistoricMeasurement.RSRP.label("RSRP"),
                ProbesHistoricMeasurement.SINR.label("SINR"),
                ProbesHistoricMeasurement.TEMP.label("TEMP"),
                ProbesHistoricMeasurement.EARFCN.label("EARFCN"),
                ProbesHistoricMeasurement.RSRQ.label("RSRQ"),
                ProbesHistoricMeasurement.BAND.label("BAND"),
                ProbesHistoricMeasurement.CID.label("CID"),
                ProbesHistoricMeasurement.CID_DEC.label("CID_DEC"),
                ProbesHistoricMeasurement.PCI.label("PCI"),
                ProbesHistoricMeasurement.GNSS.label("GNSS"),
                ProbesHistoricMeasurement.SPEED.label("SPEED"),
                ProbesHistoricMeasurement.MCC.label("MCC"),
                ProbesHistoricMeasurement.MNC.label("MNC"),
                ProbesHistoricMeasurement.MOBILITY.label("MOBILITY"),
                ProbesHistoricMeasurement.NETEXIST.label("NETEXIST"),
                ProbesHistoricMeasurement.REGISTERED.label("REGISTERED"),
                ProbesHistoricMeasurement.SCAN.label("SCAN#"),
                ProbesHistoricMeasurement.TAC.label("TAC"),
            )
            .filter(ProbesHistoricMeasurement.SERIAL == ser)
            .filter(ProbesHistoricMeasurement.DATETIME >= cutoff)
            .filter(ProbesHistoricMeasurement.DATETIME >= sdate if sdate else True)
            .filter(ProbesHistoricMeasurement.DATETIME <= edate if edate else True)
            .filter((HistoricMeasurement.RSRP <= rsrp_threshold) | (HistoricMeasurement.SINR <= sinr_threshold) | (HistoricMeasurement.LONGITUDE == 0) | (HistoricMeasurement.LATITUDE == 0) | (HistoricMeasurement.TEMP >= temp_threshold))
            .order_by(HistoricMeasurement.DATETIME.asc())
        )
        
        # Get total count
        total = base_query.count()
        
        # Get paginated results
        rows = base_query.limit(limit).offset(offset).all()
        
        # Convert SQLAlchemy objects to list of dicts
        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "EARFCN": row.EARFCN,
                "RSRQ": row.RSRQ,
                "BAND": row.BAND,
                "CID": row.CID,
                "CID_DEC": row.CID_DEC,
                "PCI": row.PCI,
                "GNSS": row.GNSS,
                "SPEED": row.SPEED,
                "MCC": row.MCC,
                "MNC": row.MNC,
                "MOBILITY": row.MOBILITY,
                "NETEXIST": row.NETEXIST,
                "REGISTERED": row.REGISTERED,
                "SCAN": row.SCAN,
                "TAC": row.TAC
            }
            result.append(rec)
        
        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total alarm records for PROBE: {ser}")
        return {"data": result, "total": total}
    finally:
        db.close()

def get_alarm_records_by_serial(serial: str, early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75, limit: int = 100000, offset: int = 0):
    """Return list of alarm records for a given SERIAL from database with pagination."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        
        # Log thresholds being used
        logger.info(f"Fetching alarm records for {ser} with thresholds - RSRP: {rsrp_threshold}, SINR: {sinr_threshold}, TEMP: {temp_threshold}")
        
        # Build base query for getting total count and paginated data
        base_query = (
            db.query(
                HistoricMeasurement.SERIAL.label("SERIAL"),
                HistoricMeasurement.NAME.label("NAME"),
                HistoricMeasurement.LATITUDE.label("LATITUDE"),
                HistoricMeasurement.LONGITUDE.label("LONGITUDE"),
                HistoricMeasurement.DATETIME.label("DATETIME"),
                HistoricMeasurement.HEADING.label("HEADING"),
                HistoricMeasurement.RSRP.label("RSRP"),
                HistoricMeasurement.SINR.label("SINR"),
                HistoricMeasurement.TEMP.label("TEMP"),
                HistoricMeasurement.S0RSRP.label("S0RSRP"),
                HistoricMeasurement.S0SINR.label("S0SINR"),
                HistoricMeasurement.S1RSRP.label("S1RSRP"),
                HistoricMeasurement.S1SINR.label("S1SINR"),
                HistoricMeasurement.S2RSRP.label("S2RSRP"),
                HistoricMeasurement.S2SINR.label("S2SINR"),
                HistoricMeasurement.S3RSRP.label("S3RSRP"),
                HistoricMeasurement.S3SINR.label("S3SINR"),
            )
            .filter(HistoricMeasurement.SERIAL == ser)
            .filter(HistoricMeasurement.DATETIME >= cutoff)
            .filter(HistoricMeasurement.DATETIME >= sdate if sdate else True)
            .filter(HistoricMeasurement.DATETIME <= edate if edate else True)
            .filter((HistoricMeasurement.RSRP <= rsrp_threshold) | (HistoricMeasurement.SINR <= sinr_threshold) | (HistoricMeasurement.LONGITUDE == 0) | (HistoricMeasurement.LATITUDE == 0) | (HistoricMeasurement.TEMP >= temp_threshold))
            .order_by(HistoricMeasurement.DATETIME.asc())
        )
        
        # Get total count
        total = base_query.count()
        
        # Get paginated results
        rows = base_query.limit(limit).offset(offset).all()
        
        # Convert SQLAlchemy objects to list of dicts
        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "S0RSRP": row.S0RSRP,
                "S0SINR": row.S0SINR,
                "S1RSRP": row.S1RSRP,
                "S1SINR": row.S1SINR,
                "S2RSRP": row.S2RSRP,
                "S2SINR": row.S2SINR,
                "S3RSRP": row.S3RSRP,
                "S3SINR": row.S3SINR
            }
            result.append(rec)
        
        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total alarm records for SERIAL: {ser}")
        return {"data": result, "total": total}
    finally:
        db.close()

def get_all_alarm_records(early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75, limit: int = 100000, offset: int = 0):
    """Return list of alarm records for all serials from database with pagination, ordered by DATETIME."""
    db = SessionLocal()
    try:
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        
        logger.info(f"Fetching all alarm records with thresholds - RSRP: {rsrp_threshold}, SINR: {sinr_threshold}, TEMP: {temp_threshold}")
        
        # Build base query for getting total count and paginated data
        base_query = (
            db.query(
                HistoricMeasurement.SERIAL.label("SERIAL"),
                HistoricMeasurement.NAME.label("NAME"),
                HistoricMeasurement.LATITUDE.label("LATITUDE"),
                HistoricMeasurement.LONGITUDE.label("LONGITUDE"),
                HistoricMeasurement.DATETIME.label("DATETIME"),
                HistoricMeasurement.HEADING.label("HEADING"),
                HistoricMeasurement.RSRP.label("RSRP"),
                HistoricMeasurement.SINR.label("SINR"),
                HistoricMeasurement.TEMP.label("TEMP"),
                HistoricMeasurement.S0RSRP.label("S0RSRP"),
                HistoricMeasurement.S0SINR.label("S0SINR"),
                HistoricMeasurement.S1RSRP.label("S1RSRP"),
                HistoricMeasurement.S1SINR.label("S1SINR"),
                HistoricMeasurement.S2RSRP.label("S2RSRP"),
                HistoricMeasurement.S2SINR.label("S2SINR"),
                HistoricMeasurement.S3RSRP.label("S3RSRP"),
                HistoricMeasurement.S3SINR.label("S3SINR"),
            )
            .filter(HistoricMeasurement.DATETIME >= cutoff)
            .filter(HistoricMeasurement.DATETIME >= sdate if sdate else True)
            .filter(HistoricMeasurement.DATETIME <= edate if edate else True)
            .filter((HistoricMeasurement.RSRP <= rsrp_threshold) | (HistoricMeasurement.SINR <= sinr_threshold) | (HistoricMeasurement.LONGITUDE == 0) | (HistoricMeasurement.LATITUDE == 0) | (HistoricMeasurement.TEMP >= temp_threshold))
            .order_by(HistoricMeasurement.DATETIME.asc())
        )
        
        # Get total count
        total = base_query.count()
        
        # Get paginated results
        rows = base_query.limit(limit).offset(offset).all()
        
        # Convert SQLAlchemy objects to list of dicts
        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "S0RSRP": row.S0RSRP,
                "S0SINR": row.S0SINR,
                "S1RSRP": row.S1RSRP,
                "S1SINR": row.S1SINR,
                "S2RSRP": row.S2RSRP,
                "S2SINR": row.S2SINR,
                "S3RSRP": row.S3RSRP,
                "S3SINR": row.S3SINR
            }
            result.append(rec)
        
        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total alarm records for ALL SYSTEMS")
        return {"data": result, "total": total}
    finally:
        db.close()

def get_all_alarm_probe_records(early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75, limit: int = 100000, offset: int = 0):
    """Return list of alarm records for all serials from database with pagination, ordered by DATETIME."""
    db = SessionLocal()
    try:
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        
        logger.info(f"Fetching all alarm records with thresholds - RSRP: {rsrp_threshold}, SINR: {sinr_threshold}, TEMP: {temp_threshold}")
        
        # Build base query for getting total count and paginated data
        base_query = (
            db.query(
                ProbesHistoricMeasurement.SERIAL.label("SERIAL"),
                ProbesHistoricMeasurement.NAME.label("NAME"),
                ProbesHistoricMeasurement.LATITUDE.label("LATITUDE"),
                ProbesHistoricMeasurement.LONGITUDE.label("LONGITUDE"),
                ProbesHistoricMeasurement.DATETIME.label("DATETIME"),
                ProbesHistoricMeasurement.HEADING.label("HEADING"),
                ProbesHistoricMeasurement.RSRP.label("RSRP"),
                ProbesHistoricMeasurement.SINR.label("SINR"),
                ProbesHistoricMeasurement.TEMP.label("TEMP"),
                ProbesHistoricMeasurement.EARFCN.label("EARFCN"),
                ProbesHistoricMeasurement.RSRQ.label("RSRQ"),
                ProbesHistoricMeasurement.BAND.label("BAND"),
                ProbesHistoricMeasurement.CID.label("CID"),
                ProbesHistoricMeasurement.CID_DEC.label("CID_DEC"),
                ProbesHistoricMeasurement.PCI.label("PCI"),
                ProbesHistoricMeasurement.GNSS.label("GNSS"),
                ProbesHistoricMeasurement.SPEED.label("SPEED"),
                ProbesHistoricMeasurement.MCC.label("MCC"),
                ProbesHistoricMeasurement.MNC.label("MNC"),
                ProbesHistoricMeasurement.MOBILITY.label("MOBILITY"),
                ProbesHistoricMeasurement.NETEXIST.label("NETEXIST"),
                ProbesHistoricMeasurement.REGISTERED.label("REGISTERED"),
                ProbesHistoricMeasurement.SCAN.label("SCAN#"),
                ProbesHistoricMeasurement.TAC.label("TAC"),
            )
            .filter(ProbesHistoricMeasurement.DATETIME >= cutoff)
            .filter(ProbesHistoricMeasurement.DATETIME >= sdate if sdate else True)
            .filter(ProbesHistoricMeasurement.DATETIME <= edate if edate else True)
            .filter((ProbesHistoricMeasurement.RSRP <= rsrp_threshold) | (ProbesHistoricMeasurement.SINR <= sinr_threshold) | (ProbesHistoricMeasurement.LONGITUDE == 0) | (ProbesHistoricMeasurement.LATITUDE == 0) | (ProbesHistoricMeasurement.TEMP >= temp_threshold))
            .order_by(ProbesHistoricMeasurement.DATETIME.asc())
        )
        
        # Get total count
        total = base_query.count()
        
        # Get paginated results
        rows = base_query.limit(limit).offset(offset).all()
        
        # Convert SQLAlchemy objects to list of dicts
        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "EARFCN": row.EARFCN,
                "RSRQ": row.RSRQ,
                "BAND": row.BAND,
                "CID": row.CID,
                "CID_DEC": row.CID_DEC,
                "PCI": row.PCI,
                "GNSS": row.GNSS,
                "SPEED": row.SPEED,
                "MCC": row.MCC,
                "MNC": row.MNC,
                "MOBILITY": row.MOBILITY,
                "NETEXIST": row.NETEXIST,
                "REGISTERED": row.REGISTERED,
                "SCAN": row.SCAN,
                "TAC": row.TAC
            }
            result.append(rec)
        
        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total alarm records for ALL SYSTEMS")
        return {"data": result, "total": total}
    finally:
        db.close()


def get_live_records_by_probe(serial: str):
    """Return list of measurement records for a given PROBE from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        rows = db.query(RealTimeProbeMeasurement).filter(RealTimeProbeMeasurement.SERIAL == ser).all()
        
        # Convert SQLAlchemy objects to list of dicts
        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "EARFCN": row.EARFCN,
                "RSRQ": row.RSRQ,
                "BAND": row.BAND,
                "CID": row.CID,
                "CID_DEC": row.CID_DEC,
                "PCI": row.PCI,
                "GNSS": row.GNSS,
                "SPEED": row.SPEED,
                "MCC": row.MCC,
                "MNC": row.MNC,
                "MOBILITY": row.MOBILITY,
                "NETEXIST": row.NETEXIST,
                "REGISTERED": row.REGISTERED,
                "SCAN": row.SCAN,
                "TAC": row.TAC
                
            }
            result.append(rec)
        
        logger.info(f"Retrieved {len(result)} records for SERIAL: {ser} from database")
        return result
    finally:
        db.close()

def get_live_records_by_serial(serial: str):
    """Return list of measurement records for a given SERIAL from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        rows = db.query(LiveMeasurement).filter(LiveMeasurement.SERIAL == ser).all()
        
        # Convert SQLAlchemy objects to list of dicts
        result = []
        for row in rows:
            rec = {
                "SERIAL": row.SERIAL,
                "NAME": row.NAME,
                "LATITUDE": row.LATITUDE,
                "LONGITUDE": row.LONGITUDE,
                "DATETIME": row.DATETIME.isoformat() if row.DATETIME else None,
                "HEADING": row.HEADING,
                "EARFCN": row.EARFCN,
                "PCI": row.PCI, 
                "ANTENNA USED": row.A_USED,
                "RSRP": row.RSRP,
                "SINR": row.SINR,
                "TEMP": row.TEMP,
                "CID": row.CID,
                "RSRQ": row.RSRQ,
                "NODE_ID": row.NODE_ID,
                "SECTOR_ID": row.SECTOR_ID
                
            }
            result.append(rec)
        
        logger.info(f"Retrieved {len(result)} records for SERIAL: {ser} from database")
        return result
    finally:
        db.close()


def live_serials_with_locations():
    """Return list of dicts {serial, latitude, longitude} for rows with valid coordinates from database."""
    db = SessionLocal()
    try:
        # Query all measurements with valid coordinates (not NULL and not 0)
        rows = db.query(LiveMeasurement).all()
        
        # Group by serial, keeping the most recent record
        groups = {}
        for row in rows:
            serial = row.SERIAL
            if serial not in groups:
                groups[serial] = row
            else:
                # Keep the row with the most recent datetime
                if row.DATETIME and groups[serial].DATETIME:
                    if row.DATETIME > groups[serial].DATETIME:
                        groups[serial] = row
                elif row.DATETIME:
                    groups[serial] = row
        
        # Convert to result format
        results = []
        for serial, row in groups.items():
            try:
                results.append({
                    "serial": serial,
                    "latitude": float(row.LATITUDE),
                    "longitude": float(row.LONGITUDE)
                })
            except (TypeError, ValueError):
                continue
        
        logger.info(f"Retrieved {len(results)} serials with locations from database")
        return results
    finally:
        db.close()

def historic_serials_with_locations():
    """Return list of dicts {serial, latitude, longitude} for rows with valid coordinates from database."""
    db = SessionLocal()
    try:
        # Query all measurements with valid coordinates (not NULL and not 0)
        rows = db.query(HistoricMeasurement).all()
        
        # Group by serial, keeping the most recent record
        groups = {}
        for row in rows:
            serial = row.SERIAL
            if serial not in groups:
                groups[serial] = row
            else:
                # Keep the row with the most recent datetime
                if row.DATETIME and groups[serial].DATETIME:
                    if row.DATETIME > groups[serial].DATETIME:
                        groups[serial] = row
                elif row.DATETIME:
                    groups[serial] = row
        
        # Convert to result format
        results = []
        for serial, row in groups.items():
            try:
                results.append({
                    "serial": serial,
                    "latitude": float(row.LATITUDE),
                    "longitude": float(row.LONGITUDE)
                })
            except (TypeError, ValueError):
                continue
        
        logger.info(f"Retrieved {len(results)} serials with locations from database")
        return results
    finally:
        db.close()

def get_earliest_datetime_for_serial(serial: str) -> str:
    """Return earliest datetime for a given SERIAL from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        row = (
            db.query(func.min(HistoricMeasurement.DATETIME))
            .filter(HistoricMeasurement.SERIAL == ser)
            .first()
        )
        if row and row[0]:
            return row[0].isoformat()
        else:
            return None
    finally:
        db.close()

def get_latest_datetime_for_serial(serial: str) -> str:
    """Return latest datetime for a given SERIAL from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        row = (
            db.query(func.max(HistoricMeasurement.DATETIME))
            .filter(HistoricMeasurement.SERIAL == ser)
            .first()
        )
        if row and row[0]:
            return row[0].isoformat()
        else:
            return None
    finally:
        db.close()

def get_latest_datetime_for_probe(serial: str) -> str:
    """Return latest datetime for a given PROBE from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        row = (
            db.query(func.max(ProbesHistoricMeasurement.DATETIME))
            .filter(ProbesHistoricMeasurement.SERIAL == ser)
            .first()
        )
        if row and row[0]:
            return row[0].isoformat()
        else:
            return None
    finally:
        db.close()

def export_live_csv(serial: str) -> str:
    """Return CSV string for the given serial from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        rows = db.query(LiveMeasurement).filter(LiveMeasurement.SERIAL == ser).all()
        
        # Build CSV output
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        headers = ["SERIAL", "NAME", "LATITUDE", "LONGITUDE", "DATETIME", "HEADING", "RSRP", "SINR", "TEMP"]
        writer.writerow(headers)
        
        # Write data rows
        for row in rows:
            writer.writerow([
                # row.NAME,
                row.SERIAL,
                row.NAME,
                row.LATITUDE,
                row.LONGITUDE,
                row.DATETIME.isoformat() if row.DATETIME else "",
                row.HEADING,
                row.RSRP,
                row.SINR,
                row.TEMP,
            ])
        
        return output.getvalue()
    finally:
        db.close()
        
def export_live_csv(serial: str) -> str:
    """Return CSV string for the given serial from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        rows = db.query(LiveMeasurement).filter(LiveMeasurement.SERIAL == ser).all()
        
        # Build CSV output
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        headers = ["SERIAL", "NAME", "LATITUDE", "LONGITUDE", "DATETIME", "EARFCN", "PCI", "RSRP", "RSRQ", "SINR", "TEMP"]
        writer.writerow(headers)
        
        # Write data rows
        for row in rows:
            writer.writerow([
                # row.NAME,
                row.SERIAL,
                row.NAME,
                row.LATITUDE,
                row.LONGITUDE,
                row.DATETIME.isoformat() if row.DATETIME else "",
                row.EARFCN,
                row.PCI,
                row.RSRP,
                row.RSRQ,
                row.SINR,
                row.TEMP,
            ])
        
        return output.getvalue()
    finally:
        db.close()

def get_alarm_statistics(early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    """Return alarm statistics for all systems (total samples vs alarm samples).
    
    Optimized version using single SQL query with conditional aggregation instead of N+1 queries.
    """
    db = SessionLocal()
    try:
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        
        # Log thresholds being used
        logger.info(f"Alarm statistics thresholds - RSRP: {rsrp_threshold}, SINR: {sinr_threshold}, TEMP: {temp_threshold}")
        
        # Define alarm condition for conditional aggregation
        alarm_condition = (
            (HistoricMeasurement.RSRP <= rsrp_threshold) | 
            (HistoricMeasurement.SINR <= sinr_threshold) | 
            (HistoricMeasurement.LONGITUDE == 0) | 
            (HistoricMeasurement.LATITUDE == 0) | 
            (HistoricMeasurement.TEMP >= temp_threshold)
        )
        rsrp_condition = (HistoricMeasurement.RSRP <= rsrp_threshold)
        sinr_condition = (HistoricMeasurement.SINR <= sinr_threshold)
        gps_condition = (HistoricMeasurement.LONGITUDE == 0) | (HistoricMeasurement.LATITUDE == 0)
        temp_condition = (HistoricMeasurement.TEMP >= temp_threshold)
        
        # Single query with GROUP BY and conditional aggregation
        # Uses CASE WHEN in SQL to count alarms in a single pass
        query = (
            db.query(
                HistoricMeasurement.SERIAL,
                HistoricMeasurement.NAME,
                func.count(HistoricMeasurement.SERIAL).label('total_samples'),
                func.sum(case((alarm_condition, 1), else_=0)).label('alarm_samples'),
                func.sum(case((rsrp_condition, 1), else_=0)).label('rsrp_alarms'),
                func.sum(case((sinr_condition, 1), else_=0)).label('sinr_alarms'),
                func.sum(case((gps_condition, 1), else_=0)).label('gps_alarms'),
                func.sum(case((temp_condition, 1), else_=0)).label('temp_alarms')

            )
            .filter(HistoricMeasurement.DATETIME >= cutoff)
            .filter(HistoricMeasurement.SERIAL != None)
        )
        
        # Apply optional date filters
        if sdate:
            query = query.filter(HistoricMeasurement.DATETIME >= sdate)
        if edate:
            query = query.filter(HistoricMeasurement.DATETIME <= edate)
        
        # Group by serial and name to aggregate counts per system
        query = query.group_by(HistoricMeasurement.SERIAL, HistoricMeasurement.NAME)
        
        results = query.all()
        logger.info(f"Found {len(results)} systems for statistics (optimized single query)")
        
        # Build statistics list from query results
        statistics = []
        for row in results:
            serial, name, total_count, alarm_count, rsrp_alarms, sinr_alarms, gps_alarms, temp_alarms = row
            percentage = (alarm_count / total_count * 100) if total_count > 0 else 0
            
            statistics.append({
                "serial": serial,
                "name": name or serial,
                "total_samples": total_count,
                "alarm_samples": alarm_count,
                "alarm_percentage": round(percentage, 2),
                "rsrp_alarms": rsrp_alarms,
                "sinr_alarms": sinr_alarms,
                "gps_alarms": gps_alarms,
                "temp_alarms": temp_alarms
            })
        
        # Sort by alarm percentage descending
        statistics.sort(key=lambda x: x["alarm_percentage"], reverse=True)
        
        logger.info(f"Calculated statistics for {len(statistics)} systems")
        return statistics
        
    finally:
        db.close()


def get_alarm_probes_statistics(early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    """Return alarm statistics for all systems (total samples vs alarm samples).
    
    Optimized version using single SQL query with conditional aggregation instead of N+1 queries.
    """
    db = SessionLocal()
    try:
        try:
            sdate = datetime.fromisoformat(early) if early else None
            edate = datetime.fromisoformat(latest) if latest else None
        except ValueError as e:
            logger.error(f"Invalid date format: early={early}, latest={latest}, error={e}")
            raise
            
        cutoff = datetime.utcnow() - timedelta(days=30000)
        
        # Log thresholds being used
        logger.info(f"Alarm statistics thresholds - RSRP: {rsrp_threshold}, SINR: {sinr_threshold}, TEMP: {temp_threshold}")
        
        # Define alarm condition for conditional aggregation
        alarm_condition = (
            (ProbesHistoricMeasurement.RSRP <= rsrp_threshold) | 
            (ProbesHistoricMeasurement.SINR <= sinr_threshold) | 
            (ProbesHistoricMeasurement.LONGITUDE == 0) | 
            (ProbesHistoricMeasurement.LATITUDE == 0) | 
            (ProbesHistoricMeasurement.TEMP >= temp_threshold)
        )
        rsrp_condition = (ProbesHistoricMeasurement.RSRP <= rsrp_threshold)
        sinr_condition = (ProbesHistoricMeasurement.SINR <= sinr_threshold)
        gps_condition = (ProbesHistoricMeasurement.LONGITUDE == 0) | (ProbesHistoricMeasurement.LATITUDE == 0)
        temp_condition = (ProbesHistoricMeasurement.TEMP >= temp_threshold)
        
        # Single query with GROUP BY and conditional aggregation
        # Uses CASE WHEN in SQL to count alarms in a single pass
        query = (
            db.query(
                ProbesHistoricMeasurement.SERIAL,
                ProbesHistoricMeasurement.NAME,
                func.count(ProbesHistoricMeasurement.SERIAL).label('total_samples'),
                func.sum(case((alarm_condition, 1), else_=0)).label('alarm_samples'),
                func.sum(case((rsrp_condition, 1), else_=0)).label('rsrp_alarms'),
                func.sum(case((sinr_condition, 1), else_=0)).label('sinr_alarms'),
                func.sum(case((gps_condition, 1), else_=0)).label('gps_alarms'),
                func.sum(case((temp_condition, 1), else_=0)).label('temp_alarms')

            )
            .filter(ProbesHistoricMeasurement.DATETIME >= cutoff)
            .filter(ProbesHistoricMeasurement.SERIAL != None)
        )
        
        # Apply optional date filters
        if sdate:
            query = query.filter(ProbesHistoricMeasurement.DATETIME >= sdate)
        if edate:
            query = query.filter(ProbesHistoricMeasurement.DATETIME <= edate)
        
        # Group by serial and name to aggregate counts per system
        query = query.group_by(ProbesHistoricMeasurement.SERIAL, ProbesHistoricMeasurement.NAME)
        
        try:
            results = query.all()
            logger.info(f"Found {len(results)} probes for statistics (optimized single query)")
        except Exception as e:
            logger.error(f"Database query failed: {e}", exc_info=True)
            raise
        
        # Build statistics list from query results
        statistics = []
        try:
            for row in results:
                serial, name, total_count, alarm_count, rsrp_alarms, sinr_alarms, gps_alarms, temp_alarms = row
                percentage = (alarm_count / total_count * 100) if total_count > 0 else 0
                
                statistics.append({
                    "serial": serial,
                    "name": name or serial,
                    "total_samples": total_count,
                    "alarm_samples": alarm_count,
                    "alarm_percentage": round(percentage, 2),
                    "rsrp_alarms": rsrp_alarms,
                    "sinr_alarms": sinr_alarms,
                    "gps_alarms": gps_alarms,
                    "temp_alarms": temp_alarms
                })
        except Exception as e:
            logger.error(f"Error building statistics from results: {e}", exc_info=True)
            raise
        
        # Sort by alarm percentage descending
        statistics.sort(key=lambda x: x["alarm_percentage"], reverse=True)
        
        logger.info(f"Calculated statistics for {len(statistics)} systems")
        return statistics
    except Exception as e:
        logger.error(f"Error in get_alarm_probes_statistics: {e}", exc_info=True)
        raise
    finally:
        db.close()


def export_historic_csv(serial: str) -> str:
    """Return CSV string for the given serial from database."""
    db = SessionLocal()
    try:
        ser = str(serial).strip()
        rows = db.query(HistoricMeasurement).filter(HistoricMeasurement.SERIAL == ser).all()
        
        # Build CSV output
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        headers = ["SERIAL",
                "NAME",
                "LATITUDE",
                "LONGITUDE",
                "DATETIME",
                "HEADING",
                "RSRP",
                "SINR",
                "TEMP",
                "S0RSRP",
                "S0SINR",
                "S1RSRP",
                "S1SINR",
                "S2RSRP",
                "S2SINR",
                "S3RSRP",
                "S3SINR",
                "SELECTED_ANTENNA",
                "EARFCN",
                "BEST_CELLID",
                "BEST_ENBID",
                "BEST_SECID",
                "BEST_PCI",
                "RSRQ",
                "S0EARFCN",
                "S0CELLID",
                "S0ENBID",
                "S0PCI",
                "S0RSRQ",
                "S1EARFCN",
                "S1CELLID",
                "S1ENBID",
                "S1PCI",
                "S1RSRQ",
                "S2EARFCN",
                "S2CELLID",
                "S2ENBID",
                "S2PCI",
                "S2RSRQ",
                "S3EARFCN",
                "S3CELLID",
                "S3ENBID",
                "S3PCI",
                "S3RSRQ"]
        writer.writerow(headers)
        
        # Write data rows
        for row in rows:
            writer.writerow([
                row.SERIAL,
                row.NAME,
                row.LATITUDE,
                row.LONGITUDE,
                row.DATETIME.isoformat() if row.DATETIME else None,
                row.HEADING,
                row.RSRP,
                row.SINR,
                row.TEMP,
                row.S0RSRP,
                row.S0SINR,
                row.S1RSRP,
                row.S1SINR,
                row.S2RSRP,
                row.S2SINR,
                row.S3RSRP,
                row.S3SINR,
                row.SELECTED_ANTENNA,
                row.EARFCN,
                row.BEST_CELLID,
                row.BEST_ENBID,
                row.BEST_SECID,
                row.BEST_PCI,
                row.RSRQ,
                row.S0EARFCN,
                row.S0CELLID,
                row.S0ENBID,
                row.S0PCI,
                row.S0RSRQ,
                row.S1EARFCN,
                row.S1CELLID,
                row.S1ENBID,
                row.S1PCI,
                row.S1RSRQ,
                row.S2EARFCN,
                row.S2CELLID,
                row.S2ENBID,
                row.S2PCI,
                row.S2RSRQ,
                row.S3EARFCN,
                row.S3CELLID,
                row.S3ENBID,
                row.S3PCI,
                row.S3RSRQ,
            ])
        
        return output.getvalue()
    finally:
        db.close()
        
# =========================
# 3SKELION (NewSheet$) READS
# =========================
# Goal: Provide a minimal "Live" experience for 3skelion.
# We return data shaped similarly to the existing /Systems/Live/{serial} endpoint,
# so we can reuse most of the existing frontend code with minimal changes.

from sqlalchemy.sql import text


def list_3skelion_serials():
    """
    Return list of distinct SERIAL values from dbo.[NewSheet$] (3skelion table).
    """
    db = SessionLocal()
    try:
        sql = text("""
            SELECT DISTINCT SERIAL
            FROM dbo.[LiveOldSheet$]
            WHERE SERIAL IS NOT NULL AND LTRIM(RTRIM(SERIAL)) <> ''
            ORDER BY SERIAL
        """)
        rows = db.execute(sql).fetchall()
        return [r[0] for r in rows]
    finally:
        db.close()

def list_3skelion_serial_name_pairs():
    """
    Return serial/name pairs for UI.
    For 3skelion: NAME should be the SHIP name (PowerBI style).
    """
    serials = list_3skelion_serials()
    return [{"SERIAL": s, "NAME": get_ship_name(s), "SHIP": get_ship_name(s)} for s in serials]

def get_3skelion_live_records_by_serial(serial: str):
    """
    Return a 1-item list with the latest live record for this SERIAL from LiveOldSheet$.
    Adds a computed column SHIP (PowerBI-style mapping).
    """
    db = SessionLocal()
    try:
        ser = str(serial).strip()

        sql = text("""
            SELECT TOP (1)
                SERIAL,
                [TIME],   
                LAT,
                LON,
                TEMP,
                SCANID,

                BEST_RSRP,
                BEST_SNR,
                BEST_RSRQ,
                BEST_CELLID,
                BEST_ANTENNA

            FROM [3skelion2].[dbo].[LiveOldSheet$]
            WHERE SERIAL = :serial
            ORDER BY [TIME] DESC, SCANID DESC
        """)

        row = db.execute(sql, {"serial": ser}).mappings().first()
        if not row:
            return []

        record = dict(row)

        dt = record.get("TIME")  # python datetime
        record["TIME"] = dt.isoformat() if dt else None

        # (optional αλλά βοηθάει αν κάποιο UI ακόμα ψάχνει DATETIME)
        record["DATETIME"] = record["TIME"]

        # ✅ Calculated field (like PowerBI DAX)
        record["SHIP"] = get_ship_name(record.get("SERIAL"))

        # ✅ Helpful aliases so our existing UI doesn't break
        # (We can later simplify the UI to use only the PowerBI-style fields.)
        record["NAME"] = record["SHIP"]              # Selection panel can show ship name
        record["LATITUDE"] = record.get("LAT")       # existing UI expects LATITUDE
        record["LONGITUDE"] = record.get("LON")      # existing UI expects LONGITUDE
        record["RSRP"] = record.get("BEST_RSRP")     # existing UI expects RSRP
        record["SINR"] = record.get("BEST_SNR")      # existing UI expects SINR

        return [record]
    finally:
        db.close()

def live_3skelion_serials_with_locations():
    db = SessionLocal()
    try:
        sql = text("""
            WITH ranked AS (
                SELECT
                    SERIAL,
                    LAT AS latitude,
                    LON AS longitude,
                    [TIME] AS time,
                    ROW_NUMBER() OVER (
                        PARTITION BY SERIAL
                        ORDER BY [TIME] DESC, SCANID DESC
                    ) AS rn
                FROM [3skelion2].[dbo].[LiveOldSheet$]
                WHERE SERIAL IS NOT NULL
            )
            SELECT
                SERIAL AS serial,
                latitude,
                longitude,
                time   
            FROM ranked
            WHERE rn = 1
              AND latitude IS NOT NULL AND longitude IS NOT NULL
              AND latitude <> 0 AND longitude <> 0
        """)


        rows = db.execute(sql).mappings().all()

        # add SHIP in Python (fast, only ~30 rows)
        out = []
        for r in rows:
            d = dict(r)
            d["ship"] = get_ship_name(d.get("serial"))
            out.append(d)

        #time -> isoformat
        for d in out:
            if d.get("time"):
                d["time"] = d["time"].isoformat()

        return out
    finally:
        db.close()

# =========================
# 3SKELION - ALARMS (NewSheet$)
# =========================

def get_3skelion_alarm_records_by_serial(
    serial: str,
    early: str = None,
    latest: str = None,
    rsrp_threshold: float = -120,
    sinr_threshold: float = 0,
    temp_threshold: float = 75
):
    """
    Return alarm samples for one SERIAL from:
      [3skelion2].[dbo].[NewSheet$]

    Output fields are normalized so the existing JS works:
      SERIAL, NAME, LATITUDE, LONGITUDE, DATETIME, RSRP, SINR, TEMP
    """
    db = SessionLocal()
    try:
        ser = str(serial).strip()

        cutoff = datetime.utcnow() - timedelta(days=15)
        sdate = datetime.fromisoformat(early) if early else cutoff
        edate = datetime.fromisoformat(latest) if latest else datetime.utcnow()

        # Never allow query to go older than cutoff
        if sdate < cutoff:
            sdate = cutoff

        sql = text("""
            SELECT
                SERIAL,
                [TIME] AS DATETIME,
                LAT AS LATITUDE,
                LON AS LONGITUDE,
                TEMP,
                BEST_RSRP AS RSRP,
                BEST_SNR  AS SINR
            FROM [3skelion2].[dbo].[NewSheet$]
            WHERE SERIAL = :serial
              AND [TIME] >= :sdate
              AND [TIME] <= :edate
              AND (
                   BEST_RSRP <= :rsrp_threshold
                OR BEST_SNR  <= :sinr_threshold
                OR LAT = 0
                OR LON = 0
                OR TEMP >= :temp_threshold
              )
            ORDER BY [TIME] ASC
        """)

        rows = db.execute(sql, {
            "serial": ser,
            "sdate": sdate,
            "edate": edate,
            "rsrp_threshold": rsrp_threshold,
            "sinr_threshold": sinr_threshold,
            "temp_threshold": temp_threshold,
        }).mappings().all()

        ship = get_ship_name(ser)

        out = []
        for r in rows:
            d = dict(r)
            dt = d.get("DATETIME")
            d["DATETIME"] = dt.isoformat() if dt else None
            d["NAME"] = ship
            out.append(d)

        return out
    finally:
        db.close()


def get_3skelion_alarm_statistics(
    early: str = None,
    latest: str = None,
    rsrp_threshold: float = -120,
    sinr_threshold: float = 0,
    temp_threshold: float = 75
):
    """
    Return alarm statistics per system (top systems by alarm rate)
    from [3skelion2].[dbo].[NewSheet$]
    """
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=15)
        sdate = datetime.fromisoformat(early) if early else cutoff
        edate = datetime.fromisoformat(latest) if latest else datetime.utcnow()

        if sdate < cutoff:
            sdate = cutoff

        sql = text("""
            SELECT
                SERIAL,
                COUNT(*) AS total_samples,
                SUM(CASE WHEN (
                       BEST_RSRP <= :rsrp_threshold
                    OR BEST_SNR  <= :sinr_threshold
                    OR LAT = 0
                    OR LON = 0
                    OR TEMP >= :temp_threshold
                ) THEN 1 ELSE 0 END) AS alarm_samples,

                SUM(CASE WHEN BEST_RSRP <= :rsrp_threshold THEN 1 ELSE 0 END) AS rsrp_alarms,
                SUM(CASE WHEN BEST_SNR  <= :sinr_threshold THEN 1 ELSE 0 END) AS sinr_alarms,
                SUM(CASE WHEN (LAT = 0 OR LON = 0) THEN 1 ELSE 0 END) AS gps_alarms,
                SUM(CASE WHEN TEMP >= :temp_threshold THEN 1 ELSE 0 END) AS temp_alarms
            FROM [3skelion2].[dbo].[NewSheet$]
            WHERE SERIAL IS NOT NULL
              AND [TIME] >= :sdate
              AND [TIME] <= :edate
            GROUP BY SERIAL
        """)

        rows = db.execute(sql, {
            "sdate": sdate,
            "edate": edate,
            "rsrp_threshold": rsrp_threshold,
            "sinr_threshold": sinr_threshold,
            "temp_threshold": temp_threshold,
        }).fetchall()

        stats = []
        for (serial, total_samples, alarm_samples, rsrp_alarms, sinr_alarms, gps_alarms, temp_alarms) in rows:
            total_samples = int(total_samples or 0)
            alarm_samples = int(alarm_samples or 0)
            pct = (alarm_samples / total_samples * 100) if total_samples > 0 else 0.0

            stats.append({
                "serial": serial,
                "name": get_ship_name(serial),
                "total_samples": total_samples,
                "alarm_samples": alarm_samples,
                "alarm_percentage": round(pct, 2),
                "rsrp_alarms": int(rsrp_alarms or 0),
                "sinr_alarms": int(sinr_alarms or 0),
                "gps_alarms": int(gps_alarms or 0),
                "temp_alarms": int(temp_alarms or 0),
            })

        stats.sort(key=lambda x: x["alarm_percentage"], reverse=True)
        return stats
    finally:
        db.close()        
        
# =========================
# 3SKELION - PLAYBACK (HISTORIC) FROM NewSheet$
# =========================
from datetime import datetime, timedelta
from sqlalchemy.sql import text

from app.ship_lookup import get_ship_name  # το mapping που ήδη φτιάξαμε


def list_3skelion_playback_serials():
    """
    Playback serials list for 3skelion.

    TIP: Για να είναι ΠΑΝΤΑ γρήγορο, το παίρνουμε από LiveOldSheet$
    (εκεί υπάρχουν τα 30 συστήματα σίγουρα).
    Αν το πάρεις από NewSheet$ μπορεί να κάνει αχρείαστο heavy DISTINCT.
    """
    db = SessionLocal()
    try:
        sql = text("""
            SELECT DISTINCT SERIAL
            FROM [3skelion2].[dbo].[LiveOldSheet$]
            WHERE SERIAL IS NOT NULL AND LTRIM(RTRIM(SERIAL)) <> ''
            ORDER BY SERIAL
        """)
        rows = db.execute(sql).fetchall()
        return [r[0] for r in rows]
    finally:
        db.close()


def get_3skelion_historic_records_by_serial(serial: str, early: str, latest: str, limit: int = 500, offset: int = 0):
    """
    Return paginated historic records from:
      [3skelion2].[dbo].[NewSheet$]

    Inputs:
      early/latest come from the UI as strings (usually 'YYYY-MM-DD').

    Output format:
      {
        "data": [ { ...record... }, ... ],
        "total": <int>
      }

    IMPORTANT:
      - The frontend playback.js expects fields: DATETIME, RSRP, SINR and coords (LAT/LON).
      - In 3skelion, we map:
          RSRP  = BEST_RSRP
          SINR  = BEST_SNR
          DATETIME = TIME
    """
    db = SessionLocal()
    try:
        ser = str(serial).strip()

        # Parse early/latest (usually YYYY-MM-DD)
        start_dt = datetime.fromisoformat(early)

        end_dt_raw = datetime.fromisoformat(latest)
        # Αν latest είναι date-only, θέλουμε να πιάσουμε ΟΛΗ τη μέρα:
        # π.χ. 2025-01-25 => μέχρι 2025-01-26 00:00 (exclusive)
        end_exclusive = end_dt_raw + timedelta(days=1) if len(latest) <= 10 else end_dt_raw

        # Total count (για pagination UI)
        count_sql = text("""
            SELECT COUNT(*) AS total
            FROM [3skelion2].[dbo].[NewSheet$]
            WHERE SERIAL = :serial
              AND [TIME] >= :start_dt
              AND [TIME] <  :end_dt
        """)
        total = db.execute(count_sql, {"serial": ser, "start_dt": start_dt, "end_dt": end_exclusive}).scalar() or 0

        # Main page query
        data_sql = text("""
            SELECT
                SERIAL,
                [TIME] AS DATETIME,     -- alias ώστε το frontend να το βλέπει σαν DATETIME
                LAT,
                LON,
                TEMP,
                SCANID,

                BEST_RSRP,
                BEST_SNR,
                BEST_RSRQ,
                BEST_CELLID,
                BEST_ANTENNA

            FROM [3skelion2].[dbo].[NewSheet$]
            WHERE SERIAL = :serial
              AND [TIME] >= :start_dt
              AND [TIME] <  :end_dt
            ORDER BY [TIME] ASC
            OFFSET :offset ROWS
            FETCH NEXT :limit ROWS ONLY
        """)

        rows = db.execute(
            data_sql,
            {"serial": ser, "start_dt": start_dt, "end_dt": end_exclusive, "offset": int(offset), "limit": int(limit)}
        ).mappings().all()

        # Υπολογίζουμε το SHIP ΜΙΑ φορά (ίδιο για όλα τα rows)
        ship = get_ship_name(ser)

        result = []
        for r in rows:
            rec = dict(r)

            # ✅ computed field για PowerBI-like usage
            rec["SHIP"] = ship

            # ✅ mapping ώστε playback map/chart να δουλέψει κατευθείαν
            rec["RSRP"] = rec.get("BEST_RSRP")
            rec["SINR"] = rec.get("BEST_SNR")

            # ✅ JSON friendly datetime
            dt = rec.get("DATETIME")
            rec["DATETIME"] = dt.isoformat() if dt else None

            result.append(rec)

        return {"data": result, "total": int(total)}
    finally:
        db.close()


# =========================
# 3SKELION - PLAYBACK (HISTORIC) FROM NewSheet$
# =========================
from datetime import datetime, timedelta
from sqlalchemy.sql import text

from app.ship_lookup import get_ship_name  # το mapping που ήδη φτιάξαμε


def list_3skelion_playback_serials():
    """
    Playback serials list for 3skelion.

    TIP: Για να είναι ΠΑΝΤΑ γρήγορο, το παίρνουμε από LiveOldSheet$
    (εκεί υπάρχουν τα 30 συστήματα σίγουρα).
    Αν το πάρεις από NewSheet$ μπορεί να κάνει αχρείαστο heavy DISTINCT.
    """
    db = SessionLocal()
    try:
        sql = text("""
            SELECT DISTINCT SERIAL
            FROM [3skelion2].[dbo].[LiveOldSheet$]
            WHERE SERIAL IS NOT NULL AND LTRIM(RTRIM(SERIAL)) <> ''
            ORDER BY SERIAL
        """)
        rows = db.execute(sql).fetchall()
        return [r[0] for r in rows]
    finally:
        db.close()


def get_3skelion_historic_records_by_serial(serial: str, early: str, latest: str, limit: int = 500, offset: int = 0):
    """
    Return paginated historic records from:
      [3skelion2].[dbo].[NewSheet$]

    Inputs:
      early/latest come from the UI as strings (usually 'YYYY-MM-DD').

    Output format:
      {
        "data": [ { ...record... }, ... ],
        "total": <int>
      }

    IMPORTANT:
      - The frontend playback.js expects fields: DATETIME, RSRP, SINR and coords (LAT/LON).
      - In 3skelion, we map:
          RSRP  = BEST_RSRP
          SINR  = BEST_SNR
          DATETIME = TIME
    """
    db = SessionLocal()
    try:
        ser = str(serial).strip()

        # Parse early/latest (usually YYYY-MM-DD)
        start_dt = datetime.fromisoformat(early)

        end_dt_raw = datetime.fromisoformat(latest)
        # Αν latest είναι date-only, θέλουμε να πιάσουμε ΟΛΗ τη μέρα:
        # π.χ. 2025-01-25 => μέχρι 2025-01-26 00:00 (exclusive)
        end_exclusive = end_dt_raw + timedelta(days=1) if len(latest) <= 10 else end_dt_raw

        # Total count (για pagination UI)
        count_sql = text("""
            SELECT COUNT(*) AS total
            FROM [3skelion2].[dbo].[NewSheet$]
            WHERE SERIAL = :serial
              AND [TIME] >= :start_dt
              AND [TIME] <  :end_dt
        """)
        total = db.execute(count_sql, {"serial": ser, "start_dt": start_dt, "end_dt": end_exclusive}).scalar() or 0

        # --- 3skelion playback: per-antenna fields (Ant1..Ant4) ---
        # Frontend expects:
        #   S0RSRP..S3RSRP and S0SINR..S3SINR
        # DB usually has: RSRP_1..RSRP_4 and SNR_1..SNR_4 (sometimes SINR_1..SINR_4)
        # We auto-detect existing columns once and return NULL for missing ones
        # (so the SQL never fails if e.g. RSRP_4 doesn't exist).
        if not hasattr(get_3skelion_historic_records_by_serial, "_newsheet_cols"):
            cols_sql = text(
                "SELECT COLUMN_NAME "
                "FROM [3skelion2].INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_NAME = 'NewSheet$'"
            )
            col_rows = db.execute(cols_sql).fetchall()
            get_3skelion_historic_records_by_serial._newsheet_cols = {r[0].upper() for r in col_rows}

        cols = get_3skelion_historic_records_by_serial._newsheet_cols

        def _sel_float(col_name: str, alias: str) -> str:
            if col_name.upper() in cols:
                return f"{col_name} AS {alias}"
            return f"CAST(NULL AS float) AS {alias}"

        antenna_select_parts = []
        for i in range(1, 5):
            # RSRP per antenna -> S0RSRP..S3RSRP
            antenna_select_parts.append(_sel_float(f"RSRP_{i}", f"S{i-1}RSRP"))

            # SINR per antenna -> S0SINR..S3SINR (DB might call it SNR_i or SINR_i)
            if f"SNR_{i}".upper() in cols:
                antenna_select_parts.append(_sel_float(f"SNR_{i}", f"S{i-1}SINR"))
            elif f"SINR_{i}".upper() in cols:
                antenna_select_parts.append(_sel_float(f"SINR_{i}", f"S{i-1}SINR"))
            else:
                antenna_select_parts.append(f"CAST(NULL AS float) AS S{i-1}SINR")

        antenna_select_sql = ",\n                ".join(antenna_select_parts)
        # Main page query
        data_sql = text(f"""
            SELECT
                SERIAL,
                [TIME] AS DATETIME,     -- alias ώστε το frontend να το βλέπει σαν DATETIME
                LAT,
                LON,
                TEMP,
                SCANID,

                BEST_RSRP,
                BEST_SNR,
                BEST_RSRQ,
                BEST_CELLID,
                BEST_ANTENNA,
                {antenna_select_sql}    

            FROM [3skelion2].[dbo].[NewSheet$]
            WHERE SERIAL = :serial
              AND [TIME] >= :start_dt
              AND [TIME] <  :end_dt
            ORDER BY [TIME] ASC
            OFFSET :offset ROWS
            FETCH NEXT :limit ROWS ONLY
        """)

        rows = db.execute(
            data_sql,
            {"serial": ser, "start_dt": start_dt, "end_dt": end_exclusive, "offset": int(offset), "limit": int(limit)}
        ).mappings().all()

        # Υπολογίζουμε το SHIP ΜΙΑ φορά (ίδιο για όλα τα rows)
        ship = get_ship_name(ser)

        result = []
        for r in rows:
            rec = dict(r)

            # ✅ computed field για PowerBI-like usage
            rec["SHIP"] = ship

            # ✅ mapping ώστε playback map/chart να δουλέψει κατευθείαν
            rec["RSRP"] = rec.get("BEST_RSRP")
            rec["SINR"] = rec.get("BEST_SNR")

            # ✅ JSON friendly datetime
            dt = rec.get("DATETIME")
            rec["DATETIME"] = dt.isoformat() if dt else None

            result.append(rec)

        return {"data": result, "total": int(total)}
    finally:
        db.close()