"""Dev helper: python -m app.reset_db  (drops every table; they are recreated on the next start)."""
from app import models  # noqa: F401
from app.database import Base, engine

Base.metadata.drop_all(bind=engine)
print("All tables dropped. Start the server to recreate and re-seed them.")
