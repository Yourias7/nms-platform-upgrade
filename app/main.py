from fastapi import FastAPI, Request, Response
import logging
from app.data_source import list_serials, get_records_by_serial, export_csv, serials_with_locations
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


@app.get("/Systems/{serial}")
def get_system(serial: str):
    data = get_records_by_serial(serial)
    logger.info(f"Retrieved {len(data)} records for SERIAL: {serial}")
    return data


@app.get("/systems/serials")
def list_serials_endpoint():
    """Return a list of all distinct SERIAL values."""
    serials = list_serials()
    logger.info(f"Returning {len(serials)} distinct serials")
    return serials


@app.get("/")
def home(request: Request):
    """Render the home page."""
    return templates.TemplateResponse("home.html", {"request": request})


@app.get("/dashboard")
def dashboard(request: Request):
    """Render the dashboard UI."""
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.get("/alarms")
def alarms(request: Request):
    """Render the alarms page."""
    return templates.TemplateResponse("alarms.html", {"request": request})


@app.get("/settings")
def settings(request: Request):
    """Render the settings page."""
    return templates.TemplateResponse("settings.html", {"request": request})


@app.get("/export/{serial}")
def export_serial(serial: str):
    """Export records for a serial as CSV."""
    filename = f"{serial}.csv"
    csv_text = export_csv(serial)
    return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})


@app.get("/systems/locations")
def systems_locations():
    """Return list of {serial, latitude, longitude} for serials with coordinates."""
    return serials_with_locations()
