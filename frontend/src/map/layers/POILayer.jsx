import React, { useEffect, useRef } from 'react';
import finalPlaces from '../../data/final_places.json';
import campusLandmarks from '../../data/campus_landmarks.geojson';

const SOURCE_ID = 'mulu-pois-source';
const LAYER_LABELS_ID = 'mulu-pois-labels';

const UNIQUE_ICONS = [
  'hospital', 'lodging', 'school', 'college', 'restaurant', 'bar', 'cafe', 
  'fuel', 'grocery', 'shop', 'bank', 'place-of-worship', 'police', 'bus', 
  'post', 'park', 'veterinary', 'town-hall', 'campsite', 'car-repair', 
  'car', 'art-gallery', 'attraction', 'pitch', 'prison', 'shelter', 
  'communications-tower', 'marker'
];

// Global module-level image cache to prevent re-fetching icons over network on theme toggles
const ICON_CACHE = new Map();

export const preloadMakiIcons = () => {
  UNIQUE_ICONS.forEach(icon => {
    if (ICON_CACHE.has(icon)) return;
    const img = new Image();
    img.onload = () => {
      ICON_CACHE.set(icon, img);
    };
    img.onerror = () => {
      console.warn(`Failed to preload Maki icon SVG: ${icon}`);
    };
    img.src = `/icons/${icon}.svg`;
  });
};

// Immediate self-trigger on module load
preloadMakiIcons();

const categoryToMakiIcon = (category, name) => {
  const n = String(name || '').toLowerCase().trim();
  if (n.includes('hostel') || n.includes('dormitory') || n.includes('student accommodation') || n.includes('hall of residence')) {
    return 'lodging';
  }
  const cat = String(category || '').toLowerCase().trim().replace(/_/g, ' ');
  
  if (['hospital', 'clinic', 'medical laboratory', 'community health center', 'health consultant', 'health post', 'health_post', 'health'].includes(cat)) {
    return 'hospital';
  }
  if (['hostel', 'hotel', 'guest house', 'lodging', 'apartment', 'condominium complex', 'housing society', 'serviced accommodation', 'student housing center', 'boarding', 'boarding house', 'dormitory'].includes(cat)) {
    return 'lodging';
  }
  if (['school', 'kindergarten', 'private educational institution'].includes(cat)) {
    return 'school';
  }
  if (['university', 'college', 'educational institution', 'educational_institution', 'education center', 'auditorium', 'library', 'lecture theatre', 'lecture hall', 'hall'].includes(cat)) {
    return 'college';
  }
  if (['restaurant', 'fast food', 'diner', 'fast_food'].includes(cat)) {
    return 'restaurant';
  }
  if (['bar', 'night club', 'nightclub', 'pub'].includes(cat)) {
    return 'bar';
  }
  if (['cafe'].includes(cat)) {
    return 'cafe';
  }
  if (['fuel'].includes(cat)) {
    return 'fuel';
  }
  if (['supermarket', 'hypermarket', 'convenience', 'grocery'].includes(cat)) {
    return 'grocery';
  }
  if (['shop', 'bakery', 'boutique', 'butcher', 'beverages', 'clothing wholesale market place', 'market', 'mall', 'shoes', 'building materials', 'building_materials'].includes(cat)) {
    return 'shop';
  }
  if (['bank', 'atm', 'financial institution', 'money transfer service', 'money order service', 'building society'].includes(cat)) {
    return 'bank';
  }
  if (['place of worship', 'place_of_worship'].includes(cat)) {
    return 'place-of-worship';
  }
  if (['police', 'security'].includes(cat)) {
    return 'police';
  }
  if (['station', 'transport', 'transportation service'].includes(cat)) {
    return 'bus';
  }
  if (['post office', 'post_office'].includes(cat)) {
    return 'post';
  }
  if (['park', 'playground', 'garden'].includes(cat)) {
    return 'park';
  }
  if (['veterinary'].includes(cat)) {
    return 'veterinary';
  }
  if (['townhall', 'town-hall'].includes(cat)) {
    return 'town-hall';
  }
  if (['camp site', 'campground', 'camping cabin', 'camp_site'].includes(cat)) {
    return 'campsite';
  }
  if (['car repair', 'car_repair'].includes(cat)) {
    return 'car-repair';
  }
  if (['car wash'].includes(cat)) {
    return 'car';
  }
  if (['artwork', 'art gallery', 'art_gallery'].includes(cat)) {
    return 'art-gallery';
  }
  if (['attraction'].includes(cat)) {
    return 'attraction';
  }
  if (['sports', 'pitch'].includes(cat)) {
    return 'pitch';
  }
  if (['prison'].includes(cat)) {
    return 'prison';
  }
  if (['shelter'].includes(cat)) {
    return 'shelter';
  }
  if (['telecommunication', 'communications tower', 'communications_tower'].includes(cat)) {
    return 'communications-tower';
  }
  return 'marker';
};

const iconColorExpression = [
  'match',
  ['get', 'maki_icon'],
  'lodging', '#C24488',          // Mapbox standard magenta/plum for hostels & dorms
  'school', '#EA5545',           // Mapbox standard coral/warm terracotta for education
  'college', '#EA5545',          // Mapbox standard coral/warm terracotta for university halls & lectures
  'restaurant', '#F28E2B',       // Mapbox standard warm amber-orange for food & dining
  'bar', '#F28E2B',
  'cafe', '#F28E2B',
  'fuel', '#FFB800',             // Mapbox standard fuel yellow
  'grocery', '#4E79A7',          // Mapbox standard commercial slate-blue
  'shop', '#4E79A7',             // Mapbox standard commercial slate-blue
  'bank', '#059669',             // Mapbox standard bank teal
  'place-of-worship', '#8B5CF6', // Mapbox standard violet
  'police', '#3B82F6',           // Mapbox standard blue
  'bus', '#0284C7',              // Mapbox standard transit cyan-blue
  'post', '#3B82F6',             // Mapbox standard postal blue
  'park', '#22C55E',             // Mapbox standard emerald green for outdoor & fields
  'campsite', '#22C55E',         // Mapbox standard emerald green
  'pitch', '#22C55E',            // Mapbox standard sports green
  'hospital', '#E15759',         // Mapbox standard medical crimson-red
  'veterinary', '#E15759',
  'art-gallery', '#8B5CF6',
  'attraction', '#F59E0B',
  'town-hall', '#64748B',
  'car-repair', '#64748B',
  'car', '#64748B',
  'prison', '#64748B',
  'shelter', '#64748B',
  'communications-tower', '#64748B',
  '#D4AF37'                      // Default signature gold
];

const textColorExpressionLight = [
  'match',
  ['get', 'maki_icon'],
  'lodging', '#86198F',          // Deep plum/magenta-pink for hostel & dorm names (e.g. "Chambeshi Hostel")
  'school', '#C2410C',           // Warm terracotta-amber for academic & school names
  'college', '#C2410C',          // Warm terracotta-amber for lecture halls & departments
  'restaurant', '#EA580C',       // Warm dining orange for cafeteria & restaurant names
  'bar', '#EA580C',
  'cafe', '#EA580C',
  'fuel', '#B45309',             // Amber-gold for fuel stations
  'grocery', '#1D4ED8',          // Crisp slate-blue for grocery & supermarket names
  'shop', '#1D4ED8',             // Crisp slate-blue for shop & store names
  'bank', '#047857',             // Emerald teal for banks & ATMs
  'place-of-worship', '#6D28D9', // Violet-purple for religious & worship places
  'police', '#1D4ED8',           // Blue for police & security
  'bus', '#0284C7',              // Cyan-blue for transit & bus stops
  'post', '#1D4ED8',             // Blue for post offices
  'park', '#15803D',             // Forest green for parks, fields & pitches
  'campsite', '#15803D',
  'pitch', '#15803D',
  'hospital', '#B91C1C',         // Crimson red for clinic & medical names
  'veterinary', '#B91C1C',
  'art-gallery', '#6D28D9',
  'attraction', '#B45309',
  'town-hall', '#334155',
  'car-repair', '#334155',
  'car', '#334155',
  'prison', '#334155',
  'shelter', '#334155',
  'communications-tower', '#334155',
  '#334155'                      // Default dark slate
];

const textColorExpressionDark = [
  'match',
  ['get', 'maki_icon'],
  'lodging', '#F472B6',          // Soft vibrant pink/magenta for hostel & dorm names
  'school', '#FDBA74',           // Warm peach/amber for academic & school names
  'college', '#FDBA74',          // Warm peach/amber for lecture halls & departments
  'restaurant', '#FB923C',       // Vibrant orange for dining & cafeterias
  'bar', '#FB923C',
  'cafe', '#FB923C',
  'fuel', '#FDE047',             // Bright yellow for fuel stations
  'grocery', '#60A5FA',          // Soft sky blue for shops & grocery
  'shop', '#60A5FA',
  'bank', '#34D399',             // Bright emerald teal for banks
  'place-of-worship', '#A78BFA', // Soft violet for places of worship
  'police', '#60A5FA',
  'bus', '#38BDF8',
  'post', '#60A5FA',
  'park', '#4ADE80',             // Bright green for parks & fields
  'campsite', '#4ADE80',
  'pitch', '#4ADE80',
  'hospital', '#F87171',         // Soft coral red for clinics & health centers
  'veterinary', '#F87171',
  'art-gallery', '#A78BFA',
  'attraction', '#FBBF24',
  'town-hall', '#94A3B8',
  'car-repair', '#94A3B8',
  'car', '#94A3B8',
  'prison', '#94A3B8',
  'shelter', '#94A3B8',
  'communications-tower', '#94A3B8',
  '#F8FAFC'                      // Default crisp off-white
];

// Combine GeoJSON features once statically
const combinedFeatures = [
  ...(finalPlaces.features || []),
  ...(campusLandmarks.features || [])
].map((f, idx) => {
  const nameVal = f.properties?.name || '';
  const categoryVal = f.properties?.category || f.properties?.category_raw || 'location';
  const makiIcon = categoryToMakiIcon(categoryVal, nameVal);
  return {
    type: 'Feature',
    id: idx,
    properties: {
      ...f.properties,
      maki_icon: makiIcon
    },
    geometry: f.geometry
  };
});

const POI_GEOJSON = {
  type: 'FeatureCollection',
  features: combinedFeatures
};

export const POILayer = ({ map, isNight = false, onPlaceSelect = null }) => {
  const isNightRef = useRef(isNight);
  const onPlaceSelectRef = useRef(onPlaceSelect);

  useEffect(() => {
    isNightRef.current = isNight;
  }, [isNight]);

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  // Dynamic paint property update effect (0ms instant color swap)
  useEffect(() => {
    if (!map || !map.style) return;
    try {
      if (map.getLayer(LAYER_LABELS_ID)) {
        map.setPaintProperty(LAYER_LABELS_ID, 'text-color', isNight ? '#FFFFFF' : textColorExpressionLight);
        map.setPaintProperty(LAYER_LABELS_ID, 'text-halo-color', isNight ? '#0F172A' : '#FFFFFF');
        map.setPaintProperty(LAYER_LABELS_ID, 'text-halo-width', 2);
        map.setPaintProperty(LAYER_LABELS_ID, 'text-halo-blur', 0.5);
        map.setPaintProperty(LAYER_LABELS_ID, 'icon-color', isNight ? '#FFFFFF' : iconColorExpression);
      }
    } catch (err) {
      console.warn('Error updating POI layer paint properties:', err);
    }
  }, [map, isNight]);

  // Main lifecycle: mount event listeners, add cached icons, and register layers safely
  useEffect(() => {
    if (!map) return;
    window.map = map;

    let isCleanedUp = false;

    const executeRegistration = () => {
      if (isCleanedUp || !map || !map.style) return;

      try {
        // 1. Add all pre-cached Maki SVG icons to the Mapbox map
        UNIQUE_ICONS.forEach(icon => {
          if (!map.hasImage(icon)) {
            if (ICON_CACHE.has(icon)) {
              try {
                map.addImage(icon, ICON_CACHE.get(icon), { sdf: true });
              } catch (e) {}
            } else {
              const img = new Image();
              img.onload = () => {
                if (isCleanedUp || !map.style) return;
                try {
                  ICON_CACHE.set(icon, img);
                  if (!map.hasImage(icon)) {
                    map.addImage(icon, img, { sdf: true });
                  }
                } catch (err) {}
              };
              img.src = `/icons/${icon}.svg`;
            }
          }
        });

        // 2. Add or update GeoJSON source
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: POI_GEOJSON
          });
        } else {
          map.getSource(SOURCE_ID).setData(POI_GEOJSON);
        }

        // 3. Add Symbol Icon & Label Layer
        if (!map.getLayer(LAYER_LABELS_ID)) {
          map.addLayer({
            id: LAYER_LABELS_ID,
            type: 'symbol',
            source: SOURCE_ID,
            minzoom: 12,
            layout: {
              'icon-image': ['get', 'maki_icon'],
              'icon-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12.5, 0,
                13, 0.45,
                15, 0.85,
                18, 0.95
              ],
              'icon-allow-overlap': false,
              'text-field': ['get', 'name'],
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14, 0,
                14.5, 10.5,
                16, 11.5,
                18, 12.5
              ],
              'text-letter-spacing': 0.01,
              'text-offset': [0, 1.25],
              'text-anchor': 'top',
              'text-allow-overlap': false
            },
            paint: {
              'icon-color': isNightRef.current ? '#FFFFFF' : iconColorExpression,
              'text-color': isNightRef.current ? '#FFFFFF' : textColorExpressionLight,
              'text-halo-color': isNightRef.current ? '#0F172A' : '#FFFFFF',
              'text-halo-width': 2,
              'text-halo-blur': 0.5
            }
          });
        }

        // Mouse handlers
        const handleMouseEnter = () => {
          map.getCanvas().style.cursor = 'pointer';
        };
        const handleMouseLeave = () => {
          map.getCanvas().style.cursor = '';
        };
        const handleClick = (e) => {
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          const coords = feat.geometry.coordinates;
          const props = feat.properties || {};
          
          if (onPlaceSelectRef.current) {
            onPlaceSelectRef.current({
              name: props.name,
              category: props.category || 'location',
              lat: coords[1],
              lng: coords[0]
            });
          }
        };

        map.off('mouseenter', LAYER_LABELS_ID, handleMouseEnter);
        map.off('mouseleave', LAYER_LABELS_ID, handleMouseLeave);
        map.off('click', LAYER_LABELS_ID, handleClick);

        map.on('mouseenter', LAYER_LABELS_ID, handleMouseEnter);
        map.on('mouseleave', LAYER_LABELS_ID, handleMouseLeave);
        map.on('click', LAYER_LABELS_ID, handleClick);

      } catch (err) {
        console.warn('[POILayer] Error registering POI layers:', err);
      }
    };

    const loadAndSetup = () => {
      if (isCleanedUp || !map || !map.style) return;
      if (map.isStyleLoaded()) {
        executeRegistration();
      } else {
        map.once('idle', () => {
          if (!isCleanedUp) executeRegistration();
        });
      }
    };

    const handleStyleLoad = () => {
      if (isCleanedUp) return;
      loadAndSetup();
    };

    map.on('style.load', handleStyleLoad);

    if (map.style) {
      loadAndSetup();
    }

    return () => {
      isCleanedUp = true;
      map.off('style.load', handleStyleLoad);
      try {
        if (map && map.style) {
          if (map.getLayer(LAYER_LABELS_ID)) map.removeLayer(LAYER_LABELS_ID);
          if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        }
      } catch (err) {
        console.warn('Error cleaning up POILayer:', err);
      }
    };
  }, [map]);

  return null;
};

export default POILayer;
