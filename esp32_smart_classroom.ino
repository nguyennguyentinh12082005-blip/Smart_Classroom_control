#include <DHT.h>
#include <FirebaseESP32.h>
#include <WiFi.h>
#include <time.h>

#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

// ================= WIFI & FIREBASE =================
#define WIFI_SSID "Wi-MESH - HCMUTE"
#define WIFI_PASSWORD "hcmute@2024"

#define FIREBASE_HOST "smart-classroom-1796a-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH "VexXIyCwYsU0IsvFTx97SLAtjvgfuw66YiJSr0Uu"

// ================= FIREBASE PATH =================
static const char *ROOM_PATH = "Rooms/A101";

// ================= PINS =================
#define PIR_PIN 21    // PIR sensor
#define DHTPIN 14     // DHT11 Data pin
#define DHT_LED_PIN 2 // LED indicator cho DHT11
#define LDR_PIN 34
#define DHTTYPE DHT11

// ===== Relay IN pins =====
int PIN_DEN1 = 13;
int PIN_DEN2 = 18;
int PIN_DEN3 = 19;
int PIN_QUAT1 = 15;
int PIN_QUAT2 = 4;
int PIN_QUAT3 = 5;

// ================= CONFIG =================
static const bool RELAY_ACTIVE_LOW = false;

// PIR sensor type: set to true if your PIR outputs LOW when motion detected
// Nếu PIR luôn = 1 dù không có người, thử đổi thành true
static const bool PIR_ACTIVE_LOW = false;

// ================= OBJECTS =================
DHT dht(DHTPIN, DHTTYPE);

FirebaseData firebaseData;
FirebaseConfig config;
FirebaseAuth auth;

SemaphoreHandle_t gMutex;

// ================= TUNING =================
static const uint32_t PIR_STABLE_MS = 800;
static const uint32_t PIR_WARMUP_MS = 10000;
static const uint32_t DHT_PERIOD_MS = 2000;
static const uint32_t PRINT_PERIOD_MS = 1000;

static const uint32_t FB_SEND_MS = 5000;
static const uint32_t FB_READ_MS =
    200; // Giảm từ 800ms xuống 200ms để phản hồi nhanh hơn

// ================= STATE =================
struct RelayState {
  bool den1 = false, den2 = false, den3 = false;
  bool quat1 = false, quat2 = false, quat3 = false;
};
RelayState g_state;

// shared sensor
float g_t = 0, g_h = 0;
int g_lux = 0, g_pir = 0;

// mode + cmd
bool g_autoMode = true;
int g_cmdDen1 = 0, g_cmdDen2 = 0, g_cmdDen3 = 0;
int g_cmdQuat1 = 0, g_cmdQuat2 = 0, g_cmdQuat3 = 0;

// ================= HELPERS =================
inline void writeRelay(int pin, bool on) {
  if (RELAY_ACTIVE_LOW)
    digitalWrite(pin, on ? LOW : HIGH);
  else
    digitalWrite(pin, on ? HIGH : LOW);
}

void applyState(const RelayState &s) {
  writeRelay(PIN_DEN1, s.den1);
  writeRelay(PIN_DEN2, s.den2);
  writeRelay(PIN_DEN3, s.den3);
  writeRelay(PIN_QUAT1, s.quat1);
  writeRelay(PIN_QUAT2, s.quat2);
  writeRelay(PIN_QUAT3, s.quat3);
}

String joinPath(const char *base, const char *sub) {
  String s(base);
  if (!s.endsWith("/"))
    s += "/";
  s += sub;
  return s;
}

// ===== AUTO logic với override từ web =====
RelayState calcAutoWithOverride(int lux, float temp, int pirStable) {
  RelayState s;

  // Lấy lệnh từ web
  int d1 = g_cmdDen1, d2 = g_cmdDen2, d3 = g_cmdDen3;
  int q1 = g_cmdQuat1, q2 = g_cmdQuat2, q3 = g_cmdQuat3;

  // ĐÈN: nếu có lệnh web (=1) thì bật, nếu không thì theo tự động
  if (d1 == 1) {
    s.den1 = true;
  } else if (pirStable == 1 && lux < 800) {
    s.den1 = true;
  }

  if (d2 == 1) {
    s.den2 = true;
  } else if (pirStable == 1 && lux < 500) {
    s.den2 = true;
  }

  if (d3 == 1) {
    s.den3 = true;
  } else if (pirStable == 1 && lux < 200) {
    s.den3 = true;
  }

  // QUẠT: tương tự
  if (q1 == 1) {
    s.quat1 = true;
  } else if (pirStable == 1 && temp > 26) {
    s.quat1 = true;
  }

  if (q2 == 1) {
    s.quat2 = true;
  } else if (pirStable == 1 && temp > 28) {
    s.quat2 = true;
  }

  if (q3 == 1) {
    s.quat3 = true;
  } else if (pirStable == 1 && temp > 30) {
    s.quat3 = true;
  }

  return s;
}

// ===== MANUAL logic: chỉ theo CMD nhưng cần có người (PIR=1) =====
RelayState calcManual(int pirStable) {
  RelayState s;

  // Nếu không có người (PIR=0) -> tắt hết, không cho điều khiển
  if (pirStable == 0) {
    return s; // Trả về tất cả false
  }

  // Có người -> cho phép điều khiển theo web
  s.den1 = (g_cmdDen1 == 1);
  s.den2 = (g_cmdDen2 == 1);
  s.den3 = (g_cmdDen3 == 1);
  s.quat1 = (g_cmdQuat1 == 1);
  s.quat2 = (g_cmdQuat2 == 1);
  s.quat3 = (g_cmdQuat3 == 1);
  return s;
}

// ================= FIREBASE TASK =================
void firebaseTask(void *pv) {
  (void)pv;
  uint32_t lastSend = 0, lastRead = 0;

  const String pAuto = joinPath(ROOM_PATH, "AutoMode");
  const String pD1 = joinPath(ROOM_PATH, "Den1");
  const String pD2 = joinPath(ROOM_PATH, "Den2");
  const String pD3 = joinPath(ROOM_PATH, "Den3");
  const String pQ1 = joinPath(ROOM_PATH, "Quat1");
  const String pQ2 = joinPath(ROOM_PATH, "Quat2");
  const String pQ3 = joinPath(ROOM_PATH, "Quat3");

  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(80));

    // Debug connection status every 5 seconds
    static uint32_t lastStatus = 0;
    if (millis() - lastStatus >= 5000) {
      lastStatus = millis();
      Serial.print("[FB][STATUS] WiFi=");
      Serial.print(WiFi.status() == WL_CONNECTED ? "OK" : "DISCONNECTED");
      Serial.print(" Firebase=");
      Serial.println(Firebase.ready() ? "READY" : "NOT_READY");
    }

    if (WiFi.status() != WL_CONNECTED)
      continue;
    if (!Firebase.ready())
      continue;

    uint32_t now = millis();

    // ===== READ commands =====
    if (now - lastRead >= FB_READ_MS) {
      lastRead = now;

      bool autoModeLocal = g_autoMode;
      int d1 = g_cmdDen1, d2 = g_cmdDen2, d3 = g_cmdDen3;
      int q1 = g_cmdQuat1, q2 = g_cmdQuat2, q3 = g_cmdQuat3;

      // Debug: print paths being used
      Serial.print("[FB][PATH] Reading from: ");
      Serial.println(pD1);

      if (Firebase.getBool(firebaseData, pAuto)) {
        autoModeLocal = firebaseData.boolData();
      } else {
        Serial.print("[FB][ERR] Auto: ");
        Serial.println(firebaseData.errorReason());
      }

      if (Firebase.getInt(firebaseData, pD1)) {
        d1 = firebaseData.intData();
      } else {
        Serial.print("[FB][ERR] D1: ");
        Serial.println(firebaseData.errorReason());
      }

      if (Firebase.getInt(firebaseData, pD2)) {
        d2 = firebaseData.intData();
      } else {
        Serial.print("[FB][ERR] D2: ");
        Serial.println(firebaseData.errorReason());
      }

      if (Firebase.getInt(firebaseData, pD3)) {
        d3 = firebaseData.intData();
      } else {
        Serial.print("[FB][ERR] D3: ");
        Serial.println(firebaseData.errorReason());
      }

      if (Firebase.getInt(firebaseData, pQ1)) {
        q1 = firebaseData.intData();
      } else {
        Serial.print("[FB][ERR] Q1: ");
        Serial.println(firebaseData.errorReason());
      }

      if (Firebase.getInt(firebaseData, pQ2)) {
        q2 = firebaseData.intData();
      } else {
        Serial.print("[FB][ERR] Q2: ");
        Serial.println(firebaseData.errorReason());
      }

      if (Firebase.getInt(firebaseData, pQ3)) {
        q3 = firebaseData.intData();
      } else {
        Serial.print("[FB][ERR] Q3: ");
        Serial.println(firebaseData.errorReason());
      }

      if (xSemaphoreTake(gMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
        g_autoMode = autoModeLocal;
        g_cmdDen1 = d1;
        g_cmdDen2 = d2;
        g_cmdDen3 = d3;
        g_cmdQuat1 = q1;
        g_cmdQuat2 = q2;
        g_cmdQuat3 = q3;
        xSemaphoreGive(gMutex);
      }

      // Debug: Print commands received from Firebase
      Serial.print("[FB][CMD] Auto=");
      Serial.print(autoModeLocal);
      Serial.print(" D1=");
      Serial.print(d1);
      Serial.print(" D2=");
      Serial.print(d2);
      Serial.print(" D3=");
      Serial.print(d3);
      Serial.print(" Q1=");
      Serial.print(q1);
      Serial.print(" Q2=");
      Serial.print(q2);
      Serial.print(" Q3=");
      Serial.println(q3);
    }

    // ===== SEND sensors =====
    if (now - lastSend >= FB_SEND_MS) {
      lastSend = now;

      float t, h;
      int lux, pir;
      bool autoModeLocal;
      if (xSemaphoreTake(gMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
        t = g_t;
        h = g_h;
        lux = g_lux;
        pir = g_pir;
        autoModeLocal = g_autoMode;
        xSemaphoreGive(gMutex);
      } else
        continue;

      FirebaseJson json;
      json.set("NhietDo", t);
      json.set("DoAm", h);
      json.set("AnhSang", lux);
      json.set("ChuyenDong", pir);
      // Note: don't send AutoMode back - it should only be controlled by web

      if (!Firebase.updateNode(firebaseData, ROOM_PATH, json)) {
        Serial.print("[FB][ERR] ");
        Serial.println(firebaseData.errorReason());
      }
    }
  }
}

// ================= SETUP =================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(400);
  Serial.println("\n=== ESP32 START ===");

  pinMode(PIR_PIN, INPUT_PULLDOWN); // PIR sensor
  pinMode(LDR_PIN, INPUT);
  pinMode(DHT_LED_PIN, OUTPUT);   // LED indicator cho DHT11
  digitalWrite(DHT_LED_PIN, LOW); // Tắt LED ban đầu

  pinMode(PIN_DEN1, OUTPUT);
  pinMode(PIN_DEN2, OUTPUT);
  pinMode(PIN_DEN3, OUTPUT);
  pinMode(PIN_QUAT1, OUTPUT);
  pinMode(PIN_QUAT2, OUTPUT);
  pinMode(PIN_QUAT3, OUTPUT);

  applyState(RelayState()); // tắt hết
  dht.begin();

  gMutex = xSemaphoreCreateMutex();

  // WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("[WIFI] Connecting");
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WIFI] OK IP=");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WIFI][ERR] Cannot connect (Firebase won't work)");
  }

  // NTP (HTTPS)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  // Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  firebaseData.setBSSLBufferSize(1024, 1024);

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Initialize CMD paths if they don't exist (run once at startup)
  Serial.println("[FB] Waiting for Firebase ready...");
  delay(3000); // Wait for Firebase connection

  // Wait for Firebase to be ready
  int waitCount = 0;
  while (!Firebase.ready() && waitCount < 20) {
    delay(500);
    waitCount++;
    Serial.print(".");
  }
  Serial.println();

  if (Firebase.ready()) {
    Serial.println("[FB] Firebase ready! Initializing CMD paths...");
    String basePath = String(ROOM_PATH);
    Serial.print("[FB] Base path: ");
    Serial.println(basePath);

    // Use set to create paths - with error checking
    if (Firebase.setInt(firebaseData, basePath + "/Den1", 0)) {
      Serial.println("[FB] Den1 OK");
    } else {
      Serial.print("[FB] Den1 FAIL: ");
      Serial.println(firebaseData.errorReason());
    }

    Firebase.setInt(firebaseData, basePath + "/Den2", 0);
    Firebase.setInt(firebaseData, basePath + "/Den3", 0);
    Firebase.setInt(firebaseData, basePath + "/Quat1", 0);
    Firebase.setInt(firebaseData, basePath + "/Quat2", 0);
    Firebase.setInt(firebaseData, basePath + "/Quat3", 0);
    Firebase.setBool(firebaseData, basePath + "/AutoMode", true);

    Serial.println("[FB] CMD paths initialized!");
  } else {
    Serial.println("[FB][ERR] Firebase not ready - cannot initialize paths!");
  }

  xTaskCreatePinnedToCore(firebaseTask, "firebaseTask", 8192, nullptr, 1,
                          nullptr, 0);
}

// ================= LOOP =================
void loop() {
  uint32_t now = millis();

  // ---- PIR debounce + warmup ----
  static int pirRawLast = 0, pirStable = 0;
  static uint32_t pirChangeAt = 0;

  int pirRaw = digitalRead(PIR_PIN);

  // Invert if using Active LOW PIR sensor
  if (PIR_ACTIVE_LOW) {
    pirRaw = !pirRaw;
  }

  if (millis() < PIR_WARMUP_MS)
    pirRaw = 0;

  if (pirRaw != pirRawLast) {
    pirRawLast = pirRaw;
    pirChangeAt = now;
  }
  if (now - pirChangeAt >= PIR_STABLE_MS)
    pirStable = pirRawLast;

  // ---- DHT11 với LED indicator ----
  static uint32_t lastDHT = 0;
  static float t = 0, h = 0;
  static int dhtFail = 0;

  if (now - lastDHT >= DHT_PERIOD_MS) {
    lastDHT = now;

    // Nhấp nháy LED khi đang đọc DHT11
    digitalWrite(DHT_LED_PIN, HIGH);

    float tn = dht.readTemperature();
    float hn = dht.readHumidity();

    if (isnan(tn) || isnan(hn)) {
      dhtFail++;
      Serial.print("[DHT11][ERR] Read failed (");
      Serial.print(dhtFail);
      Serial.println(")");
      // LED tắt nếu lỗi
      digitalWrite(DHT_LED_PIN, LOW);
    } else {
      dhtFail = 0;
      t = tn; // DHT11 không cần offset như DHT22
      h = hn;
      // LED sáng ngắn rồi tắt khi đọc thành công
      delay(50);
      digitalWrite(DHT_LED_PIN, LOW);
    }
  }

  // ---- LDR ----
  int lux = map(analogRead(LDR_PIN), 0, 4095, 1000, 0);

  // ---- Cập nhật shared data ----
  bool autoModeLocal;
  if (xSemaphoreTake(gMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
    g_t = t;
    g_h = h;
    g_lux = lux;
    g_pir = pirStable;
    autoModeLocal = g_autoMode;
    xSemaphoreGive(gMutex);
  } else {
    autoModeLocal = true;
  }

  // ---- Tính toán trạng thái relay ----
  RelayState out;
  if (autoModeLocal) {
    // AUTO MODE: web vẫn có thể override
    if (xSemaphoreTake(gMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
      out = calcAutoWithOverride(lux, t, pirStable);
      xSemaphoreGive(gMutex);
    } else {
      out = RelayState();
    }
  } else {
    // MANUAL MODE: hoàn toàn theo web
    if (xSemaphoreTake(gMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
      out = calcManual(pirStable);
      xSemaphoreGive(gMutex);
    } else {
      out = RelayState();
    }
  }

  applyState(out);

  // ---- Print ----
  static uint32_t lastPrint = 0;
  if (now - lastPrint >= PRINT_PERIOD_MS) {
    lastPrint = now;
    Serial.print("[MODE] ");
    Serial.print(autoModeLocal ? "AUTO" : "MANUAL");
    Serial.print(" | Lux=");
    Serial.print(lux);
    Serial.print(" | T=");
    Serial.print(t);
    Serial.print(" | H=");
    Serial.print(h);
    Serial.print(" | PIR=");
    Serial.println(pirStable);
  }

  delay(2);
}
