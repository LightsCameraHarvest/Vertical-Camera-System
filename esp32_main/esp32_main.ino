// Test code on ESP-32 for Bluetooth Classic

#include <AccelStepper.h>
#include <ESP32Servo.h>
#include <BluetoothSerial.h>

const int x_pin = 39; // joystick
const int y_pin = 36; 

// Limit switch pins
const int topLimitPin = 33;
const int bottomLimitPin = 32;

const int ena_pin = 14; // motor driver
const int dir_pin = 12;
const int stp_pin = 13;

Servo myServo;
const int pwm_pin = 4; //servo

// Stepper setup: DRIVER mode uses STEP, DIR
AccelStepper stepper(AccelStepper::DRIVER, stp_pin, dir_pin);
const int maxSpeed = 1000;
const int accel = 600;
const int deadzone = 100;

BluetoothSerial SerialBT;

void goHome() {
  Serial.println("Going home...");
  digitalWrite(stp_pin, HIGH);
  delay(1000);
  digitalWrite(stp_pin, LOW);
  delay(1000);
}

void setup() {
  Serial.begin(115200);
  Serial.println("Hello from ESP32!");
  // Enable stepper driver
  pinMode(ena_pin, OUTPUT);
  digitalWrite(ena_pin, LOW); // LOW = enabled on most drivers

  // Limit switch inputs
  pinMode(topLimitPin, INPUT_PULLUP);
  pinMode(bottomLimitPin, INPUT_PULLUP);

  // Stepper motor config
  stepper.setMaxSpeed(maxSpeed);
  stepper.setAcceleration(accel);

  // Servo init
  myServo.attach(pwm_pin);

  SerialBT.begin("ESP32_BT");
  Serial.println("Bluetooth Started! Waiting for pairing...");

}

void loop() {
  if (SerialBT.available()) {
    char c = SerialBT.read();
    Serial.print("Received: ");
    Serial.println(c);
    SerialBT.println("ack");

    if (c == 'G') {
      goHome();
    }
  }
  // === Read Joystick ===
  int joyX = analogRead(x_pin); // 0–4095 on ESP32
  int joyY = analogRead(y_pin);

  // === Servo Control ===
  int angle = map(joyX, 0, 4095, 0, 180);
  myServo.write(angle);

  // === Read Limit Switches ===
  bool topPressed = digitalRead(topLimitPin) == LOW;
  bool bottomPressed = digitalRead(bottomLimitPin) == LOW;

  // === Determine Direction from Y-axis ===
  int movementDir = 0;
  if (joyY > 2048 + deadzone) {
    movementDir = 1;
  } else if (joyY < 2048 - deadzone) {
    movementDir = -1;
  }

  // === Enforce Limit Switches ===
  if (topPressed && movementDir == 1) {
    movementDir = 0;
  }
  if (bottomPressed && movementDir == -1) {
    movementDir = 0;
  }

  // === Drive Stepper ===
  if (movementDir == 1) {
    stepper.setSpeed(maxSpeed);
  } else if (movementDir == -1) {
    stepper.setSpeed(-maxSpeed);
  } else {
    stepper.setSpeed(0);
  }

  stepper.runSpeed(); // Non-blocking continuous motion
}