"""
Raspberry Pi Pico — Chicken Road IoT (mode USB série)
- Appui bouton → envoie "press\n" sur le port série USB
- Reçoit "ON" / "OFF" / "WIN" sur le port série → contrôle la LED onboard
"""
import sys
import select
import time
from machine import Pin

BUTTON_PIN = 14   # GP14 — câbler entre GP14 et GND

button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)  # LOW quand pressé
led    = Pin(15, Pin.OUT)                        # LED sur GP15

last_state  = True
debounce_ms = 0

led.on()  # LED allumée au démarrage
print("Pico prêt — mode USB série")

while True:
    # ── Commandes LED reçues depuis le bridge ─────────────────────
    r, _, _ = select.select([sys.stdin], [], [], 0)
    if r:
        cmd = sys.stdin.readline().strip()
        if cmd == "ON":
            # Clignote 2 secondes puis s'éteint
            for _ in range(25):
                led.toggle()
                time.sleep(0.08)
            led.off()
        elif cmd == "OFF":
            led.on()  # Recommencer → LED allumée
        elif cmd == "WIN":
            led.on()

    # ── Détection appui bouton avec debounce ─────────────────────
    state = button.value()
    now   = time.ticks_ms()

    if state == False and last_state == True:
        if time.ticks_diff(now, debounce_ms) > 200:
            print("press")
            debounce_ms = now

    last_state = state
    time.sleep_ms(20)
