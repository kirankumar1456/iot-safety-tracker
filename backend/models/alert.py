from datetime import datetime, timezone

from backend.extensions import db


class Alert(db.Model):
    __tablename__ = "alerts"

    id = db.Column(db.Integer, primary_key=True)

    device_id = db.Column(
        db.String(50),
        nullable=False,
        index=True
    )

    alert_type = db.Column(
        db.String(50),
        nullable=False
    )

    message = db.Column(
        db.String(255),
        nullable=False
    )

    latitude = db.Column(
        db.Float,
        nullable=True
    )

    longitude = db.Column(
        db.Float,
        nullable=True
    )

    status = db.Column(
        db.String(20),
        default="active",
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    resolved_at = db.Column(
        db.DateTime,
        nullable=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "device_id": self.device_id,
            "alert_type": self.alert_type,
            "message": self.message,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "resolved_at": (
                self.resolved_at.isoformat()
                if self.resolved_at
                else None
            )
        }