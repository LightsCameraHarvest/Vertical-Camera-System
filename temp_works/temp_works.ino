#include <ESP32Servo.h>
#include <BluetoothSerial.h>

// Joystick pins
const int x_pin = 39;
const int y_pin = 36; 

// Limit switch pins
const int top_limit_pin = 33;
const int bottom_limit_pin = 32;

// Motor Driver Pins
const int ena_pin = 14;
const int dir_pin = 12;
const int stp_pin = 13;

// Servo parameters
Servo myServo;
const int servo_pin = 4; //servo
const int minAngle = 0;
const int maxAngle = 180;
int servoPos = 90; // Start at middle (0–270°)
const int stepSize = 5;

// Stepper parameters
const int deadzone = 100;

// Level control
const float totalTravelCm = 30.0;
const float stepDistanceCm = 10.0;
const int stepsPerCm = 200;
int currentLevel = 1;
int targetLevel = 1;

BluetoothSerial SerialBT;

bool isTopPressed() {
  return digitalRead(top_limit_pin) == LOW;
}
bool isBottomPressed() {
  return digitalRead(bottom_limit_pin) == LOW;
}

void goHome() {
  Serial.println("Going home...");
  digitalWrite(stp_pin, HIGH);
  delay(1000);
  digitalWrite(stp_pin, LOW);
  delay(1000);
  if (isTopPressed()){
    currentLevel = 1;
    targetLevel = 1;
    Serial.println("Homing complete. Current level: 1");
    return;
  }
}

void stepUp() {
  if(!isTopPressed()) {
    for(int i=0; i<200; i++) {
      digitalWrite(dir_pin, HIGH);
      digitalWrite(stp_pin, HIGH);
      delayMicroseconds(1000);
      digitalWrite(stp_pin, LOW);
      delayMicroseconds(1000);
    }
  }
}
void stepDown() {
  if(!isBottomPressed()) {
    for(int i=0; i<200; i++) {
      digitalWrite(dir_pin, LOW);
      digitalWrite(stp_pin, HIGH);
      delayMicroseconds(1000);
      digitalWrite(stp_pin, LOW);
      delayMicroseconds(1000);
    }
  }
}

void panCCW() {
  servoPos = max(minAngle, servoPos - stepSize);
  myServo.write(servoPos);
}
void panCW() {
  servoPos = min(maxAngle, servoPos + stepSize);
  myServo.write(servoPos);
}

void setup() {
  Serial.begin(115200);
  // Serial.println("Hello from ESP32!");
  // Stepper setup
  pinMode(ena_pin, OUTPUT);
  digitalWrite(ena_pin, LOW);
  pinMode(stp_pin, OUTPUT);
  pinMode(dir_pin, OUTPUT);
  // Limit switch setup
  pinMode(top_limit_pin, INPUT_PULLUP);
  pinMode(bottom_limit_pin, INPUT_PULLUP);
  // Servo setup
  myServo.attach(servo_pin);
  myServo.write(servoPos);
  // Bluetooth setup
  SerialBT.begin("ESP32_EARTI");
  Serial.println("Bluetooth Started! Waiting for pairing...");

  // // Move to home position at top
  // goHome();
  // Serial.println("Enter target level (1–4):");
  // Serial.println("");
}

void loop() {
  // Bluetooth
  // **NEW**: If we can use a wire, homing is no longer needed. We detect when current is negative/
  //              when external power is disconnected, which would've told us to home. 
  // **UPDATE**: Write in "up/down" and "pan CCW/CW" signals from Pi
  if (SerialBT.available()) {
    char cmd = SerialBT.read();
    // Serial.print("Received: ");
    // Serial.println(cmd);
    // SerialBT.println("ack");

    if (cmd == 'u'){ // up
      stepUp();
      // Serial.println("up");
    } else if (cmd == 'd') { // down
      stepDown();
      // Serial.println("down");
    } else if (cmd == 'l') { // left (CCW)
      panCCW();
      // Serial.println("ccw");
    } else if (cmd == 'r') { // right (CW)
      panCW();
      // Serial.println("cw");
    }

    // switch (cmd) {
    //   case 1:
    //     Serial.println("1");

    //     break;
    //   case 2:
    //     Serial.println("2");

    //     break;
    //   case 3:
    //     Serial.println("3");

    //     break;
    //   case 4:
    //     Serial.println("4");

    //     break;
    //   case 5:
    //     Serial.println("5");

    //     break;
    //   case 6:
    //     Serial.println("6");

    //     break;
    //   case 7:
    //     Serial.println("7");

    //     break;
    //   case 8:
    //     Serial.println("8");
    //     break;
    //   case 9:
    //     Serial.println("9");
    //     break;
    //   case 10: 
    //     Serial.println("10");
    //     break;
    //   default:
    //     Serial.println("Unknown mode");
    //     break;
    // }


  }
  delay(50);
}
