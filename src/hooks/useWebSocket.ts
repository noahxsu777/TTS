import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSMessage } from '../types';

export type WSStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface Options {
  onMessage?: (msg: WSMessage) => void;
  maxReconnectAttempts?: number;
}

const RECONNECT_DELAYS = [0, 500, 1000, 2000, 4000, 8000, 15000, 30000]; // ms

export function useWebSocket(url: string, options: Options = {}) {
  const { onMessage, maxReconnectAttempts = 999 } = options;
  const wsRef      = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMsgRef   = useRef(onMessage);
  const mountedRef = useRef(true);
  const urlRef     = useRef(url);
  urlRef.current   = url;
  onMsgRef.current = onMessage;

  const [status, setStatus] = useState<WSStatus>('idle');

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    clearTimer();
    setStatus('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(urlRef.current);
    } catch {
      setStatus('error');
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setStatus('open');
      attemptRef.current = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const msg: WSMessage = JSON.parse(ev.data as string);
        // Reply to server pings with pong
        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pong', ts: msg.ts }));
          return;
        }
        onMsgRef.current?.(msg);
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      if (mountedRef.current) setStatus('error');
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!mountedRef.current) return;
      setStatus('closed');
      scheduleReconnect();
    };
  }, []); // stable — no deps change

  const scheduleReconnect = () => {
    if (!mountedRef.current) return;
    if (attemptRef.current >= maxReconnectAttempts) return;
    const delay = RECONNECT_DELAYS[Math.min(attemptRef.current, RECONNECT_DELAYS.length - 1)];
    attemptRef.current += 1;
    timerRef.current = setTimeout(connect, delay);
  };

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify(data)); } catch { /* ignore */ }
    }
  }, []);

  const forceReconnect = useCallback(() => {
    attemptRef.current = 0;
    wsRef.current?.close();
  }, []);

  // Initial connect + cleanup
  useEffect(() => {
    mountedRef.current = true;
    connect();

    // Reconnect when tab regains focus
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING) {
          attemptRef.current = 0;
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // Reconnect on network recovery
    const onOnline = () => { attemptRef.current = 0; connect(); };
    window.addEventListener('online', onOnline);

    return () => {
      mountedRef.current = false;
      clearTimer();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, send, forceReconnect };
}
