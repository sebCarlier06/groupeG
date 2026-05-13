"""
Raspberry Pi Pico W — Chicken Road IoT (mode Wi-Fi MQTT)
- Connexion Wi-Fi → broker MQTT
- 4 boutons → publie {"direction": "up/down/left/right"} sur game/button/press
- Reçoit commandes LED sur game/led/command → contrôle LED onboard
"""
import json
import time
import network
from machine import Pin
from umqtt.simple import MQTTClient

from config import WIFI_SSID, WIFI_PASSWORD, MQTT_HOST, MQTT_PORT

MQTT_BROKER = MQTT_HOST
CLIENT_ID   = b"pico-w-chickengame"

BUTTONS = {
    'left':  Pin(0,  Pin.IN, Pin.PULL_UP),
    'right': Pin(1,  Pin.IN, Pin.PULL_UP),
    'down':  Pin(2,  Pin.IN, Pin.PULL_UP),
    'up':    Pin(14, Pin.IN, Pin.PULL_UP),
}

led = Pin(15, Pin.OUT)
last_states = {k: True for k in BUTTONS}
debounce    = {k: 0    for k in BUTTONS}


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        wlan.connect(WIFI_SSID, WIFI_PASSWORD)
        print("Connexion Wi-Fi...")
        while not wlan.isconnected():
            time.sleep(0.5)
    print("Wi-Fi connecté:", wlan.ifconfig())


def on_message(topic, msg):
    cmd = msg.decode().strip()
    print("MQTT reçu [{}]: {}".format(topic.decode(), cmd))
    if cmd == "ON":
        for _ in range(25):
            led.toggle()
            time.sleep(0.08)
        led.off()
    elif cmd == "OFF":
        led.on()
    elif cmd == "WIN":
        led.on()


def connect_mqtt():
    client = MQTTClient(CLIENT_ID, MQTT_BROKER, port=MQTT_PORT, keepalive=60)
    client.set_callback(on_message)
    client.connect()
    client.subscribe(b"game/led/command")
    print("MQTT connecté — abonné à game/led/command")
    return client


connect_wifi()
client = connect_mqtt()
led.on()
print("Pico W prêt")

while True:
    try:
        client.check_msg()

        now = time.ticks_ms()
        for name, pin in BUTTONS.items():
            state = pin.value()
            if state == False and last_states[name] == True:
                if time.ticks_diff(now, debounce[name]) > 200:
                    payload = json.dumps({"direction": name})
                    client.publish(b"game/button/press", payload.encode())
                    print("Publié:", payload)
                    debounce[name] = now
            last_states[name] = state

    except OSError:
        print("MQTT déconnecté — reconnexion...")
        time.sleep(2)
        try:
            connect_wifi()
            client = connect_mqtt()
        except Exception as e:
            print("Erreur reconnexion:", e)

    time.sleep_ms(20)
