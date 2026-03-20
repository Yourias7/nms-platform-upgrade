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
    SELECTED_ANTENNA = Column(Float, name="BESTS.SECT#")
    EARFCN = Column(Float, name="BESTS.EARFCN")
    BEST_CELLID = Column(String(255), name="BESTS.CID_dec")
    BEST_ENBID = Column(String(255), name="BESTS_NODEB_dec")
    BEST_SECID = Column(String(255), name="SECTORID")
    BEST_PCI = Column(String(255), name="BESTS.PCI")
    RSRQ = Column(Float, name="BESTS.RSRQ")
    S0EARFCN = Column(Float, name="S0.EARFCN")
    S0CELLID = Column(String(255), name="S0.CID_dec")
    S0ENBID = Column(String(255), name="S0.NODEB_dec")
    S0PCI = Column(String(255), name="S0.PCI")
    S0RSRQ = Column(Float, name="S0.RSRQ")
    S1EARFCN = Column(Float, name="S1.EARFCN")
    S1CELLID = Column(String(255), name="S1.CID_dec")
    S1ENBID = Column(String(255), name="S1.NODEB_dec")
    S1PCI = Column(String(255), name="S1.PCI")
    S1RSRQ = Column(Float, name="S1.RSRQ")
    S2EARFCN = Column(Float, name="S2.EARFCN")
    S2CELLID = Column(String(255), name="S2.CID_dec")
    S2ENBID = Column(String(255), name="S2.NODEB_dec")
    S2PCI = Column(String(255), name="S2.PCI")
    S2RSRQ = Column(Float, name="S2.RSRQ")
    S3EARFCN = Column(Float, name="S3.EARFCN")
    S3CELLID = Column(String(255), name="S3.CID_dec")
    S3ENBID = Column(String(255), name="S3.NODEB_dec")
    S3PCI = Column(String(255), name="S3.PCI")
    S3RSRQ = Column(Float, name="S3.RSRQ")