import logging
import threading
from sqlalchemy.sql import func, text, case
import time
from datetime import datetime, timedelta
from .database import SessionLocal
from .models import HistoricMeasurement, LiveMeasurement
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
        
# def list_live_names():
#     """Return list of all distinct SERIAL values from database."""
#     db = SessionLocal()
#     try:
#         rows = db.query(LiveMeasurement.NAME).distinct().all()
#         names = [r[0] for r in rows if r[0] is not None]
#         logger.info(f"Retrieved {len(names)} distinct serials from database")
#         return names
#     finally:
#         db.close()
def list_live_serial_name_pairs():
    db = SessionLocal()
    try:
        rows = (
            db.query(LiveMeasurement.SERIAL, LiveMeasurement.NAME)
            .distinct()
            .all()
        )
        # κρατάμε μόνο όσα έχουν serial
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
                "S3SINR": row.S3SINR
            }
            result.append(rec)

        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total for SERIAL: {ser}")
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
            }
            result.append(rec)

        logger.info(f"Retrieved {len(result)} records (offset={offset}, limit={limit}) out of {total} total for ALL serials")
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
                "S3SINR"]
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
            ])
        
        return output.getvalue()
    finally:
        db.close()