/*
  TEST HLK LD2410B - CHI DUNG CHAN OUT (DON GIAN)
  ================================================
  Ket noi (chi can 3 day):
  - LD2410B VCC  -> ESP32 5V
  - LD2410B GND  -> ESP32 GND
  - LD2410B OUT  -> ESP32 GPIO 21

  Mo Serial Monitor o 115200 baud de xem ket qua
*/

#define LD2410_OUT_PIN 21 // Chan OUT cua LD2410B

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n====================================");
  Serial.println("  TEST CAM BIEN RADAR HLK LD2410B");
  Serial.println("  (Chi su dung chan OUT)");
  Serial.println("====================================\n");

  pinMode(LD2410_OUT_PIN, INPUT);

  Serial.println("Doi 5 giay cho cam bien khoi dong...");
  delay(5000);
  Serial.println("San sang! Di chuyen truoc cam bien de test.\n");
}

void loop() {
  static uint32_t lastPrint = 0;
  static int lastState = -1;

  int outValue = digitalRead(LD2410_OUT_PIN);

  // In khi co thay doi trang thai
  if (outValue != lastState) {
    lastState = outValue;

    Serial.print("[LD2410B] ");
    if (outValue == HIGH) {
      Serial.println(">>> CO NGUOI <<<");
    } else {
      Serial.println("Khong co nguoi");
    }
  }

  // In trang thai moi 1 giay
  if (millis() - lastPrint >= 1000) {
    lastPrint = millis();

    Serial.print("Trang thai: ");
    Serial.println(outValue == HIGH ? "CO NGUOI (1)" : "KHONG (0)");
  }

  delay(50);
}
