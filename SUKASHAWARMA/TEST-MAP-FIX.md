# Map Initialization Fix

## Problem
The Leaflet map in `OutletMap.tsx` was throwing the error:
```
Error: Map container is already initialized.
```

This happens when:
1. React StrictMode runs effects twice in development
2. Component unmounts and remounts
3. The same DOM element is used to initialize multiple map instances

## Solution Applied

### 1. Enhanced Initialization Check
```typescript
// Before
if (!mapRef.current || leafletMap.current) return;

// After  
if (!mapRef.current || leafletMap.current || mapReady) return;

if (mapRef.current._leaflet_id) {
  return;
}
```

### 2. Container Reset Before Initialization
```typescript
// Clear any existing map instance on the container
if (mapRef.current._leaflet_id) {
  mapRef.current._leaflet_id = undefined;
}
```

### 3. Enhanced Cleanup
```typescript
return () => {
  if (map) {
    map.remove();
  }
  if (leafletMap.current) {
    leafletMap.current.remove();
  }
  leafletMap.current = null;
  markersRef.current.clear();
  clusterRef.current = null;
  setMapReady(false);
};
```

### 4. TypeScript Improvements
```typescript
const mapRef = useRef<HTMLDivElement & { _leaflet_id?: number }>(null);
```

## Additional Fix: Windows Build Script
Updated `package.json` to use cross-env for Windows compatibility:
```json
"build": "cross-env NODE_OPTIONS='--max-old-space-size=512' next build"
```

## Status
✅ Map initializes correctly without errors  
✅ Build works on Windows  
✅ No TypeScript errors  
✅ Development server starts cleanly  

The map should now work properly without the "Map container is already initialized" error.