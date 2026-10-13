// ======================================================
// IoT SAFETY TRACKER - FRONTEND APPLICATION
// ======================================================

const API_BASE = "/api";

let map = null;
let fullMap = null;

let markers = {};
let fullMapMarkers = {};
let lastLoadedTrackers = [];


// ======================================================
// UTILITY
// ======================================================

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ======================================================
// MAP CONFIGURATION
// ======================================================

const DEFAULT_MAP_CENTER = [22.3072, 73.1812];
const DEFAULT_MAP_ZOOM = 13;


// ======================================================
// CREATE TRACKER ICON
// ======================================================

function createTrackerIcon(tracker) {

    const status =
        String(tracker.status || "offline").toLowerCase();

    const isOnline = status === "online";

    const battery =
        Number(tracker.battery);

    let batteryClass = "battery-normal";

    if (!Number.isNaN(battery)) {

        if (battery <= 20) {
            batteryClass = "battery-low";
        } else if (battery <= 50) {
            batteryClass = "battery-medium";
        }
    }

    const html = `
        <div class="tracker-map-marker
            ${isOnline ? "tracker-online" : "tracker-offline"}
            ${batteryClass}">

            <div class="tracker-marker-pulse"></div>

            <div class="tracker-marker-core">
                🛡
            </div>

        </div>
    `;

    return L.divIcon({

        className: "custom-tracker-icon",

        html: html,

        iconSize: [46, 46],

        iconAnchor: [23, 23],

        popupAnchor: [0, -23]

    });
}


// ======================================================
// DASHBOARD MAP
// ======================================================

function initializeMap() {

    const mapElement =
        document.getElementById("map");

    if (!mapElement) {
        return;
    }

    if (map) {

        setTimeout(() => {

            map.invalidateSize();

        }, 100);

        return;
    }

    map = L.map("map", {

        zoomControl: true,

        attributionControl: true

    }).setView(

        DEFAULT_MAP_CENTER,

        DEFAULT_MAP_ZOOM

    );

    L.tileLayer(

        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            maxZoom: 19,

            attribution:
                "&copy; OpenStreetMap contributors"

        }

    ).addTo(map);
}


// ======================================================
// FULL LIVE MAP
// ======================================================

function initializeFullMap() {

    const mapElement =
        document.getElementById("full-map");

    if (!mapElement) {
        return;
    }

    if (fullMap) {

        setTimeout(() => {

            fullMap.invalidateSize();

        }, 100);

        return;
    }

    fullMap = L.map("full-map", {

        zoomControl: true,

        attributionControl: true

    }).setView(

        DEFAULT_MAP_CENTER,

        DEFAULT_MAP_ZOOM

    );

    L.tileLayer(

        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            maxZoom: 19,

            attribution:
                "&copy; OpenStreetMap contributors"

        }

    ).addTo(fullMap);
}


// ======================================================
// LOAD TRACKERS
// ======================================================

async function loadTrackers() {

    try {

        const response =
            await fetch(`${API_BASE}/trackers`);

        if (!response.ok) {

            throw new Error(
                "Failed to load trackers"
            );
        }

        const trackers =
            await response.json();

        lastLoadedTrackers = Array.isArray(trackers) ? trackers : [];

        updateDashboardStats(trackers);

        // Dashboard-only tracker status panel.
        displayDashboardTrackers(trackers);

        displayTrackerManagement(trackers);
        populateTelemetrySimulator(trackers);

        // Make sure the dashboard map exists before drawing markers.
        if (document.getElementById("map") && !map) {
            initializeMap();
        }

        updateDashboardMap(trackers);

        // Keep the dashboard map focused on the latest tracker location(s).
        if (map) {
            const validDashboardTrackers = getValidTrackers(trackers);
            if (validDashboardTrackers.length === 1) {
                map.setView(
                    [
                        Number(validDashboardTrackers[0].latitude),
                        Number(validDashboardTrackers[0].longitude)
                    ],
                    16,
                    { animate: false }
                );
            } else if (validDashboardTrackers.length > 1) {
                const bounds = L.latLngBounds(
                    validDashboardTrackers.map(tracker => [
                        Number(tracker.latitude),
                        Number(tracker.longitude)
                    ])
                );
                map.fitBounds(bounds, {
                    padding: [30, 30],
                    maxZoom: 16,
                    animate: false
                });
            }
            map.invalidateSize(true);
        }

        updateFullMap(trackers);

    } catch (error) {

        console.error(
            "Tracker loading error:",
            error
        );
    }
}


// ======================================================
// DASHBOARD STATISTICS
// ======================================================

function updateDashboardStats(trackers) {

    if (!Array.isArray(trackers)) {
        return;
    }

    const total =
        trackers.length;

    const online =
        trackers.filter(
            tracker =>
                tracker.status &&
                tracker.status.toLowerCase() === "online"
        ).length;

    const batteries =
        trackers

            .map(
                tracker =>
                    Number(tracker.battery)
            )

            .filter(
                value =>
                    !Number.isNaN(value)
            );

    let averageBattery = 0;

    if (batteries.length > 0) {

        averageBattery =
            batteries.reduce(
                (sum, value) =>
                    sum + value,
                0
            ) / batteries.length;
    }

    const totalElement =
        document.getElementById(
            "total-trackers"
        );

    const onlineElement =
        document.getElementById(
            "online-trackers"
        );

    const batteryElement =
        document.getElementById(
            "average-battery"
        );

    if (totalElement) {

        totalElement.textContent =
            total;
    }

    if (onlineElement) {

        onlineElement.textContent =
            online;
    }

    if (batteryElement) {

        batteryElement.textContent =
            `${Math.round(averageBattery)}%`;
    }
}


// ======================================================
// DASHBOARD - TRACKER STATUS
// ======================================================

function displayDashboardTrackers(trackers) {
    const container = document.getElementById("tracker-list");
    if (!container) return;

    if (!Array.isArray(trackers) || trackers.length === 0) {
        container.innerHTML = `
            <div class="tracker-empty-state">
                <div class="tracker-empty-icon">⌁</div>
                <strong>No tracker connected</strong>
                <span>Add a tracker to start monitoring live safety data.</span>
                <button type="button" class="tracker-action-button secondary" data-tracker-action="refresh">
                    <span aria-hidden="true">↻</span> Refresh
                </button>
            </div>`;
        wireDashboardTrackerActions(container);
        return;
    }

    container.innerHTML = trackers.map(tracker => {
        const name = tracker.name || tracker.device_id || "Unnamed tracker";
        const deviceId = tracker.device_id || "Unknown device";
        const status = String(tracker.status || "offline").toLowerCase();
        const online = status === "online";
        const statusLabel = online ? "Online" : "Offline";
        const person = tracker.assigned_person || "Not assigned";
        const gpsRaw = String(tracker.gps_status || "unknown").toLowerCase();
        const gpsActive = gpsRaw === "active";
        const wifiRaw = String(tracker.wifi_status || "unknown").toLowerCase();
        const wifiConnected = wifiRaw === "connected";
        const sosActive = tracker.sos === true || tracker.sos === 1 || String(tracker.sos).toLowerCase() === "true";

        // Prefer the most recent telemetry battery. If the API explicitly
        // reports null, do not display an old tracker-table value as live.
        const batteryValue = Object.prototype.hasOwnProperty.call(tracker, "telemetry_battery")
            ? tracker.telemetry_battery
            : tracker.battery;
        const batteryKnown = batteryValue !== null && batteryValue !== undefined && batteryValue !== "" && Number.isFinite(Number(batteryValue));
        const battery = batteryKnown ? Math.max(0, Math.min(100, Number(batteryValue))) : null;
        const batteryClass = battery === null ? "unknown" : battery <= 15 ? "critical" : battery <= 30 ? "warning" : "good";

        const lat = tracker.latitude;
        const lng = tracker.longitude;
        const hasLocation = lat !== null && lat !== undefined && lng !== null && lng !== undefined && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
        const latitude = hasLocation ? Number(lat).toFixed(5) : null;
        const longitude = hasLocation ? Number(lng).toFixed(5) : null;
        const telemetryTime = tracker.telemetry_timestamp || tracker.updated_at || null;
        const formattedTime = telemetryTime ? (() => {
            const d = new Date(telemetryTime);
            return Number.isNaN(d.getTime()) ? "Time unavailable" : d.toLocaleTimeString("en-IN", {hour: "2-digit", minute: "2-digit", second: "2-digit"});
        })() : "Waiting for telemetry";

        const ax = Number(tracker.accel_x);
        const ay = Number(tracker.accel_y);
        const az = Number(tracker.accel_z);
        const hasMotion = [tracker.accel_x, tracker.accel_y, tracker.accel_z].every(v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)));
        const magnitude = hasMotion ? Math.sqrt(ax * ax + ay * ay + az * az) : null;
        const motionLabel = magnitude === null ? "No sensor data" : Math.abs(magnitude - 1) > 0.18 ? "Moving" : "Mostly still";
        const motionClass = magnitude === null ? "unknown" : motionLabel === "Moving" ? "moving" : "still";

        return `
            <article class="dashboard-tracker-card modern-tracker-card ${online ? "is-online" : "is-offline"}" data-device-id="${escapeHtml(deviceId)}">
                <div class="dtc-top-glow" aria-hidden="true"></div>
                <div class="dtc-header">
                    <div class="dtc-identity">
                        <div class="dtc-avatar" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2.8 19 5.6v5.8c0 4.5-2.8 7.7-7 9.8-4.2-2.1-7-5.3-7-9.8V5.6L12 2.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <div class="dtc-title-wrap">
                            <div class="dtc-eyebrow">SAFETY DEVICE</div>
                            <h3>${escapeHtml(name)}</h3>
                            <span class="dtc-device-id"><span class="dtc-device-dot"></span>${escapeHtml(deviceId)}</span>
                        </div>
                    </div>
                    <span class="dtc-status ${online ? "online" : "offline"}"><i></i>${statusLabel}</span>
                </div>

                <div class="dtc-owner-row">
                    <div class="dtc-owner-icon" aria-hidden="true">♙</div>
                    <div class="dtc-owner-copy"><span>Assigned to</span><strong>${escapeHtml(person)}</strong></div>
                    <div class="dtc-updated"><span class="dtc-live-pip"></span><span>${escapeHtml(formattedTime)}</span></div>
                </div>

                <div class="dtc-battery-block">
                    <div class="dtc-battery-heading">
                        <span><span class="dtc-mini-icon" aria-hidden="true">▰</span> Battery level</span>
                        <strong class="${batteryClass}">${battery === null ? "Not connected" : `${Math.round(battery)}%`}</strong>
                    </div>
                    <div class="dtc-battery-track" role="progressbar" aria-label="Battery level" aria-valuemin="0" aria-valuemax="100" ${battery === null ? "aria-valuenow=\"0\" aria-valuetext=\"Battery data unavailable\"" : `aria-valuenow="${Math.round(battery)}"`}>
                        <span class="dtc-battery-fill ${batteryClass}" style="width:${battery === null ? 0 : battery}%"></span>
                    </div>
                    <div class="dtc-battery-foot"><span>${battery === null ? "Waiting for battery telemetry" : battery <= 15 ? "Low battery · charge soon" : battery <= 30 ? "Battery running low" : "Battery health looks good"}</span><span>${battery === null ? "—" : `${Math.round(battery)} / 100`}</span></div>
                </div>

                <div class="dtc-signal-grid">
                    <div class="dtc-signal-card ${gpsActive ? "good" : "muted"}">
                        <div class="dtc-signal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="9" r="2.3" stroke="currentColor" stroke-width="1.7"/></svg></div>
                        <div class="dtc-signal-copy"><span>GPS location</span><strong>${gpsActive && hasLocation ? "GPS fixed" : gpsActive ? "Fix not received" : gpsRaw === "searching" ? "Searching" : escapeHtml(gpsRaw)}</strong></div>
                        <span class="dtc-signal-indicator"></span>
                    </div>
                    <div class="dtc-signal-card ${wifiConnected ? "good" : "muted"}">
                        <div class="dtc-signal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3.5 8.8a13 13 0 0 1 17 0M6.8 12.2a8 8 0 0 1 10.4 0M10 15.5a3.2 3.2 0 0 1 4 0M12 19h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
                        <div class="dtc-signal-copy"><span>Wi-Fi network</span><strong>${wifiConnected ? "Connected" : escapeHtml(wifiRaw)}</strong></div>
                        <span class="dtc-signal-indicator"></span>
                    </div>
                    <div class="dtc-signal-card ${sosActive ? "danger" : "good"}">
                        <div class="dtc-signal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 21 19H3L12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 9v4.5M12 16.5h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
                        <div class="dtc-signal-copy"><span>Safety status</span><strong>${sosActive ? "SOS active" : "No SOS reported"}</strong></div>
                        <span class="dtc-signal-indicator"></span>
                    </div>
                    <div class="dtc-signal-card ${motionClass}">
                        <div class="dtc-signal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 12h3l2.1-6 4.1 12 2.5-8 1.6 2H21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                        <div class="dtc-signal-copy"><span>Motion sensor</span><strong>${motionLabel}</strong></div>
                        <span class="dtc-signal-indicator"></span>
                    </div>
                </div>

                <div class="dtc-location-block ${hasLocation ? "has-location" : "no-location"}">
                    <div class="dtc-location-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="9" r="2.3" stroke="currentColor" stroke-width="1.7"/></svg></div>
                    <div class="dtc-location-copy"><span>Latest location</span>${hasLocation ? `<strong>${latitude}, ${longitude}</strong><small>Coordinates received from tracker</small>` : `<strong>Location unavailable</strong><small>Waiting for a valid GPS fix</small>`}</div>
                    <span class="dtc-location-tag">${hasLocation ? "GPS FIX" : "NO FIX"}</span>
                </div>

                <div class="dtc-footer">
                    <button type="button" class="tracker-action-button primary" data-tracker-action="map" data-device-id="${escapeHtml(deviceId)}" ${hasLocation ? "" : "disabled"}>
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20V6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" stroke="currentColor" stroke-width="1.7"/></svg>
                        View on map
                    </button>
                    <button type="button" class="tracker-action-button secondary" data-tracker-action="refresh" aria-label="Refresh tracker status"><span aria-hidden="true">↻</span> Refresh</button>
                </div>
            </article>`;
    }).join("");

    wireDashboardTrackerActions(container);
}

function wireDashboardTrackerActions(container) {
    if (!container) return;
    container.querySelectorAll('[data-tracker-action="refresh"]').forEach(button => {
        button.addEventListener("click", async () => {
            if (button.dataset.loading === "true") return;
            button.dataset.loading = "true";
            button.classList.add("is-loading");
            const original = button.innerHTML;
            button.innerHTML = '<span aria-hidden="true">↻</span> Refreshing…';
            try {
                await loadTrackers();
            } finally {
                // loadTrackers rerenders the card, so this cleanup is only needed
                // if the button is still part of the current DOM.
                if (button.isConnected) {
                    button.dataset.loading = "false";
                    button.classList.remove("is-loading");
                    button.innerHTML = original;
                }
            }
        });
    });

    container.querySelectorAll('[data-tracker-action="map"]').forEach(button => {
        button.addEventListener("click", () => {
            const deviceId = button.dataset.deviceId;
            const tracker = lastLoadedTrackers.find(item => item.device_id === deviceId);
            if (!tracker || !getValidTrackers([tracker]).length) return;

            if (!map) initializeMap();
            const mapElement = document.getElementById("map");
            if (mapElement) mapElement.scrollIntoView({behavior: "smooth", block: "center"});

            const position = [Number(tracker.latitude), Number(tracker.longitude)];
            if (map) {
                map.setView(position, 17, {animate: true});
                setTimeout(() => {
                    map.invalidateSize(true);
                    if (markers[deviceId]) markers[deviceId].openPopup();
                }, 250);
            }
        });
    });
}

// ======================================================
// GET VALID TRACKER LOCATIONS
// ======================================================

function getValidTrackers(trackers) {

    if (!Array.isArray(trackers)) {
        return [];
    }

    return trackers.filter(tracker => {

        if (
            tracker.latitude === null ||
            tracker.latitude === undefined ||
            tracker.longitude === null ||
            tracker.longitude === undefined
        ) {
            return false;
        }

        const latitude =
            Number(tracker.latitude);

        const longitude =
            Number(tracker.longitude);

        return (
            !Number.isNaN(latitude) &&
            !Number.isNaN(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180
        );
    });
}


// ======================================================
// UPDATE DASHBOARD MAP
// ======================================================

function updateDashboardMap(trackers) {

    if (!map) {
        return;
    }

    const validTrackers =
        getValidTrackers(trackers);

    const activeDeviceIds =
        new Set();

    validTrackers.forEach(tracker => {

        const deviceId =
            tracker.device_id;

        if (!deviceId) {
            return;
        }

        activeDeviceIds.add(deviceId);

        const latitude =
            Number(tracker.latitude);

        const longitude =
            Number(tracker.longitude);

        const position =
            [latitude, longitude];

        // ----------------------------------------------
        // UPDATE EXISTING MARKER
        // ----------------------------------------------

        if (markers[deviceId]) {

            markers[deviceId].setLatLng(
                position
            );

            markers[deviceId].setIcon(
                createTrackerIcon(tracker)
            );

            markers[deviceId].setPopupContent(
                createTrackerPopup(tracker)
            );

            return;
        }

        // ----------------------------------------------
        // CREATE NEW MARKER
        // ----------------------------------------------

        const marker =
            L.marker(
                position,
                {
                    icon:
                        createTrackerIcon(tracker)
                }
            ).addTo(map);

        marker.bindPopup(
            createTrackerPopup(tracker),
            {
                maxWidth: 320
            }
        );

        markers[deviceId] =
            marker;
    });

    // ----------------------------------------------
    // REMOVE OLD MARKERS
    // ----------------------------------------------

    Object.keys(markers).forEach(
        deviceId => {

            if (
                !activeDeviceIds.has(
                    deviceId
                )
            ) {

                map.removeLayer(
                    markers[deviceId]
                );

                delete markers[deviceId];
            }
        }
    );
}


// ======================================================
// UPDATE FULL MAP
// ======================================================

// ======================================================
// UPDATE FULL LIVE MAP
// ======================================================

function updateFullMap(trackers) {

    if (!fullMap) {
        return;
    }

    const validTrackers = getValidTrackers(trackers);
    const activeDeviceIds = new Set();

    validTrackers.forEach(tracker => {

        const deviceId = tracker.device_id;

        if (!deviceId) {
            return;
        }

        const latitude = Number(tracker.latitude);
        const longitude = Number(tracker.longitude);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return;
        }

        activeDeviceIds.add(deviceId);

        const position = [latitude, longitude];

        if (fullMapMarkers[deviceId]) {
            fullMapMarkers[deviceId].setLatLng(position);
            fullMapMarkers[deviceId].setIcon(createTrackerIcon(tracker));
            fullMapMarkers[deviceId].setPopupContent(createTrackerPopup(tracker));
            return;
        }

        const marker = L.marker(position, {
            icon: createTrackerIcon(tracker)
        }).addTo(fullMap);

        marker.bindPopup(createTrackerPopup(tracker), {
            maxWidth: 340
        });

        fullMapMarkers[deviceId] = marker;
    });

    Object.keys(fullMapMarkers).forEach(deviceId => {
        if (!activeDeviceIds.has(deviceId)) {
            fullMap.removeLayer(fullMapMarkers[deviceId]);
            delete fullMapMarkers[deviceId];
        }
    });

    // Keep the map centered on available tracker locations.
    if (validTrackers.length === 1) {
        fullMap.setView(
            [Number(validTrackers[0].latitude), Number(validTrackers[0].longitude)],
            16,
            { animate: false }
        );
    } else if (validTrackers.length > 1) {
        const bounds = L.latLngBounds(
            validTrackers.map(tracker => [
                Number(tracker.latitude),
                Number(tracker.longitude)
            ])
        );

        fullMap.fitBounds(bounds, {
            padding: [40, 40],
            maxZoom: 16,
            animate: false
        });
    }
}


// ======================================================
// LIVE MAP - TRACKER LIST
// ======================================================

function displayLiveMapTrackers(trackers) {

    const container =
        document.getElementById(
            "live-map-tracker-list"
        );

    const countElement =
        document.getElementById(
            "live-map-tracker-count"
        );

    if (!container) {
        return;
    }

    if (!Array.isArray(trackers) || trackers.length === 0) {

        if (countElement) {
            countElement.textContent = "0";
        }

        container.innerHTML = `
            <div class="empty-state">
                No trackers available.
            </div>
        `;

        return;
    }

    if (countElement) {
        countElement.textContent =
            trackers.length;
    }

    container.innerHTML = "";

    trackers.forEach(tracker => {

        const deviceId =
            tracker.device_id ||
            "N/A";

        const name =
            tracker.name ||
            deviceId;

        const status =
            String(
                tracker.status ||
                "offline"
            ).toLowerCase();

        const battery =
            tracker.battery !== null &&
            tracker.battery !== undefined
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        Number(tracker.battery)
                    )
                )
                : 0;

        const isSOS =
            Boolean(tracker.sos);

        const statusClass =
            isSOS
                ? "sos"
                : status === "online"
                    ? "online"
                    : "offline";

        const statusText =
            isSOS
                ? "SOS ACTIVE"
                : status === "online"
                    ? "Online"
                    : "Offline";

        const item =
            document.createElement("button");

        item.type = "button";

        item.className =
            `live-map-tracker-item ${statusClass}`;

        item.dataset.deviceId =
            deviceId;

        item.innerHTML = `

            <div class="live-map-tracker-icon">

                ${isSOS ? "⚠" : "🛡"}

            </div>

            <div class="live-map-tracker-info">

                <strong>
                    ${escapeHtml(name)}
                </strong>

                <span>
                    ${escapeHtml(deviceId)}
                </span>

                <small class="${statusClass}">
                    <span class="status-dot"></span>
                    ${escapeHtml(statusText)}
                    · ${Math.round(battery)}%
                </small>

            </div>

            <div class="live-map-tracker-arrow">
                →
            </div>

        `;

        item.addEventListener(
            "click",
            () => {

                const marker =
                    fullMapMarkers[deviceId];

                if (!marker || !fullMap) {
                    console.warn(
                        "No map marker found for:",
                        deviceId
                    );
                    return;
                }

                const position =
                    marker.getLatLng();

                fullMap.setView(
                    position,
                    17,
                    {
                        animate: true
                    }
                );

                marker.openPopup();

            }
        );

        container.appendChild(item);

    });

}

// ======================================================
// TRACKER POPUP
// ======================================================

function createTrackerPopup(tracker) {

    const name =
        tracker.name ||
        tracker.device_id ||
        "Unknown Tracker";

    const deviceId =
        tracker.device_id ||
        "N/A";

    const status =
        tracker.status ||
        "unknown";

    const battery =
        tracker.battery !== null &&
        tracker.battery !== undefined
            ? `${tracker.battery}%`
            : "N/A";

    const latitude =
        tracker.latitude !== null &&
        tracker.latitude !== undefined
            ? tracker.latitude
            : "N/A";

    const longitude =
        tracker.longitude !== null &&
        tracker.longitude !== undefined
            ? tracker.longitude
            : "N/A";

    const gps =
        tracker.gps_status ||
        "unknown";

    const wifi =
        tracker.wifi_status ||
        "unknown";

    return `
        <div class="tracker-popup">

            <h3>
                ${escapeHtml(name)}
            </h3>

            <p>
                <strong>Device ID:</strong>
                ${escapeHtml(deviceId)}
            </p>

            <p>
                <strong>Status:</strong>
                ${escapeHtml(status)}
            </p>

            <p>
                <strong>Battery:</strong>
                ${escapeHtml(battery)}
            </p>

            <p>
                <strong>Latitude:</strong>
                ${escapeHtml(latitude)}
            </p>

            <p>
                <strong>Longitude:</strong>
                ${escapeHtml(longitude)}
            </p>

            <p>
                <strong>GPS:</strong>
                ${escapeHtml(gps)}
            </p>

            <p>
                <strong>Wi-Fi:</strong>
                ${escapeHtml(wifi)}
            </p>

        </div>
    `;
}


// ======================================================
// TRACKER MANAGEMENT PAGE
// ======================================================
function displayTrackerManagement(trackers) {
    const container = document.getElementById(
        "tracker-management-list"
    );

    if (!container) {
        return;
    }

    if (!trackers || trackers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🛡</div>
                <h3>No trackers found</h3>
                <p>Add a safety tracker to start monitoring.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = "";

    trackers.forEach(tracker => {
        const item = document.createElement("div");

        item.className = `modern-tracker-card management-tracker-card ${String(tracker.status || "offline").toLowerCase() === "online" ? "is-online" : "is-offline"}`;

        const name =
            tracker.name ||
            tracker.device_id ||
            "Unnamed Tracker";

        const deviceId =
            tracker.device_id ||
            "N/A";

        const assignedPerson =
            tracker.assigned_person ||
            "Not assigned";

        const phone =
            tracker.phone ||
            "Not available";

        const status =
            String(tracker.status || "offline").toLowerCase();

        // Never present a missing battery reading as a real 0% reading.
        const batteryKnown = tracker.battery !== null &&
            tracker.battery !== undefined && tracker.battery !== "" &&
            Number.isFinite(Number(tracker.battery));
        const battery = batteryKnown
            ? Math.max(0, Math.min(100, Number(tracker.battery)))
            : null;

        const gps =
            tracker.gps_status ||
            "unknown";

        const wifi =
            tracker.wifi_status ||
            "unknown";

        const latitude =
            tracker.latitude !== null &&
            tracker.latitude !== undefined
                ? Number(tracker.latitude).toFixed(5)
                : "N/A";

        const longitude =
            tracker.longitude !== null &&
            tracker.longitude !== undefined
                ? Number(tracker.longitude).toFixed(5)
                : "N/A";

        const accuracy =
            tracker.accuracy !== null &&
            tracker.accuracy !== undefined
                ? `${tracker.accuracy} m`
                : "N/A";

        const lastUpdate =
            tracker.telemetry_timestamp ||
            tracker.updated_at ||
            null;

        let lastUpdateText = "No telemetry";

        if (lastUpdate) {
            const date = new Date(lastUpdate);

            if (!isNaN(date.getTime())) {
                lastUpdateText =
                    date.toLocaleString();
            }
        }

        const statusLabel =
            status === "online"
                ? "Online"
                : "Offline";

        const statusClass =
            status === "online"
                ? "online"
                : "offline";

        let batteryClass = battery === null ? "unknown" : "good";

        if (battery !== null && battery <= 20) {
            batteryClass = "critical";
        } else if (battery !== null && battery <= 50) {
            batteryClass = "warning";
        }

        const gpsClass =
            String(gps).toLowerCase() === "active" ||
            String(gps).toLowerCase() === "connected" ||
            String(gps).toLowerCase() === "ok"
                ? "connected"
                : "disconnected";

        const wifiClass =
            String(wifi).toLowerCase() === "connected" ||
            String(wifi).toLowerCase() === "active" ||
            String(wifi).toLowerCase() === "ok"
                ? "connected"
                : "disconnected";

        const sosActive = tracker.sos === true || tracker.sos === 1 || String(tracker.sos).toLowerCase() === "true";
        const sosClass = sosActive ? "sos-active" : "sos-safe";
        const sosText = sosActive ? "SOS ACTIVE" : "No SOS reported";

        item.innerHTML = `
            <div class="modern-tracker-header">

                <div class="tracker-identity">

                    <div class="tracker-avatar">
                        🛡
                    </div>

                    <div>
                        <h3>
                            ${escapeHtml(name)}
                        </h3>

                        <span class="tracker-device-id">
                            ${escapeHtml(deviceId)}
                        </span>
                    </div>

                </div>

                <div class="
                    tracker-status
                    ${statusClass}
                ">
                    <span class="status-dot"></span>
                    ${statusLabel}
                </div>

            </div>


            <div class="tracker-person">

                <div class="person-info">

                    <span class="detail-label">
                        Assigned to
                    </span>

                    <strong>
                        ${escapeHtml(
                            assignedPerson
                        )}
                    </strong>

                </div>

                <div class="person-info">

                    <span class="detail-label">
                        Phone
                    </span>

                    <strong>
                        ${escapeHtml(phone)}
                    </strong>

                </div>

            </div>


            <div class="tracker-battery">

                <div class="battery-header">

                    <span>
                        Battery
                    </span>

                    <strong>
                        ${battery}%
                    </strong>

                </div>

                <div class="battery-track">

                    <div
                        class="
                            battery-fill
                            ${batteryClass}
                        "
                        style="
                            width: ${battery === null ? 0 : battery}%;
                        "
                    ></div>

                </div>

            </div>


            <div class="tracker-metrics">

                <div class="tracker-metric">

                    <div class="metric-icon">
                        📍
                    </div>

                    <div>
                        <span>
                            GPS
                        </span>

                        <strong class="${gpsClass}">
                            ${escapeHtml(gps)}
                        </strong>
                    </div>

                </div>


                <div class="tracker-metric">

                    <div class="metric-icon">
                        📶
                    </div>

                    <div>
                        <span>
                            Wi-Fi
                        </span>

                        <strong class="${wifiClass}">
                            ${escapeHtml(wifi)}
                        </strong>
                    </div>

                </div>


                <div class="tracker-metric">

                    <div class="metric-icon">
                        ⚠
                    </div>

                    <div>
                        <span>
                            Safety
                        </span>

                        <strong class="${sosClass}">
                            ${sosText}
                        </strong>
                    </div>

                </div>

            </div>


            <div class="tracker-location">

                <div class="location-header">

                    <span>
                        📍 Latest Location
                    </span>

                    <span>
                        Accuracy:
                        ${escapeHtml(accuracy)}
                    </span>

                </div>

                <div class="coordinates">

                    <div>
                        <small>
                            Latitude
                        </small>

                        <strong>
                            ${escapeHtml(latitude)}
                        </strong>
                    </div>

                    <div>
                        <small>
                            Longitude
                        </small>

                        <strong>
                            ${escapeHtml(longitude)}
                        </strong>
                    </div>

                </div>

            </div>


            <div class="tracker-footer">

    <span class="last-update">
        Last update:
        ${escapeHtml(lastUpdateText)}
    </span>

    <div class="tracker-actions">

        <button
            type="button"
            class="tracker-view-button"
            data-device-id="${escapeHtml(deviceId)}"
        >
            View on map →
        </button>

        <button
            type="button"
            class="tracker-edit-button"
            data-device-id="${escapeHtml(deviceId)}"
        >
            Edit
        </button>

        <button
            type="button"
            class="tracker-delete-button"
            data-device-id="${escapeHtml(deviceId)}"
        >
            Delete
        </button>

    </div>

</div>
        `;

        container.appendChild(item);
    });

    container.querySelectorAll(".tracker-view-button")
        .forEach(button => {

            button.addEventListener("click", () => {

                const deviceId =
                    button.dataset.deviceId;

                const marker =
                    markers[deviceId];

                if (marker && map) {

                    map.setView(
                        marker.getLatLng(),
                        16,
                        {
                            animate: true
                        }
                    );

                    marker.openPopup();

                    const mapElement =
                        document.getElementById("map");

                    if (mapElement) {
                        mapElement.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });
                    }

                } else {

                    console.warn(
                        "No map marker found for:",
                        deviceId
                    );

                }

            });

        });

   // ======================================================
// DELETE TRACKER
// ======================================================

container.querySelectorAll(".tracker-delete-button")
    .forEach(button => {

        button.addEventListener("click", async () => {

            const deviceId =
                button.dataset.deviceId;

            if (!deviceId) {
                return;
            }

            const confirmed = confirm(
                `Are you sure you want to delete tracker ${deviceId}?`
            );

            if (!confirmed) {
                return;
            }

            button.disabled = true;
            button.textContent = "Deleting...";

            try {

                const response = await fetch(
                    `${API_BASE}/trackers/${encodeURIComponent(deviceId)}`,
                    {
                        method: "DELETE"
                    }
                );

                if (!response.ok) {

                    const errorData =
                        await response.json()
                            .catch(() => ({}));

                    throw new Error(
                        errorData.error ||
                        "Failed to delete tracker"
                    );
                }

                await loadTrackers();

            } catch (error) {

                console.error(
                    "Delete tracker error:",
                    error
                );

                button.disabled = false;
                button.textContent = "Delete";

                alert(
                    "Unable to delete this tracker."
                );
            }

        });

    });


    // ======================================================
// EDIT TRACKER
// ======================================================

container.querySelectorAll(".tracker-edit-button")
    .forEach(button => {

        button.addEventListener("click", async () => {

            const deviceId =
                button.dataset.deviceId;

            if (!deviceId) {
                return;
            }

            const tracker =
                trackers.find(
                    item =>
                        String(item.device_id) ===
                        String(deviceId)
                );

            if (!tracker) {
                return;
            }

            const name =
                prompt(
                    "Tracker name:",
                    tracker.name || ""
                );

            if (name === null) {
                return;
            }

            const assignedPerson =
                prompt(
                    "Assigned person:",
                    tracker.assigned_person || ""
                );

            if (assignedPerson === null) {
                return;
            }

            const phone =
                prompt(
                    "Phone number:",
                    tracker.phone || ""
                );

            if (phone === null) {
                return;
            }

            button.disabled = true;
            button.textContent = "Saving...";

            try {

                const response =
                    await fetch(
                        `${API_BASE}/trackers/${encodeURIComponent(deviceId)}`,
                        {
                            method: "PUT",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                name: name.trim(),
                                assigned_person:
                                    assignedPerson.trim(),
                                phone:
                                    phone.trim()
                            })
                        }
                    );

                if (!response.ok) {

                    const errorData =
                        await response.json()
                            .catch(() => ({}));

                    throw new Error(
                        errorData.error ||
                        "Failed to update tracker"
                    );
                }

                await loadTrackers();

            } catch (error) {

                console.error(
                    "Edit tracker error:",
                    error
                );

                button.disabled = false;
                button.textContent = "Edit";

                alert(
                    "Unable to update this tracker."
                );
            }

        });

    });


    /*
     * View on Map buttons
     */

    const mapButtons =
        container.querySelectorAll(
            ".tracker-view-button"
        );

    mapButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const deviceId =
                    button.dataset.deviceId;

                if (!deviceId) {
                    return;
                }

                const tracker =
                    trackers.find(
                        item =>
                            String(
                                item.device_id
                            ) ===
                            String(deviceId)
                    );

                if (!tracker) {
                    return;
                }

                showPage("map");

                setTimeout(() => {

                    if (
                        fullMap &&
                        tracker.latitude !== null &&
                        tracker.longitude !== null
                    ) {

                        const lat =
                            Number(
                                tracker.latitude
                            );

                        const lng =
                            Number(
                                tracker.longitude
                            );

                        if (
                            !isNaN(lat) &&
                            !isNaN(lng)
                        ) {

                            fullMap.setView(
                                [lat, lng],
                                16
                            );

                            const marker =
                                fullMapMarkers[
                                    deviceId
                                ];

                            if (marker) {
                                marker.openPopup();
                            }
                        }
                    }

                }, 300);
            }
        );
    });
}

// ======================================================
// LOAD ALERTS
// ======================================================

async function loadAlerts() {

    try {

        const response =
            await fetch(
                `${API_BASE}/alerts`
            );

        if (!response.ok) {
            throw new Error(
                "Failed to load alerts"
            );
        }

        const alerts =
            await response.json();

        updateAlertCount(alerts);

        displayDashboardAlerts(alerts);
        displayAllAlerts(alerts);

    } catch (error) {

        console.error(
            "Alert loading error:",
            error
        );
    }
}


// ======================================================
// ALERT COUNT
// ======================================================

function updateAlertCount(alerts) {

    if (!Array.isArray(alerts)) {
        return;
    }

    const activeAlerts =
        alerts.filter(
            alert =>
                alert.status &&
                alert.status.toLowerCase() ===
                    "active"
        ).length;

    const element =
        document.getElementById(
            "active-alerts"
        );

    if (element) {
        element.textContent =
            activeAlerts;
    }
}


// ======================================================
// DISPLAY DASHBOARD ALERTS
// ======================================================

function displayDashboardAlerts(alerts) {
    const container = document.getElementById("alerts-list");
    if (!container) return;

    if (!Array.isArray(alerts) || alerts.length === 0) {
        container.innerHTML = `
            <div class="alerts-empty-state">
                <span class="alerts-empty-icon" aria-hidden="true">✓</span>
                <div><strong>All clear</strong><p>No safety events have been reported.</p></div>
                <span class="alerts-empty-badge">SAFE</span>
            </div>`;
        return;
    }

    const recentAlerts = alerts.slice(0, 5);
    container.innerHTML = "";

    recentAlerts.forEach(alert => {
        const status = String(alert.status || "active").toLowerCase();
        const isResolved = status === "resolved";
        const alertType = String(alert.alert_type || "Safety alert");
        const message = String(alert.message || "A safety event was recorded.");
        const deviceId = String(alert.device_id || "Unknown tracker");
        const isSOS = /sos|panic|emergency/i.test(`${alertType} ${message}`);
        const icon = isSOS
            ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2 21 19H3L12 3.2Z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>`
            : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></svg>`;

        const hasLocation = alert.latitude !== null && alert.latitude !== undefined &&
            alert.longitude !== null && alert.longitude !== undefined &&
            Number.isFinite(Number(alert.latitude)) && Number.isFinite(Number(alert.longitude));
        let createdAt = "Time unavailable";
        let relativeTime = "Recorded event";
        if (alert.created_at) {
            const date = new Date(alert.created_at);
            if (!Number.isNaN(date.getTime())) {
                createdAt = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
                const elapsed = Math.max(0, Date.now() - date.getTime());
                if (elapsed < 60000) relativeTime = "Just now";
                else if (elapsed < 3600000) relativeTime = `${Math.floor(elapsed / 60000)} min ago`;
                else if (elapsed < 86400000) relativeTime = `${Math.floor(elapsed / 3600000)} hr ago`;
                else if (elapsed < 604800000) relativeTime = `${Math.floor(elapsed / 86400000)} days ago`;
                else relativeTime = createdAt;
            }
        }

        const item = document.createElement("article");
        item.className = `dashboard-alert-row ${isResolved ? "is-resolved" : "is-active"} ${isSOS && !isResolved ? "is-critical" : ""}`;
        item.innerHTML = `
            <div class="dashboard-alert-icon ${isResolved ? "icon-resolved" : (isSOS ? "icon-sos" : "icon-warning")}">${icon}</div>
            <div class="dashboard-alert-body">
                <div class="dashboard-alert-topline">
                    <div class="dashboard-alert-title-wrap">
                        <span class="dashboard-alert-type">${escapeHtml(alertType)}</span>
                        <span class="dashboard-alert-device">${escapeHtml(deviceId)}</span>
                    </div>
                    <span class="dashboard-alert-status ${isResolved ? "status-resolved" : "status-active"}"><span class="status-dot"></span>${isResolved ? "Resolved" : "Active"}</span>
                </div>
                <p class="dashboard-alert-message">${escapeHtml(message)}</p>
                <div class="dashboard-alert-meta">
                    <span class="dashboard-alert-time" title="${escapeHtml(createdAt)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${escapeHtml(relativeTime)}</span>
                    <span class="dashboard-alert-location ${hasLocation ? "location-available" : "location-missing"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>${hasLocation ? `${Number(alert.latitude).toFixed(4)}, ${Number(alert.longitude).toFixed(4)}` : "Location unavailable"}</span>
                </div>
                <div class="dashboard-alert-actions">
                    ${hasLocation ? `<button type="button" class="dashboard-alert-action alert-map-action" data-lat="${Number(alert.latitude)}" data-lng="${Number(alert.longitude)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>View location</button>` : `<span class="dashboard-alert-no-location">No GPS fix at event time</span>`}
                    ${!isResolved && alert.id !== undefined ? `<button type="button" class="dashboard-alert-action dashboard-alert-resolve" data-alert-id="${Number(alert.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Resolve</button>` : `<span class="dashboard-alert-resolved-note">✓ Closed</span>`}
                </div>
            </div>`;
        container.appendChild(item);
    });

    container.querySelectorAll(".dashboard-alert-action.alert-map-action").forEach(button => {
        button.addEventListener("click", () => {
            const lat = Number(button.dataset.lat);
            const lng = Number(button.dataset.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`, "_blank", "noopener,noreferrer");
            }
        });
    });

    container.querySelectorAll(".dashboard-alert-resolve").forEach(button => {
        button.addEventListener("click", async () => {
            const id = button.dataset.alertId;
            if (!id) return;
            button.disabled = true;
            button.classList.add("is-loading");
            button.innerHTML = `<span class="alert-action-spinner"></span>Resolving`;
            try {
                const response = await fetch(`${API_BASE}/alerts/${encodeURIComponent(id)}/resolve`, { method: "POST" });
                if (!response.ok) {
                    const details = await response.json().catch(() => ({}));
                    throw new Error(details.error || "Could not resolve alert");
                }
                await loadAlerts();
            } catch (error) {
                console.error("Dashboard resolve alert error:", error);
                button.disabled = false;
                button.classList.remove("is-loading");
                button.textContent = "Resolve";
                window.alert("Could not resolve this alert. Please try again.");
            }
        });
    });
}


// ======================================================
// DISPLAY ALL ALERTS
// ======================================================

let allAlertsCache = [];
let allAlertsFilter = "all";
let allAlertsSearch = "";
let allAlertsToolbarReady = false;

function displayAllAlerts(alerts) {
    const container = document.getElementById("all-alerts-list");
    if (!container) return;

    allAlertsCache = Array.isArray(alerts) ? alerts : [];
    if (!allAlertsToolbarReady) {
        const toolbar = document.createElement("div");
        toolbar.className = "all-alerts-toolbar";
        toolbar.innerHTML = `
          <div class="alerts-toolbar-top">
            <div class="alerts-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 4.5 4.5"></path></svg>
              <input id="all-alerts-search" type="search" placeholder="Search alerts or tracker ID…" aria-label="Search alerts" />
            </div>
            <span class="alerts-live-note"><i></i> Live event feed</span>
          </div>
          <div class="alerts-filter-row" role="group" aria-label="Filter alerts">
            <button type="button" class="alerts-filter-chip is-selected" data-alert-filter="all">All alerts <span id="alert-count-all">0</span></button>
            <button type="button" class="alerts-filter-chip" data-alert-filter="active">Active <span id="alert-count-active">0</span></button>
            <button type="button" class="alerts-filter-chip" data-alert-filter="resolved">Resolved <span id="alert-count-resolved">0</span></button>
          </div>
          <div class="alerts-feed-summary"><span id="alerts-results-count">Showing all events</span><span>Newest first</span></div>
        `;
        container.parentNode.insertBefore(toolbar, container);
        toolbar.addEventListener("click", event => {
            const chip = event.target.closest("[data-alert-filter]");
            if (!chip) return;
            allAlertsFilter = chip.dataset.alertFilter;
            toolbar.querySelectorAll("[data-alert-filter]").forEach(el => el.classList.toggle("is-selected", el === chip));
            renderAllAlertsList();
        });
        toolbar.querySelector("#all-alerts-search").addEventListener("input", event => {
            allAlertsSearch = event.target.value.trim().toLowerCase();
            renderAllAlertsList();
        });
        allAlertsToolbarReady = true;
    }
    renderAllAlertsList();
}

function renderAllAlertsList() {
    const container = document.getElementById("all-alerts-list");
    if (!container) return;
    const isResolved = item => String(item.status || "active").toLowerCase() === "resolved";
    const activeCount = allAlertsCache.filter(item => !isResolved(item)).length;
    const resolvedCount = allAlertsCache.length - activeCount;
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText("alert-count-all", allAlertsCache.length);
    setText("alert-count-active", activeCount);
    setText("alert-count-resolved", resolvedCount);

    const filtered = allAlertsCache.filter(item => {
        const resolved = isResolved(item);
        if (allAlertsFilter === "active" && resolved) return false;
        if (allAlertsFilter === "resolved" && !resolved) return false;
        const haystack = `${item.alert_type || "Safety alert"} ${item.message || ""} ${item.device_id || ""} ${item.status || ""}`.toLowerCase();
        return !allAlertsSearch || haystack.includes(allAlertsSearch);
    });
    setText("alerts-results-count", `Showing ${filtered.length} of ${allAlertsCache.length} events`);

    if (!filtered.length) {
        container.innerHTML = `
          <div class="alerts-empty-state all-alerts-empty">
            <div class="alerts-empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg></div>
            <div><strong>${allAlertsCache.length ? "No matching alerts" : "All clear for now"}</strong><p>${allAlertsCache.length ? "Try another filter or search term." : "No safety events have been reported by your trackers."}</p></div>
            <span class="alerts-empty-badge">${allAlertsCache.length ? "NO MATCHES" : "MONITORING"}</span>
          </div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const resolved = isResolved(item);
        const type = String(item.alert_type || "Safety Alert");
        const message = String(item.message || "Safety event detected");
        const device = String(item.device_id || "Unknown tracker");
        const isSOS = type.toLowerCase().includes("sos") || message.toLowerCase().includes("sos");
        const severity = resolved ? "resolved" : (isSOS ? "critical" : "warning");
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        const hasLocation = item.latitude !== null && item.latitude !== undefined && item.longitude !== null && item.longitude !== undefined && Number.isFinite(lat) && Number.isFinite(lng);
        const date = item.created_at ? new Date(item.created_at) : null;
        const dateValid = date && Number.isFinite(date.getTime());
        const absoluteTime = dateValid ? date.toLocaleString(undefined, {dateStyle:"medium", timeStyle:"short"}) : "Time unavailable";
        const relativeTime = dateValid ? formatAlertRelativeTime(date) : "Timestamp unavailable";
        const icon = resolved
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
          : isSOS
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5m0 3h.01"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/></svg>';
        return `
          <article class="all-alert-card ${resolved ? "is-resolved" : "is-active"} ${severity}" data-alert-card="${Number(item.id) || ""}">
            <div class="all-alert-icon ${severity}">${icon}</div>
            <div class="all-alert-content">
              <div class="all-alert-heading">
                <div class="all-alert-title-group"><span class="all-alert-type">${escapeHtml(type)}</span><span class="all-alert-device">${escapeHtml(device)}</span></div>
                <span class="all-alert-status ${resolved ? "resolved" : "active"}"><i></i>${resolved ? "Resolved" : (isSOS ? "Action required" : "Active")}</span>
              </div>
              <h3>${escapeHtml(message)}</h3>
              <div class="all-alert-meta">
                <span class="all-alert-time" title="${escapeHtml(absoluteTime)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>${escapeHtml(relativeTime)}</span></span>
                <span class="all-alert-location ${hasLocation ? "available" : "missing"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg><span>${hasLocation ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Location unavailable"}</span></span>
                <span class="all-alert-created">${dateValid ? `Reported ${escapeHtml(absoluteTime)}` : "Reported time unavailable"}</span>
              </div>
              <div class="all-alert-actions">
                ${!resolved && item.id !== undefined ? `<button type="button" class="all-alert-button resolve" data-resolve-alert="${Number(item.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg> Resolve alert</button>` : `<span class="all-alert-closed"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg> Resolved and closed</span>`}
                ${hasLocation ? `<button type="button" class="all-alert-button location" data-alert-lat="${lat}" data-alert-lng="${lng}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg> View on map</button>` : `<span class="all-alert-no-location">Map unavailable until GPS fix</span>`}
                <button type="button" class="all-alert-button details" data-alert-details="${Number(item.id) || ""}">Details <span aria-hidden="true">↗</span></button>
              </div>
            </div>
          </article>`;
    }).join("");
}

function formatAlertRelativeTime(date) {
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString(undefined, {dateStyle:"medium"});
}

// One delegated handler keeps the full alert list interactive after every refresh.
document.addEventListener("click", async event => {
    const resolveButton = event.target.closest("[data-resolve-alert]");
    if (resolveButton) {
        const id = resolveButton.dataset.resolveAlert;
        if (!id || resolveButton.disabled) return;
        resolveButton.disabled = true;
        resolveButton.classList.add("is-loading");
        const original = resolveButton.innerHTML;
        resolveButton.innerHTML = '<span class="all-alert-spinner"></span> Resolving…';
        try {
            const response = await fetch(`${API_BASE}/alerts/${encodeURIComponent(id)}/resolve`, {method:"POST"});
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Unable to resolve alert");
            }
            await loadAlerts();
        } catch (error) {
            console.error("Resolve alert failed:", error);
            resolveButton.disabled = false;
            resolveButton.classList.remove("is-loading");
            resolveButton.innerHTML = original;
            window.alert("Could not resolve this alert. Please try again.");
        }
        return;
    }
    const locationButton = event.target.closest("[data-alert-lat][data-alert-lng]");
    if (locationButton) {
        const lat = Number(locationButton.dataset.alertLat);
        const lng = Number(locationButton.dataset.alertLng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        if (typeof showPage === "function") showPage("map");
        setTimeout(() => {
            if (fullMap) { fullMap.setView([lat, lng], 17, {animate:true}); fullMap.invalidateSize(); }
            else if (map) { map.setView([lat, lng], 17, {animate:true}); map.invalidateSize(); }
        }, 350);
        return;
    }
    const detailButton = event.target.closest("[data-alert-details]");
    if (detailButton) {
        const id = Number(detailButton.dataset.alertDetails);
        const item = allAlertsCache.find(alert => Number(alert.id) === id);
        if (!item) return;
        const when = item.created_at ? new Date(item.created_at).toLocaleString() : "Unavailable";
        window.alert(`${item.alert_type || "Safety Alert"}\n${item.message || "Safety event detected"}\n\nTracker: ${item.device_id || "Unknown"}\nStatus: ${item.status || "active"}\nReported: ${when}\nLocation: ${item.latitude ?? "N/A"}, ${item.longitude ?? "N/A"}`);
    }
});

// ======================================================
// ADD TRACKER
// ======================================================

// ======================================================
// HISTORY - LOAD TRACKERS
// ======================================================

async function loadHistoryTrackers() {

    const container =
        document.getElementById(
            "history-list"
        );

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="empty-state">
            Loading trackers...
        </div>
    `;

    try {

        const response =
            await fetch(
                `${API_BASE}/trackers`
            );

        if (!response.ok) {
            throw new Error(
                "Failed to load trackers"
            );
        }

        const trackers =
            await response.json();

        if (
            !trackers ||
            trackers.length === 0
        ) {

            container.innerHTML = `
                <div class="empty-state">
                    No trackers available.
                </div>
            `;

            return;
        }

        let html = `

            <div class="history-controls">

                <label
                    for="history-tracker-select"
                >
                    Select Tracker
                </label>

                <select
                    id="history-tracker-select"
                >

                    <option value="">
                        Select a tracker
                    </option>
        `;

        trackers.forEach(tracker => {

            html += `
                <option
                    value="${escapeHtml(
                        tracker.device_id
                    )}"
                >
                    ${escapeHtml(
                        tracker.name ||
                        tracker.device_id
                    )}
                    -
                    ${escapeHtml(
                        tracker.device_id
                    )}
                </option>
            `;
        });

        html += `

                </select>

                <button
                    type="button"
                    class="refresh-button"
                    id="history-refresh-button"
                >
                    Refresh
                </button>

            </div>

            <div
                id="history-table-container"
            >

                <div class="empty-state">
                    Select a tracker to view
                    telemetry history.
                </div>

            </div>
        `;

        container.innerHTML = html;

        const selector =
            document.getElementById(
                "history-tracker-select"
            );

        if (selector) {

            selector.addEventListener(
                "change",
                () => {

                    if (selector.value) {

                        loadHistory(
                            selector.value
                        );

                    } else {

                        const tableContainer =
                            document.getElementById(
                                "history-table-container"
                            );

                        if (tableContainer) {

                            tableContainer.innerHTML = `
                                <div class="empty-state">
                                    Select a tracker to view
                                    telemetry history.
                                </div>
                            `;
                        }
                    }
                }
            );
        }

        const refreshButton =
            document.getElementById(
                "history-refresh-button"
            );

        if (refreshButton) {

            refreshButton.addEventListener(
                "click",
                loadHistoryTrackers
            );
        }

    } catch (error) {

        console.error(
            "History tracker loading error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                Failed to load trackers.
            </div>
        `;
    }
}

// ======================================================
// HISTORY - LOAD TELEMETRY
// ======================================================

async function loadHistory(deviceId) {
    const container =
        document.getElementById(
            "history-table-container"
        );

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="empty-state">
            Loading telemetry history...
        </div>
    `;

    try {
        const response =
            await fetch(
                `${API_BASE}/telemetry/${encodeURIComponent(
                    deviceId
                )}`
            );

        if (!response.ok) {
            throw new Error(
                "Failed to load telemetry"
            );
        }

        const telemetry =
            await response.json();

        if (
            !telemetry ||
            telemetry.length === 0
        ) {
            container.innerHTML = `
                <div class="empty-state">
                    No telemetry records found
                    for this tracker.
                </div>
            `;
            return;
        }

        let html = `
            <div class="history-summary">
                <div class="history-summary-item">
                    <span>Tracker</span>
                    <strong>
                        ${escapeHtml(deviceId)}
                    </strong>
                </div>

                <div class="history-summary-item">
                    <span>Records</span>
                    <strong>
                        ${telemetry.length}
                    </strong>
                </div>

                <div class="history-summary-item">
                    <span>Latest Update</span>
                    <strong>
                        ${escapeHtml(
                            formatDateTime(
                                telemetry[0].timestamp
                            )
                        )}
                    </strong>
                </div>
            </div>

            <div class="history-table-wrapper">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Date / Time</th>
                            <th>Latitude</th>
                            <th>Longitude</th>
                            <th>Accuracy</th>
                            <th>Battery</th>
                            <th>GPS</th>
                            <th>Wi-Fi</th>
                            <th>SOS</th>
                        </tr>
                    </thead>

                    <tbody>
        `;

        telemetry.forEach(record => {

            const timestamp =
                formatDateTime(
                    record.timestamp
                );

            const latitude =
                record.latitude !== null &&
                record.latitude !== undefined
                    ? Number(record.latitude).toFixed(6)
                    : "N/A";

            const longitude =
                record.longitude !== null &&
                record.longitude !== undefined
                    ? Number(record.longitude).toFixed(6)
                    : "N/A";

            const accuracy =
                record.accuracy !== null &&
                record.accuracy !== undefined
                    ? `${record.accuracy} m`
                    : "N/A";

            const battery =
                record.battery !== null &&
                record.battery !== undefined
                    ? `${record.battery}%`
                    : "N/A";

            const gps =
                record.gps_status ||
                "unknown";

            const wifi =
                record.wifi_status ||
                "unknown";

            const sos =
                record.sos === true
                    ? `
                        <span class="history-sos active">
                            🚨 YES
                        </span>
                    `
                    : `
                        <span class="history-sos">
                            No
                        </span>
                    `;

            html += `
                <tr>

                    <td>
                        ${escapeHtml(timestamp)}
                    </td>

                    <td>
                        ${escapeHtml(latitude)}
                    </td>

                    <td>
                        ${escapeHtml(longitude)}
                    </td>

                    <td>
                        ${escapeHtml(accuracy)}
                    </td>

                    <td>
                        <span class="battery-value">
                            ${escapeHtml(battery)}
                        </span>
                    </td>

                    <td>
                        <span class="
                            telemetry-status
                            ${gps.toLowerCase() === "active" ||
                              gps.toLowerCase() === "available" ||
                              gps.toLowerCase() === "connected"
                                ? "status-good"
                                : ""}
                        ">
                            ${escapeHtml(gps)}
                        </span>
                    </td>

                    <td>
                        <span class="
                            telemetry-status
                            ${wifi.toLowerCase() === "connected" ||
                              wifi.toLowerCase() === "active"
                                ? "status-good"
                                : ""}
                        ">
                            ${escapeHtml(wifi)}
                        </span>
                    </td>

                    <td>
                        ${sos}
                    </td>

                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

    } catch (error) {

        console.error(
            "Telemetry history loading error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state error-state">
                Failed to load telemetry history.
                <br>
                <small>
                    ${escapeHtml(error.message)}
                </small>
            </div>
        `;
    }
}


// ======================================================
// DATE / TIME FORMATTER
// ======================================================

function formatDateTime(value) {

    if (!value) {
        return "N/A";
    }

    try {

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return value;
        }

        return date.toLocaleString(
            "en-IN",
            {
                dateStyle: "medium",
                timeStyle: "medium"
            }
        );

    } catch {
        return value;
    }
}


// ======================================================
// PAGE NAVIGATION
// ======================================================

function showPage(pageName) {

    const pages =
        document.querySelectorAll(
            ".page-content"
        );

    const navItems =
        document.querySelectorAll(
            ".nav-item[data-page]"
        );

    // Hide every page
    pages.forEach(page => {
        page.classList.add("hidden");
    });

    // Remove active navigation state
    navItems.forEach(item => {
        item.classList.remove("active");
    });

    // Show selected page
    const selectedPage =
        document.getElementById(
            `page-${pageName}`
        );

    if (selectedPage) {

        selectedPage.classList.remove(
            "hidden"
        );
    }

    // Activate selected navigation item
    const selectedNav =
        document.querySelector(
            `.nav-item[data-page="${pageName}"]`
        );

    if (selectedNav) {

        selectedNav.classList.add(
            "active"
        );
    }

    // ==================================================
    // TOP BAR
    // ==================================================

    const titles = {

        dashboard:
            "Dashboard",

        trackers:
            "Tracker Management",

        map:
            "Live Map",

        alerts:
            "Safety Alerts",

        history:
            "Telemetry History"
    };

    const descriptions = {

        dashboard:
            "Real-time safety monitoring",

        trackers:
            "Monitor all registered IoT safety trackers.",

        map:
            "Real-time location of all active trackers.",

        alerts:
            "Monitor active and historical safety events.",

        history:
            "Historical GPS and tracker telemetry data."
    };

    const titleElement =
        document.querySelector(
            ".topbar h2"
        );

    const descriptionElement =
        document.querySelector(
            ".topbar p"
        );

    if (titleElement) {

        titleElement.textContent =
            titles[pageName] ||
            "Dashboard";
    }

    if (descriptionElement) {

        descriptionElement.textContent =
            descriptions[pageName] ||
            "Real-time safety monitoring";
    }

    // ==================================================
    // PAGE-SPECIFIC ACTIONS
    // ==================================================

    if (pageName === "dashboard") {

        setTimeout(() => {

            if (map) {
                map.invalidateSize();
            }

            loadTrackers();

        }, 100);
    }

    if (pageName === "trackers") {

        loadTrackers();
    }

    if (pageName === "map") {

        initializeFullMap();

        setTimeout(async () => {

            if (fullMap) {
                fullMap.invalidateSize(true);
            }

            await loadTrackers();

            if (fullMap) {
                fullMap.invalidateSize(true);
                updateFullMap(lastLoadedTrackers);
            }

        }, 200);
    }

    if (pageName === "alerts") {

        loadAlerts();
    }

    if (pageName === "history") {

        loadHistoryTrackers();
    }
}

// ======================================================
// TRACKER FORM CONTROLS
// ======================================================

// ======================================================
// TEMPORARY TELEMETRY SIMULATOR
// ======================================================

function populateTelemetrySimulator(trackers) {
    const panel = document.getElementById("telemetry-simulator");
    const select = document.getElementById("sim-device-id");
    if (!panel || !select) return;

    panel.hidden = false;
    const currentValue = select.value;
    select.innerHTML = `<option value="">Select a tracker</option>`;

    if (Array.isArray(trackers)) {
        trackers.forEach(tracker => {
            if (!tracker.device_id) return;
            const option = document.createElement("option");
            option.value = tracker.device_id;
            option.textContent = `${tracker.name || tracker.device_id} — ${tracker.device_id}`;
            select.appendChild(option);
        });
    }

    if (currentValue && Array.from(select.options).some(o => o.value === currentValue)) {
        select.value = currentValue;
    } else if (select.options.length === 2) {
        select.selectedIndex = 1;
    }
}

function setTelemetrySimulatorMessage(text, type = "") {
    const message = document.getElementById("telemetry-simulator-message");
    if (!message) return;
    message.textContent = text;
    message.className = `form-message ${type}`.trim();
}

function getTelemetrySimulatorData(forceSOS = null) {
    const deviceId = document.getElementById("sim-device-id")?.value.trim();
    const battery = Number(document.getElementById("sim-battery")?.value);
    const latitude = Number(document.getElementById("sim-latitude")?.value);
    const longitude = Number(document.getElementById("sim-longitude")?.value);
    const accuracy = Number(document.getElementById("sim-accuracy")?.value);
    const gps = document.getElementById("sim-gps")?.value || "active";
    const wifi = document.getElementById("sim-wifi")?.value || "connected";
    const sos = document.getElementById("sim-sos")?.checked || false;

    if (!deviceId) throw new Error("Select a tracker first.");
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Enter a valid latitude.");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("Enter a valid longitude.");
    if (!Number.isFinite(accuracy) || accuracy < 0) throw new Error("Enter a valid GPS accuracy.");
    if (!Number.isFinite(battery) || battery < 0 || battery > 100) throw new Error("Battery must be between 0 and 100.");

    return {
        device_id: deviceId,
        latitude,
        longitude,
        accuracy,
        battery,
        gps_status: gps,
        wifi_status: wifi,
        sos: forceSOS === null ? sos : forceSOS
    };
}

async function sendTestTelemetry(forceSOS = null) {
    const button = document.getElementById("send-test-telemetry-button");
    const sosButton = document.getElementById("send-test-sos-button");

    try {
        const payload = getTelemetrySimulatorData(forceSOS);
        if (button) button.disabled = true;
        if (sosButton) sosButton.disabled = true;

        setTelemetrySimulatorMessage(forceSOS === true ? "Sending SOS telemetry..." : "Sending telemetry...");

        const response = await fetch(`${API_BASE}/telemetry`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || "Telemetry request failed.");

        setTelemetrySimulatorMessage(
            forceSOS === true
                ? "SOS telemetry sent. Check Alerts and the tracker card."
                : "Telemetry sent successfully. Tracker data updated.",
            "success"
        );

        await loadTrackers();
        await loadAlerts();
    } catch (error) {
        console.error("Telemetry simulator error:", error);
        setTelemetrySimulatorMessage(error.message || "Unable to send test telemetry.", "error");
    } finally {
        if (button) button.disabled = false;
        if (sosButton) sosButton.disabled = false;
    }
}

function resetTelemetrySimulator() {
    const values = {
        "sim-battery": 87,
        "sim-latitude": 22.3072,
        "sim-longitude": 73.1812,
        "sim-accuracy": 5
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
    });
    const gps = document.getElementById("sim-gps");
    const wifi = document.getElementById("sim-wifi");
    const sos = document.getElementById("sim-sos");
    if (gps) gps.value = "active";
    if (wifi) wifi.value = "connected";
    if (sos) sos.checked = false;
    setTelemetrySimulatorMessage("");
}

function initializeTelemetrySimulator() {
    document.getElementById("send-test-telemetry-button")?.addEventListener("click", () => sendTestTelemetry(null));
    document.getElementById("send-test-sos-button")?.addEventListener("click", () => {
        const sos = document.getElementById("sim-sos");
        if (sos) sos.checked = true;
        sendTestTelemetry(true);
    });
    document.getElementById("fill-test-telemetry-button")?.addEventListener("click", resetTelemetrySimulator);
}

// ======================================================
// NAVIGATION EVENTS
// ======================================================

function initializeNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item[data-page]"
        );

    navItems.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const page =
                    button.dataset.page;

                if (page) {

                    showPage(page);
                }
            }
        );
    });
}


// ======================================================
// INITIALIZE APPLICATION
// ======================================================

// ======================================================
// TRACKER FORM CONTROLS - SINGLE IMPLEMENTATION
// ======================================================

function openAddTrackerForm() {
    const form = document.getElementById("add-tracker-form");
    if (!form) {
        console.error("Add tracker form not found");
        return;
    }

    form.hidden = false;
    form.style.display = "block";

    const nameInput = document.getElementById("tracker-name");
    if (nameInput) {
        setTimeout(() => nameInput.focus(), 50);
    }
}

function closeAddTrackerForm() {
    const form = document.getElementById("add-tracker-form");
    if (form) {
        form.hidden = true;
        form.style.display = "none";
    }
}

async function addTracker(event) {
    if (event) event.preventDefault();

    const nameInput = document.getElementById("tracker-name");
    const deviceIdInput = document.getElementById("tracker-device-id");
    const personInput = document.getElementById("tracker-person");
    const phoneInput = document.getElementById("tracker-phone");
    const message = document.getElementById("add-tracker-message");
    const button = document.getElementById("save-tracker-button");

    if (!nameInput || !deviceIdInput) {
        console.error("Tracker form fields not found");
        return;
    }

    const name = nameInput.value.trim();
    const deviceId = deviceIdInput.value.trim();
    const assignedPerson = personInput ? personInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";

    if (!name || !deviceId) {
        if (message) {
            message.textContent = "Tracker Name and Device ID are required.";
            message.className = "form-message error";
        }
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Adding...";
    }

    if (message) {
        message.textContent = "Registering tracker...";
        message.className = "form-message";
    }

    try {
        const response = await fetch(`${API_BASE}/trackers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name,
                device_id: deviceId,
                assigned_person: assignedPerson,
                phone: phone,
                status: "offline",
                battery: 0,
                gps_status: "unknown",
                wifi_status: "unknown"
            })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || data.message || "Failed to add tracker");
        }

        if (message) {
            message.textContent = "Tracker added successfully.";
            message.className = "form-message success";
        }

        nameInput.value = "";
        deviceIdInput.value = "";
        if (personInput) personInput.value = "";
        if (phoneInput) phoneInput.value = "";

        await loadTrackers();

        setTimeout(() => {
            closeAddTrackerForm();
            if (message) {
                message.textContent = "";
                message.className = "form-message";
            }
        }, 700);

    } catch (error) {
        console.error("Add tracker error:", error);
        if (message) {
            message.textContent = error.message || "Unable to add tracker.";
            message.className = "form-message error";
        }
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Add Tracker";
        }
    }
}

function initializeTrackerForm() {
    const addButton = document.getElementById("add-tracker-button");
    const cancelButton = document.getElementById("cancel-tracker-button");
    const refreshButton = document.getElementById("refresh-trackers-button");
    const form = document.getElementById("tracker-add-form");

    if (addButton) addButton.addEventListener("click", openAddTrackerForm);
    if (cancelButton) cancelButton.addEventListener("click", closeAddTrackerForm);
    if (refreshButton) refreshButton.addEventListener("click", loadTrackers);
    if (form) form.addEventListener("submit", addTracker);
}

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "IoT Safety Tracker initialized"
        );

        // Navigation
        initializeNavigation();

        // Dashboard map
        initializeMap();

        // Tracker form
        initializeTrackerForm();
        initializeTelemetrySimulator();

        // Initial dashboard data
        loadTrackers();

        // Initial alerts
        loadAlerts();
// ==================================================
        // AUTO REFRESH TRACKERS
        // ==================================================

        setInterval(
            () => {

                loadTrackers();

            },
            10000
        );

        // ==================================================
        // AUTO REFRESH ALERTS
        // ==================================================

        setInterval(
            () => {

                loadAlerts();

            },
            10000
        );

    }
);


async function updateMotionSensor() {
    const trackerId = "TRACKER_02";

    try {
        const response = await fetch(`/api/telemetry/${trackerId}`);

        if (!response.ok) {
            throw new Error("Could not fetch tracker data");
        }

        const records = await response.json();
        const tracker = records[0];

        const formatAxis = value =>
            typeof value === "number" && Number.isFinite(value)
                ? `${value.toFixed(3)} g`
                : "--";

        document.getElementById("accel-x").textContent =
            formatAxis(tracker.accel_x);

        document.getElementById("accel-y").textContent =
            formatAxis(tracker.accel_y);

        document.getElementById("accel-z").textContent =
            formatAxis(tracker.accel_z);

        document.getElementById("motion-updated").textContent =
            `Last checked: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        document.getElementById("motion-updated").textContent =
            "Unable to retrieve sensor data.";
        console.error("Motion sensor update failed:", error);
    }
}

updateMotionSensor();
setInterval(updateMotionSensor, 5000);