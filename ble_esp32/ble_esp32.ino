#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// UUIDs
#define SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CHARACTERISTIC_UUID "19B10001-E8F2-537E-4F6C-D104768A1214"

BLECharacteristic *pCharacteristic;

// Custom function to call
void goHome() {
  Serial.println("goHome() called!");
  // Your actual logic here
}

// Callback class
class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    String value = pChar->getValue();
    Serial.print("Received: ");
    Serial.println(value.c_str());

    if (value == "go_home") {
      goHome();
    }
  }
};

void setup() {
  Serial.begin(115200);
  BLEDevice::init("EggcellentImposter");

  BLEServer *pServer = BLEDevice::createServer();
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
}

void loop() {
  delay(1000); // Keep loop alive
}

