#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <ESP32Servo.h>

// UUIDs
#define SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CHARACTERISTIC_UUID "19B10001-E8F2-537E-4F6C-D104768A1214"

BLECharacteristic *pCharacteristic;
Servo myServo;
const int pwm_pin = 4; //servo
// Custom function to call
void goHome() {
  Serial.println("goHome() called!");
  myServo.write(80);
}

// Callback class
class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    String value = pChar->getValue();
    Serial.print("Received: ");
    Serial.println(value.c_str());

    if (value == "go_home") {
      Serial.println("went home");
      goHome();
    }
  }
};

class MyServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    Serial.println("Central connected!");
  }

  void onDisconnect(BLEServer* pServer) {
    Serial.println("Central disconnected!");
    BLEDevice::getAdvertising()->start();  // Optional: restart advertising
  }
};


void setup() {
  Serial.begin(115200);
  delay(2000);
  BLEDevice::init("EARTICamera");

  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());  // <-- Add this
  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE
  );

  pCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();

  Serial.println("ESP32 BLE server started and advertising");

  myServo.attach(pwm_pin);
}

void loop() {
  
  delay(500); // Keep loop alive
}

