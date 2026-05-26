from fastapi import FastAPI, Request, Response # type: ignore
import logging
from app.data_source import (get_alarm_probes_statistics, get_alarm_records_by_probe, get_alarm_records_by_serial, get_all_alarm_probe_records, get_all_alarm_records, get_alarm_statistics, get_all_historic_probe_records, get_earliest_datetime_for_serial, get_historic_records_by_probe, get_latest_datetime_for_serial, 
get_historic_records_by_serial, get_all_historic_records, get_live_records_by_probe, get_live_records_by_serial, list_historic_probes, list_historic_probes_serial_name_pairs, list_live_probes, list_live_probes_serial_name_pairs, list_live_serial_name_pairs, list_live_serials, list_historic_serials, 
export_live_csv, export_historic_csv, live_serials_with_locations, historic_serials_with_locations,list_3skelion_serials,list_3skelion_serial_name_pairs,
get_3skelion_live_records_by_serial, live_3skelion_serials_with_locations,list_3skelion_playback_serials,get_3skelion_historic_records_by_serial,
get_3skelion_alarm_records_by_serial,get_3skelion_alarm_statistics,export_3skelion_live_csv, get_all_3skelion_historic_records, export_3skelion_historic_csv)
from fastapi.responses import StreamingResponse, FileResponse, RedirectResponse # type: ignore
import io
import mimetypes
from pathlib import Path

from fastapi.staticfiles import StaticFiles # type: ignore
from fastapi.templating import Jinja2Templates # type: ignore

# Ensure JavaScript files are served with correct MIME type
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')

logger = logging.getLogger("uvicorn")

app = FastAPI()

# Get base directory (project root)
BASE_DIR = Path(__file__).resolve().parent.parent

# Mount static files and templates
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

@app.middleware("http")
async def disable_cache_for_dev(request: Request, call_next):
    response: Response = await call_next(request)

    path = request.url.path
    content_type = response.headers.get("content-type", "")

    # Disable caching for static files + HTML pages (dev convenience)
    if path.startswith("/static/") or content_type.startswith("text/html"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    return response

@app.get("/Systems/Live/{serial}")
def get_system(serial: str):
    data = get_live_records_by_serial(serial)
    logger.info(f"Retrieved {len(data)} records for SERIAL: {serial}")
    return data

@app.get("/Probes/Live/{serial}")
def get_probe_system(serial: str):
    data = get_live_records_by_probe(serial)
    logger.info(f"Retrieved {len(data)} records for SERIAL: {serial}")
    return data

@app.get("/playback/Historic/all/{early}/{latest}")
def get_all_systems_paged(early: str, latest: str, page: int = 1, limit: int = 500):
    """Return paginated historic records for all systems."""
    offset = (page - 1) * limit
    result = get_all_historic_records(early=early, latest=latest, limit=limit, offset=offset)
    logger.info(f"Returning {len(result['data'])} records (page {page}) out of {result['total']} total for ALL systems")
    return result

@app.get("/Probes/playback/Historic/all/{early}/{latest}")
def get_all_probes_paged(early: str, latest: str, page: int = 1, limit: int = 500):
    """Return paginated historic records for all probes."""
    offset = (page - 1) * limit
    result = get_all_historic_probe_records(early=early, latest=latest, limit=limit, offset=offset)
    logger.info(f"Returning {len(result['data'])} records (page {page}) out of {result['total']} total for ALL probes")
    return result

@app.get("/playback/Historic/{serial}/{early}/{latest}")
def get_system(serial: str, early: str, latest: str, page: int = 1, limit: int = 500):
    offset = (page - 1) * limit
    result = get_historic_records_by_serial(serial, early=early, latest=latest, limit=limit, offset=offset)
    logger.info(f"Retrieved {len(result['data'])} records (page {page}) out of {result['total']} total for SERIAL: {serial}")
    return result

@app.get("/Probes/playback/Historic/{serial}/{early}/{latest}")
def get_probe_system(serial: str, early: str, latest: str, page: int = 1, limit: int = 500):
    offset = (page - 1) * limit
    result = get_historic_records_by_probe(serial, early=early, latest=latest, limit=limit, offset=offset)
    logger.info(f"Retrieved {len(result['data'])} records (page {page}) out of {result['total']} total for SERIAL: {serial}")
    return result


@app.get("/alarms/systems/{serial}/{early}/{latest}")
def get_alarm_systems(serial: str, early: str, latest: str, page: int = 1, limit: int = 100000, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    offset = (page - 1) * limit
    result = get_alarm_records_by_serial(serial, early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold, limit=limit, offset=offset)
    logger.info(f"Retrieved {len(result['data'])} alarm records (page {page}) out of {result['total']} total for SERIAL: {serial} with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
    return result

@app.get("/3skelion/alarms/systems/{serial}/{early}/{latest}")
def get_3skelion_alarm_systems(serial: str, early: str, latest: str,
                               rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    data = get_3skelion_alarm_records_by_serial(
        serial, early=early, latest=latest,
        rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold
    )
    return data

@app.get("/alarms/probes/{serial}/{early}/{latest}")
def get_alarm_probes(serial: str, early: str, latest: str, page: int = 1, limit: int = 100000, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    offset = (page - 1) * limit
    result = get_alarm_records_by_probe(serial, early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold, limit=limit, offset=offset)
    logger.info(f"Retrieved {len(result['data'])} alarm records (page {page}) out of {result['total']} total for SERIAL: {serial} with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
    return result

@app.get("/alarms/all/{early}/{latest}")
def get_all_alarm_systems(early: str, latest: str, page: int = 1, limit: int = 500, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    """Return paginated alarm records for all systems ordered by datetime."""
    offset = (page - 1) * limit
    result = get_all_alarm_records(early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold, limit=limit, offset=offset)
    logger.info(f"Retrieved {len(result['data'])} alarm records (page {page}) out of {result['total']} total for ALL SYSTEMS with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
    return result

@app.get("/alarms/probes/all/{early}/{latest}")
def get_all_alarm_probes(early: str, latest: str, page: int = 1, limit: int = 500, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    """Return paginated alarm records for all probes ordered by datetime."""
    offset = (page - 1) * limit
    result = get_all_alarm_probe_records(early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold, limit=limit, offset=offset)
    logger.info(f"Retrieved {len(result['data'])} alarm records (page {page}) out of {result['total']} total for ALL PROBES with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
    return result

@app.get("/alarms/statistics")
def get_alarm_statistics_endpoint(early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    """Return alarm statistics for all systems (total samples vs alarm samples)."""
    data = get_alarm_statistics(early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold)
    logger.info(f"Retrieved statistics for {len(data)} systems with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
    return data

@app.get("/3skelion/alarms/statistics")
def get_3skelion_alarm_statistics_endpoint(early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    """Return alarm statistics for 3skelion systems (total samples vs alarm samples)."""
    data = get_3skelion_alarm_statistics(early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold)
    logger.info(f"Retrieved statistics for {len(data)} 3skelion systems with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
    return data

@app.get("/playback/Historic/{serial}/earliest")
def get_early_datetime(serial: str):
    """Return earliest datetime for a given SERIAL from database."""
    return get_earliest_datetime_for_serial(serial)

@app.get("/playback/Historic/{serial}/{latest}")
def get_latest_datetime(serial: str, latest: str):
    """Return latest datetime for a given SERIAL from database."""
    return get_latest_datetime_for_serial(serial)


@app.get("/systems/Live/serials")
def list_live_serials_endpoint():
    """Return a list of all distinct SERIAL values."""
    serials = list_live_serials()
    logger.info(f"Returning {len(serials)} distinct serials")
    return serials

@app.get("/probes/Live/serials")
def list_live_probes_endpoint():
    """Return a list of all distinct SERIAL values for probes."""
    serials = list_live_probes()
    logger.info(f"Returning {len(serials)} distinct probes")
    return serials

@app.get("/systems/Live/names")
def list_live_names_endpoint():
    """Return a list of all distinct NAME values."""
    pairs = list_live_serial_name_pairs()
    return pairs

@app.get("/probes/Live/names")
def list_live_names_probes_endpoint():
    """Return a list of all distinct NAME values for probes."""
    pairs = list_live_probes_serial_name_pairs()
    return pairs

@app.get("/probes/playback/Historic/names")
def list_historic_names_probes_endpoint():
    """Return a list of all distinct NAME values for probes."""
    pairs = list_historic_probes_serial_name_pairs()
    return pairs

@app.get("/playback/Historic/serials")
def list_historic_serials_endpoint():
    """Return a list of all distinct SERIAL values."""
    serials = list_historic_serials()
    logger.info(f"Returning {len(serials)} distinct serials")
    return serials

@app.get("/probes/playback/Historic/serials")
def list_historic_probes_serials_endpoint():
    """Return a list of all distinct SERIAL values for probes."""
    serials = list_historic_probes()
    logger.info(f"Returning {len(serials)} distinct probes")
    return serials




@app.get("/")
def home(request: Request):
    """Render the home page."""
    return templates.TemplateResponse("home.html", {"request": request})


@app.get("/error")
def error_page(request: Request):
    """Render the error page with optional error details."""
    return templates.TemplateResponse("error.html", {"request": request})


@app.get("/4skelion/liveview")
def liveview_4skelion(request: Request):
    """Render the live view UI."""
    try:
        return templates.TemplateResponse("4skelion/liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/4skelion/detailed-liveview")
def detailed_liveview_4skelion(request: Request):
    """Render the detailed live view UI."""
    try:
        return templates.TemplateResponse("4skelion/detailed-liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/liveview")
def liveview_3skelion(request: Request):
    """Render the live view UI."""
    try:
        return templates.TemplateResponse("3skelion/liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/detailed-liveview")
def detailed_liveview_3skelion(request: Request):
    """Render the detailed live view UI."""
    try:
        return templates.TemplateResponse("3skelion/detailed-liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/liveview")
def liveview_f_qual(request: Request):
    """Render the live view UI."""
    try:
        return templates.TemplateResponse("f-qual/liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/detailed-liveview")
def detailed_liveview_f_qual(request: Request):
    """Render the detailed live view UI."""
    try:
        return templates.TemplateResponse("f-qual/detailed-liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/f-qual/dashboard")
def dashboard_f_qual(request: Request):
    """Render the dashboard UI."""
    try:
        return templates.TemplateResponse("f-qual/dashboard.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/coming_soon")
def coming_soon(request: Request):
    """Render the coming soon page."""
    return templates.TemplateResponse("coming_soon.html", {"request": request})


@app.get("/4skelion/alarms")
def alarms_4skelion(request: Request):
    try:
        return RedirectResponse(url="/4skelion/alarms/summary")
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/alarms")
def alarms_3skelion(request: Request):
    try:
        return RedirectResponse(url="/3skelion/alarms/summary")
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/alarms")
def alarms_f_qual(request: Request):
    try:
        return RedirectResponse(url="/f-qual/alarms/summary")
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/alarms/communication")
def communication_alarms_4skelion(request: Request):
    try:
        return templates.TemplateResponse("4skelion/communication_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/alarms/communication")
def communication_alarms_3skelion(request: Request):
    try:
        return templates.TemplateResponse("3skelion/communication_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/alarms/communication")
def communication_alarms_f_qual(request: Request):
    try:
        return templates.TemplateResponse("f-qual/communication_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/alarms/summary")
def total_alarms_4skelion(request: Request):
    try:
        return templates.TemplateResponse("4skelion/alarm_summary.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/alarms/summary")
def total_alarms_3skelion(request: Request):
    try:
        return templates.TemplateResponse("3skelion/alarm_summary.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/alarms/summary")
def total_alarms_f_qual(request: Request):
    try:
        return templates.TemplateResponse("f-qual/alarm_summary.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/alarms/performance")
def performance_alarms_4skelion(request: Request):
    try:
        return templates.TemplateResponse("4skelion/performance_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/alarms/performance")
def performance_alarms_3skelion(request: Request):
    try:
        return templates.TemplateResponse("3skelion/performance_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/alarms/performance")
def performance_alarms_f_qual(request: Request):
    try:
        return templates.TemplateResponse("f-qual/performance_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/playback")
def playback_4skelion(request: Request):
    """Render the playback UI."""
    try:
        return templates.TemplateResponse("4skelion/playback.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/3skelion/playback")
def playback_3skelion(request: Request):
    """Render the playback UI."""
    try:
        return templates.TemplateResponse("3skelion/playback.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/playback")
def playback_f_qual(request: Request):
    """Render the playback UI."""
    try:
        return templates.TemplateResponse("f-qual/playback.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/settings")
def settings_4skelion(request: Request):
    """Render the settings UI."""
    try:
        return templates.TemplateResponse("4skelion/settings.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/settings")
def settings_3skelion(request: Request):
    """Render the settings UI."""
    try:
        return templates.TemplateResponse("3skelion/settings.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/settings")
def settings_f_qual(request: Request):
    """Render the settings UI."""
    try:
        return templates.TemplateResponse("f-qual/settings.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/details")
def details_4skelion(request: Request):
    """Render the Historic Details UI"""
    try:
        return templates.TemplateResponse("4skelion/historic_details.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/details")
def details_3skelion(request: Request):
    """Render the Historic Details UI"""
    try:
        return templates.TemplateResponse("3skelion/historic_details.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/f-qual/details")
def details_f_qual(request: Request):
    """Render the Historic Details UI"""
    try:
        return templates.TemplateResponse("f-qual/historic_details.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/export/Live/{serial}")
def export_serial(serial: str):
    """Export records for a serial as CSV."""
    filename = f"{serial}.csv"
    csv_text = export_live_csv(serial)
    return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})


@app.get("/export/Historic/{serial}")
def export_historic_serial(serial: str):
    """Export records for a serial as CSV."""
    filename = f"{serial}.csv"
    csv_text = export_historic_csv(serial)
    return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})


@app.get("/systems/Live/locations")
def systems_locations():
    """Return list of {serial, latitude, longitude} for serials with coordinates."""
    return live_serials_with_locations()

@app.get("/playback/Historic/locations")
def playback_historic_locations():
    """Return list of {serial, latitude, longitude} for serials with coordinates."""
    return historic_serials_with_locations()

# =========================
# 3SKELION API (NewSheet_Last15Days$)
# =========================

@app.get("/3skelion/systems/Live/serials")
def list_3skelion_serials_endpoint():
    """Return 3skelion serial list from dbo.[NewSheet_Last15Days$]."""
    return list_3skelion_serials()


@app.get("/3skelion/systems/Live/names")
def list_3skelion_names_endpoint():
    """
    Return serial/name pairs.
    For now: NAME == SERIAL (until we confirm a real name column exists).
    """
    return list_3skelion_serial_name_pairs()


@app.get("/3skelion/Systems/Live/{serial}")
def get_3skelion_system(serial: str):
    """Return latest 3skelion record for SERIAL from dbo.[NewSheet_Last15Days$]."""
    return get_3skelion_live_records_by_serial(serial)


@app.get("/3skelion/systems/Live/locations")
def systems_locations_3skelion():
    """Return latest locations for map markers (3skelion)."""
    return live_3skelion_serials_with_locations()


@app.get("/3skelion/export/Live/{serial}")
def export_3skelion_serial(serial: str):
    filename = f"{serial}.csv"
    csv_text = export_3skelion_live_csv(serial)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
    )

# =========================
# 3SKELION - PLAYBACK API
# =========================

@app.get("/3skelion/playback/Historic/serials")
def list_3skelion_historic_serials_endpoint():
    return list_3skelion_playback_serials()

@app.get("/3skelion/playback/Historic/all/{early}/{latest}")
def get_all_3skelion_systems_paged(early: str, latest: str, page: int = 1, limit: int = 500):
    offset = (page - 1) * limit
    return get_all_3skelion_historic_records(early=early, latest=latest, limit=limit, offset=offset)

@app.get("/3skelion/playback/Historic/{serial}/{early}/{latest}")
def get_3skelion_historic_paged(serial: str, early: str, latest: str, page: int = 1, limit: int = 500):
    offset = (page - 1) * limit
    return get_3skelion_historic_records_by_serial(serial, early=early, latest=latest, limit=limit, offset=offset)


from typing import Optional  # αν δεν υπάρχει ήδη

@app.get("/3skelion/export/Historic/{serial}")
def export_3skelion_historic_serial(serial: str, startDate: Optional[str] = None, endDate: Optional[str] = None):
    filename = f"{serial}.csv"
    csv_text = export_3skelion_historic_csv(serial, start_date=startDate, end_date=endDate)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
    )
