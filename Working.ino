// --------------------
// Pins
#define dirPin 2
#define stepPin 4
#define enablePin 8

#define bottomLimitPin 6
#define topLimitPin 7

#define joyYPin A0
#define joyXPin A1

#define servoPin 9

// --------------------
// Servo parameters
int servoPos = 135;
const int minAngle = 0;
const int maxAngle = 270;
const int deadZoneLow = 490;
const int deadZoneHigh = 530;
const int stepSize = 1;

const int servoMoveInterval = 20; // ms
unsigned long lastServoMove = 0;

unsigned long lastServoPulse = 0;
const int pwmPeriod = 20000; // µs

// --------------------
// Stepper parameters
const float maxSpeed = 1000;
const int deadzone = 100;
const long stepDelayMicros = 1000000 / maxSpeed;

bool homed = false;

// --------------------
// Level control
const float totalTravelCm = 30.0;
const float stepDistanceCm = 10.0;
const int stepsPerCm = 200;  // <-- EDIT this for your machine!
int currentLevel = 1;
int targetLevel = 1;

// --------------------
void setup() {
  pinMode(enablePin, OUTPUT);
  digitalWrite(enablePin, LOW);

  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);

  pinMode(topLimitPin, INPUT_PULLUP);
  pinMode(bottomLimitPin, INPUT_PULLUP);

  pinMode(servoPin, OUTPUT);

  Serial.begin(9600);
  Serial.println("System Ready. Homing first...");
}

// --------------------
void loop() {
  unsigned long nowMillis = millis();
  unsigned long nowMicros = micros();

  // Always send servo PWM
  if (nowMicros - lastServoPulse >= pwmPeriod) {
    sendServoPulse();
    lastServoPulse = nowMicros;
  }

  // Servo control
  int joyX = analogRead(joyXPin);
  if (nowMillis - lastServoMove >= servoMoveInterval) {
    if (joyX < deadZoneLow) {
      servoPos = max(minAngle, servoPos - stepSize);
    } else if (joyX > deadZoneHigh) {
      servoPos = min(maxAngle, servoPos + stepSize);
    }
    lastServoMove = nowMillis;
  }

  bool bottomPressed = digitalRead(bottomLimitPin) == LOW;

  // --------------------
  // Homing
  if (!homed) {
    if (!bottomPressed) {
      digitalWrite(dirPin, LOW); // LOW for DOWN → move to home
      stepOnce();
    } else {
      homed = true;
      currentLevel = 1;
      targetLevel = 1;
      Serial.println("Homing complete. Current level: 1");
      Serial.println("Enter target level (1–4):");
    }
    return; // wait until homed
  }

  // --------------------
  // Handle Serial input
  if (Serial.available()) {
    int inputLevel = Serial.parseInt();
    if (inputLevel >= 1 && inputLevel <= 4) {
      targetLevel = inputLevel;
      Serial.print("Target level set to: ");
      Serial.println(targetLevel);
    } else {
      Serial.println("Invalid level. Enter 1–4.");
    }
  }

  // --------------------
  // Go to target level if needed
  if (currentLevel != targetLevel) {
    if (targetLevel > currentLevel) {
      // Going UP to higher level
      digitalWrite(dirPin, HIGH); // HIGH for UP
      bool topPressed = digitalRead(topLimitPin) == LOW;

      if (!topPressed) {
        stepDistance(stepDistanceCm);
        currentLevel++;
        Serial.print("Now at level: ");
        Serial.println(currentLevel);
      } else {
        Serial.println("Top limit hit!");
      }
    } else if (targetLevel < currentLevel) {
      // Going DOWN to lower level
      digitalWrite(dirPin, LOW); // LOW for DOWN
      if (!bottomPressed) {
        stepDistance(stepDistanceCm);
        currentLevel--;
        Serial.print("Now at level: ");
        Serial.println(currentLevel);
      } else {
        Serial.println("Bottom limit hit!");
        currentLevel = 1; // Safety
      }
    }
  } else {
    // Allow joystick manual only if not moving automatically
    handleManualStepper();
  }
}

// --------------------
void stepOnce() {
  digitalWrite(stepPin, HIGH);
  delayMicroseconds(5);
  digitalWrite(stepPin, LOW);
  delayMicroseconds(stepDelayMicros - 5);
}

void stepDistance(float cm) {
  int steps = (int)(cm * stepsPerCm);
  for (int i = 0; i < steps; i++) {
    stepOnce();
  }
}

// --------------------
void handleManualStepper() {
  int joyY = analogRead(joyYPin);
  bool topPressed = digitalRead(topLimitPin) == LOW;
  bool bottomPressed = digitalRead(bottomLimitPin) == LOW;

  int movementDir = 0;
  if (joyY > 512 + deadzone) {
    movementDir = 1; // UP
  } else if (joyY < 512 - deadzone) {
    movementDir = -1; // DOWN
  }

  if (topPressed && movementDir == 1) movementDir = 0;
  if (bottomPressed && movementDir == -1) movementDir = 0;

  if (movementDir != 0) {
    digitalWrite(dirPin, movementDir == 1 ? HIGH : LOW);
    stepOnce();
  }
}

// --------------------
void sendServoPulse() {
  int pulseWidth = map(servoPos, 0, 270, 500, 2500);
  digitalWrite(servoPin, HIGH);
  delayMicroseconds(pulseWidth);
  digitalWrite(servoPin, LOW);
}

