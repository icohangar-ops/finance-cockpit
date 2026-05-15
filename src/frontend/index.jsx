import {
  render, Dashboard, DashboardPanel, Text, Heading, Strong, Badge,
  ProgressBar, StatusLozenge, SectionMessage, Table, Head, Cell, Row,
} from '@forge/ui';

function fmt(n) {
  if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export const handler = async ({ budget, burnRate, cashForecast, workingCapital, projectKey, source }) => {
  const pct = Math.round((budget.spent / budget.total) * 100);
  const bs = pct > 90 ? 'removed' : pct > 70 ? 'moved' : 'added';
  const cccC = workingCapital.ccc > 30 ? 'red' : workingCapital.ccc > 20 ? 'yellow' : 'green';

  return (
    <Dashboard>
      <DashboardPanel>
        <Heading size="small">Budget — {budget.period}</Heading>
        <Text>Total: <Strong>{fmt(budget.total)}</Strong></Text>
        <ProgressBar value={pct} />
        <Text>Spent: {fmt(budget.spent)} ({pct}%) · Remaining: {fmt(budget.remaining)}</Text>
        <StatusLozenge text={pct > 90 ? 'Over Budget Risk' : pct > 70 ? 'On Track' : 'Healthy'} appearance={bs} />
      </DashboardPanel>

      <DashboardPanel>
        <Heading size="small">Burn Rate</Heading>
        <Text><Strong>{fmt(burnRate.monthly)}</Strong> / month</Text>
        <Text><Strong>{fmt(burnRate.weekly)}</Strong> / week</Text>
        <Badge text={burnRate.trend} appearance={burnRate.trend === 'stable' ? 'default' : burnRate.trend === 'decreasing' ? 'success' : 'removed'} />
        <Text>Runway: <Strong>{burnRate.runwayMonths} months</Strong></Text>
      </DashboardPanel>

      <DashboardPanel>
        <Heading size="small">13-Week Cash Forecast</Heading>
        <Text>Current: <Strong>{fmt(cashForecast.currentBalance)}</Strong></Text>
        <Text>Min Projected: <Strong>{fmt(cashForecast.minProjected)}</Strong> (Wk {cashForecast.minWeek})</Text>
        <Text>End Position: <Strong>{fmt(cashForecast.endPosition)}</Strong></Text>
        {cashForecast.hasWorkingCapitalRisk && (
          <SectionMessage appearance="warning">
            Working capital risk in weeks: {cashForecast.riskWeeks.join(', ')}
          </SectionMessage>
        )}
      </DashboardPanel>

      <DashboardPanel>
        <Heading size="small">Working Capital — Score: {workingCapital.score}/100</Heading>
        <ProgressBar value={workingCapital.score} />
        <Table>
          <Head>
            <Cell><Text size="small"><Strong>DSO</Strong></Text></Cell>
            <Cell><Text size="small"><Strong>DPO</Strong></Text></Cell>
            <Cell><Text size="small"><Strong>DIO</Strong></Text></Cell>
            <Cell><Text size="small"><Strong>CCC</Strong></Text></Cell>
          </Head>
          <Row>
            <Cell><Text>{workingCapital.dso}d</Text></Cell>
            <Cell><Text>{workingCapital.dpo}d</Text></Cell>
            <Cell><Text>{workingCapital.dio}d</Text></Cell>
            <Cell><Text><Strong style={{color:cccC}}>{workingCapital.ccc}d</Strong></Text></Cell>
          </Row>
        </Table>
        {workingCapital.recommendations?.length > 0 && (
          <SectionMessage title="Optimization Opportunities" appearance="info">
            {workingCapital.recommendations.map((r, i) => (
              <Text key={i}>• {r.action} → <Strong>{fmt(r.savings)}/yr</Strong></Text>
            ))}
          </SectionMessage>
        )}
      </DashboardPanel>

      <Text appearance="subtle">Source: {source} · Project: {projectKey}</Text>
    </Dashboard>
  );
};

export default handler;
