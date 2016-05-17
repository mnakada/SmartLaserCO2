import RPi.GPIO as GPIO
import time
import os
import logging
logging.basicConfig(format='%(asctime)s : %(message)s')
logger = logging.getLogger()

class RPiPowerControlClass:

  def __init__(self):
    self.DelayControlTimeout = 5 * 60
    self.Timeout = 30 * 60
    self.Interval = 0.1
    self.PowerSWCount = 0
    self.LEDTick = 0
     
    self.MainPowerPort = 22
    self.DelayControlPort = 23
    self.AssistAirPort = 24
    self.PowerLEDPort = 25
    self.LaserPointerPort = 26
    self.PowerSWPort = 7
    
    self.LastAccess = time.time()
    self.LastInterval = 0
    self.LastPowerOff = 0

    self.PowerStatus = 0
    self.AssistAirStatus = 0
    self.DelayControlStatus = 0
    self.ProcessStatus = 0

    GPIO.setmode(GPIO.BCM)
    GPIO.cleanup()
    GPIO.setup(self.MainPowerPort, GPIO.OUT, initial=False)
    GPIO.setup(self.DelayControlPort, GPIO.OUT, initial=False)
    GPIO.setup(self.AssistAirPort, GPIO.OUT, initial=False)
    GPIO.setup(self.PowerLEDPort, GPIO.OUT, initial=False)
    GPIO.setup(self.LaserPointerPort, GPIO.OUT, initial=False)
    GPIO.setup(self.PowerSWPort, GPIO.IN, pull_up_down = GPIO.PUD_UP)

  def gpio_cleanup(self):
    GPIO.cleanup()

  def get_power_status(self):
    self.LastAccess = time.time()
    return self.PowerStatus

  def get_assist_air_status(self):
    self.LastAccess = time.time()
    return self.AssistAirStatus

  def set_process_status(self, flag):
    self.ProcessStatus = int(flag)

  def set_assist_air(self, flag):
    self.AssistAirStatus = int(flag)
    GPIO.output(self.AssistAirPort, self.AssistAirStatus)

  def set_power(self, flag):
    self.PowerStatus = int(int(flag) > 0)
    if self.PowerStatus == 0:
      self.LastPowerOff = time.time()
      self.LEDTick = 0
    else:
      self.DelayControlStatus = 1
      GPIO.output(self.DelayControlPort, True)
    self.set_assist_air(self.PowerStatus)
    GPIO.output(self.MainPowerPort, self.PowerStatus)
    GPIO.output(self.LaserPointerPort, self.PowerStatus)
    GPIO.output(self.PowerLEDPort, self.PowerStatus)

  def interval_check(self):
    now = time.time()
    if now < self.LastInterval + self.Interval:
      return
    self.LastInterval = now
    if (self.PowerStatus > 0) and (self.ProcessStatus == 0) and (now > (self.LastAccess + self.Timeout)):
      logger.info('auto shutdown')
      self.set_power(0)

    self.LEDTick += 1
    if GPIO.input(self.PowerSWPort) == 0:
      self.PowerSWCount += 1
      if self.PowerSWCount > 3: # > 0.3sec
        if self.PowerStatus == 0:
          self.DelayControlStatus = 0
          GPIO.output(self.PowerLEDPort, 1)
        else:
          GPIO.output(self.PowerLEDPort, 0)
    else:
      if self.PowerSWCount > 100: # > 10.0sec
        GPIO.output(self.PowerLEDPort, True)
        logger.info('RaspberryPi shutdown')
        os.system("/sbin/shutdown -h now")
      if self.PowerSWCount > 3: # > 0.3sec
        if self.PowerStatus == 0: # power on
          self.set_power(1)
          logger.info('power on by button')
        else: # power off
          self.set_power(0)
          logger.info('power off by button')
      self.PowerSWCount = 0
    
    if self.PowerSWCount > 100: # > 10.0sec
      GPIO.output(self.PowerLEDPort, (self.PowerSWCount / 2) & 1)
    elif self.PowerSWCount > 30: # > 3.0sec
      GPIO.output(self.PowerLEDPort, (self.PowerSWCount / 4) & 1)
    
    if (self.DelayControlStatus == 1) and (self.PowerStatus == 0):
      if now > self.LastPowerOff + self.DelayControlTimeout:
        self.DelayControlStatus = 0
        GPIO.output(self.DelayControlPort, False)
        GPIO.output(self.PowerLEDPort, 0)
        logger.info('delayed power off')
      else:
        GPIO.output(self.PowerLEDPort, (self.LEDTick / 8) & 1)

RPiPowerControl = RPiPowerControlClass()
