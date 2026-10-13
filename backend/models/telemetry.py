
from datetime import datetime, timezone

from backend.extensions import db


class Telemetry(db.Model):
    __tablename__ = "telemetry"

    id = db.Column(db.Integer, primary_key=True)

    device_id = db.Column(
        db.String(50),
        nullable=False,
        index=True
    )

    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    accuracy = db.Column(db.Float, nullable=True)
    battery = db.Column(db.Float, nullable=True)

    # MPU6050 accelerometer readings (in g)
    accel_x = db.Column(db.Float, nullable=True)
    accel_y = db.Column(db.Float, nullable=True)
    accel_z = db.Column(db.Float, nullable=True)

    sos = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    gps_status = db.Column(
        db.String(20),
        default="unknown",
        nullable=False
    )

    wifi_status = db.Column(
        db.String(20),
        default="unknown",
        nullable=False
    )

    timestamp = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "device_id": self.device_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "accuracy": self.accuracy,
            "battery": self.battery,
            "accel_x": self.accel_x,
            "accel_y": self.accel_y,
            "accel_z": self.accel_z,
            "sos": self.sos,
            "gps_status": self.gps_status,
            "wifi_status": self.wifi_status,
            "timestamp": self.timestamp.isoformat()
        }