# models.py
from sqlalchemy import Column, Integer, Float, String, DateTime
from database import Base

class Measurement(Base):
    __tablename__ = "LiveSheet$"

    SERIAL = Column(String(255), primary_key=True, index=True)
    LATITUDE = Column(Float)
    LONGITUDE = Column(Float)
    DATETIME = Column(DateTime)
    HEADING = Column(Float)
    RSRP = Column(Float, name="BESTS.RSRP")
    SINR = Column(Float, name="BESTS.SNR")
    TEMP = Column(Float, name="BESTS.TEMP.")
