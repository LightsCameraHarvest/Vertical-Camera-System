#include <AccelStepper.h>

// Stepper motor pins and driver
#define dirPin 2
#define stepPin 3
#define motorInterfaceType 1  // DRV8825 in step/dir mode

AccelStepper stepper(motorInterfaceType, stepPin, dirPin);

// Limit switch pin (bottom/home position)
const int homeSwitchPin = 8; // use INPUT_PULLUP

// Number of trays
const int trayCount = 8;

// Distance between trays (mm)
const float traySpacing = 50.0;

// Steps per mm calculation (NEMA17, DRV8825, 1/8, 16 teeth GT2 pulley)
const int fullStepsPerRev = 200;
const int microsteps = 8;
const int stepsPerRev = fullStepsPerRev * microsteps; // 200*8=1600
const float pulleyCircumference = 16 * 2.0; // 32 mm
const float stepsPerMM = stepsPerRev / pulleyCircumference; // 1600/32=50
const long trayStepDistance = traySpacing * stepsPerMM; // 50*50=2500

void setup() {
  Serial.begin(9600);
  pinMode(homeSwitchPin, INPUT_PULLUP); // Assuming normally closed

  // Configure stepper speed & acceleration
  stepper.setMaxSpeed(800);       // adjust as needed
  stepper.setAcceleration(200);   // adjust as needed

  Serial.println("Starting homing...");
  homeStepper();

  Serial.println("Start checking trays...");
  // Move to each tray
  for (int i = 0; i < trayCount; i++) {
    long targetPosition = stepper.currentPosition() + trayStepDistance;

    stepper.moveTo(targetPosition);
    while (stepper.distanceToGo() != 0) {
      stepper.run();
    }

    Serial.print("Reached tray ");
    Serial.println(i + 1);

    delay(10000); // Wait 10 seconds to check/scan tray
  }

  Serial.println("All trays checked!");
}

void loop() {
  // nothing to do here
}

void homeStepper() {
  // Move down slowly until limit switch triggers
  stepper.setMaxSpeed(200);
  stepper.moveTo(-10000); // move negative direction

  while (digitalRead(homeSwitchPin) == HIGH) {
    stepper.run();
  }

  stepper.stop();
  delay(200);

  // Back off a little to release switch
  stepper.moveTo(stepper.currentPosition() + 5 * stepsPerMM); // move up ~5mm
  while (stepper.distanceToGo() != 0) {
    stepper.run();
  }

  // Reset current position to zero
  stepper.setCurrentPosition(0);
  Serial.println("Homing complete!");
}
