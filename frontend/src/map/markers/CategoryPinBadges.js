/**
 * CategoryPinBadges.js
 * High-Definition Apple/Google-Style Vector Pin Badges with Day/Night outer glow.
 */

// Category Style Specifications
export const CATEGORY_STYLES = {
  hostel: {
    bgDay: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
    bgNight: 'linear-gradient(135deg, #F472B6 0%, #E11D48 100%)',
    glowNight: '0 0 14px rgba(244, 114, 182, 0.7)',
    borderColor: '#FFFFFF',
    svgIcon: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 4v16M2 8h20v12M2 17h20M6 8v9M18 8v9M7 11h4a2 2 0 0 1 2 2v4H5v-4a2 2 0 0 1 2-2z"/>
      </svg>
    `
  },
  university: {
    bgDay: 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)',
    bgNight: 'linear-gradient(135deg, #FACC15 0%, #A16207 100%)',
    glowNight: '0 0 14px rgba(250, 204, 21, 0.7)',
    borderColor: '#FFFFFF',
    svgIcon: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>
    `
  },
  dining: {
    bgDay: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
    bgNight: 'linear-gradient(135deg, #FB923C 0%, #C2410C 100%)',
    glowNight: '0 0 14px rgba(251, 146, 60, 0.7)',
    borderColor: '#FFFFFF',
    svgIcon: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 2v20M18 8h-4V2M14 12v10M6 2v10M10 2v10M3 2v6a3 3 0 0 0 6 0V2"/>
      </svg>
    `
  },
  medical: {
    bgDay: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    bgNight: 'linear-gradient(135deg, #F87171 0%, #B91C1C 100%)',
    glowNight: '0 0 14px rgba(248, 113, 113, 0.7)',
    borderColor: '#FFFFFF',
    svgIcon: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 6v12M6 12h12"/>
      </svg>
    `
  },
  worship: {
    bgDay: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    bgNight: 'linear-gradient(135deg, #A78BFA 0%, #6D28D9 100%)',
    glowNight: '0 0 14px rgba(167, 139, 250, 0.7)',
    borderColor: '#FFFFFF',
    svgIcon: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v8M9 5h6M4 22V10l8-4 8 4v12H4zM10 22v-5a2 2 0 0 1 4 0v5"/>
      </svg>
    `
  },
  shop: {
    bgDay: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
    bgNight: 'linear-gradient(135deg, #38BDF8 0%, #0369A1 100%)',
    glowNight: '0 0 14px rgba(56, 189, 248, 0.7)',
    borderColor: '#FFFFFF',
    svgIcon: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>
      </svg>
    `
  },
  default: {
    bgDay: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    bgNight: 'linear-gradient(135deg, #60A5FA 0%, #1D4ED8 100%)',
    glowNight: '0 0 14px rgba(96, 165, 250, 0.7)',
    borderColor: '#FFFFFF',
    svgIcon: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    `
  }
};

/**
 * Returns style object for a given category key.
 */
export const getCategoryStyle = (categoryKey = '', name = '') => {
  const cat = (categoryKey || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (['hostel', 'boarding', 'hotel', 'guest_house', 'dormitory', 'residence', 'motel', 'lodging', 'housing', 'apartment', 'bed & breakfast', 'serviced accommodation', 'shelter', 'condominium'].some(k => cat.includes(k) || n.includes(k))) {
    return CATEGORY_STYLES.hostel;
  }
  if (['university', 'school', 'library', 'ict', 'college', 'academic', 'campus', 'education', 'institution', 'auditorium', 'kindergarten', 'playground'].some(k => cat.includes(k) || n.includes(k))) {
    return CATEGORY_STYLES.university;
  }
  if (['restaurant', 'cafe', 'food', 'pub', 'bar', 'dining', 'eatery', 'fast_food', 'bakery', 'diner', 'beverages'].some(k => cat.includes(k) || n.includes(k))) {
    return CATEGORY_STYLES.dining;
  }
  if (['clinic', 'hospital', 'health', 'pharmacy', 'medical', 'doctors', 'laboratory', 'veterinary'].some(k => cat.includes(k) || n.includes(k))) {
    return CATEGORY_STYLES.medical;
  }
  if (['church', 'chapel', 'worship', 'outreach', 'cathedral', 'place_of_worship'].some(k => cat.includes(k) || n.includes(k))) {
    return CATEGORY_STYLES.worship;
  }
  if (['shop', 'store', 'market', 'supermarket', 'enterprise', 'commercial', 'mall', 'boutique', 'convenience', 'bank', 'atm', 'butcher', 'car_wash'].some(k => cat.includes(k) || n.includes(k))) {
    return CATEGORY_STYLES.shop;
  }

  return CATEGORY_STYLES.default;
};

/**
 * Creates high-definition HTML markup for Apple/Google style pin badge (circular category icon badge on top of place name text).
 */
export const createPinBadgeHtml = (name, categoryKey = 'default', isNight = false) => {
  const style = getCategoryStyle(categoryKey, name);
  const bg = isNight ? style.bgNight : style.bgDay;
  const glow = isNight ? style.glowNight : '0 2px 8px rgba(0, 0, 0, 0.25)';
  const textColor = isNight ? '#F8FAFC' : '#0F172A';
  const textBg = isNight ? 'rgba(15, 23, 42, 0.90)' : 'rgba(255, 255, 255, 0.94)';

  return `
    <div class="category-pin-badge-wrapper" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -100%);
      cursor: pointer;
      pointer-events: auto;
      user-select: none;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    ">
      <!-- Circular Category Badge Icon ON TOP -->
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: ${bg};
        border: 2px solid ${style.borderColor};
        box-shadow: ${glow};
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
      ">
        ${style.svgIcon}
      </div>

      <!-- Place Name Label Text BELOW Icon -->
      <div style="
        margin-top: 2px;
        padding: 2px 6px;
        border-radius: 6px;
        background: ${textBg};
        backdrop-filter: blur(4px);
        color: ${textColor};
        font-size: 11px;
        font-weight: 700;
        font-family: system-ui, -apple-system, sans-serif;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        border: 1px solid ${isNight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.10)'};
        z-index: 1;
      ">
        ${name}
      </div>
    </div>
  `;
};




/**
 * Dynamically generates high-DPI circular category badge images and registers them into Mapbox GL JS canvas.
 */
export const registerCategoryBadgeImages = (map) => {
  if (!map) return;

  const categories = [
    { name: 'university', color: '#EAB308', icon: 'cap' },
    { name: 'hostel', color: '#EC4899', icon: 'bed' },
    { name: 'dining', color: '#F97316', icon: 'utensils' },
    { name: 'medical', color: '#EF4444', icon: 'cross' },
    { name: 'worship', color: '#8B5CF6', icon: 'chapel' },
    { name: 'shop', color: '#0EA5E9', icon: 'bag' },
    { name: 'default', color: '#3B82F6', icon: 'marker' }
  ];

  categories.forEach(cat => {
    const imageName = `mulu-badge-${cat.name}`;
    if (map.hasImage(imageName)) return;

    const size = 56; // 2x High-DPI size for crisp rendering
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const radius = size / 2 - 4;
    const centerX = size / 2;
    const centerY = size / 2;

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // White outer border ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';

    // Inner category circle fill
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 3, 0, 2 * Math.PI, false);
    ctx.fillStyle = cat.color;
    ctx.fill();

    // Vector Icon Drawing
    ctx.strokeStyle = '#FFFFFF';
    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (cat.icon === 'cap') {
      // Graduation Cap Icon
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 8);
      ctx.lineTo(centerX + 12, centerY - 2);
      ctx.lineTo(centerX, centerY + 4);
      ctx.lineTo(centerX - 12, centerY - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY + 4, 7, 0, Math.PI, false);
      ctx.stroke();
    } else if (cat.icon === 'bed') {
      // Bed Icon
      ctx.beginPath();
      ctx.moveTo(centerX - 10, centerY - 6);
      ctx.lineTo(centerX - 10, centerY + 10);
      ctx.moveTo(centerX + 10, centerY - 2);
      ctx.lineTo(centerX + 10, centerY + 10);
      ctx.moveTo(centerX - 10, centerY + 3);
      ctx.lineTo(centerX + 10, centerY + 3);
      ctx.stroke();
      ctx.fillRect(centerX - 8, centerY - 4, 5, 5);
    } else if (cat.icon === 'utensils') {
      // Utensils Icon
      ctx.beginPath();
      ctx.moveTo(centerX - 6, centerY - 8);
      ctx.lineTo(centerX - 6, centerY + 8);
      ctx.moveTo(centerX + 6, centerY - 8);
      ctx.lineTo(centerX + 6, centerY + 8);
      ctx.stroke();
    } else if (cat.icon === 'cross') {
      // Medical Cross
      ctx.fillRect(centerX - 3, centerY - 9, 6, 18);
      ctx.fillRect(centerX - 9, centerY - 3, 18, 6);
    } else if (cat.icon === 'chapel') {
      // Chapel Cross
      ctx.fillRect(centerX - 2.5, centerY - 10, 5, 20);
      ctx.fillRect(centerX - 8, centerY - 6, 16, 5);
    } else if (cat.icon === 'bag') {
      // Shop Bag
      ctx.strokeRect(centerX - 8, centerY - 4, 16, 14);
      ctx.beginPath();
      ctx.arc(centerX, centerY - 4, 5, Math.PI, 0, false);
      ctx.stroke();
    } else {
      // Default Pin Circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    const imgData = ctx.getImageData(0, 0, size, size);
    if (!map.hasImage(imageName)) {
      map.addImage(imageName, { width: size, height: size, data: imgData.data }, { pixelRatio: 2 });
    }
  });
};


