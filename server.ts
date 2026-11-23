import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';

interface CommunityMember {
  id: string;
  nick: string;
  registeredAt: string;
  verified: boolean;
}

interface AliveWebSocket extends WebSocket {
  isAlive?: boolean;
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadMembers(): CommunityMember[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(MEMBERS_FILE)) {
      fs.writeFileSync(MEMBERS_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(MEMBERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CommunityMember =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.nick === 'string' &&
        typeof item.registeredAt === 'string'
    );
  } catch (err) {
    console.error('Erro ao ler members.json:', err);
    return [];
  }
}

function saveMembers(members: CommunityMember[]): void {
  ensureDataDir();
  const tmpFile = `${MEMBERS_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(members, null, 2), 'utf-8');
  fs.renameSync(tmpFile, MEMBERS_FILE);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  let members: CommunityMember[] = loadMembers();

  const getOnlineCount = (): number => {
    let count = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        count += 1;
      }
    });
    return count;
  };

  const buildStatePayload = () => ({
    type: 'state' as const,
    onlineCount: getOnlineCount(),
    totalRegistered: members.length,
    members,
  });

  const broadcastState = () => {
    const payload = JSON.stringify(buildStatePayload());
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  wss.on('connection', (ws: AliveWebSocket) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('error', () => {
      // Errors are handled gracefully and socket cleanup triggers on close
    });

    ws.on('close', () => {
      broadcastState();
    });

    // Notify all connected clients (including the newly connected one)
    broadcastState();
  });

  // Real heartbeat to purge dead/dropped connections promptly
  const heartbeatInterval = setInterval(() => {
    let terminatedAny = false;
    wss.clients.forEach((client) => {
      const aliveClient = client as AliveWebSocket;
      if (aliveClient.isAlive === false) {
        terminatedAny = true;
        aliveClient.terminate();
        return;
      }
      aliveClient.isAlive = false;
      aliveClient.ping();
    });
    if (terminatedAny) {
      broadcastState();
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Public REST API: returns real current online count and real registered members
  app.get('/api/community', (_req, res) => {
    res.json({
      onlineCount: getOnlineCount(),
      totalRegistered: members.length,
      members,
    });
  });

  // Public REST API: registers ONLY public nick & timestamp (never email/password)
  app.post('/api/members', (req, res) => {
    const body = req.body as { id?: unknown; nick?: unknown; registeredAt?: unknown };
    const rawNick = typeof body?.nick === 'string' ? body.nick.trim() : '';

    if (!rawNick) {
      res.status(400).json({ error: 'Nome, apelido ou nick é obrigatório.' });
      return;
    }

    const sanitizedNick = rawNick.slice(0, 80);
    const id =
      typeof body?.id === 'string' && body.id.trim()
        ? body.id.trim().slice(0, 80)
        : `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Idempotent check to prevent duplicate entries on retries
    const existing = members.find((m) => m.id === id);
    if (existing) {
      res.status(200).json({
        member: existing,
        onlineCount: getOnlineCount(),
        totalRegistered: members.length,
        members,
      });
      return;
    }

    const registeredAt =
      typeof body?.registeredAt === 'string' && !Number.isNaN(Date.parse(body.registeredAt))
        ? body.registeredAt
        : new Date().toISOString();

    const newMember: CommunityMember = {
      id,
      nick: sanitizedNick,
      registeredAt,
      verified: true,
    };

    members = [newMember, ...members];
    saveMembers(members);
    broadcastState();

    res.status(201).json({
      member: newMember,
      onlineCount: getOnlineCount(),
      totalRegistered: members.length,
      members,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Acesso Grátis server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Acesso Grátis server:', err);
  process.exit(1);
});
