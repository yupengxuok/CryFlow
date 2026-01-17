/**
 * Signal Computer Tests
 */
const {
  getTimeSinceLastEvent,
  getLastSleepDuration,
  detectCryEscalation
} = require('../utils/signalComputer');

describe('Signal Computer', () => {
  const currentTime = new Date('2026-01-16T12:00:00Z');
  
  describe('getTimeSinceLastEvent', () => {
    it('should calculate time since last feed', () => {
      const events = [
        { type: 'feed', ts: new Date('2026-01-16T10:00:00Z') }
      ];
      
      const result = getTimeSinceLastEvent(events, 'feed', currentTime);
      expect(result).toBe(120); // 2 hours = 120 minutes
    });
    
    it('should return null if no events of type', () => {
      const events = [
        { type: 'cry', ts: new Date('2026-01-16T10:00:00Z') }
      ];
      
      const result = getTimeSinceLastEvent(events, 'feed', currentTime);
      expect(result).toBeNull();
    });
  });
  
  describe('getLastSleepDuration', () => {
    it('should calculate sleep duration from asleep to woke_up', () => {
      const events = [
        { type: 'sleep', sleep_state: 'asleep', ts: new Date('2026-01-16T10:00:00Z') },
        { type: 'sleep', sleep_state: 'woke_up', ts: new Date('2026-01-16T10:30:00Z') }
      ];
      
      const result = getLastSleepDuration(events);
      expect(result).toBe(30); // 30 minutes
    });
    
    it('should return null if no sleep pair found', () => {
      const events = [
        { type: 'sleep', sleep_state: 'asleep', ts: new Date('2026-01-16T10:00:00Z') }
      ];
      
      const result = getLastSleepDuration(events);
      expect(result).toBeNull();
    });
  });
  
  describe('detectCryEscalation', () => {
    it('should detect escalating cry pattern', () => {
      const events = [
        { type: 'cry', cry_intensity: 0.3, cry_duration_sec: 60, ts: new Date('2026-01-16T10:00:00Z') },
        { type: 'cry', cry_intensity: 0.5, cry_duration_sec: 90, ts: new Date('2026-01-16T10:30:00Z') },
        { type: 'cry', cry_intensity: 0.7, cry_duration_sec: 120, ts: new Date('2026-01-16T11:00:00Z') }
      ];
      
      const result = detectCryEscalation(events);
      expect(result).toBe('escalating');
    });
    
    it('should detect worsening cry pattern', () => {
      const events = [
        { type: 'cry', cry_intensity: 0.5, cry_duration_sec: 100, ts: new Date('2026-01-16T10:00:00Z') },
        { type: 'cry', cry_intensity: 0.5, cry_duration_sec: 90, ts: new Date('2026-01-16T10:30:00Z') },
        { type: 'cry', cry_intensity: 0.5, cry_duration_sec: 95, ts: new Date('2026-01-16T11:00:00Z') }
      ];
      
      const result = detectCryEscalation(events);
      expect(result).toBe('worsening');
    });
    
    it('should return insufficient_data for single event', () => {
      const events = [
        { type: 'cry', cry_intensity: 0.5, cry_duration_sec: 90, ts: new Date('2026-01-16T10:00:00Z') }
      ];
      
      const result = detectCryEscalation(events);
      expect(result).toBe('insufficient_data');
    });
  });
});
