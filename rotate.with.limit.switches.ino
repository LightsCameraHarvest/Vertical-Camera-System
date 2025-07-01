#include <AccelStepper.h>
#include <Servo.h>

// Stepper motor pins
#define dirPin 2
#define stepPin 3
#define enablePin 8

// Limit switch pins
const int topLimitPin = 6;
const int bottomLimitPin = 7;

// Joystick pins
const int joyXPin = A1; // Servo
const int joyYPin = A0; // Stepper

// Servo setup
Servo myServo;
const int servoPin = 9;

// Stepper setup
AccelStepper stepper(AccelStepper::DRIVER, stepPin, dirPin);
const int maxSpeed = 1000;
const int accel = 600;
const int deadzone = 100;

void setup() {
  pinMode(enablePin, OUTPUT);
  digitalWrite(enablePin, LOW); // Enable stepper

  pinMode(topLimitPin, INPUT_PULLUP);
  pinMode(bottomLimitPin, INPUT_PULLUP);

  stepper.setMaxSpeed(maxSpeed);
  stepper.setAcceleration(accel);

  myServo.attach(servoPin);
}

void loop() {
  // === Read Joystick ===
  int joyX = analogRead(joyXPin);
  int joyY = analogRead(joyYPin);

  // === Servo Control ===
  int angle = map(joyX, 0, 1023, 0, 180);
  myServo.write(angle);

  // === Read Limit Switches ===
  bool topPressed = digitalRead(topLimitPin) == LOW;
  bool bottomPressed = digitalRead(bottomLimitPin) == LOW;

  // === Stepper Logic ===
  int movementDir = 0; // 0 = stop, +1 = up, -1 = down

  if (joyY > 512 + deadzone) {
    movementDir = 1; // UP
  } else if (joyY < 512 - deadzone) {
    movementDir = -1; // DOWN
  } else {
    movementDir = 0; // JOYSTICK centered
  }

  // === Enforce Direction Lockout ===
  if (topPressed && movementDir == 1) {
    // At top, and trying to move UP
    movementDir = 0;
  }
  if (bottomPressed && movementDir == -1) {
    // At bottom, and trying to move DOWN
    movementDir = 0;
  }

  // === Set Speed Accordingly ===
  if (movementDir == 1) {
    stepper.setSpeed(maxSpeed); // Move UP
  } else if (movementDir == -1) {
    stepper.setSpeed(-maxSpeed); // Move DOWN
  } else {
    stepper.setSpeed(0); // Stop
  }

  stepper.runSpeed(); // Non-blocking update
}
