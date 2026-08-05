export const ABOUT_ICONS_OPTIONS = [
  { key: 'shield', label: '🛡️ Garansi / Keamanan' },
  { key: 'lock', label: '🔒 Transaksi / Terpercaya' },
  { key: 'message', label: '💬 Konsultasi / Chat' },
  { key: 'heart', label: '❤️ Kesehatan / Kasih Sayang' },
  { key: 'truck', label: '🚚 Pengiriman / Delivery' },
  { key: 'sparkles', label: '✨ Kualitas / Premium' },
  { key: 'star', label: '⭐ Rekomendasi / Terbaik' },
  { key: 'compass', label: '🧭 Eksplorasi / Visi' }
];

/* ==========================================================================
   OPERATIONAL HOURS HELPER & DYNAMIC COMPONENTS
   ========================================================================== */

export interface DaySchedule {
  open: string;
  close: string;
  status: 'open' | 'closed';
}

export interface OperationalHoursData {
  mode: 'everyday' | 'weekdays_weekends' | 'custom' | 'manual';
  timezone: string; // 'WIB' | 'WITA' | 'WIT'
  display_text?: string;
  manual_text?: string;
  everyday?: DaySchedule;
  weekdays?: DaySchedule;
  weekends?: DaySchedule;
  days?: Record<string, DaySchedule>;
}

export const INDO_DAYS_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const;

export const DEFAULT_OPERATIONAL_HOURS: OperationalHoursData = {
  mode: 'everyday',
  timezone: 'WIB',
  everyday: { open: '08:00', close: '21:00', status: 'open' },
  weekdays: { open: '08:00', close: '21:00', status: 'open' },
  weekends: { open: '09:00', close: '22:00', status: 'open' },
  days: {
    'Senin': { open: '08:00', close: '21:00', status: 'open' },
    'Selasa': { open: '08:00', close: '21:00', status: 'open' },
    'Rabu': { open: '08:00', close: '21:00', status: 'open' },
    'Kamis': { open: '08:00', close: '21:00', status: 'open' },
    'Jumat': { open: '08:00', close: '21:00', status: 'open' },
    'Sabtu': { open: '09:00', close: '22:00', status: 'open' },
    'Minggu': { open: '09:00', close: '22:00', status: 'open' },
  }
};

export function parseOperationalHours(raw?: string): OperationalHoursData {
  if (!raw || !raw.trim()) {
    return DEFAULT_OPERATIONAL_HOURS;
  }

  const str = raw.trim();

  // Try JSON parse first
  if (str.startsWith('{')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object' && parsed.mode) {
        return {
          ...DEFAULT_OPERATIONAL_HOURS,
          ...parsed,
          days: { ...DEFAULT_OPERATIONAL_HOURS.days, ...(parsed.days || {}) }
        };
      }
    } catch (e) {
      // ignore & fallback
    }
  }

  // Regex string fallback
  const timeMatch = str.match(/(\d{1,2}[:.]\d{2})\s*[-–s\/d]+\s*(\d{1,2}[:.]\d{2})/);
  const tzMatch = str.match(/(WIB|WITA|WIT)/i);
  const timezone = tzMatch ? tzMatch[1].toUpperCase() : 'WIB';

  if (timeMatch) {
    const open = timeMatch[1].replace('.', ':').padStart(5, '0');
    const close = timeMatch[2].replace('.', ':').padStart(5, '0');
    return {
      mode: 'manual',
      timezone,
      manual_text: str,
      display_text: str,
      everyday: { open, close, status: 'open' },
      weekdays: { open, close, status: 'open' },
      weekends: { open, close, status: 'open' },
      days: {
        'Senin': { open, close, status: 'open' },
        'Selasa': { open, close, status: 'open' },
        'Rabu': { open, close, status: 'open' },
        'Kamis': { open, close, status: 'open' },
        'Jumat': { open, close, status: 'open' },
        'Sabtu': { open, close, status: 'open' },
        'Minggu': { open, close, status: 'open' },
      }
    };
  }

  return {
    mode: 'manual',
    timezone: 'WIB',
    manual_text: str,
    display_text: str,
    everyday: { open: '08:00', close: '21:00', status: 'open' },
    weekdays: { open: '08:00', close: '21:00', status: 'open' },
    weekends: { open: '08:00', close: '21:00', status: 'open' },
    days: DEFAULT_OPERATIONAL_HOURS.days
  };
}

export function getOperationalStatus(data: OperationalHoursData) {
  const now = new Date();
  const dayMap = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = dayMap[now.getDay()];
  const currentMin = now.getHours() * 60 + now.getMinutes();

  if (data.mode === 'manual' && data.manual_text && !data.everyday?.open) {
    return {
      status: 'open',
      badgeText: '🟢 BUKA HARI INI',
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      summaryText: data.manual_text,
      todayScheduleText: data.manual_text,
      todayName
    };
  }

  let todaySched: DaySchedule = { open: '08:00', close: '21:00', status: 'open' };

  if (data.mode === 'everyday') {
    todaySched = data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  } else if (data.mode === 'weekdays_weekends') {
    const isWeekend = todayName === 'Sabtu' || todayName === 'Minggu';
    todaySched = isWeekend ? (data.weekends || { open: '09:00', close: '22:00', status: 'open' }) : (data.weekdays || { open: '08:00', close: '21:00', status: 'open' });
  } else if (data.mode === 'custom' && data.days && data.days[todayName]) {
    todaySched = data.days[todayName];
  } else {
    todaySched = data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  }

  // Determine summary string
  let summaryText = '';
  if (data.mode === 'manual' && data.manual_text) {
    summaryText = data.manual_text;
  } else if (data.mode === 'everyday') {
    summaryText = `${data.everyday?.open || '08:00'} - ${data.everyday?.close || '21:00'} ${data.timezone} (Setiap Hari)`;
  } else if (data.mode === 'weekdays_weekends') {
    summaryText = `Senin-Jumat: ${data.weekdays?.open || '08:00'}-${data.weekdays?.close || '21:00'} | Sabtu-Minggu: ${data.weekends?.open || '09:00'}-${data.weekends?.close || '22:00'} ${data.timezone}`;
  } else {
    summaryText = `${todaySched.open} - ${todaySched.close} ${data.timezone} (${todayName})`;
  }

  if (todaySched.status === 'closed') {
    return {
      status: 'closed',
      badgeText: '🔴 TUTUP HARI INI',
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): Tutup`,
      todayName
    };
  }

  const [openH, openM] = (todaySched.open || '08:00').split(':').map(Number);
  const [closeH, closeM] = (todaySched.close || '21:00').split(':').map(Number);

  const openMin = (openH || 0) * 60 + (openM || 0);
  const closeMin = (closeH || 0) * 60 + (closeM || 0);

  if (currentMin >= openMin && currentMin < closeMin) {
    const minsLeft = closeMin - currentMin;
    if (minsLeft <= 45) {
      return {
        status: 'closing_soon',
        badgeText: `🟡 SEGERA TUTUP (${minsLeft}m lagi)`,
        badgeColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        badgeBorder: 'rgba(245, 158, 11, 0.3)',
        summaryText,
        todayScheduleText: `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone}`,
        todayName
      };
    }
    return {
      status: 'open',
      badgeText: `🟢 BUKA SEKARANG (${todaySched.open} - ${todaySched.close} ${data.timezone})`,
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone}`,
      todayName
    };
  } else if (currentMin < openMin) {
    return {
      status: 'closed',
      badgeText: `🔴 TUTUP (Buka ${todaySched.open})`,
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone}`,
      todayName
    };
  } else {
    return {
      status: 'closed',
      badgeText: '🔴 TUTUP SEKARANG',
      badgeColor: '#ef4444',
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeBorder: 'rgba(239, 68, 68, 0.3)',
      summaryText,
      todayScheduleText: `Hari ini (${todayName}): ${todaySched.open} - ${todaySched.close} ${data.timezone}`,
      todayName
    };
  }
}

export function OperationalHoursCard({ rawHours }: { rawHours?: string }) {
  const [expanded, setExpanded] = useState(false);
  const data = useMemo(() => parseOperationalHours(rawHours), [rawHours]);
  const statusInfo = useMemo(() => getOperationalStatus(data), [data]);

  const getDaySchedule = (dayName: string): DaySchedule => {
    if (data.mode === 'everyday') return data.everyday || { open: '08:00', close: '21:00', status: 'open' };
    if (data.mode === 'weekdays_weekends') {
      const isWk = dayName === 'Sabtu' || dayName === 'Minggu';
      return isWk ? (data.weekends || { open: '09:00', close: '22:00', status: 'open' }) : (data.weekdays || { open: '08:00', close: '21:00', status: 'open' });
    }
    if (data.mode === 'custom' && data.days && data.days[dayName]) {
      return data.days[dayName];
    }
    return data.everyday || { open: '08:00', close: '21:00', status: 'open' };
  };

  return (
    <div style={{ borderRadius: '0.85rem', border: '1px solid var(--border-light)', backgroundColor: 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'all 0.2s ease' }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', flexShrink: 0, border: '1px solid var(--border-light)' }}>
          <Clock size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Jam Operasional</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.55rem', borderRadius: '9999px', backgroundColor: statusInfo.badgeBg, color: statusInfo.badgeColor, border: `1px solid ${statusInfo.badgeBorder}`, letterSpacing: '0.02em' }}>
              {statusInfo.badgeText}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 800 }}>
              {statusInfo.summaryText}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
              {expanded ? 'Tutup ▴' : 'Jadwal ▾'}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Weekly Schedule Table */}
      {expanded && (
        <div style={{ padding: '0.85rem 1rem 1rem 1rem', borderTop: '1px dashed var(--border-light)', backgroundColor: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>RINCIAN JADWAL MINGGUAN ({data.timezone})</span>
            <span>{statusInfo.todayName ? `Hari ini: ${statusInfo.todayName}` : ''}</span>
          </div>
          {INDO_DAYS_LIST.map((day) => {
            const isToday = day === statusInfo.todayName;
            const daySched = getDaySchedule(day);
            const isClosed = daySched.status === 'closed';

            return (
              <div 
                key={day}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'space-between',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: isToday ? 'var(--primary-glow)' : 'transparent',
                  border: isToday ? '1px solid var(--primary)' : '1px solid transparent',
                  fontSize: '0.8rem',
                  fontWeight: isToday ? 800 : 500
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: isToday ? 'var(--primary)' : 'var(--text-primary)' }}>{day}</span>
                  {isToday && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.05rem 0.4rem', borderRadius: '4px', backgroundColor: 'var(--primary)', color: '#fff' }}>
                      Hari Ini
                    </span>
                  )}
                </div>
                <span style={{ color: isClosed ? '#ef4444' : (isToday ? 'var(--primary)' : 'var(--text-secondary)'), fontWeight: isClosed ? 700 : (isToday ? 800 : 600) }}>
                  {isClosed ? 'TUTUP' : `${daySched.open} - ${daySched.close} ${data.timezone}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function OperationalHoursBuilder({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (val: string) => void; 
}) {
  const parsedData = useMemo(() => parseOperationalHours(value), [value]);

  const [mode, setMode] = useState<'everyday' | 'weekdays_weekends' | 'custom' | 'manual'>(parsedData.mode || 'everyday');
  const [timezone, setTimezone] = useState<string>(parsedData.timezone || 'WIB');

  // Everyday state
  const [everyday, setEveryday] = useState<DaySchedule>(parsedData.everyday || { open: '08:00', close: '21:00', status: 'open' });

  // Weekdays & Weekends state
  const [weekdays, setWeekdays] = useState<DaySchedule>(parsedData.weekdays || { open: '08:00', close: '21:00', status: 'open' });
  const [weekends, setWeekends] = useState<DaySchedule>(parsedData.weekends || { open: '09:00', close: '22:00', status: 'open' });

  // Custom 7 Days state
  const [days, setDays] = useState<Record<string, DaySchedule>>(parsedData.days || DEFAULT_OPERATIONAL_HOURS.days!);

  // Manual text state
  const [manualText, setManualText] = useState<string>(parsedData.manual_text || parsedData.display_text || '');

  // Helper to emit JSON updates to parent
  const emitUpdate = (newMode: string, newTz: string, newEveryday: DaySchedule, newWkdays: DaySchedule, newWkends: DaySchedule, newDays: Record<string, DaySchedule>, newManual: string) => {
    let resultObj: OperationalHoursData;

    if (newMode === 'everyday') {
      resultObj = {
        mode: 'everyday',
        timezone: newTz,
        everyday: newEveryday,
        display_text: `${newEveryday.open} - ${newEveryday.close} ${newTz} (Setiap Hari)`
      };
    } else if (newMode === 'weekdays_weekends') {
      resultObj = {
        mode: 'weekdays_weekends',
        timezone: newTz,
        weekdays: newWkdays,
        weekends: newWkends,
        display_text: `Senin-Jumat: ${newWkdays.open}-${newWkdays.close} | Sabtu-Minggu: ${newWkends.open}-${newWkends.close} ${newTz}`
      };
    } else if (newMode === 'custom') {
      resultObj = {
        mode: 'custom',
        timezone: newTz,
        days: newDays,
        display_text: `Kustom 7 Hari (${newTz})`
      };
    } else {
      resultObj = {
        mode: 'manual',
        timezone: newTz,
        manual_text: newManual,
        display_text: newManual
      };
    }

    onChange(JSON.stringify(resultObj));
  };

  // Sync mode changes
  const handleModeChange = (newMode: 'everyday' | 'weekdays_weekends' | 'custom' | 'manual') => {
    setMode(newMode);
    emitUpdate(newMode, timezone, everyday, weekdays, weekends, days, manualText);
  };

  const handleTzChange = (newTz: string) => {
    setTimezone(newTz);
    emitUpdate(mode, newTz, everyday, weekdays, weekends, days, manualText);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', borderRadius: '0.85rem', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <label className="form-label" style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem' }}>📅 Pengaturan Jam Operasional</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Zona Waktu:</span>
          <select 
            className="form-input" 
            style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.78rem', height: 'auto', borderRadius: '0.4rem' }}
            value={timezone}
            onChange={(e) => handleTzChange(e.target.value)}
          >
            <option value="WIB">WIB (UTC+7)</option>
            <option value="WITA">WITA (UTC+8)</option>
            <option value="WIT">WIT (UTC+9)</option>
          </select>
        </div>
      </div>

      {/* Preset Mode Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
        {[
          { key: 'everyday', label: '⚡ Setiap Hari' },
          { key: 'weekdays_weekends', label: '💼 Hari Kerja & Akhir Pekan' },
          { key: 'custom', label: '🎨 Kustom 7 Hari' },
          { key: 'manual', label: '✍️ Teks Manual' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleModeChange(item.key as any)}
            style={{
              padding: '0.55rem 0.65rem',
              borderRadius: '0.55rem',
              fontSize: '0.76rem',
              fontWeight: mode === item.key ? 800 : 600,
              backgroundColor: mode === item.key ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
              color: mode === item.key ? '#fff' : 'var(--text-secondary)',
              border: mode === item.key ? '1px solid var(--primary)' : '1px solid var(--border-light)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'center'
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* MODE 1: EVERYDAY */}
      {mode === 'everyday' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Jam Buka &amp; Tutup Harian (Senin - Minggu)</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Jam Buka</label>
              <input 
                type="time" 
                className="form-input"
                value={everyday.open}
                onChange={(e) => {
                  const updated = { ...everyday, open: e.target.value };
                  setEveryday(updated);
                  emitUpdate(mode, timezone, updated, weekdays, weekends, days, manualText);
                }}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Jam Tutup</label>
              <input 
                type="time" 
                className="form-input"
                value={everyday.close}
                onChange={(e) => {
                  const updated = { ...everyday, close: e.target.value };
                  setEveryday(updated);
                  emitUpdate(mode, timezone, updated, weekdays, weekends, days, manualText);
                }}
              />
            </div>
          </div>
          {/* Quick Presets */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>Preset:</span>
            {[
              { label: '08:00 - 21:00', open: '08:00', close: '21:00' },
              { label: '09:00 - 22:00', open: '09:00', close: '22:00' },
              { label: '08:00 - 17:00', open: '08:00', close: '17:00' },
              { label: 'Buka 24 Jam', open: '00:00', close: '23:59' },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const updated = { open: p.open, close: p.close, status: 'open' as const };
                  setEveryday(updated);
                  emitUpdate(mode, timezone, updated, weekdays, weekends, days, manualText);
                }}
                style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MODE 2: WEEKDAYS & WEEKENDS */}
      {mode === 'weekdays_weekends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Weekdays */}
          <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>💼 Hari Kerja (Senin - Jumat)</span>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...weekdays, status: weekdays.status === 'open' ? 'closed' as const : 'open' as const };
                  setWeekdays(updated);
                  emitUpdate(mode, timezone, everyday, updated, weekends, days, manualText);
                }}
                style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: weekdays.status === 'closed' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: weekdays.status === 'closed' ? '#ef4444' : '#10b981', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                {weekdays.status === 'closed' ? 'Tutup' : 'Buka'}
              </button>
            </div>
            {weekdays.status !== 'closed' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Jam Buka</label>
                  <input type="time" className="form-input" value={weekdays.open} onChange={(e) => {
                    const updated = { ...weekdays, open: e.target.value };
                    setWeekdays(updated);
                    emitUpdate(mode, timezone, everyday, updated, weekends, days, manualText);
                  }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Jam Tutup</label>
                  <input type="time" className="form-input" value={weekdays.close} onChange={(e) => {
                    const updated = { ...weekdays, close: e.target.value };
                    setWeekdays(updated);
                    emitUpdate(mode, timezone, everyday, updated, weekends, days, manualText);
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Weekends */}
          <div style={{ padding: '0.85rem', borderRadius: '0.65rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 800 }}>🎉 Akhir Pekan (Sabtu - Minggu)</span>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...weekends, status: weekends.status === 'open' ? 'closed' as const : 'open' as const };
                  setWeekends(updated);
                  emitUpdate(mode, timezone, everyday, weekdays, updated, days, manualText);
                }}
                style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '4px', backgroundColor: weekends.status === 'closed' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: weekends.status === 'closed' ? '#ef4444' : '#10b981', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                {weekends.status === 'closed' ? 'Tutup' : 'Buka'}
              </button>
            </div>
            {weekends.status !== 'closed' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Jam Buka</label>
                  <input type="time" className="form-input" value={weekends.open} onChange={(e) => {
                    const updated = { ...weekends, open: e.target.value };
                    setWeekends(updated);
                    emitUpdate(mode, timezone, everyday, weekdays, updated, days, manualText);
                  }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.72rem' }}>Jam Tutup</label>
                  <input type="time" className="form-input" value={weekends.close} onChange={(e) => {
                    const updated = { ...weekends, close: e.target.value };
                    setWeekends(updated);
                    emitUpdate(mode, timezone, everyday, weekdays, updated, days, manualText);
                  }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 3: CUSTOM 7 DAYS */}
      {mode === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {INDO_DAYS_LIST.map((day) => {
            const currentSched = days[day] || { open: '08:00', close: '21:00', status: 'open' };
            const isClosed = currentSched.status === 'closed';

            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '0.55rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light)', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, width: '65px', flexShrink: 0 }}>{day}</span>
                
                {isClosed ? (
                  <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, flex: 1 }}>TUTUP SEHARIAN</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                    <input type="time" className="form-input" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} value={currentSched.open} onChange={(e) => {
                      const updatedDays = { ...days, [day]: { ...currentSched, open: e.target.value } };
                      setDays(updatedDays);
                      emitUpdate(mode, timezone, everyday, weekdays, weekends, updatedDays, manualText);
                    }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>s/d</span>
                    <input type="time" className="form-input" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} value={currentSched.close} onChange={(e) => {
                      const updatedDays = { ...days, [day]: { ...currentSched, close: e.target.value } };
                      setDays(updatedDays);
                      emitUpdate(mode, timezone, everyday, weekdays, weekends, updatedDays, manualText);
                    }} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const newStatus = isClosed ? 'open' as const : 'closed' as const;
                    const updatedDays = { ...days, [day]: { ...currentSched, status: newStatus } };
                    setDays(updatedDays);
                    emitUpdate(mode, timezone, everyday, weekdays, weekends, updatedDays, manualText);
                  }}
                  style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: isClosed ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)', color: isClosed ? '#ef4444' : '#10b981', border: 'none', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                >
                  {isClosed ? 'Buka' : 'Tutup'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE 4: MANUAL TEXT */}
      {mode === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Teks Jam Operasional Bebas</label>
          <input 
            type="text"
            className="form-input"
            placeholder="Contoh: 08:00 - 21:00 WIB (Buka Setiap Hari)"
            value={manualText}
            onChange={(e) => {
              const val = e.target.value;
              setManualText(val);
              emitUpdate(mode, timezone, everyday, weekdays, weekends, days, val);
            }}
          />
        </div>
      )}

      {/* LIVE PREVIEW BOX */}
      <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-light)' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.5rem' }}>
          👁️ Live Preview Tampilan Publik
        </span>
        <OperationalHoursCard rawHours={value} />
      </div>
    </div>
  );
}