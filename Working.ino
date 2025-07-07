#include <Servo.h>

// Stepper motor pins
#define dirPin 2
#define stepPin 4
#define enablePin 8

// Limit switch pins
const int  bottomLimitPin= 6;
const int topLimitPin = 7;

// Joystick pins
const int joyYPin = A0; // Stepper
const int joyXPin = A1; // Servo

// Servo parameters
const int servoPin = 9;
Servo myServo;
int servoPos = 135; // Start at middle (0–270°)
const int minAngle = 0;
const int maxAngle = 180; // ⚠️ NOTE: most hobby servos max at ~180°!
const int deadZoneLow = 490;
const int deadZoneHigh = 530;
const int stepSize = 1;
const long servoUpdateInterval = 50; // ms

// Stepper parameters
const float maxSpeed = 1000; // Steps per second
const int deadzone = 100;
const long stepDelayMicros = 1000000 / maxSpeed;

unsigned long lastServoUpdate = 0;

void setup() {
  // Stepper setup
  pinMode(enablePin, OUTPUT);n
  digitalWrite(enablePin, LOW);
  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(topLimitPin, INPUT_PULLUP);
  pinMode(bottomLimitPin, INPUT_PULLUP);

  // Servo setup
  myServo.attach(servoPin);
  myServo.write(servoPos);
}

void loop() {
  unsigned long currentMillis = millis();

  int joyY = analogRead(joyYPin);
  int joyX = analogRead(joyXPin);

  if (currentMillis - lastServoUpdate >= servoUpdateInterval) {
    if (joyX < deadZoneLow) {
      servoPos = max(minAngle, servoPos - stepSize);
    } else if (joyX > deadZoneHigh) {
      servoPos = min(maxAngle, servoPos + stepSize);
    }
    myServo.write(servoPos);
    lastServoUpdate = currentMillis;
  }

  bool topPressed = digitalRead(topLimitPin) == LOW;
  bool bottomPressed = digitalRead(bottomLimitPin) == LOW;

  int movementDir = 0;
  if (joyY > 512 + deadzone) {
    movementDir = 1;
  } else if (joyY < 512 - deadzone) {
    movementDir = -1;
  }

  if (topPressed && movementDir == 1) {
    movementDir = 0;
  }
  if (bottomPressed && movementDir == -1) {
    movementDir = 0;
  }

  if (movementDir != 0) {
    digitalWrite(dirPin, movementDir == 1 ? HIGH : LOW);
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(5);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(stepDelayMicros - 5);
  }
}
