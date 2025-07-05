#include <AccelStepper.h>

const int dirPin = 2;
const int stepPin = 5;
const int enPin = 8;

const int stepsPerRev = 3200; // 200 steps * 16 microstepping

AccelStepper stepper(AccelStepper::DRIVER, stepPin, dirPin);

void setup() {
  pinMode(enPin, OUTPUT);
  digitalWrite(enPin, LOW); // Enable driver

  stepper.setMaxSpeed(5000);     // steps per second
  stepper.setAcceleration(2000);  // steps per second^2
}

void loop() {
  // Move 2 revolutions forward
  stepper.moveTo(4 * stepsPerRev);
  stepper.runToPosition(); // Wait until move is done

  delay(500);

  // Move 1.5 revolutions backward
  stepper.moveTo(-3 * stepsPerRev);
  stepper.runToPosition();

  delay(500);
}