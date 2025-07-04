# Test code on RPi for Bluetooth Classic

import serial
import time

ser = serial.Serial('/dev/rfcomm0', 9600, timeout=1)
time.sleep(1)

ser.write(b'H')  # Send byte to ESP32
print("Sent!")

if ser.in_waiting:
    print("Received:", ser.read(ser.in_waiting).decode())

ser.close()
