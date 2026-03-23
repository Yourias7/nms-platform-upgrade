from fastapi import FastAPI, Request, Response
import logging
from app.data_source import get_alarm_probes_statistics, get_alarm_records_by_probe, get_alarm_records_by_serial, get_all_alarm_probe_records, get_all_alarm_records, get_alarm_statistics, get_all_historic_probe_records, get_earliest_datetime_for_serial, get_historic_records_by_probe, get_latest_datetime_for_serial, get_historic_records_by_serial, get_all_historic_records, get_live_records_by_probe, get_live_records_by_serial, list_historic_probes, list_live_probes, list_live_probes_serial_name_pairs, list_live_serial_name_pairs, list_live_serials, list_historic_serials, export_live_csv, export_historic_csv, live_serials_with_locations, historic_serials_with_locations
from fastapi.responses import StreamingResponse, FileResponse, RedirectResponse
import io
import mimetypes
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

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

@app.get("/alarms/probes/statistics")
def get_alarm_statistics_probes_endpoint(early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    """Return alarm statistics for all probes (total samples vs alarm samples)."""
    data = get_alarm_probes_statistics(early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold)
    logger.info(f"Retrieved statistics for {len(data)} probes with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
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
def liveview(request: Request):
    """Render the live view UI."""
    try:
        return templates.TemplateResponse("4skelion/liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/liveview")
def liveview(request: Request):
    """Render the live view UI."""
    try:
        return templates.TemplateResponse("3skelion/liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/probes/liveview")
def liveview(request: Request):
    """Render the live view UI."""
    try:
        return templates.TemplateResponse("f-qual/liveview.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})



@app.get("/coming_soon")
def coming_soon(request: Request):
    """Render the coming soon page."""
    return templates.TemplateResponse("coming_soon.html", {"request": request})


@app.get("/4skelion/alarms")
def alarms(request: Request):
    try:
        return RedirectResponse(url="/4skelion/alarms/summary")
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/alarms")
def alarms(request: Request):
    try:
        return RedirectResponse(url="/3skelion/alarms/summary")
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/probes/alarms")
def alarms(request: Request):
    try:
        return RedirectResponse(url="/f-qual/alarms/summary")
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/alarms/communication")
def communication_alarms(request: Request):
    try:
        return templates.TemplateResponse("4skelion/communication_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/alarms/communication")
def communication_alarms(request: Request):
    try:
        return templates.TemplateResponse("3skelion/communication_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/probes/alarms/communication")
def communication_alarms(request: Request):
    try:
        return templates.TemplateResponse("f-qual/communication_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/alarms/summary")
def total_alarms(request: Request):
    try:
        return templates.TemplateResponse("4skelion/alarm_summary.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/alarms/summary")
def total_alarms(request: Request):
    try:
        return templates.TemplateResponse("3skelion/alarm_summary.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/probes/alarms/summary")
def total_alarms(request: Request):
    try:
        return templates.TemplateResponse("f-qual/alarm_summary.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/alarms/performance")
def performance_alarms(request: Request):
    try:
        return templates.TemplateResponse("4skelion/performance_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/alarms/performance")
def performance_alarms(request: Request):
    try:
        return templates.TemplateResponse("3skelion/performance_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/probes/alarms/performance")
def performance_alarms(request: Request):
    try:
        return templates.TemplateResponse("f-qual/performance_alarm.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/playback")
def playback(request: Request):
    """Render the playback UI."""
    try:
        return templates.TemplateResponse("4skelion/playback.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/3skelion/playback")
def playback(request: Request):
    """Render the playback UI."""
    try:
        return templates.TemplateResponse("3skelion/playback.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/probes/playback")
def playback(request: Request):
    """Render the playback UI."""
    try:
        return templates.TemplateResponse("f-qual/playback.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/settings")
def settings(request: Request):
    """Render the settings UI."""
    try:
        return templates.TemplateResponse("4skelion/settings.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/settings")
def settings(request: Request):
    """Render the settings UI."""
    try:
        return templates.TemplateResponse("3skelion/settings.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/probes/settings")
def settings(request: Request):
    """Render the settings UI."""
    try:
        return templates.TemplateResponse("f-qual/settings.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})

@app.get("/4skelion/details")
def details(request: Request):
    """Render the Historic Details UI"""
    try:
        return templates.TemplateResponse("4skelion/historic_details.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/3skelion/details")
def details(request: Request):
    """Render the Historic Details UI"""
    try:
        return templates.TemplateResponse("3skelion/historic_details.html", {"request": request})
    except Exception:
        return templates.TemplateResponse("coming_soon.html", {"request": request})
    
@app.get("/probes/details")
def details(request: Request):
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


