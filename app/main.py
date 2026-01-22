from fastapi import FastAPI, Depends, Request, Response
from sqlalchemy.orm import Session
import models
from deps import get_db
import logging
from data_source import list_serials as db_list_serials, get_records_by_serial, export_csv, serials_with_locations
from fastapi.responses import StreamingResponse, FileResponse
import io
import mimetypes

from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Ensure JavaScript files are served with correct MIME type
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/javascript', '.mjs')

logger = logging.getLogger("uvicorn")

app = FastAPI()

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/Systems/{serial}")
def get_system(serial: str):
    data = get_records_by_serial(serial)
    logger.info(f"Retrieved {len(data)} records for SERIAL: {serial}")
    return data


@app.get("/systems/serials")
def list_serials():
    """Return a list of all distinct SERIAL values."""
    serials = db_list_serials()
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
