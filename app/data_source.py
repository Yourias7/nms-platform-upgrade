import logging
import threading
from sqlalchemy.sql import func, text, case
import time
from datetime import datetime, timedelta
from .database import SessionLocal
from .models import HistoricMeasurement, LiveMeasurement, RealTimeProbeMeasurement, ProbesHistoricMeasurement
import csv
import io

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
        sdate = datetime.fromisoformat(early) if early else None
        edate = datetime.fromisoformat(latest) if latest else None
        cutoff = datetime.utcnow() - timedelta(days=15)
        
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
        
        results = query.all()
        logger.info(f"Found {len(results)} probes for statistics (optimized single query)")
        
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