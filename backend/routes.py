
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from backend.extensions import db
from backend.models import Tracker, Telemetry, Alert


api = Blueprint("api", __name__, url_prefix="/api")


# =========================================================
# HEALTH
# =========================================================

@api.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "iot-safety-tracker"
    })


# =========================================================
# TRACKERS
# =========================================================

@api.route("/trackers", methods=["GET"])
def get_trackers():
    trackers = Tracker.query.order_by(Tracker.id.asc()).all()
    result = []

    for tracker in trackers:
        latest = (
            Telemetry.query
            .filter_by(device_id=tracker.device_id)
            .order_by(Telemetry.timestamp.desc())
            .first()
        )

        item = tracker.to_dict()

        if latest:
            item.update({
                "latitude": latest.latitude,
                "longitude": latest.longitude,
                "accuracy": latest.accuracy,
                "telemetry_battery": latest.battery,
                "accel_x": latest.accel_x,
                "accel_y": latest.accel_y,
                "accel_z": latest.accel_z,
                "sos": latest.sos,
                "gps_status": latest.gps_status,
                "wifi_status": latest.wifi_status,
                "telemetry_timestamp": latest.timestamp.isoformat()
            })
        else:
            item.update({
                "latitude": None,
                "longitude": None,
                "accuracy": None,
                "telemetry_battery": None,
                "accel_x": None,
                "accel_y": None,
                "accel_z": None,
                "sos": False,
                "telemetry_timestamp": None
            })

        result.append(item)

    return jsonify(result)


@api.route("/trackers", methods=["POST"])
def create_tracker():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must contain JSON data"}), 400

    device_id = str(data.get("device_id", "")).strip()
    name = str(data.get("name", "")).strip()

    if not device_id or not name:
        return jsonify({"error": "device_id and name are required"}), 400

    if Tracker.query.filter_by(device_id=device_id).first():
        return jsonify({
            "error": "Tracker with this device_id already exists"
        }), 409

    tracker = Tracker(
        device_id=device_id,
        name=name,
        assigned_person=data.get("assigned_person"),
        phone=data.get("phone"),
        status=data.get("status", "offline"),
        battery=data.get("battery", 0),
        gps_status=data.get("gps_status", "unknown"),
        wifi_status=data.get("wifi_status", "unknown")
    )

    db.session.add(tracker)
    db.session.commit()

    return jsonify(tracker.to_dict()), 201


@api.route("/trackers/<string:device_id>", methods=["GET"])
def get_tracker(device_id):
    tracker = Tracker.query.filter_by(device_id=device_id).first()

    if not tracker:
        return jsonify({"error": "Tracker not found"}), 404

    return jsonify(tracker.to_dict())


@api.route("/trackers/<string:device_id>", methods=["PUT"])
def update_tracker(device_id):
    tracker = Tracker.query.filter_by(device_id=device_id).first()

    if not tracker:
        return jsonify({"error": "Tracker not found"}), 404

    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must contain JSON data"}), 400

    if "name" in data:
        name = str(data["name"]).strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        tracker.name = name

    if "assigned_person" in data:
        tracker.assigned_person = data["assigned_person"]

    if "phone" in data:
        tracker.phone = data["phone"]

    if "status" in data:
        if data["status"] not in ("online", "offline"):
            return jsonify({"error": "Invalid tracker status"}), 400
        tracker.status = data["status"]

    if "battery" in data:
        try:
            battery = float(data["battery"])
        except (TypeError, ValueError):
            return jsonify({"error": "Battery must be a number"}), 400

        if not 0 <= battery <= 100:
            return jsonify({"error": "Battery must be between 0 and 100"}), 400

        tracker.battery = battery

    if "gps_status" in data:
        tracker.gps_status = data["gps_status"]

    if "wifi_status" in data:
        tracker.wifi_status = data["wifi_status"]

    tracker.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        "message": "Tracker updated successfully",
        "tracker": tracker.to_dict()
    })


@api.route("/trackers/<string:device_id>", methods=["DELETE"])
def delete_tracker(device_id):
    tracker = Tracker.query.filter_by(device_id=device_id).first()

    if not tracker:
        return jsonify({"error": "Tracker not found"}), 404

    Telemetry.query.filter_by(device_id=device_id).delete(
        synchronize_session=False
    )
    Alert.query.filter_by(device_id=device_id).delete(
        synchronize_session=False
    )

    db.session.delete(tracker)
    db.session.commit()

    return jsonify({
        "message": "Tracker deleted successfully",
        "device_id": device_id
    })


# =========================================================
# TELEMETRY
# =========================================================

@api.route("/telemetry", methods=["POST"])
def receive_telemetry():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must contain JSON data"}), 400

    device_id = str(data.get("device_id", "")).strip()

    if not device_id:
        return jsonify({"error": "Missing required field: device_id"}), 400

    tracker = Tracker.query.filter_by(device_id=device_id).first()

    if not tracker:
        return jsonify({"error": "Tracker not registered"}), 404

    # Validate optional numeric values.
    numeric_fields = (
        "latitude", "longitude", "accuracy", "battery",
        "accel_x", "accel_y", "accel_z"
    )
    values = {}

    for field in numeric_fields:
        value = data.get(field)

        if value is None:
            values[field] = None
            continue

        try:
            values[field] = float(value)
        except (TypeError, ValueError):
            return jsonify({
                "error": f"{field} must be a number or null"
            }), 400

    battery = values["battery"]
    if battery is not None and not 0 <= battery <= 100:
        return jsonify({
            "error": "Battery must be between 0 and 100"
        }), 400

    sos_triggered = data.get("sos", False) is True

    telemetry = Telemetry(
        device_id=device_id,
        latitude=values["latitude"],
        longitude=values["longitude"],
        accuracy=values["accuracy"],
        battery=battery,
        accel_x=values["accel_x"],
        accel_y=values["accel_y"],
        accel_z=values["accel_z"],
        sos=sos_triggered,
        gps_status=data.get("gps_status", "unknown"),
        wifi_status=data.get("wifi_status", "unknown")
    )

    db.session.add(telemetry)

    if battery is not None:
        tracker.battery = battery

    tracker.gps_status = data.get("gps_status", tracker.gps_status)
    tracker.wifi_status = data.get("wifi_status", tracker.wifi_status)
    tracker.status = "online"
    tracker.updated_at = datetime.now(timezone.utc)

    # Create an SOS alert only if one is not already active.
    if sos_triggered:
        existing_sos = Alert.query.filter_by(
            device_id=device_id,
            alert_type="SOS",
            status="active"
        ).first()

        if not existing_sos:
            db.session.add(Alert(
                device_id=device_id,
                alert_type="SOS",
                message="SOS button activated",
                latitude=values["latitude"],
                longitude=values["longitude"],
                status="active"
            ))

    db.session.commit()

    return jsonify({
        "message": "Telemetry received successfully",
        "telemetry": telemetry.to_dict()
    }), 201


@api.route("/telemetry/<string:device_id>", methods=["GET"])
def get_telemetry(device_id):
    records = (
        Telemetry.query
        .filter_by(device_id=device_id)
        .order_by(Telemetry.timestamp.desc())
        .all()
    )

    return jsonify([record.to_dict() for record in records])


# =========================================================
# ALERTS
# =========================================================

@api.route("/alerts", methods=["GET"])
def get_alerts():
    alerts = Alert.query.order_by(Alert.created_at.desc()).all()
    return jsonify([alert.to_dict() for alert in alerts])


@api.route("/alerts/<int:alert_id>/resolve", methods=["POST"])
def resolve_alert(alert_id):
    alert = db.session.get(Alert, alert_id)

    if not alert:
        return jsonify({"error": "Alert not found"}), 404

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        "message": "Alert resolved successfully",
        "alert": alert.to_dict()
    })