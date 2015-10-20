#include <SoftwareSerial.h>

SoftwareSerial softSerial(2,3);

void setup()
{
  Serial.begin(57600);
  softSerial.begin(9600);
}

void loop()
{
  if (softSerial.available() > 0) {
    Serial.print((char)softSerial.read());
  }
}

