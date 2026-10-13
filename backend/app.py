import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from backend.config import Config
from backend.extensions import db, socketio
from backend.routes import api

from backend.models import Tracker, Telemetry, Alert


# Project root directory
BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..")
)

FRONTEND_DIR = os.path.join(
    BASE_DIR,
    "frontend"
)


def create_app():

    app = Flask(
        __name__,
        static_folder=FRONTEND_DIR,
        static_url_path="/static"
    )

    app.config.from_object(Config)

    CORS(app)

    db.init_app(app)
    socketio.init_app(app)

    app.register_blueprint(api)
    app.register_blueprint(api, name="api_direct", url_prefix="")

    # ===============================
    # FRONTEND
    # ===============================

    @app.route("/")
    def dashboard():

        return send_from_directory(
            FRONTEND_DIR,
            "index.html"
        )

    # ===============================
    # DATABASE
    # ===============================

    with app.app_context():
        db.create_all()
        try:
            if Tracker.query.first() is None:
                default_tracker = Tracker(
                    device_id="TRACKER_02",
                    name="kiran's tracker",
                    assigned_person="Kiran",
                    phone="7207847791",
                    status="online",
                    battery=87.0,
                    gps_status="active",
                    wifi_status="connected"
                )
                db.session.add(default_tracker)
                db.session.add(Telemetry(
                    device_id="TRACKER_02",
                    latitude=22.288443,
                    longitude=73.363341,
                    accuracy=2.29,
                    battery=87.0,
                    accel_x=-0.031,
                    accel_y=0.189,
                    accel_z=0.965,
                    sos=False,
                    gps_status="active",
                    wifi_status="connected"
                ))
                db.session.commit()
        except Exception:
            db.session.rollback()

    return app