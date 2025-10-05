export type AuditResult = {
  key: string;
  title: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  metric?: string | number;
  why?: string;
  how_to_fix?: string;
  details?: Record<string, unknown>;
  category: 'data_quality' | 'strategy' | 'signal' | 'technical';
  severity: 'critical' | 'warning' | 'info';
};

type Inputs = {
  responseRate30d?: { response_rate: number; responses: number; invites: number };
  verbatim90d?: { verbatim_share: number; responses: number };
  fatigue30d?: Array<{ user_id: string; responses_30d: number }>;
  channelMix90d?: Array<{ channel: string; responses: number }>;
  npsWoW?: { wow_stddev: number; total_n: number };
  haveEvents?: boolean;
  haveDevices?: boolean;
  haveLocales?: boolean;
  totalResponses?: number;
  avgNpsScore?: number;
  completionTime?: number;
  segmentCoverage?: Array<{ segment: string; coverage: number }>;
};

export function runAudit(i: Inputs): AuditResult[] {
  const out: AuditResult[] = [];

  // 1) Response rate
  if (i.responseRate30d) {
    const rr = i.responseRate30d.response_rate;
    let status: AuditResult['status'] = rr >= 0.20 ? 'pass' : rr >= 0.10 ? 'warn' : 'fail';
    out.push({
      key: 'response_rate',
      title: 'Response Rate (30 days)',
      status,
      category: 'data_quality',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `${(rr * 100).toFixed(1)}%`,
      why: `You invited ${i.responseRate30d.invites} and received ${i.responseRate30d.responses} responses.`,
      how_to_fix: status === 'pass' 
        ? 'Keep steady volume and sampling. Consider A/B testing different invitation timing.'
        : status === 'warn'
        ? 'Add in-app triggers at key moments and send 1 email reminder at +48h. Test different subject lines.'
        : 'Add in-app triggers at key moments, send 1 email reminder at +48h, and consider SMS follow-up. Test different invitation timing and messaging.'
    });
  } else {
    out.push({ 
      key: 'response_rate', 
      title: 'Response Rate (30 days)', 
      status: 'skip', 
      category: 'data_quality',
      severity: 'info',
      why: 'Missing invites/responses data.' 
    });
  }

  // 2) Verbatim health
  if (i.verbatim90d) {
    const vs = i.verbatim90d.verbatim_share;
    const status = vs >= 0.55 ? 'pass' : vs >= 0.35 ? 'warn' : 'fail';
    out.push({
      key: 'verbatim_share',
      title: 'Verbatim Comment Rate (90 days)',
      status,
      category: 'data_quality',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `${(vs * 100).toFixed(1)}%`,
      why: `${i.verbatim90d.responses} responses with ${(vs * 100).toFixed(1)}% having comments.`,
      how_to_fix: status === 'pass'
        ? 'Great! Keep the open-ended prompt concise and engaging.'
        : status === 'warn'
        ? 'Shorten prompt, reassure "2 clicks, 10 seconds," and ask one follow-up like "What\'s the main reason?"'
        : 'Shorten prompt significantly, add reassurance about time, and consider a two-step approach: score first, then optional comment.'
    });
  } else {
    out.push({ 
      key: 'verbatim_share', 
      title: 'Verbatim Comment Rate (90 days)', 
      status: 'skip', 
      category: 'data_quality',
      severity: 'info',
      why: 'Missing comments data.' 
    });
  }

  // 3) Survey fatigue
  if (i.fatigue30d) {
    const over2 = i.fatigue30d.filter(r => r.responses_30d >= 2).length;
    const status = over2 === 0 ? 'pass' : over2 <= 5 ? 'warn' : 'fail';
    out.push({
      key: 'fatigue',
      title: 'Survey Fatigue (30 days)',
      status,
      category: 'strategy',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `${over2} users ≥2 surveys`,
      why: `${over2} users have been surveyed multiple times in the last 30 days.`,
      how_to_fix: status === 'pass'
        ? 'Cadence looks healthy. Continue monitoring.'
        : status === 'warn'
        ? 'Throttle to max 1 survey per user per 30 days; exclude freshly surveyed users.'
        : 'Implement strict throttling: max 1 survey per user per 30 days. Add user exclusion logic for recently surveyed users.'
    });
  } else {
    out.push({ 
      key: 'fatigue', 
      title: 'Survey Fatigue (30 days)', 
      status: 'skip', 
      category: 'strategy',
      severity: 'info',
      why: 'Missing respondent frequency data.' 
    });
  }

  // 4) Channel mix
  if (i.channelMix90d) {
    const total = i.channelMix90d.reduce((a, c) => a + c.responses, 0) || 1;
    const inapp = i.channelMix90d.find(c => c.channel === 'in_app')?.responses ?? 0;
    const email = i.channelMix90d.find(c => c.channel === 'email')?.responses ?? 0;
    const inappShare = inapp / total;
    const emailShare = email / total;
    const status = inappShare >= 0.5 ? 'pass' : inappShare >= 0.3 ? 'warn' : 'fail';
    out.push({
      key: 'channel_mix',
      title: 'Channel Mix',
      status,
      category: 'strategy',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `In-app ${(inappShare * 100).toFixed(0)}%, Email ${(emailShare * 100).toFixed(0)}%`,
      why: `Current mix: ${(inappShare * 100).toFixed(0)}% in-app, ${(emailShare * 100).toFixed(0)}% email.`,
      how_to_fix: inappShare >= 0.5 
        ? 'Balanced mix. Consider testing different in-app trigger points.'
        : 'Add in-app intercepts on active screens to lift volume. Email-only surveys often have lower response rates.'
    });
  } else {
    out.push({ 
      key: 'channel_mix', 
      title: 'Channel Mix', 
      status: 'skip', 
      category: 'strategy',
      severity: 'info',
      why: 'Missing channel data.' 
    });
  }

  // 5) NPS stability
  if (i.npsWoW) {
    const { wow_stddev, total_n } = i.npsWoW;
    const status = total_n < 100 ? (wow_stddev > 8 ? 'warn' : 'pass') : (wow_stddev > 8 ? 'fail' : 'pass');
    out.push({
      key: 'stability',
      title: 'NPS Stability (Week-over-Week)',
      status,
      category: 'signal',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `σ=${wow_stddev.toFixed(1)} (n=${total_n})`,
      why: `Week-over-week standard deviation is ${wow_stddev.toFixed(1)} points with ${total_n} total responses.`,
      how_to_fix: status === 'pass'
        ? 'Stable trend. Continue monitoring for any significant changes.'
        : 'Review trigger timing, ensure randomization, and avoid "all-hands" blasts tied to product changes. Consider segmenting by user type.'
    });
  } else {
    out.push({ 
      key: 'stability', 
      title: 'NPS Stability (Week-over-Week)', 
      status: 'skip', 
      category: 'signal',
      severity: 'info',
      why: 'Insufficient history.' 
    });
  }

  // 6) Completion time
  if (i.completionTime) {
    const status = i.completionTime <= 25 ? 'pass' : i.completionTime <= 45 ? 'warn' : 'fail';
    out.push({
      key: 'completion_time',
      title: 'Survey Completion Time',
      status,
      category: 'data_quality',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `${i.completionTime.toFixed(1)}s average`,
      why: `Average completion time is ${i.completionTime.toFixed(1)} seconds.`,
      how_to_fix: status === 'pass'
        ? 'Good completion time. Keep surveys concise.'
        : status === 'warn'
        ? 'Consider shortening survey or improving UX. Test different question formats.'
        : 'Survey is too long or complex. Reduce to 2-3 questions maximum. Test different question formats and layouts.'
    });
  } else {
    out.push({ 
      key: 'completion_time', 
      title: 'Survey Completion Time', 
      status: 'skip', 
      category: 'data_quality',
      severity: 'info',
      why: 'Missing completion time data.' 
    });
  }

  // 7) Segment coverage
  if (i.segmentCoverage && i.segmentCoverage.length > 0) {
    const lowCoverage = i.segmentCoverage.filter(s => s.coverage < 0.1);
    const status = lowCoverage.length === 0 ? 'pass' : lowCoverage.length <= 2 ? 'warn' : 'fail';
    out.push({
      key: 'segment_coverage',
      title: 'Segment Coverage',
      status,
      category: 'strategy',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `${lowCoverage.length} segments <10% coverage`,
      why: `${lowCoverage.length} segments have less than 10% coverage.`,
      how_to_fix: status === 'pass'
        ? 'Good segment coverage. Continue monitoring.'
        : 'Increase sampling for underrepresented segments. Consider targeted surveys for key segments.'
    });
  } else {
    out.push({ 
      key: 'segment_coverage', 
      title: 'Segment Coverage', 
      status: 'skip', 
      category: 'strategy',
      severity: 'info',
      why: 'Missing segment coverage data.' 
    });
  }

  // 8) Touchpoints / devices / locales – presence only (data inventory)
  out.push({
    key: 'touchpoints',
    title: 'Touchpoint Coverage',
    status: i.haveEvents ? 'pass' : 'warn',
    category: 'technical',
    severity: i.haveEvents ? 'info' : 'warning',
    why: i.haveEvents ? 'Good: events available for trigger analysis.' : 'Missing event tracking data.',
    how_to_fix: i.haveEvents 
      ? 'Good: events available for trigger analysis.' 
      : 'Track key events (signup, activation, feature usage, support). Use them as survey triggers.'
  });

  out.push({
    key: 'device_locale',
    title: 'Device/Locale Coverage',
    status: (i.haveDevices && i.haveLocales) ? 'pass' : 'warn',
    category: 'technical',
    severity: (i.haveDevices && i.haveLocales) ? 'info' : 'warning',
    why: (i.haveDevices && i.haveLocales) ? 'Good coverage tracking.' : 'Missing device/locale data.',
    how_to_fix: (i.haveDevices && i.haveLocales) 
      ? 'Good coverage tracking.' 
      : 'Capture device and locale in responses to detect skew and ensure representative sampling.'
  });

  // 9) Overall data volume
  if (i.totalResponses) {
    const status = i.totalResponses >= 1000 ? 'pass' : i.totalResponses >= 500 ? 'warn' : 'fail';
    out.push({
      key: 'data_volume',
      title: 'Data Volume',
      status,
      category: 'data_quality',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `${i.totalResponses.toLocaleString()} responses`,
      why: `Total responses: ${i.totalResponses.toLocaleString()}.`,
      how_to_fix: status === 'pass'
        ? 'Good data volume for reliable insights.'
        : status === 'warn'
        ? 'Consider increasing survey frequency or expanding target audience.'
        : 'Increase survey frequency, expand target audience, or consider different survey strategies.'
    });
  }

  // 10) NPS score distribution
  if (i.avgNpsScore !== undefined) {
    const status = i.avgNpsScore >= 0 ? 'pass' : i.avgNpsScore >= -10 ? 'warn' : 'fail';
    out.push({
      key: 'nps_distribution',
      title: 'NPS Score Distribution',
      status,
      category: 'signal',
      severity: status === 'fail' ? 'critical' : status === 'warn' ? 'warning' : 'info',
      metric: `Average: ${i.avgNpsScore.toFixed(1)}`,
      why: `Average NPS score is ${i.avgNpsScore.toFixed(1)}.`,
      how_to_fix: status === 'pass'
        ? 'Good NPS distribution. Continue monitoring trends.'
        : status === 'warn'
        ? 'Monitor for improvement trends. Consider segment analysis.'
        : 'Focus on improving customer experience. Analyze detractors and implement feedback loops.'
    });
  }

  return out;
}
