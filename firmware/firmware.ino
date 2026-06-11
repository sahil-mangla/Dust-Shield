/**

- PROJECT: DustShield v1.0 - Single-Switch Flyback EDS Driver
- HARDWARE: ESP32-C3-MINI-1
- DESCRIPTION: Reads an analog tuning potentiometer, applies software noise filtering,
- maps the value to a hardware PWM output signal with a strict safety ceiling,
- and drives a TC4420 gate driver to control high-voltage generation.
*/

#include <Arduino.h>

// ==========================================
// 1. PIN CONFIGURATIONS
// ==========================================
const int POT_PIN = 0;          // Potentiometer Wiper connected to GPIO 0 (ADC1_CH0)
const int PWM_PIN = 18;         // Gate Driver Signal output on GPIO 18

// ==========================================
// 2. HARDWARE PWM PARAMETERS
// ==========================================
const int PWM_FREQ = 30000;     // Optimized switching frequency (30 kHz)
const int PWM_RES = 8;          // 8-bit resolution (Duty cycle range: 0 to 255)
const int LEDC_CHANNEL = 0;     // Internal LEDC hardware channel 0

// ==========================================
// 3. CRITICAL SAFETY BOUNDARIES
// ==========================================
// Hard limit to prevent transformer core saturation and MOSFET overcurrent damage.
// 45% of maximum 8-bit value (0.45 * 255 = 114)
const int MAX_SAFE_DUTY = 114;

// ==========================================
// 4. SIGNAL FILTERING CONSTANTS
// ==========================================
// Exponential Moving Average filter weight (0.0 to 1.0)
// Lower values = more aggressive noise filtering but slower response times
const float FILTER_WEIGHT = 0.15;

// ==========================================
// 5. GLOBAL SYSTEM VARIABLES
// ==========================================
float filteredAdcValue = 0.0;   // Stores the smoothed running average
int activeDutyCycle = 0;        // Stores the current active duty cycle value
unsigned long lastUpdateTick = 0;
const unsigned long SAMPLE_INTERVAL_MS = 50; // Read analog input at 20Hz (every 50ms)

void setup() {
// Initialize Serial interface for debugging and calibration monitor
Serial.begin(115200);
delay(1000);
Serial.println(F("=================================================="));
Serial.println(F(" SYSTEM BOOT: DustShield v1.0 Flyback EDS Driver "));
Serial.println(F("=================================================="));

// Configure hardware pins
pinMode(PWM_PIN, OUTPUT);
digitalWrite(PWM_PIN, LOW); // Force gate driver off immediately during boot

pinMode(POT_PIN, INPUT);

// Configure ESP32 hardware LEDC PWM peripheral
ledcSetup(LEDC_CHANNEL, PWM_FREQ, PWM_RES);
ledcAttachPin(PWM_PIN, LEDC_CHANNEL);

// Set initial duty cycle to 0% for soft-start safety verification
ledcWrite(LEDC_CHANNEL, 0);

// Initialize the filter baseline with a stable starting read
filteredAdcValue = analogRead(POT_PIN);

Serial.println(F("[INIT] Hardware PWM Peripheral Configured Successfully."));
Serial.print(F("[INIT] Frequency Bound: ")); Serial.print(PWM_FREQ); Serial.println(F(" Hz"));
Serial.print(F("[INIT] Hard-coded Safety Duty Ceiling: ")); Serial.print((float)MAX_SAFE_DUTY / 2.55); Serial.println(F("%"));
Serial.println(F("[SYSTEM] Running... Monitoring Potentiometer Control."));
}

void loop() {
unsigned long currentMillis = millis();

// Execute the control loop on a fixed time interval
if (currentMillis - lastUpdateTick >= SAMPLE_INTERVAL_MS) {
lastUpdateTick = currentMillis;

```
// A. Read the 12-bit ADC value (Range: 0 to 4095 on ESP32-C3)
int rawAdcValue = analogRead(POT_PIN);

// B. Apply Exponential Moving Average (EMA) Filter
// This software layer works alongside your 100nF hardware capacitor to clean out switching noise
filteredAdcValue = (FILTER_WEIGHT * rawAdcValue) + ((1.0 - FILTER_WEIGHT) * filteredAdcValue);

// C. Map the filtered 12-bit range strictly to the safe 8-bit hardware space
// 0 on the Potentiometer = 0% Duty Cycle (Off)
// 4095 on the Potentiometer = 45% Duty Cycle Max (Safe Peak Field Strength)
int targetDutyCycle = map((int)filteredAdcValue, 0, 4095, 0, MAX_SAFE_DUTY);

// D. Apply Double-Layer Safety Clamping
// Software constraint guarantees duty cycle can never breach the transformer threshold
if (targetDutyCycle > MAX_SAFE_DUTY) {
  targetDutyCycle = MAX_SAFE_DUTY;
}
if (targetDutyCycle < 0) {
  targetDutyCycle = 0;
}

// E. Commit the updated duty cycle to the gate driver if a change is requested
if (targetDutyCycle != activeDutyCycle) {
  activeDutyCycle = targetDutyCycle;
  ledcWrite(LEDC_CHANNEL, activeDutyCycle);

  // F. Output Telemetry Data to the Serial Monitor for testing and verification
  float realDutyPercentage = ((float)activeDutyCycle / 255.0) * 100.0;
  Serial.print(F("RAW_ADC: "));     Serial.print(rawAdcValue);
  Serial.print(F(" | FILT_ADC: ")); Serial.print((int)filteredAdcValue);
  Serial.print(F(" | PWM_REG: "));  Serial.print(activeDutyCycle);
  Serial.print(F(" | ACTIVE_DUTY: ")); Serial.print(realDutyPercentage, 1);
  Serial.println(F("%"));
}
```

}
}