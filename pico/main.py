"""
Raspberry Pi Pico W — Chicken Road IoT
- Sens montant  : appui bouton → publie sur game/button/press
- Sens descendant: reçoit game/led/command → contrôle la LED onboard
"""
import network
import time
from machine import Pin
from umqtt.simple import MQTTClient

# ── Configuration ────────────────────────────────────────────────
WIFI_SSID     = "VOTRE_SSID"
WIFI_PASSWORD = "VOTRE_MOT_DE_PASSE"

MQTT_BROKER    = "192.168.1.100"   # IP du serveur où tourne Mosquitto
MQTT_PORT      = 1883
MQTT_CLIENT_ID = b"pico_chicken"

TOPIC_PUBLISH   = b"game/button/press"
TOPIC_SUBSCRIBE = b"game/led/command"

BUTTON_PIN = 14   # GP14 — câbler entre GP14 et GND

# ── Hardware ─────────────────────────────────────────────────────
button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)  # LOW quand pressé
led    = Pin("LED", Pin.OUT)                    # LED onboard Pico W

# ── WiFi ─────────────────────────────────────────────────────────
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    print("Connexion WiFi", end="")
    for _ in range(20):
        if wlan.isconnected():
            break
        time.sleep(0.5)
        print(".", end="")
    if not wlan.isconnected():
        raise RuntimeError("Connexion WiFi échouée")
    print(f"\nConnecté : {wlan.ifconfig()[0]}")

# ── MQTT callback (sens descendant) ──────────────────────────────
def on_message(topic, msg):
    payload = msg.decode()
    print(f"MQTT [{topic.decode()}] : {payload}")

    if payload == "ON":
        led.on()                       # Signal game over
    elif payload == "OFF":
        led.off()                      # Réinitialisation
    elif payload == "WIN":
        for _ in range(6):             # Clignotement victoire
            led.toggle()
            time.sleep(0.15)
        led.off()

# ── Main ──────────────────────────────────────────────────────────
def main():
    connect_wifi()

    client = MQTTClient(MQTT_CLIENT_ID, MQTT_BROKER, port=MQTT_PORT)
    client.set_callback(on_message)
    client.connect()
    client.subscribe(TOPIC_SUBSCRIBE)
    print(f"Connecté au broker MQTT, abonné à {TOPIC_SUBSCRIBE.decode()}")

    last_state   = True   # PULL_UP : True = bouton relâché
    debounce_ms  = 0

    while True:
        client.check_msg()            # Vérifier les messages entrants

        state = button.value()
        now   = time.ticks_ms()

        if state == False and last_state == True:
            if time.ticks_diff(now, debounce_ms) > 200:
                client.publish(TOPIC_PUBLISH, b"press")
                print("Bouton pressé → publié")
                debounce_ms = now

        last_state = state
        time.sleep_ms(20)

main()
