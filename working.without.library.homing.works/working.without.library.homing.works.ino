// Stepper motor pins
#define dirPin 2
#define stepPin 4
#define enablePin 8

// Limit switch pins
const int bottomLimitPin = 6;
const int topLimitPin = 7;

// Joystick pins
const int joyYPin = A0; // Stepper control
const int joyXPin = A1; // Servo control

// Servo parameters
const int servoPin = 9;
int servoPos = 135; // degrees (0–270)
const int minAngle = 0;
const int maxAngle = 270;
const int deadZoneLow = 490;
const int deadZoneHigh = 530;
const int stepSize = 1; // degrees per change

// Servo speed control
const int servoMoveInterval = 20; // ms between angle updates
unsigned long lastServoMove = 0;

// Servo PWM timing
unsigned long lastServoPulse = 0;
const int pwmPeriod = 20000; // 20 ms period for servo

// Stepper parameters
const float maxSpeed = 1000; // Steps per second
const int deadzone = 100;
const long stepDelayMicros = 1000000 / maxSpeed;

// Homing flag
bool homingDone = false;

void setup() {
  pinMode(enablePin, OUTPUT);
  digitalWrite(enablePin, LOW);

  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);

  pinMode(topLimitPin, INPUT_PULLUP);
  pinMode(bottomLimitPin, INPUT_PULLUP);

  pinMode(servoPin, OUTPUT);
}

void loop() {
  unsigned long nowMillis = millis();
  unsigned long nowMicros = micros();

  // Read joystick X for servo
  int joyX = analogRead(joyXPin);

  // Update servo target angle slowly based on time and step size
  if (nowMillis - lastServoMove >= servoMoveInterval) {
    if (joyX < deadZoneLow) {
      servoPos = max(minAngle, servoPos - stepSize);
    } else if (joyX > deadZoneHigh) {
      servoPos = min(maxAngle, servoPos + stepSize);
    }
    lastServoMove = nowMillis;
  }

  // Send continuous PWM pulse every 20ms
  if (nowMicros - lastServoPulse >= pwmPeriod) {
    sendServoPulse();
    lastServoPulse = nowMicros;
  }

  bool topPressed = digitalRead(topLimitPin) == LOW;
  bool bottomPressed = digitalRead(bottomLimitPin) == LOW;

  int movementDir = 0;

  if (!homingDone) {
    // ---------- HOMING MODE ----------
    // Always move UP until top limit switch is pressed
    if (topPressed) {
      homingDone = true; // Homing complete!
    } else {
      movementDir = 1;   // Force move UP
    }
  } else {
    // ---------- NORMAL MODE ----------
    int joyY = analogRead(joyYPin);

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
  }

  if (movementDir != 0) {
    digitalWrite(dirPin, movementDir == 1 ? HIGH : LOW);
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(5);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(stepDelayMicros - 5);
  }
}

void sendServoPulse() {
  // Map 0–270 degrees to 500–2500µs pulse — adjust for your servo
  int pulseWidth = map(servoPos, 0, 270, 500, 2500);
  digitalWrite(servoPin, HIGH);
  delayMicroseconds(pulseWidth);
  digitalWrite(servoPin, LOW);
  // The rest of the 20ms cycle is handled by loop timing
}
