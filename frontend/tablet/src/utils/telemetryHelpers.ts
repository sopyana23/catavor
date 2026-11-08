export interface DimensionalMetric {
  dimension_value: string;
  name: string;
  views: number;
  percentage: number;
  conversion_rate_percent?: number;
  unique_visitors?: number;
  total_actions?: number;
}

export interface AggregatedDimensionResult {
  topItems: DimensionalMetric[];
  otherItem: DimensionalMetric | null;
  displayItems: DimensionalMetric[];
  totalItemsCount: number;
  remainingCount: number;
  totalViews: number;
}

/**
 * Computes Top-N dimensional items and groups the long tail into an aggregated "Others" entry.
 * Guarantees that the sum of percentages equals 100% and layout height remains bounded.
 */
export function aggregateTopNDimensions(
  items: DimensionalMetric[] | undefined | null,
  topN: number = 5,
  othersLabel: string = 'Lainnya'
): AggregatedDimensionResult {
  if (!items || items.length === 0) {
    return {
      topItems: [],
      otherItem: null,
      displayItems: [],
      totalItemsCount: 0,
      remainingCount: 0,
      totalViews: 0
    };
  }

  // Sort descending by views
  const sorted = [...items].sort((a, b) => (b.views || 0) - (a.views || 0));
  const totalViews = sorted.reduce((sum, item) => sum + (item.views || 0), 0);

  if (sorted.length <= topN) {
    const topItems = sorted.map(item => ({
      ...item,
      percentage: totalViews > 0 ? (item.views / totalViews) * 100 : item.percentage
    }));
    return {
      topItems,
      otherItem: null,
      displayItems: topItems,
      totalItemsCount: sorted.length,
      remainingCount: 0,
      totalViews
    };
  }

  const top = sorted.slice(0, topN);
  const remaining = sorted.slice(topN);

  const remainingViews = remaining.reduce((sum, item) => sum + (item.views || 0), 0);
  const remainingActions = remaining.reduce((sum, item) => sum + (item.total_actions || 0), 0);
  const remainingUnique = remaining.reduce((sum, item) => sum + (item.unique_visitors || 0), 0);

  const topItems = top.map(item => ({
    ...item,
    percentage: totalViews > 0 ? (item.views / totalViews) * 100 : item.percentage
  }));

  const remainingPercent = totalViews > 0 ? (remainingViews / totalViews) * 100 : 0;
  const remainingCR = remainingViews > 0 ? (remainingActions / remainingViews) * 100 : 0;

  const otherItem: DimensionalMetric = {
    dimension_value: '__others__',
    name: `${othersLabel} (${remaining.length})`,
    views: remainingViews,
    percentage: remainingPercent,
    conversion_rate_percent: remainingCR,
    unique_visitors: remainingUnique,
    total_actions: remainingActions
  };

  return {
    topItems,
    otherItem,
    displayItems: [...topItems, otherItem],
    totalItemsCount: sorted.length,
    remainingCount: remaining.length,
    totalViews
  };
}

export interface TimeBandMetric {
  key: string;
  label: string;
  range: string;
  views: number;
  percentage: number;
  peakHour: string;
}

export function computeHourlyTimeBands(hourlyHeatmap: Array<{ hour: string; views: number }> | undefined | null): {
  bands: TimeBandMetric[];
  peakHour: { hour: string; views: number };
  totalViews: number;
} {
  const hours = hourlyHeatmap && hourlyHeatmap.length === 24
    ? hourlyHeatmap
    : Array.from({ length: 24 }, (_, i) => ({ hour: String(i).padStart(2, '0'), views: 0 }));

  let totalViews = 0;
  let peak = { hour: '00', views: 0 };

  hours.forEach(h => {
    totalViews += h.views;
    if (h.views > peak.views) {
      peak = { hour: h.hour, views: h.views };
    }
  });

  const bandDefs = [
    { key: 'night', label: 'Dini Hari', start: 0, end: 5, range: '00:00 - 05:59' },
    { key: 'morning', label: 'Pagi Hari', start: 6, end: 11, range: '06:00 - 11:59' },
    { key: 'afternoon', label: 'Siang - Sore', start: 12, end: 17, range: '12:00 - 17:59' },
    { key: 'evening', label: 'Malam (Prime Time)', start: 18, end: 23, range: '18:00 - 23:59' },
  ];

  const bands: TimeBandMetric[] = bandDefs.map(def => {
    const bandHours = hours.filter(h => {
      const hNum = parseInt(h.hour, 10);
      return hNum >= def.start && hNum <= def.end;
    });

    const views = bandHours.reduce((sum, h) => sum + h.views, 0);
    const bandPeak = bandHours.reduce((max, h) => (h.views > max.views ? h : max), { hour: String(def.start).padStart(2, '0'), views: 0 });

    return {
      key: def.key,
      label: def.label,
      range: def.range,
      views,
      percentage: totalViews > 0 ? (views / totalViews) * 100 : 0,
      peakHour: bandPeak.hour
    };
  });

  return { bands, peakHour: peak, totalViews };
}
