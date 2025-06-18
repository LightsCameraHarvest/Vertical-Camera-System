/**
/ Testing joystick with motor controller. 
/ Only implemented "left-right" functionality. 
/ Left rotates stepper motor CCW; right rotates stepper motor CW. 
/ To-do?: implement "up-down" functionality
**/
#define xPin A0
#define yPin A1

const int dirPin = 2;
const int stepPin = 5;
const int enPin = 8;


void setup() {
  Serial.begin(9600);
  pinMode(enPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(stepPin, OUTPUT);
  digitalWrite(enPin, LOW); 
}

void loop() {
  int xVal = analogRead(xPin);
  int yVal = analogRead(yPin);

  if (xVal < 400) {
    Serial.print("LEFT");
    Serial.println(xVal);
    digitalWrite(dirPin, HIGH);
    delayMicroseconds(2000);
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(2000);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(2000);
    
  } else if (xVal > 600) {
    Serial.print("RIGHT");
    Serial.println(xVal);
    digitalWrite(dirPin, LOW);
    delayMicroseconds(2000);
    digitalWrite(stepPin, HIGH);
    delayMicroseconds(2000);
    digitalWrite(stepPin, LOW);
    delayMicroseconds(2000);
  }

  if (yVal < 400) {
    Serial.print("UP");
    Serial.println(yVal);
  } else if (yVal > 600) {
    Serial.print("DOWN");
    Serial.println(yVal);
  }
}

