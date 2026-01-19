# models.py
from sqlalchemy import Column, Integer, Float, String, DateTime
from database import Base

class Measurement(Base):
    __tablename__ = "Systems"

    id = Column(Integer, primary_key=True, index=True)
    SERIAL  = Column(String(255), unique=True, index=True)
    # rsrp = Column(Float)
    # sinr = Column(Float)
    LATITUDE = Column(Float)
    LONGITUDE = Column(Float)
    DATETIME = Column(DateTime)
    AZIMUTH = Column(Float)
    RSRP = Column(Float)
    SINR = Column(Float)
    TEMP = Column(Float)
