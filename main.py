from fastapi import FastAPI, Depends, Request, Response
from sqlalchemy.orm import Session
import models
from deps import get_db
import logging
from data_source import has_excel, list_serials as excel_list_serials, get_records_by_serial, export_csv as excel_export_csv, serials_with_locations as excel_serials_with_locations
from fastapi.responses import StreamingResponse, FileResponse
import io
import csv
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
def get_system(serial: str, db: Session = Depends(get_db)):
    if has_excel():
        data = get_records_by_serial(serial)
        logger.info(f"(Excel) Retrieved {len(data)} records for SERIAL: {serial}")
        return data

    data = db.query(models.Measurement).filter(models.Measurement.SERIAL == serial).all()
    logger.info(f"(DB) Retrieved {len(data)} records for SERIAL: {serial}")
    return data


@app.get("/systems/serials")
def list_serials(db: Session = Depends(get_db)):
    """Return a list of all distinct SERIAL values."""
    if has_excel():
        serials = excel_list_serials()
        logger.info(f"(Excel) Returning {len(serials)} distinct serials")
        return serials

    rows = db.query(models.Measurement.SERIAL).distinct().all()
    # `rows` is a list of single-item tuples like [("ABC123",), ("DEF456",)]
    serials = [r[0] for r in rows]
    logger.info(f"(DB) Returning {len(serials)} distinct serials")
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
def export_serial(serial: str, db: Session = Depends(get_db)):
    """Export records for a serial as CSV. Prefers Excel if present."""
    filename = f"{serial}.csv"
    if has_excel():
        csv_text = excel_export_csv(serial)
        return Response(content=csv_text, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})

    # DB fallback: query and stream CSV
    rows = db.query(models.Measurement).filter(models.Measurement.SERIAL == serial).all()
    cols = [c.name for c in models.Measurement.__table__.columns]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(cols)
    for r in rows:
        writer.writerow([getattr(r, c) for c in cols])
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""})


@app.get("/systems/locations")
def systems_locations(db: Session = Depends(get_db)):
    """Return list of {serial, latitude, longitude} for serials with coordinates."""
    if has_excel():
        return excel_serials_with_locations()

    # DB fallback: query rows and compute latest per serial
    rows = db.query(models.Measurement.SERIAL, models.Measurement.latitude, models.Measurement.longitude, models.Measurement.timestamp).all()
    groups = {}
    for serial, lat, lon, ts in rows:
        if lat is None or lon is None:
            continue
        s = str(serial).strip()
        if s not in groups:
            groups[s] = (ts, lat, lon)
        else:
            prev_ts = groups[s][0]
            try:
                if ts and prev_ts and ts > prev_ts:
                    groups[s] = (ts, lat, lon)
            except Exception:
                pass
    results = []
    for s, (_, lat, lon) in groups.items():
        try:
            results.append({"serial": s, "latitude": float(lat), "longitude": float(lon)})
        except Exception:
            continue
    return results
