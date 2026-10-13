import os
import shutil


BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)

DATABASE_PATH = os.path.join(
    BASE_DIR,
    "database",
    "tracker.db"
)

# On Vercel (or any serverless environment where root is read-only),
# store SQLite database in /tmp or use external DATABASE_URL if configured.
if os.getenv("VERCEL"):
    tmp_db_dir = "/tmp/database"
    os.makedirs(tmp_db_dir, exist_ok=True)
    tmp_db = os.path.join(tmp_db_dir, "tracker.db")
    if not os.path.exists(tmp_db) and os.path.exists(DATABASE_PATH):
        try:
            shutil.copyfile(DATABASE_PATH, tmp_db)
        except Exception:
            pass
    default_db_uri = f"sqlite:///{tmp_db}"
else:
    default_db_uri = f"sqlite:///{DATABASE_PATH}"

database_url = os.getenv("DATABASE_URL", default_db_uri)
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)


class Config:
    SECRET_KEY = os.getenv(
        "SECRET_KEY",
        "development-secret-key"
    )

    SQLALCHEMY_DATABASE_URI = database_url

    SQLALCHEMY_TRACK_MODIFICATIONS = False