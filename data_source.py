from pathlib import Path
import logging

logger = logging.getLogger(__name__)

_df = None


def _excel_path():
    return Path(__file__).parent / "data.xlsx"


def has_excel() -> bool:
    return _excel_path().exists()


def _load_df():
    global _df
    if _df is not None:
        return _df

    path = _excel_path()
    if not path.exists():
        raise FileNotFoundError(f"Excel data file not found at {path}")

    try:
        import pandas as pd
    except Exception as e:
        raise RuntimeError("pandas (and openpyxl) are required to read Excel data. Install via 'pip install pandas openpyxl'") from e

    # Read Excel file - openpyxl engine is better at preserving datetime values
    df = pd.read_excel(path, engine='openpyxl')
    # Normalize column names to match models: ensure 'SERIAL' column exists
    df.columns = [c.strip() for c in df.columns]
    
    # Ensure DATETIME column is parsed correctly if it exists
    datetime_cols = [col for col in df.columns if col.upper() in ['DATETIME', 'TIMESTAMP', 'TIME']]
    for col in datetime_cols:
        try:
            df[col] = pd.to_datetime(df[col], errors='coerce')
        except Exception as e:
            logger.warning(f"Could not parse {col} as datetime: {e}")
    
    _df = df
    logger.info(f"Loaded {len(df)} rows from {path}")
    return _df


def list_serials():
    df = _load_df()
    if "SERIAL" not in df.columns:
        raise RuntimeError("Excel file must contain a 'SERIAL' column")
    # Return unique SERIAL values as strings (preserve original casing)
    vals = df["SERIAL"].dropna().astype(str)
    # strip whitespace
    vals = vals.str.strip()
    return vals.unique().tolist()


def get_records_by_serial(serial: str):
    df = _load_df()
    if "SERIAL" not in df.columns:
        raise RuntimeError("Excel file must contain a 'SERIAL' column")
    # Case-insensitive match and trim whitespace
    ser = str(serial).strip().lower()
    rows = df[df["SERIAL"].astype(str).str.strip().str.lower() == ser]
    # Convert rows to list of dicts, handling datetimes and NaNs
    result = []
    for _, r in rows.iterrows():
        rec = {}
        for col, val in r.items():
            if hasattr(val, "isoformat"):
                try:
                    rec[col] = val.isoformat().replace('T', ' ')
                    continue
                except Exception:
                    pass
            # pandas NaN -> None
            if val != val:  # NaN check
                rec[col] = None
            else:
                rec[col] = val
        result.append(rec)
    return result


def serials_with_locations():
    """Return list of dicts {serial, latitude, longitude} for rows with coordinates.
    For each SERIAL, pick the most recent row if a 'timestamp' column exists, otherwise pick first with coords.
    """
    df = _load_df()
    if "SERIAL" not in df.columns:
        raise RuntimeError("Excel file must contain a 'SERIAL' column")

    # Normalize column names to lowercase mapping to original
    cols_lower = {c.lower(): c for c in df.columns}
    lat_col = cols_lower.get("latitude") or cols_lower.get("lat")
    lon_col = cols_lower.get("longitude") or cols_lower.get("lon")
    ts_col = cols_lower.get("timestamp") or cols_lower.get("time")

    if not lat_col or not lon_col:
        # No location data available
        return []

    # Trim serials and lowercase for grouping
    df["_SERIAL_norm"] = df["SERIAL"].astype(str).str.strip()
    # If timestamp exists, convert to datetime for sorting
    if ts_col:
        try:
            df["_ts"] = df[ts_col]
        except Exception:
            df["_ts"] = None
    else:
        df["_ts"] = None

    groups = {}
    for _, r in df.iterrows():
        s = r["_SERIAL_norm"]
        lat = r[lat_col]
        lon = r[lon_col]
        ts = r.get("_ts")
        # skip if lat/lon are NaN or None
        if lat != lat or lon != lon:
            continue
        if s not in groups:
            groups[s] = (ts, lat, lon)
        else:
            # prefer newer timestamp when available
            prev_ts = groups[s][0]
            if ts is not None and prev_ts is not None:
                try:
                    if ts > prev_ts:
                        groups[s] = (ts, lat, lon)
                except Exception:
                    pass
    results = []
    for s, (_, lat, lon) in groups.items():
        try:
            latf = float(lat)
            lonf = float(lon)
            results.append({"serial": s, "latitude": latf, "longitude": lonf})
        except Exception:
            continue
    return results


def export_csv(serial: str) -> str:
    """Return CSV string for the given serial (Excel-backed)."""
    df = _load_df()
    if "SERIAL" not in df.columns:
        raise RuntimeError("Excel file must contain a 'SERIAL' column")
    ser = str(serial).strip().lower()
    rows = df[df["SERIAL"].astype(str).str.strip().str.lower() == ser]
    # Use pandas to produce CSV
    try:
        csv_str = rows.to_csv(index=False)
    except Exception:
        # Fallback: build CSV manually
        import io, csv
        output = io.StringIO()
        writer = csv.writer(output)
        cols = list(rows.columns)
        writer.writerow(cols)
        for _, r in rows.iterrows():
            writer.writerow([r[c] for c in cols])
        csv_str = output.getvalue()
    return csv_str
