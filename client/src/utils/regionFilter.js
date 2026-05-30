/**
 * Helpers to dynamically classify shipments as USA, Europe, or India-based
 * using an explicit 'country' property OR fallback keyword matching on
 * destination, origin, show city, exhibition, or recipient.
 */

export const isUsaShipment = (item) => {
    if (!item) return false;
    
    const country = String(item.country || '').trim().toUpperCase();
    
    // 1. If explicit country column is filled, use it exclusively
    if (country) {
        return country === 'USA' || country === 'US' || country === 'UNITED STATES';
    }
    
    // 2. Otherwise, fallback to keyword matching ONLY if country column is empty
    const dest = String(item.destination || '').toUpperCase();
    const city = String(item.show_city || '').toUpperCase();
    const recipient = String(item.recipient || '').toUpperCase();
    const origin = String(item.origin || '').toUpperCase();
    const exhibition = String(item.exhibition_name || '').toUpperCase();
    
    // Common US states, cities, abbreviations, and exhibition centres
    const usKeywords = [
        'USA', 'UNITED STATES', ' U.S.', ' U.S.A.', ', US', ',US', 'NEW YORK', 'LAS VEGAS', 
        'CHICAGO', 'ORLANDO', 'MIAMI', 'LOS ANGELES', 'SAN FRANCISCO', 'WASHINGTON', 'BOSTON',
        'ATLANTA', 'DALLAS', 'HOUSTON', 'SEATTLE', 'DETROIT', 'OHIO', 'NEVADA', 'FLORIDA', 'CALIFORNIA',
        'TEXAS', 'NEW ALBANY', 'PORTLAND', 'SAN DIAGO', 'SAN DIEGO', 'ORLENDO'
    ];
    
    const matchesUs = usKeywords.some(kw => 
        dest.includes(kw) || 
        city.includes(kw) || 
        recipient.includes(kw) || 
        origin.includes(kw) || 
        exhibition.includes(kw)
    ) ||
    /\b(US|USA)\b/i.test(dest) || 
    /\b(US|USA)\b/i.test(city) || 
    /\b(US|USA)\b/i.test(exhibition) ||
    /\b(US|USA)\b/i.test(origin);
           
    return matchesUs;
};

export const isEuropeShipment = (item) => {
    if (!item) return false;

    const country = String(item.country || '').trim().toUpperCase();
    
    // 1. If explicit country column is filled, use it exclusively
    if (country) {
        return country === 'EUROPE' || country === 'EU' || country === 'UK' || country === 'UNITED KINGDOM';
    }
    
    // 2. Otherwise, fallback to keyword matching ONLY if country column is empty
    const dest = String(item.destination || '').toUpperCase();
    const city = String(item.show_city || '').toUpperCase();
    const recipient = String(item.recipient || '').toUpperCase();
    const origin = String(item.origin || '').toUpperCase();
    const exhibition = String(item.exhibition_name || '').toUpperCase();

    // Common European countries, cities, abbreviations, and exhibition locations
    const euKeywords = [
        'GERMANY', 'DEUTSCHLAND', 'FRANCE', 'UNITED KINGDOM', 'GREAT BRITAIN', ' UK', ' U.K.', ', UK', ',UK',
        'ITALY', 'ITALIA', 'SPAIN', 'ESPANA', 'NETHERLANDS', 'HOLLAND', 'BELGIUM', 'SWITZERLAND', 'AUSTRIA',
        'DENMARK', 'SWEDEN', 'NORWAY', 'FINLAND', 'IRELAND', 'POLAND', 'PORTUGAL', 'GREECE', 'EUROPE', 'EU',
        'DUSSELDORF', 'MUNICH', 'MUNCHEN', 'FRANKFURT', 'PARIS', 'LONDON', 'AMSTERDAM', 'BRUSSELS', 'MILAN', 
        'MILANO', 'ROME', 'ROMA', 'BARCELONA', 'MADRID', 'GENEVA', 'ZURICH', 'VIENNA', 'COPENHAGEN', 
        'STOCKHOLM', 'OSLO', 'HELSINKI', 'DUBLIN', 'WARSAW', 'LISBON', 'ATHENS', 'BIRMINGHAM', 'MANCHESTER',
        ' NL', ' DE', ' FR', ' IT', ' ES', ' BE', ' CH', ' AT', ' DK', ' SE', ' NO', ' FI', ' IE', ' PL', ' PT', ' GR',
        'NL-GMBH', 'GMBH', 'GMBH-NL'
    ];
    
    const matchesEu = euKeywords.some(kw => 
        dest.includes(kw) || 
        city.includes(kw) || 
        recipient.includes(kw) || 
        origin.includes(kw) || 
        exhibition.includes(kw)
    ) ||
    /\b(UK|GB|DE|FR|IT|ES|NL|BE|CH|AT|DK|SE|NO|FI|IE|PL|PT|GR|EU|NL-GMBH|GMBH|GMBH-NL)\b/i.test(dest) ||
    /\b(UK|GB|DE|FR|IT|ES|NL|BE|CH|AT|DK|SE|NO|FI|IE|PL|PT|GR|EU|NL-GMBH|GMBH|GMBH-NL)\b/i.test(city) ||
    /\b(UK|GB|DE|FR|IT|ES|NL|BE|CH|AT|DK|SE|NO|FI|IE|PL|PT|GR|EU|NL-GMBH|GMBH|GMBH-NL)\b/i.test(exhibition) ||
    /\b(UK|GB|DE|FR|IT|ES|NL|BE|CH|AT|DK|SE|NO|FI|IE|PL|PT|GR|EU|NL-GMBH|GMBH|GMBH-NL)\b/i.test(origin);
    
    // Europe shipments should not overlap with US
    return matchesEu && !isUsaShipment(item);
};

export const isIndiaShipment = (item) => {
    if (!item) return false;

    const country = String(item.country || '').trim().toUpperCase();
    
    // 1. If explicit country column is filled, use it exclusively
    if (country) {
        return country === 'INDIA' || country === 'IN';
    }
    
    // 2. Otherwise, fallback to keyword matching ONLY if country column is empty
    const dest = String(item.destination || '').toUpperCase();
    const city = String(item.show_city || '').toUpperCase();
    const recipient = String(item.recipient || '').toUpperCase();
    const origin = String(item.origin || '').toUpperCase();
    const exhibition = String(item.exhibition_name || '').toUpperCase();

    // Common Indian locations, cities, states, and center tags
    const inKeywords = [
        'INDIA', 'IN', ', IN', ',IN', 'NOIDA', 'MUMBAI', 'CHENNAI', 'DELHI', 'BENGALURU', 
        'BANGALORE', 'KOLKATA', 'JAIPUR', 'HYDERABAD', 'PUNE', 'INDORE', 'JIO', 'HITEX', 
        'BIEC', 'PRAGATI', 'MAIDAN', 'HAVELLS', 'WIPRO', 'RELIANCE'
    ];
    
    const matchesIn = inKeywords.some(kw => 
        dest.includes(kw) || 
        city.includes(kw) || 
        recipient.includes(kw) || 
        origin.includes(kw) || 
        exhibition.includes(kw)
    ) ||
    /\b(IN|IND)\b/i.test(dest) || 
    /\b(IN|IND)\b/i.test(city) || 
    /\b(IN|IND)\b/i.test(exhibition) ||
    /\b(IN|IND)\b/i.test(origin);
    
    // India shipments should not overlap with US or Europe
    return matchesIn && !isUsaShipment(item) && !isEuropeShipment(item);
};
