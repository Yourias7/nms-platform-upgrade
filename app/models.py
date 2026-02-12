# models.py
from sqlalchemy import Column, Integer, Float, String, DateTime
from .database import Base

# Live Measurement Model
class LiveMeasurement(Base):
    __tablename__ = "LiveSheet$"

    SERIAL = Column(String(255), primary_key=True, index=True)
    NAME = Column(String(255))
    LATITUDE = Column(Float)
    LONGITUDE = Column(Float)
    DATETIME = Column(DateTime)
    HEADING = Column(Float)
    RSRP = Column(Float, name="BESTS.RSRP")
    SINR = Column(Float, name="BESTS.SNR")
    TEMP = Column(Float, name="BESTS.TEMP.")
    EARFCN = Column(Integer, name="BESTS.EARFCN")
    PCI = Column(Integer, name="BESTS.PCI")
    A_USED= Column(Integer, name="BESTS.SECT#")
    CID= Column(Integer, name="BESTS.CID_dec")


############################# SAMPLE OF ANOTHER MODEL #############################

# class CellInfo(Base):
#     __tablename__ = "CellInfo$"

#     SERIAL = Column(String(255), primary_key=True, index=True)
#     PCI = Column(Integer)
#     EARFCN = Column(Integer)
#     TAC = Column(Integer)
#     CI = Column(Integer)
#     BAND = Column(String(50))
#     MCC = Column(Integer)
#     MNC = Column(Integer)

# Historic Measurement Model
class HistoricMeasurement(Base):
    __tablename__ = "HistoricNewConfiguration$"

    SERIAL = Column(String(255), primary_key=True, index=True)
    NAME = Column(String(255))
    LATITUDE = Column(Float)
    LONGITUDE = Column(Float)
    DATETIME = Column(DateTime)
    HEADING = Column(Float)
    RSRP = Column(Float, name="BESTS.RSRP")
    SINR = Column(Float, name="BESTS.SNR")
    TEMP = Column(Float, name="BESTS.TEMP.")
    