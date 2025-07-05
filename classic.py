# Test code on RPi for Bluetooth Classic

import serial
import time
import os 

while not os.path.exists("/dev/rfcomm0"):
    print("Waiting for ESP32 to be available...")
    time.sleep(1)
# Now safe to run your using serial

ser = serial.Serial('/dev/rfcomm0', 9600, timeout=1)
time.sleep(1)

ser.write(b'H')  # Send byte to ESP32
print("Sent!")

if ser.in_waiting:
    print("Received:", ser.read(ser.in_waiting).decode())

ser.close()
