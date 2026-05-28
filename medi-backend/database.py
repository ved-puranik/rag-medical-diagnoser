import os
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# All persistent runtime data lives under ./data/ so a single volume mount
# covers both the SQLite file and the RAG vector store directory.
os.makedirs("./data", exist_ok=True)
DATABASE_URL = "sqlite:///./data/medi_scribe.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ClinicalSession(Base):
    __tablename__ = "clinical_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=datetime.utcnow)
    raw_transcript = Column(Text)
    redacted_transcript = Column(Text)
    soap_note = Column(Text)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
