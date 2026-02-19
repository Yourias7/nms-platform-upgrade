from fastapi import FastAPI, Request, Response
import logging
from app.data_source import get_historic_records_by_serial, get_live_records_by_serial, list_live_serial_name_pairs, list_live_serials, list_historic_serials, export_live_csv, export_historic_csv, live_serials_with_locations, historic_serials_with_locations
from fastapi.responses import StreamingResponse, FileResponse
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

@app.get("/Systems/Historic/{serial}")
def get_system(serial: str):
    data = get_historic_records_by_serial(serial)
    logger.info(f"Retrieved {len(data)} records for SERIAL: {serial}")
    return data


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

@app.get("/systems/Historic/serials")
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
    return RedirectResponse(url="/alarms/communication")

@app.get("/alarms/communication")
def communication_alarms(request: Request):
    return templates.TemplateResponse("communication_alarm.html", {"request": request})

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

@app.get("/systems/Historic/locations")
def systems_locations():
    """Return list of {serial, latitude, longitude} for serials with coordinates."""
    return historic_serials_with_locations()

from fastapi.responses import RedirectResponse




