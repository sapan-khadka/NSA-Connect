from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, Integer, String, Text

from app.core.embedding import EMBEDDING_DIMENSION
from app.models.base import Base


class ConstitutionalChunk(Base):
    __tablename__ = "constitutional_chunks"

    id = Column(Integer, primary_key=True, index=True)
    section = Column(String(255), nullable=True)
    chunk_index = Column(Integer, nullable=False, default=0)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(EMBEDDING_DIMENSION), nullable=False)
