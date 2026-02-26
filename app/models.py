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
    RSRQ= Column(Integer, name="BESTS.RSRQ")
    NODE_ID= Column(Integer, name="BESTS_NODEB_dec")
    SECTOR_ID= Column(Integer, name="SECTORID")


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
    S0RSRP = Column(Float, name="S0.RSRP")
    S0SINR = Column(Float, name="SECT0.SNR")
    S1RSRP = Column(Float, name="S1.RSRP")
    S1SINR = Column(Float, name="SECT1.SNR")
    S2RSRP = Column(Float, name="S2.RSRP")
    S2SINR = Column(Float, name="SECT2.SNR")
    S3RSRP = Column(Float, name="S3.RSRP")
    S3SINR = Column(Float, name="SECT3.SNR")
