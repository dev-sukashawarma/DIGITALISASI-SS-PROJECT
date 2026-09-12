import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  isWithinRadius,
  isGpsAccuracyAcceptable,
  GEOFENCE_RADIUS_M,
  MAX_GPS_ACCURACY_M,
} from './gps';

describe('GPS & Geofencing Logic (Absensi)', () => {
  const OUTLET_LOCATION = { lat: -6.200000, lng: 106.816666 }; // Jakarta center

  it('calculates 0 meters for identical coordinates', () => {
    const distance = haversineMeters(OUTLET_LOCATION, OUTLET_LOCATION);
    expect(distance).toBe(0);
  });

  it('calculates distance correctly for a known offset (~111m per 0.001 deg lat)', () => {
    const slightlyNorth = { lat: OUTLET_LOCATION.lat + 0.001, lng: OUTLET_LOCATION.lng };
    const distance = haversineMeters(OUTLET_LOCATION, slightlyNorth);
    // 0.001 deg latitude is roughly 111 meters
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it('accepts staff when within geofence radius', () => {
    // 30 meters away
    const nearby = { lat: OUTLET_LOCATION.lat + 0.0002, lng: OUTLET_LOCATION.lng };
    const distance = haversineMeters(OUTLET_LOCATION, nearby);
    expect(distance).toBeLessThan(GEOFENCE_RADIUS_M);
    expect(isWithinRadius(OUTLET_LOCATION, nearby, GEOFENCE_RADIUS_M)).toBe(true);
  });

  it('rejects staff when outside geofence radius', () => {
    // ~550 meters away
    const farAway = { lat: OUTLET_LOCATION.lat + 0.005, lng: OUTLET_LOCATION.lng };
    expect(isWithinRadius(OUTLET_LOCATION, farAway, GEOFENCE_RADIUS_M)).toBe(false);
  });

  it('validates GPS accuracy threshold correctly', () => {
    expect(isGpsAccuracyAcceptable(10)).toBe(true);
    expect(isGpsAccuracyAcceptable(MAX_GPS_ACCURACY_M)).toBe(true);
    expect(isGpsAccuracyAcceptable(MAX_GPS_ACCURACY_M + 1)).toBe(false);
    expect(isGpsAccuracyAcceptable(500)).toBe(false);
  });
});
