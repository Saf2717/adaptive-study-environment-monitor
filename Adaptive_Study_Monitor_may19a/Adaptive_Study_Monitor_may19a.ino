#include "arduino_secrets.h"
#include <Arduino_ConnectionHandler.h>
#include <ArduinoIoTCloud.h>
#include "thingProperties.h"

#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "DHT.h"
#include <HTTPClient.h>

const char* serverUrl = "http://YOUR_BACKEND_HOST:3000/data";

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_MOSI 23
#define OLED_CLK 18
#define OLED_DC 0
#define OLED_CS 2
#define OLED_RESET 4

#define DHTPIN 16
#define DHTTYPE DHT11
#define SOUND_PIN 39

DHT dht(DHTPIN, DHTTYPE);

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  OLED_MOSI,
  OLED_CLK,
  OLED_DC,
  OLED_RESET,
  OLED_CS
);

unsigned long lastSensorUpdate = 0;
const unsigned long SENSOR_INTERVAL = 5000;

int readNoiseLevel() {
  int minVal = 4095;
  int maxVal = 0;
  unsigned long start = millis();

  while (millis() - start < 300) {
    int value = analogRead(SOUND_PIN);

    if (value < minVal) minVal = value;
    if (value > maxVal) maxVal = value;
  }

  return maxVal - minVal;
}

int calculateFocusScore(float temp, float hum, int noiseValue) {
  int score = 100;

  if (temp < 18) score -= (18 - temp) * 5;
  if (temp > 25) score -= (temp - 25) * 5;

  if (hum < 35) score -= 10;
  if (hum > 65) score -= 10;

  if (noiseValue > 30) score -= 15;
  if (noiseValue > 80) score -= 25;
  if (noiseValue > 150) score -= 35;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return score;
}

void updateOLED() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println("Study Monitor");

  display.setCursor(0, 14);
  display.print("Temp: ");
  display.print(temperature);
  display.println(" C");

  display.setCursor(0, 25);
  display.print("Hum : ");
  display.print(humidity);
  display.println(" %");

  display.setCursor(0, 36);
  display.print("Noise: ");
  display.println(noise);

  display.setCursor(0, 48);
  display.print("Focus: ");
  display.print(focus_score);
  display.print(" ");
  display.println(status);

  display.display();
}

void readSensorsAndUpdateCloud() {
  long totalNoise = 0;

  for (int i = 0; i < 5; i++) {
    totalNoise += readNoiseLevel();
    delay(50);
  }

  int smoothedNoise = totalNoise / 5;

  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    Serial.println("DHT11 read failed");
    status = "DHT ERROR";
    updateOLED();
    return;
  }

  humidity = h;
  temperature = t;
  noise = smoothedNoise;

  focus_score = calculateFocusScore(temperature, humidity, noise);

  if (noise > 150) {
    status = "LOUD";
  }
  else if (temperature > 26) {
    status = "HOT";
  }
  else if (temperature < 18) {
    status = "COLD";
  }
  else if (humidity > 70) {
    status = "HUMID";
  }
  else if (focus_score >= 75) {
    status = "GOOD";
  }
  else if (focus_score >= 50) {
    status = "OK";
  }
  else {
    status = "POOR";
  }

  Serial.print("Temp: ");
  Serial.print(temperature);
  Serial.print(" | Hum: ");
  Serial.print(humidity);
  Serial.print(" | Noise: ");
  Serial.print(noise);
  Serial.print(" | Focus: ");
  Serial.print(focus_score);
  Serial.print(" | Status: ");
  Serial.println(status);

  updateOLED();
  sendToBackend(temperature, humidity, noise, focus_score, status);
}

void sendToBackend(float t, float h, int n, int fs, String s) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"room\":\"Bedroom\",";
    json += "\"temperature\":" + String(t) + ",";
    json += "\"humidity\":" + String(h) + ",";
    json += "\"noise\":" + String(n) + ",";
    json += "\"focusScore\":" + String(fs) + ",";
    json += "\"status\":\"" + s + "\"";
    json += "}";

    int responseCode = http.POST(json);

    Serial.print("Backend POST: ");
    Serial.println(responseCode);

    http.end();
  }
}

void setup() {
  Serial.begin(9600);
  delay(1500);

  dht.begin();

  if (!display.begin(SSD1306_SWITCHCAPVCC)) {
    Serial.println("OLED failed");
    while (true);
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Starting Cloud...");
  display.display();

  initProperties();

  ArduinoCloud.begin(ArduinoIoTPreferredConnection);

  setDebugMessageLevel(2);
  ArduinoCloud.printDebugInfo();

  readSensorsAndUpdateCloud();
}

void loop() {
  ArduinoCloud.update();

  if (millis() - lastSensorUpdate >= SENSOR_INTERVAL) {
    lastSensorUpdate = millis();
    readSensorsAndUpdateCloud();
  }
}

void onTemperatureChange() {}
void onHumidityChange() {}
void onNoiseChange() {}
void onFocusScoreChange() {}
void onStatusChange() {}