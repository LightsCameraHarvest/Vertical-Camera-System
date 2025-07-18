# Raspberry Pi file path: /home/helena/controls.py

import pigpio
import RPi.GPIO as GPIO
from time import sleep
import asyncio
import websockets
import json

# Pin definitions
ena_pin = 17
dir_pin = 27
stp_pin = 22
motor_step_size = 200
max_steps = 1000  # ***NEED TO TEST!!!***

servo_pin = 13  # or 19
min_pulse = 1000
max_pulse = 2000
servo_pos = max_pulse // 2
servo_step_size = 20
limit_pin = 26  # or 26
# because we have no bottom limit pin, we need to keep track of steps
total_steps = 0

pi = pigpio.pi()
if not pi.connected:
    print("Failed to connect to pigpiod. Is it running?")
    exit(1)

# GPIO setup
GPIO.setmode(GPIO.BCM)  # GPIO numbers not board numbers
GPIO.setup(ena_pin, GPIO.OUT)
GPIO.setup(dir_pin, GPIO.OUT)
GPIO.setup(stp_pin, GPIO.OUT)
GPIO.setup(limit_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

current_level = 0
target_level = 0

pi.set_servo_pulsewidth(servo_pin, servo_pos)

def isTopPressed():
    return GPIO.input(limit_pin) == GPIO.LOW

def goHome():
    global current_level, target_level
    GPIO.output(ena_pin, GPIO.LOW)
    print("Going home...")

    while not isTopPressed():
        # step pulse
        GPIO.output(stp_pin, GPIO.HIGH)
        sleep(0.001)
        GPIO.output(stp_pin, GPIO.LOW)
        sleep(0.001)

    total_steps = 0
    current_level = 1
    target_level = 1
    print("Homing complete. Current level: 1")
    GPIO.output(ena_pin, GPIO.HIGH)
    return

def stepUp():
    global total_steps
    if not isTopPressed():
        GPIO.output(dir_pin, GPIO.HIGH)
        sleep(0.001)
        for i in range(motor_step_size):
            GPIO.output(stp_pin, GPIO.HIGH)
            sleep(0.001)
            GPIO.output(stp_pin, GPIO.LOW)
            sleep(0.001)
            total_steps += 1

def stepDown():
    global total_steps
    if total_steps <= max_steps:
        GPIO.output(dir_pin, GPIO.LOW)
        sleep(0.001)
        for i in range(motor_step_size):
            GPIO.output(stp_pin, GPIO.HIGH)
            sleep(0.001)
            GPIO.output(stp_pin, GPIO.LOW)
            sleep(0.001)
            total_steps -= 1

def panCCW():
    global servo_pos
    servo_pos = max(min_pulse, servo_pos - servo_step_size)
    pi.set_servo_pulsewidth(servo_pin, servo_pos)

def panCW():
    global servo_pos
    servo_pos = min(max_pulse, servo_pos + servo_step_size)
    pi.set_servo_pulsewidth(servo_pin, servo_pos)

# WebSocket handler
async def handleCommand(websocket, path):
    async for message in websocket:
        try:
            data = json.loads(message)
            command = data.get('command')
            camera = data.get('camera')

            if command == 'u': # Up arrow
                stepUp()
            elif command == 'd': # Down arrow
                stepDown()
            elif command == 'l': # Left arrow
                panCCW()
            elif command == 'r': # Right arrow
                panCW()

            # sleep(0.1)  # Delay after action
        except json.JSONDecodeError:
            print("Received invalid JSON")

# Run the WebSocket server
async def main():
    try:
        async with websockets.serve(handleCommand, "0.0.0.0", 8765):
            print("WebSocket server running...")
            await asyncio.Future()  # Run forever
    except KeyboardInterrupt:
        print("Exiting...")
    finally:
        if pi.connected:
            try:
                pi.set_servo_pulsewidth(servo_pin, 0)
                pi.stop()
            except Exception as e:
                print(f"Error during pigpio cleanup: {e}")

if __name__ == "__main__":
    asyncio.run(main())
