from datetime import datetime, timezone

from backend.extensions import db


class Tracker(db.Model):
    __tablename__ = "trackers"

    id = db.Column(db.Integer, primary_key=True)

    device_id = db.Column(
        db.String(50),
        unique=True,
        nullable=False,
        index=True
    )

    name = db.Column(
        db.String(100),
        nullable=False
    )

    assigned_person = db.Column(
        db.String(100),
        nullable=True
    )

    phone = db.Column(
        db.String(20),
        nullable=True
    )

    status = db.Column(
        db.String(20),
        default="offline",
        nullable=False
    )

    battery = db.Column(
        db.Float,
        default=0,
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

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "device_id": self.device_id,
            "name": self.name,
            "assigned_person": self.assigned_person,
            "phone": self.phone,
            "status": self.status,
            "battery": self.battery,
            "gps_status": self.gps_status,
            "wifi_status": self.wifi_status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }