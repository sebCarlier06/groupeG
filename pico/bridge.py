"""
Bridge USB-série → Backend HTTP
Lit les événements du Pico sur /dev/ttyACM0 et les envoie au backend.
Redirige aussi les commandes LED du backend vers le Pico.

Usage :
    pip install pyserial requests socketio[client]
    python bridge.py
"""
import time
import threading
import serial
import requests
import socketio

SERIAL_PORT  = '/dev/ttyACM0'
BAUD_RATE    = 115200
BACKEND_HTTP = 'http://localhost:3000'

sio = socketio.Client()
ser = None


@sio.event
def connect():
    print("Bridge connecté au backend via Socket.IO")


@sio.event
def disconnect():
    print("Bridge déconnecté du backend")


@sio.on('led_command')
def on_led_command(data):
    """Reçoit les commandes LED du backend et les envoie au Pico via série."""
    cmd = data.get('command', '')
    if ser and ser.is_open and cmd in ('ON', 'OFF', 'WIN'):
        ser.write((cmd + '\n').encode())
        print(f"LED → Pico : {cmd}")


def connect_socket():
    while True:
        try:
            sio.connect(BACKEND_HTTP, transports=['websocket', 'polling'])
            sio.wait()
        except Exception as e:
            print(f"Socket.IO erreur : {e} — reconnexion dans 3s")
            time.sleep(3)


def main():
    global ser

    # Connexion Socket.IO en arrière-plan
    t = threading.Thread(target=connect_socket, daemon=True)
    t.start()

    # Connexion port série
    while True:
        try:
            ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
            print(f"Port série ouvert : {SERIAL_PORT}")
            break
        except serial.SerialException as e:
            print(f"Impossible d'ouvrir {SERIAL_PORT} : {e} — retry dans 2s")
            time.sleep(2)

    print("Bridge démarré. En attente d'appuis bouton…")

    while True:
        try:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if not line:
                continue
            print(f"Série reçu : {line!r}")
            # 'press' = rétrocompatibilité (ancien firmware → up)
            DIRECTIONS = {'up', 'down', 'left', 'right', 'press'}
            if line in DIRECTIONS:
                direction = 'up' if line == 'press' else line
                try:
                    r = requests.post(
                        f"{BACKEND_HTTP}/api/game/button",
                        json={'direction': direction},
                        timeout=2,
                    )
                    print(f"Backend {direction}: {r.status_code}")
                except requests.RequestException as e:
                    print(f"Erreur backend : {e}")
        except serial.SerialException as e:
            print(f"Erreur série : {e} — reconnexion dans 2s")
            time.sleep(2)
            try:
                ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
            except Exception:
                pass


if __name__ == '__main__':
    main()
