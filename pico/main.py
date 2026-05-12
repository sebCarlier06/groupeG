"""
Raspberry Pi Pico — Chicken Road IoT (mode USB série)
- 4 boutons → envoie "up" / "down" / "left" / "right" sur le port série USB
- Reçoit "ON" / "OFF" sur le port série → contrôle la LED
"""
import sys
import select
import time
from machine import Pin

BUTTONS = {
    'left':  Pin(0,  Pin.IN, Pin.PULL_UP),
    'right': Pin(1,  Pin.IN, Pin.PULL_UP),
    'down':  Pin(2,  Pin.IN, Pin.PULL_UP),
    'up':    Pin(14, Pin.IN, Pin.PULL_UP),
}

led = Pin(15, Pin.OUT)

last_states = {k: True for k in BUTTONS}
debounce    = {k: 0    for k in BUTTONS}

led.on()
print("Pico prêt — mode USB série")

while True:
    # ── Commandes LED reçues depuis le bridge ─────────────────────
    r, _, _ = select.select([sys.stdin], [], [], 0)
    if r:
        cmd = sys.stdin.readline().strip()
        if cmd == "ON":
            for _ in range(25):
                led.toggle()
                time.sleep(0.08)
            led.off()
        elif cmd == "OFF":
            led.on()
        elif cmd == "WIN":
            led.on()

    # ── Détection des 4 boutons avec debounce ─────────────────────
    now = time.ticks_ms()
    for name, pin in BUTTONS.items():
        state = pin.value()
        if state == False and last_states[name] == True:
            if time.ticks_diff(now, debounce[name]) > 200:
                print(name)
                debounce[name] = now
        last_states[name] = state

    time.sleep_ms(20)
