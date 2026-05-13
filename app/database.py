# database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "SWISSQUAL-SRV")
DB_NAME = os.getenv("DB_NAME", "3skelion2")
DB_USER = os.getenv("DB_USER", "sa")
DB_PASS = os.getenv("DB_PASS", "swissqual")
DB_PORT = os.getenv("DB_PORT", "1433")

# MSSQL connection string with ODBC 17 driver
DATABASE_URL = (
    f"mssql+pyodbc://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?driver=ODBC+Driver+13+for+SQL+Server"
)

# Create SQLAlchemy engine (with connection pooling)
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Second Database Connection
DB2_HOST = os.getenv("DB2_HOST", "SWISSQUAL-SRV")
DB2_NAME = os.getenv("DB2_NAME", "F-Qual")
DB2_USER = os.getenv("DB2_USER", "sa")
DB2_PASS = os.getenv("DB2_PASS", "swissqual")
DB2_PORT = os.getenv("DB2_PORT", "1433")

# MSSQL connection string for second database
DATABASE_URL_2 = (
    f"mssql+pyodbc://{DB2_USER}:{DB2_PASS}@{DB2_HOST}:{DB2_PORT}/{DB2_NAME}?driver=ODBC+Driver+13+for+SQL+Server"
)

# Create SQLAlchemy engine for second database
engine_2 = create_engine(
    DATABASE_URL_2,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)

SessionLocal_2 = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine_2
)

Base = declarative_base()


