from pathlib import Path
import logging
import csv
import io
import pandas as pd

logger = logging.getLogger(__name__)

_df = None
_df = None


def _excel_path():
    """Return path to the Excel data file."""
    return Path(__file__).parent / "data.xlsx"


def _load_df():
    """Load and cache the Excel DataFrame."""
    global _df
    if _df is not None:
        return _df

    path = _excel_path()
    if not path.exists():
        raise FileNotFoundError(f"Excel data file not found at {path}")

    # try:
    #     import pandas as pd
    # except Exception as e:
    #     raise RuntimeError("pandas (and openpyxl) are required to read Excel data. Install via 'pip install pandas openpyxl'") from e

    _df = pd.read_excel(path, engine='openpyxl')
    logger.info(f"Loaded {len(_df)} rows from {path}")
    return _df


def list_serials():
    """Return list of all distinct SERIAL values from Excel."""
    df = _load_df()
    serials = df["SERIAL"].dropna().unique().tolist()
    logger.info(f"Retrieved {len(serials)} distinct serials from Excel")
    return serials


def get_records_by_serial(serial: str):
    """Return list of measurement records for a given SERIAL from Excel."""
    df = _load_df()
    ser = str(serial).strip()
    rows = df[df["SERIAL"] == ser]
    
    # Convert DataFrame to list of dicts
    result = []
    for _, row in rows.iterrows():
        # Handle DATETIME - could be string or datetime object
        datetime_val = row.get("DATETIME")
        if pd.notna(datetime_val):
            if hasattr(datetime_val, 'isoformat'):
                datetime_val = datetime_val.isoformat()
            else:
                datetime_val = str(datetime_val)
        else:
            datetime_val = None
        
        rec = {
            "SERIAL": row.get("SERIAL"),
            "LATITUDE": row.get("LATITUDE"),
            "LONGITUDE": row.get("LONGITUDE"),
            "DATETIME": datetime_val,
            "HEADING": row.get("AZIMUTH") if "AZIMUTH" in row else row.get("HEADING"),
            "RSRP": row.get("RSRP"),
            "SINR": row.get("SINR"),
            "TEMP": row.get("TEMP"),
        }
        result.append(rec)
    
    logger.info(f"Retrieved {len(result)} records for SERIAL: {ser} from Excel")
    return result


def serials_with_locations():
    """Return list of dicts {serial, latitude, longitude} for rows with valid coordinates from Excel."""
    df = _load_df()
    
    # Filter rows with valid coordinates
    df_valid = df.dropna(subset=["SERIAL", "LATITUDE", "LONGITUDE"])
    df_valid = df_valid[(df_valid["LATITUDE"] != 0) | (df_valid["LONGITUDE"] != 0)]
    
    # Group by serial, keep the most recent record
    if "DATETIME" in df_valid.columns:
        df_valid = df_valid.sort_values("DATETIME", ascending=False)
    
    df_grouped = df_valid.groupby("SERIAL").first().reset_index()
    
    # Convert to result format
    results = []
    for _, row in df_grouped.iterrows():
        try:
            results.append({
                "serial": row["SERIAL"],
                "latitude": float(row["LATITUDE"]),
                "longitude": float(row["LONGITUDE"])
            })
        except (TypeError, ValueError):
            continue
    
    logger.info(f"Retrieved {len(results)} serials with locations from Excel")
    return results


def export_csv(serial: str) -> str:
    """Return CSV string for the given serial from Excel."""
    df = _load_df()
    ser = str(serial).strip()
    rows = df[df["SERIAL"] == ser]
    
    # Build CSV output
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    headers = ["SERIAL", "LATITUDE", "LONGITUDE", "DATETIME", "HEADING", "RSRP", "SINR", "TEMP"]
    writer.writerow(headers)
    
    # Write data rows
    for _, row in rows.iterrows():
        heading = row.get("AZIMUTH") if "AZIMUTH" in row else row.get("HEADING")
        
        # Handle DATETIME - could be string or datetime object
        datetime_val = row.get("DATETIME")
        if pd.notna(datetime_val):
            if hasattr(datetime_val, 'isoformat'):
                datetime_val = datetime_val.isoformat()
            else:
                datetime_val = str(datetime_val)
        else:
            datetime_val = ""
        
        writer.writerow([
            row.get("SERIAL"),
            row.get("LATITUDE"),
            row.get("LONGITUDE"),
            datetime_val,
            heading,
            row.get("RSRP"),
            row.get("SINR"),
            row.get("TEMP"),
        ])
    
    return output.getvalue()
