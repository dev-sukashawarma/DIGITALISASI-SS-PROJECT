# Google Tag Manager Integration

## Overview
Menambahkan Google Tag Manager (GTM) dengan ID `GTM-P48M8X5S` ke seluruh website Suka Shawarma untuk tracking dan analytics.

## Implementation

### 1. Head Script (layout.tsx)
```javascript
// Google Tag Manager script di <head>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-P48M8X5S');
```

### 2. Noscript Fallback (layout.tsx)
```html
<!-- Google Tag Manager (noscript) di <body> -->
<noscript>
  <iframe 
    src="https://www.googletagmanager.com/ns.html?id=GTM-P48M8X5S"
    height="0" 
    width="0" 
    style={{ display: 'none', visibility: 'hidden' }}
  />
</noscript>
```

## Files Modified

### ✅ src/app/layout.tsx
- Added GTM script in `<head>` section
- Added noscript fallback in `<body>` section
- Applied to all pages via root layout

### ✅ src/app/kemitraan/page.tsx  
- Initially added noscript here, then moved to layout
- Ensures kemitraan page has GTM tracking

## Coverage
🎯 **All Pages Covered:**
- ✅ Homepage (/)
- ✅ Kemitraan (/kemitraan) - **PRIORITY PAGE**
- ✅ Menu (/menu)
- ✅ Locations (/locations)
- ✅ All other pages via layout

## GTM Features Available
📊 **Tracking Capabilities:**
- Page views
- User interactions
- Conversion tracking
- E-commerce events
- Custom events
- User behavior analytics

## Testing
✅ **Build Status:** Successful  
✅ **TypeScript:** No errors  
✅ **Server:** Running on localhost:3000  
✅ **Integration:** Global via layout.tsx  

## Next Steps
1. Verify GTM is working in browser dev tools
2. Set up conversion goals in Google Analytics
3. Configure event tracking for key interactions:
   - Kemitraan form submissions
   - Menu item clicks
   - Location searches
   - Phone number clicks

## Production Deployment
Ready for deployment to https://sukashawarma.com/kemitraan/
GTM will start collecting data immediately after deployment.