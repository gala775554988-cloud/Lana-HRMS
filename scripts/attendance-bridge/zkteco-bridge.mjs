#!/usr/bin/env node
import http from 'node:http';
import { createServer } from 'node:http';

const config = {
  deviceIp: process.env.ZKTECO_IP || '192.168.0.201',
  devicePort: Number(process.env.ZKTECO_PORT || 8081),
  listenPort: Number(process.env.BRIDGE_LISTEN_PORT || 8081),
  lanaUrl: (process.env.LANA_URL || 'https://lana-hrms.vercel.app').replace(/\/$/, ''),
  token: process.env.ATTENDANCE_BRIDGE_TOKEN || '',
  deviceName: process.env.ZKTECO_DEVICE_NAME || 'ZKTeco Main Branch',
};

function parseForm(text) {
  const params = new URLSearchParams(text);
  return Object.fromEntries(params.entries());
}

function parseZktecoPayload(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    if (line.includes('\t')) {
      const cells = line.split('\t');
      rows.push({ userId: cells[0], timestamp: cells[1], punchType: cells[2], raw: line });
    } else if (line.includes(',')) {
      const cells = line.split(',');
      rows.push({ userId: cells[0], timestamp: cells[1], punchType: cells[2], raw: line });
    } else if (line.includes('=')) {
      rows.push(parseForm(line));
    }
  }
  return rows;
}

async function sendToLana(records) {
  if (!config.token) throw new Error('ATTENDANCE_BRIDGE_TOKEN is required');
  const response = await fetch(`${config.lanaUrl}/api/attendance/biometric/zkteco`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ deviceIp: config.deviceIp, deviceName: config.deviceName, records }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Lana API ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

const server = createServer(async (req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const body = Buffer.concat(chunks).toString('utf8');
    try {
      // ZKTeco ADMS health/config endpoints. Keep device connected without failing.
      if (req.url?.startsWith('/iclock/getrequest')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
        return;
      }
      const records = parseZktecoPayload(body);
      if (records.length) {
        const result = await sendToLana(records);
        console.log(new Date().toISOString(), 'sent', records.length, result);
      } else {
        console.log(new Date().toISOString(), 'received no attendance rows', req.method, req.url, body.slice(0, 200));
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } catch (error) {
      console.error(new Date().toISOString(), error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('ERROR');
    }
  });
});

server.listen(config.listenPort, '0.0.0.0', () => {
  console.log(`Lana ZKTeco Bridge listening on 0.0.0.0:${config.listenPort}`);
  console.log(`Device IP expected: ${config.deviceIp}:${config.devicePort}`);
  console.log(`Lana URL: ${config.lanaUrl}`);
});
