from fastapi import FastAPI, Request, Response
import logging
from app.data_source import get_alarm_records_by_serial, get_alarm_statistics, get_earliest_datetime_for_serial, get_latest_datetime_for_serial, get_historic_records_by_serial, get_live_records_by_serial, list_live_serial_name_pairs, list_live_serials, list_historic_serials, export_live_csv, export_historic_csv, live_serials_with_locations, historic_serials_with_locations
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

@app.get("/playback/Historic/{serial}/{early}/{latest}")
def get_system(serial: str, early: str, latest: str):
    data = get_historic_records_by_serial(serial, early=early, latest=latest)
    logger.info(f"Retrieved {len(data)} records for SERIAL: {serial}")
    return data

@app.get("/alarms/systems/{serial}/{early}/{latest}")
def get_alarm_systems(serial: str, early: str, latest: str, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    data = get_alarm_records_by_serial(serial, early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold)
    logger.info(f"Retrieved {len(data)} alarm records for SERIAL: {serial} with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
    return data

@app.get("/alarms/statistics")
def get_alarm_statistics_endpoint(early: str = None, latest: str = None, rsrp_threshold: float = -120, sinr_threshold: float = 0, temp_threshold: float = 75):
    """Return alarm statistics for all systems (total samples vs alarm samples)."""
    data = get_alarm_statistics(early=early, latest=latest, rsrp_threshold=rsrp_threshold, sinr_threshold=sinr_threshold, temp_threshold=temp_threshold)
    logger.info(f"Retrieved statistics for {len(data)} systems with thresholds RSRP<={rsrp_threshold}, SINR<={sinr_threshold}, TEMP>={temp_threshold}")
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

@app.get("/systems/Live/names")
def list_live_names_endpoint():
    """Return a list of all distinct NAME values."""
    pairs = list_live_serial_name_pairs()
    return pairs

@app.get("/playback/Historic/serials")
def list_historic_serials_endpoint():
    """Return a list of all distinct SERIAL values."""
    serials = list_historic_serials()
    logger.info(f"Returning {len(serials)} distinct serials")
    return serials



@app.get("/")
def home(request: Request):
    """Render the home page."""
    return templates.TemplateResponse("home.html", {"request": request})


@app.get("/liveview")
def liveview(request: Request):
    """Render the live view UI."""
    return templates.TemplateResponse("liveview.html", {"request": request})


@app.get("/alarms")
def alarms(request: Request):
    return RedirectResponse(url="/alarms/summary")

@app.get("/alarms/communication")
def communication_alarms(request: Request):
    return templates.TemplateResponse("communication_alarm.html", {"request": request})

@app.get("/alarms/summary")
def total_alarms(request: Request):
    return templates.TemplateResponse("alarm_summary.html", {"request": request})

@app.get("/alarms/performance")
def performance_alarms(request: Request):
    return templates.TemplateResponse("performance_alarm.html", {"request": request})

@app.get("/playback")
def playback(request: Request):
    """Render the playback UI."""
    return templates.TemplateResponse("playback.html", {"request": request})

@app.get("/settings")
def settings(request: Request):
    """Render the settings UI."""
    return templates.TemplateResponse("settings.html", {"request": request})

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


