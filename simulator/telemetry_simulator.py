import requests
import random
import threading
import time

# ======================================================
# SMART SAFETY TELEMETRY SIMULATOR
# ======================================================

API_URL = "http://127.0.0.1:5000/api/telemetry"

DEVICE_ID = "TRACKER_01"

# Starting GPS location
latitude = 22.3072
longitude = 73.1812

# Device state
battery = 100.0
gps_connected = True
wifi_connected = True
running = True


# ======================================================
# SEND TELEMETRY
# ======================================================

def send_telemetry(sos=False):

    global latitude
    global longitude
    global battery

    # Simulate movement when GPS is available
    if gps_connected:
        latitude += random.uniform(-0.0005, 0.0005)
        longitude += random.uniform(-0.0005, 0.0005)

    # Simulate battery consumption
    battery -= random.uniform(0.05, 0.20)

    if battery <= 0:
        battery = 100.0

    data = {
        "device_id": DEVICE_ID,
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "accuracy": round(random.uniform(3, 10), 2)
        if gps_connected else None,
        "battery": round(battery, 2),
        "sos": sos,
        "gps_status": "connected"
        if gps_connected else "disconnected",
        "wifi_status": "connected"
        if wifi_connected else "disconnected"
    }

    try:

        response = requests.post(
            API_URL,
            json=data,
            timeout=5
        )

        if response.status_code == 201:

            if sos:
                print()
                print("🚨 ===============================")
                print("🚨 SOS ALERT SENT")
                print("🚨 ===============================")
                print(
                    f"📍 Location: "
                    f"{data['latitude']}, "
                    f"{data['longitude']}"
                )
                print(
                    f"🔋 Battery: "
                    f"{data['battery']}%"
                )
                print()

            else:

                print(
                    f"📡 {DEVICE_ID} | "
                    f"GPS: "
                    f"{data['latitude']}, "
                    f"{data['longitude']} | "
                    f"Battery: "
                    f"{data['battery']}% | "
                    f"GPS: "
                    f"{data['gps_status']} | "
                    f"Wi-Fi: "
                    f"{data['wifi_status']}"
                )

        else:

            print(
                f"❌ Server returned "
                f"{response.status_code}"
            )

    except requests.exceptions.RequestException as error:

        print(
            f"❌ Connection error: {error}"
        )


# ======================================================
# CONTINUOUS TELEMETRY
# ======================================================

def telemetry_loop():

    global running

    while running:

        send_telemetry()

        time.sleep(5)


# ======================================================
# COMMAND MENU
# ======================================================

def command_loop():

    global running
    global gps_connected
    global wifi_connected

    while running:

        print()
        print("--------------------------------------")
        print("SMART SAFETY DEVICE")
        print("--------------------------------------")
        print("1. Trigger SOS")
        print("2. Toggle GPS")
        print("3. Toggle Wi-Fi")
        print("4. Show device status")
        print("5. Exit")
        print("--------------------------------------")

        try:

            choice = input(
                "Enter choice: "
            ).strip()

        except (KeyboardInterrupt, EOFError):

            running = False
            break

        # ------------------------------------------------
        # SOS
        # ------------------------------------------------

        if choice == "1":

            print()
            print("🚨 SOS BUTTON PRESSED")
            print("Sending emergency telemetry...")

            send_telemetry(sos=True)

        # ------------------------------------------------
        # GPS
        # ------------------------------------------------

        elif choice == "2":

            gps_connected = not gps_connected

            if gps_connected:

                print(
                    "🛰️ GPS connection restored"
                )

            else:

                print(
                    "⚠️ GPS disconnected"
                )

        # ------------------------------------------------
        # WI-FI
        # ------------------------------------------------

        elif choice == "3":

            wifi_connected = not wifi_connected

            if wifi_connected:

                print(
                    "📶 Wi-Fi connection restored"
                )

            else:

                print(
                    "⚠️ Wi-Fi disconnected"
                )

        # ------------------------------------------------
        # STATUS
        # ------------------------------------------------

        elif choice == "4":

            print()
            print("DEVICE STATUS")
            print("--------------------------------------")
            print(f"Device ID : {DEVICE_ID}")
            print(
                f"Battery   : "
                f"{round(battery, 2)}%"
            )
            print(
                f"GPS       : "
                f"{'Connected' if gps_connected else 'Disconnected'}"
            )
            print(
                f"Wi-Fi     : "
                f"{'Connected' if wifi_connected else 'Disconnected'}"
            )
            print(
                f"Location  : "
                f"{round(latitude, 6)}, "
                f"{round(longitude, 6)}"
            )
            print("--------------------------------------")

        # ------------------------------------------------
        # EXIT
        # ------------------------------------------------

        elif choice == "5":

            print()
            print("🛑 Stopping simulator...")
            running = False
            break

        else:

            print(
                "❌ Invalid choice. "
                "Please select 1-5."
            )


# ======================================================
# MAIN
# ======================================================

if __name__ == "__main__":

    print()
    print("=" * 50)
    print("🛡️ SMART SAFETY TELEMETRY SIMULATOR")
    print("=" * 50)
    print()
    print(f"Device ID : {DEVICE_ID}")
    print(f"API       : {API_URL}")
    print()
    print("📡 Telemetry will be sent every 5 seconds.")
    print("🎛️ Use the menu to control the simulated device.")
    print()

    telemetry_thread = threading.Thread(
        target=telemetry_loop,
        daemon=True
    )

    telemetry_thread.start()

    command_loop()

    running = False

    print()
    print("Simulator stopped.")